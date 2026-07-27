from datetime import timedelta

from app.core.time_utils import get_now_ist_naive
from app.models.trip import Trip


def create_admin_helper(client, username="payout_audit_admin"):
    # Register and login admin
    client.post(
        "/users/",
        json={
            "username": username,
            "password": "admin_password",
            "email": f"{username}@example.com",
            "role": "admin",
        },
    )
    res = client.post(
        "/auth/token",
        data={"username": username, "password": "admin_password"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_audit_aware_payouts_and_divergence_penalties(client, db_session):
    token = create_admin_helper(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Setup driver and assigned vehicle
    # Create vehicle
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "BharatBenz",
            "model": "1617R",
            "year": 2024,
            "license_plate": "MH-12-PP-1111",
            "odometer_km": 1000.0,
            "status": "active",
        },
        headers=headers,
    )
    assert veh_res.status_code == 201
    vehicle_id = veh_res.json()["id"]

    # Create driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Arjun",
            "phone": "9995554444",
            "license_number": "MH-12-2022-0000088",
            "license_expiry": "2035-01-01T00:00:00",
            "username": "arjun_driver",
            "password": "driver_password",
            "odometer_km": 1000.0,
            "vehicle_type": "cargo_truck",
            "base_salary": 15000.0,
            "commission_percentage": 10.0,
            "vehicle_id": vehicle_id,
        },
        headers=headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # 2. Create Trip 1: Standard trip (will pass audit)
    future_time = get_now_ist_naive() + timedelta(days=1)
    trip1_res = client.post(
        "/trips/",
        json={
            "source": "Mumbai Depot",
            "destination": "Thane Warehouse",
            "distance_km": 30.0,
            "duration_minutes": 60,
            "estimated_fare": 2000.0,
            "scheduled_date": future_time.isoformat(),
        },
        headers=headers,
    )
    assert trip1_res.status_code == 200
    trip1_id = trip1_res.json()["id"]

    # 3. Create Trip 2: Detoured/Divergent trip (will fail audit due to GPS divergence)
    trip2_res = client.post(
        "/trips/",
        json={
            "source": "Mumbai Depot",
            "destination": "Panvel Warehouse",
            "distance_km": 40.0,
            "duration_minutes": 80,
            "estimated_fare": 3000.0,
            "scheduled_date": (future_time + timedelta(hours=2)).isoformat(),
        },
        headers=headers,
    )
    assert trip2_res.status_code == 200
    trip2_id = trip2_res.json()["id"]

    # Log in driver to record coordinates and start/complete trips
    driver_token = client.post(
        "/auth/token",
        data={"username": "arjun_driver", "password": "driver_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # Dispatch & Complete Trip 1
    client.patch(
        f"/trips/{trip1_id}/assign", json={"driver_id": driver_id}, headers=headers
    )
    client.patch(f"/trips/{trip1_id}/start", headers=headers)
    client.patch(
        f"/trips/{trip1_id}/complete", json={"note": "Clean delivery"}, headers=headers
    )

    # Dispatch Trip 2
    client.patch(
        f"/trips/{trip2_id}/assign", json={"driver_id": driver_id}, headers=headers
    )
    client.patch(f"/trips/{trip2_id}/start", headers=headers)

    # Simulate GPS location logs that calculate to a high detour distance for Trip 2
    client.post(
        "/drivers/location",
        json={"latitude": 19.0, "longitude": 72.8},
        headers=driver_headers,
    )
    client.post(
        "/drivers/location",
        json={"latitude": 19.2, "longitude": 73.0},
        headers=driver_headers,
    )
    client.post(
        "/drivers/location",
        json={"latitude": 19.4, "longitude": 73.2},
        headers=driver_headers,
    )

    # Complete Trip 2. The endpoint will compute actual distance from coordinate points
    # Let's override actual distance directly in DB to guarantee audit failure
    trip2 = db_session.query(Trip).filter(Trip.id == trip2_id).first()
    trip2.gps_distance_km = 60.0  # 1.5 ratio vs 40.0 planned
    trip2.status = "completed"
    trip2.end_time = get_now_ist_naive()
    trip2.audit_status = "failed_gps_divergence"
    trip2.payout_status = "hold_audit"
    db_session.commit()

    # Verify Trip 1 passed and Trip 2 failed GPS divergence
    t1_check = db_session.query(Trip).filter(Trip.id == trip1_id).first()
    assert t1_check.status == "completed"
    assert t1_check.payout_status == "pending"

    # Set Trip 1 end time in database to be during current month
    t1_check.end_time = get_now_ist_naive()
    db_session.commit()

    # 4. Generate payout draft
    pay_url = (
        f"/drivers/{driver_id}/payments/generate"
        f"?year={future_time.year}&month={future_time.month}"
    )
    pay_gen_res = client.post(pay_url, headers=headers)
    assert pay_gen_res.status_code == 200
    payout = pay_gen_res.json()

    # Arjun's base salary = 15000.
    # Trip 1 fare = 2000. 10% commission = 200.
    # Trip 2 fare = 3000. 10% commission = 300 (excluded: hold_audit).
    # So expected commission_paid = 200. Deductions = 0.
    # Scorecard bonus = 5% of total earnings (₹5000) = ₹250. Net Payout = 15450.0.
    assert payout["commission_paid"] == 200.0
    assert payout["bonus"] == 250.0
    assert payout["deductions"] == 0.0
    assert payout["total_paid"] == 15450.0
    assert "safety performance bonus" in payout["note"]

    # Delete the payout draft so we can regenerate it after resolving the audit
    delete_res = client.delete(f"/drivers/payments/{payout['id']}", headers=headers)
    assert delete_res.status_code == 200

    # 5. Dispatcher approves the trip payout manually
    approve_res = client.patch(
        f"/trips/{trip2_id}/payout-action",
        json={"action": "approve"},
        headers=headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["payout_status"] == "approved"

    # 6. Regenerate payout draft
    pay_gen_res2 = client.post(pay_url, headers=headers)
    assert pay_gen_res2.status_code == 200
    payout2 = pay_gen_res2.json()

    # Trip 1 commission = 200.
    # Trip 2 commission = 300 (included now since payout_status is approved!).
    # Total commission = 500.
    # Trip 2 has route divergence: planned=40 km, actual=60 km. Excess = 20 km.
    # Consumption rate for cargo_truck = 12.0 L/100km = 0.12 L/km.
    # Excess liters = 20 km * 0.12 L/km = 2.4 liters.
    # Diesel price default = 97.83.
    # Penalty cost = 2.4 * 97.83 = 234.79 INR.
    # Scorecard bonus = 5% of ₹5000 = ₹250 (due to audit pass rate = 50%).
    # Deductions should equal 234.79.
    # Net payout = 15000 + 500 (commission) + 250 (bonus) - 234.79 = 15515.21
    assert payout2["commission_paid"] == 500.0
    assert payout2["bonus"] == 250.0
    assert payout2["deductions"] == 234.79
    assert payout2["total_paid"] == 15515.21
    assert "₹234.79 unauthorized route divergence penalties" in payout2["note"]
