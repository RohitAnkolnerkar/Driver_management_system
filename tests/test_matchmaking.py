from app.models.driver import Driver
from app.models.trip import Trip


def create_user_helper(client, username="match_disp", role="dispatcher"):
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


def test_smart_matchmaking_ranking(client, db_session):
    # 1. Setup dispatcher
    token = create_user_helper(client, "dispatcher_match1", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create drivers:
    # Driver A: Near origin (18.51, 73.01), available, has vehicle
    driver_a_res = client.post(
        "/drivers/",
        json={
            "name": "Driver Near",
            "phone": "9990001111",
            "license_number": "DL-12-2020-0000001",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "driver_near",
            "password": "password123",
            "odometer_km": 5000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert driver_a_res.status_code == 200
    driver_a_id = driver_a_res.json()["id"]

    # Manually update location of Driver A to be near
    drv_a = db_session.query(Driver).filter(Driver.id == driver_a_id).first()
    drv_a.current_latitude = 18.51
    drv_a.current_longitude = 73.01
    drv_a.vehicle_id = 1  # give them some vehicle association
    db_session.commit()

    # Driver B: Far away (19.99, 74.99), available, no vehicle
    driver_b_res = client.post(
        "/drivers/",
        json={
            "name": "Driver Far",
            "phone": "9990002222",
            "license_number": "DL-12-2020-0000002",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "driver_far",
            "password": "password123",
            "odometer_km": 5000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert driver_b_res.status_code == 200
    driver_b_id = driver_b_res.json()["id"]

    drv_b = db_session.query(Driver).filter(Driver.id == driver_b_id).first()
    drv_b.current_latitude = 19.99
    drv_b.current_longitude = 74.99
    drv_b.vehicle_id = None
    db_session.commit()

    # 3. Create trip starting at (18.5, 73.0)
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Warehouse Central",
            "destination": "Airport Terminal",
            "distance_km": 15.0,
            "duration_minutes": 45,
            "estimated_fare": 600.0,
            "source_latitude": 18.50,
            "source_longitude": 73.00,
        },
        headers=headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # 4. Fetch recommendations
    recs_res = client.get(f"/trips/{trip_id}/match-recommendations", headers=headers)
    assert recs_res.status_code == 200
    recs = recs_res.json()

    # Verify that the nearest driver has a higher compatibility score
    assert len(recs) > 0
    # Driver A should be first recommended due to proximity (18.51, 73.01) and vehicle
    assert recs[0]["driver_id"] == driver_a_id
    assert recs[0]["score"] > 80

    # 5. Verify smart-match endpoint assigns Driver A
    match_res = client.post(f"/trips/{trip_id}/smart-match", headers=headers)
    assert match_res.status_code == 200
    assert match_res.json()["driver_id"] == driver_a_id

    # Verify trip status updated
    trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
    assert trip.driver_id == driver_a_id
    assert trip.status == "assigned"


def test_matchmaking_service_soon_warning(client, db_session):
    # 1. Setup dispatcher
    token = create_user_helper(client, "dispatcher_match2", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create vehicle with odometer close to default 10,000km threshold (e.g. 9600km)
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Eicher",
            "model": "Pro",
            "year": 2021,
            "license_plate": "WARN-99-CD",
            "odometer_km": 9600.0,
            "status": "active",
        },
        headers=headers,
    )
    assert veh_res.status_code == 201
    vehicle_id = veh_res.json()["id"]

    # 3. Create driver and link to this vehicle
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Soon Driver",
            "phone": "9998884321",
            "license_number": "DL-12-2020-0000301",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "soon_driver",
            "password": "password123",
            "odometer_km": 9600.0,
            "vehicle_type": "cargo_truck",
            "vehicle_id": vehicle_id,
        },
        headers=headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Update driver locations
    from app.models.driver import Driver

    drv = db_session.query(Driver).filter(Driver.id == driver_id).first()
    drv.current_latitude = 18.51
    drv.current_longitude = 73.01
    db_session.commit()

    # 4. Create trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Warehouse Central",
            "destination": "Airport Terminal",
            "distance_km": 15.0,
            "duration_minutes": 45,
            "estimated_fare": 600.0,
            "source_latitude": 18.50,
            "source_longitude": 73.00,
        },
        headers=headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # 5. Fetch recommendations
    recs_res = client.get(f"/trips/{trip_id}/match-recommendations", headers=headers)
    assert recs_res.status_code == 200
    recs = recs_res.json()
    assert len(recs) > 0
    rec = next(r for r in recs if r["driver_id"] == driver_id)

    # Check that warning reasons include service due soon warning
    assert any("service due soon" in reason for reason in rec["reasons"])
