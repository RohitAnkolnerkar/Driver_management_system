from datetime import datetime


def create_user_helper(client, username="audit_disp", role="dispatcher"):
    res_create = client.post(
        "/users/",
        json={
            "username": username,
            "password": "test_password",
            "email": f"{username}@example.com",
            "role": role,
        },
    )
    assert res_create.status_code == 200
    res = client.post(
        "/auth/token",
        data={"username": username, "password": "test_password"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_maintenance_downtime_lifecycle(client, db_session):
    disp_token = create_user_helper(client, "maintenance_disp", "dispatcher")
    headers = {"Authorization": f"Bearer {disp_token}"}

    # 1. Create a vehicle
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Tata",
            "model": "Prima",
            "year": 2024,
            "license_plate": "MH-14-AA-9999",
            "odometer_km": 1000.0,
            "status": "active",
        },
        headers=headers,
    )
    assert veh_res.status_code == 201
    veh_id = veh_res.json()["id"]

    # 2. Log a pending maintenance (completed_at is null)
    m_res = client.post(
        f"/vehicles/{veh_id}/maintenance",
        json={
            "service_type": "engine",
            "description": "Checking engine knock",
            "cost": 0.0,
            "odometer_at_service": 1200.0,
            "service_date": datetime.utcnow().isoformat(),
        },
        headers=headers,
    )
    assert m_res.status_code == 201
    log_id = m_res.json()["id"]
    assert m_res.json()["completed_at"] is None

    # Check vehicle status is updated to "maintenance"
    veh_get = client.get(f"/vehicles/{veh_id}", headers=headers)
    assert veh_get.json()["status"] == "maintenance"
    assert veh_get.json()["odometer_km"] == 1200.0  # Synced to service odometer

    # 3. Complete the maintenance log
    comp_res = client.patch(
        f"/vehicles/maintenance/{log_id}/complete",
        json={
            "cost": 5000.0,
            "description": "Engine tuned, knock resolved",
            "next_service_due_odometer": 6200.0,
        },
        headers=headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["completed_at"] is not None
    assert comp_res.json()["cost"] == 5000.0

    # Check vehicle status returned to "active"
    veh_get2 = client.get(f"/vehicles/{veh_id}", headers=headers)
    assert veh_get2.json()["status"] == "active"


def test_utilization_analytics(client, db_session):
    disp_token = create_user_helper(client, "util_disp", "dispatcher")
    headers = {"Authorization": f"Bearer {disp_token}"}

    # Create vehicle
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Mahindra",
            "model": "Dost",
            "year": 2023,
            "license_plate": "MH-12-BB-8888",
            "odometer_km": 5000.0,
            "status": "active",
        },
        headers=headers,
    )
    veh_id = veh_res.json()["id"]

    # Retrieve utilization analytics
    anal_res = client.get(
        "/vehicles/utilization-analytics?period_days=30", headers=headers
    )
    assert anal_res.status_code == 200
    records = anal_res.json()
    assert len(records) > 0
    veh_record = next(r for r in records if r["vehicle_id"] == veh_id)
    assert veh_record["active_hours"] == 0.0
    assert veh_record["downtime_hours"] == 0.0
    assert veh_record["utilization_rate"] == 0.0
    assert veh_record["wear_alert_level"] == "low"


def test_personal_two_wheeler_fuel_deduction(client, db_session):
    disp_token = create_user_helper(client, "pay_disp", "dispatcher")
    headers = {"Authorization": f"Bearer {disp_token}"}

    # 1. Setup driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Ramesh",
            "phone": "9998887777",
            "license_number": "DL-12-2021-9999999",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "ramesh_driver",
            "password": "password123",
            "odometer_km": 1000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Setup a trip to satisfy the FK/API check
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Mumbai",
            "destination": "Pune",
            "distance_km": 150.0,
            "duration_minutes": 180,
            "estimated_fare": 4000.0,
        },
        headers=headers,
    )
    trip_id = trip_res.json()["id"]

    # 2. Driver logs personal fuel refuel for two-wheeler
    driver_token = client.post(
        "/auth/token",
        data={"username": "ramesh_driver", "password": "password123"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    fuel_res = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 12.0,
            "cost": 1200.0,
            "odometer": 1000.0,  # Odometer remains the same, doesn't progress
            "trip_id": trip_id,
            "is_personal_two_wheeler": True,
        },
        headers=driver_headers,
    )
    assert fuel_res.status_code == 200
    assert fuel_res.json()["is_flagged_fraud"] is False  # Bypassed audits!
    assert fuel_res.json()["is_personal_two_wheeler"] is True

    # Odometer of driver remains unchanged because it's a personal vehicle
    drv_get = client.get(f"/drivers/{driver_id}", headers=headers)
    assert drv_get.json()["odometer_km"] == 1000.0

    # 3. Generate monthly payout draft and check deduction
    now = datetime.utcnow()
    pay_res = client.post(
        f"/drivers/{driver_id}/payments/generate?year={now.year}&month={now.month}",
        headers=headers,
    )
    assert pay_res.status_code == 200
    payment = pay_res.json()
    assert payment["deductions"] == 1200.0  # Automatically deducted the 1200 INR cost!
