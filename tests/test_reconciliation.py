from app.models.trip import Trip


def create_user_helper(client, username="fuel_test_user", role="dispatcher"):
    res_create = client.post(
        "/users/",
        json={
            "username": username,
            "password": "test_password",
            "email": f"{username}@example.com",
            "role": role,
        },
    )
    assert (
        res_create.status_code == 200
    ), f"User creation failed: {res_create.status_code} - {res_create.text}"
    res = client.post(
        "/auth/token",
        data={"username": username, "password": "test_password"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_reconciliation_gps_divergence(client, db_session):
    # Setup users
    dispatcher_token = create_user_helper(client, "reconcile_disp1", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Create driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Audit Driver",
            "phone": "9998887711",
            "license_number": "DL-12-2018-9999901",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "audit_driver1",
            "password": "audit_password",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # 1. Create a trip with planned distance of 10.0 km
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal X",
            "destination": "Warehouse Y",
            "distance_km": 10.0,
            "duration_minutes": 30,
            "estimated_fare": 500.0,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # Assign and start
    client.patch(
        f"/trips/{trip_id}/assign", json={"driver_id": driver_id}, headers=disp_headers
    )
    client.patch(f"/trips/{trip_id}/start", headers=disp_headers)

    # Simulate GPS detour coordinate logging (divergence: ~15km, ratio: 1.5 > 1.20)
    driver_token = client.post(
        "/auth/token",
        data={"username": "audit_driver1", "password": "audit_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # Post coordinates that calculate to ~15km distance
    # Let's say: [18.5, 73.1] -> [18.55, 73.15] -> [18.6, 73.2]
    client.post(
        "/drivers/location",
        json={"latitude": 18.5, "longitude": 73.1},
        headers=driver_headers,
    )
    client.post(
        "/drivers/location",
        json={"latitude": 18.55, "longitude": 73.15},
        headers=driver_headers,
    )
    client.post(
        "/drivers/location",
        json={"latitude": 18.6, "longitude": 73.2},
        headers=driver_headers,
    )

    # Complete the trip without custom odometer (it will fallback to
    # start odo + calculated GPS distance)
    complete_res = client.patch(
        f"/trips/{trip_id}/complete", json={"note": "finished"}, headers=disp_headers
    )
    assert complete_res.status_code == 200

    # Fetch trip and verify reconciliation failed
    db_trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
    assert db_trip.audit_status == "failed_gps_divergence"
    assert db_trip.payout_status == "hold_audit"


def test_reconciliation_odo_mismatch(client, db_session):
    dispatcher_token = create_user_helper(client, "reconcile_disp2", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Create driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Odo Driver",
            "phone": "9998887722",
            "license_number": "DL-12-2018-9999902",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "audit_driver2",
            "password": "audit_password",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Create trip with planned distance of 10.0 km
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal X",
            "destination": "Warehouse Y",
            "distance_km": 10.0,
            "duration_minutes": 30,
            "estimated_fare": 500.0,
        },
        headers=disp_headers,
    )
    trip_id = trip_res.json()["id"]

    client.patch(
        f"/trips/{trip_id}/assign", json={"driver_id": driver_id}, headers=disp_headers
    )
    client.patch(f"/trips/{trip_id}/start", headers=disp_headers)

    # Complete trip with a heavily mismatching odometer (e.g. 1080 km,
    # discrepancy: 80 km vs 10 km planned)
    complete_res = client.patch(
        f"/trips/{trip_id}/complete",
        json={"note": "finished", "odometer": 1080.0},
        headers=disp_headers,
    )
    assert complete_res.status_code == 200

    db_trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
    assert db_trip.audit_status == "failed_odo_mismatch"
    assert db_trip.payout_status == "hold_audit"

    # Now verify payout action: Dispatcher approves it manually
    approve_res = client.patch(
        f"/trips/{trip_id}/payout-action",
        json={"action": "approve"},
        headers=disp_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["payout_status"] == "approved"
