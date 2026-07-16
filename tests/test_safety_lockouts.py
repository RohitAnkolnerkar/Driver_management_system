from app.models.trip import Trip


def create_user_helper(client, username="lockout_disp", role="dispatcher"):
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


def test_vehicle_maintenance_overdue_lockout(client, db_session):
    # Setup dispatcher
    token = create_user_helper(client, "lockout_disp1", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a vehicle
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Volvo",
            "model": "FH16",
            "year": 2022,
            "license_plate": "LOCK-01-AB",
            "odometer_km": 11000.0,  # Exceeds 10,000km default threshold without logs
            "status": "active",
        },
        headers=headers,
    )
    assert veh_res.status_code == 201
    vehicle_id = veh_res.json()["id"]

    # 2. Create driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Lock Driver",
            "phone": "9991112222",
            "license_number": "DL-12-2020-0000101",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "lock_driver1",
            "password": "password123",
            "odometer_km": 1000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # 3. Create trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal A",
            "destination": "Terminal B",
            "distance_km": 10.0,
            "duration_minutes": 20,
            "estimated_fare": 300.0,
        },
        headers=headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # 4. Attempt to assign trip with this overdue vehicle
    assign_res = client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver_id, "vehicle_id": vehicle_id},
        headers=headers,
    )
    # Must fail with 400 because vehicle exceeds 5,000 km threshold
    # without service history
    assert assign_res.status_code == 400
    assert "overdue for maintenance" in assign_res.json()["detail"]


def test_driver_fatigue_safety_lockout(client, db_session):
    # Setup dispatcher
    token = create_user_helper(client, "lockout_disp2", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    # Create driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Tired Driver",
            "phone": "9991113333",
            "license_number": "DL-12-2020-0000102",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "lock_driver2",
            "password": "password123",
            "odometer_km": 1000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Create a vehicle to avoid maintenance lockout
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Volvo",
            "model": "FH16",
            "year": 2022,
            "license_plate": "LOCK-02-CD",
            "odometer_km": 1000.0,  # 1000km, which is < 5000 threshold
            "status": "active",
        },
        headers=headers,
    )
    assert veh_res.status_code == 201
    vehicle_id = veh_res.json()["id"]

    # Create a completed trip for this driver that took 9 hours
    # (540 minutes) in the last 24h
    from datetime import timedelta

    from app.core.time_utils import get_now_ist_naive

    trip = Trip(
        source="Factory A",
        destination="Factory B",
        distance_km=100.0,
        status="completed",
        driver_id=driver_id,
        vehicle_id=vehicle_id,
        duration_minutes=540,  # 9 hours
        start_time=get_now_ist_naive() - timedelta(hours=5),
        end_time=get_now_ist_naive() - timedelta(hours=4),
        created_at=get_now_ist_naive() - timedelta(hours=6),
    )
    db_session.add(trip)
    db_session.commit()

    # Now create another trip and try to assign this tired driver
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal A",
            "destination": "Terminal B",
            "distance_km": 10.0,
            "duration_minutes": 20,
            "estimated_fare": 300.0,
        },
        headers=headers,
    )
    assert trip_res.status_code == 200
    new_trip_id = trip_res.json()["id"]

    # Attempt to assign
    assign_res = client.patch(
        f"/trips/{new_trip_id}/assign",
        json={"driver_id": driver_id, "vehicle_id": vehicle_id},
        headers=headers,
    )
    assert assign_res.status_code == 400
    assert "exceeded daily driving limit" in assign_res.json()["detail"]
