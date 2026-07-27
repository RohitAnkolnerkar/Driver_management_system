from app.models.driver import Driver
from app.models.trip import Trip


def register_and_login(client, username="dispatcher1", role="dispatcher"):
    client.post(
        "/users/",
        json={
            "username": username,
            "password": "Test@1234",
            "email": f"{username}@test.com",
            "role": role,
        },
    )
    res = client.post(
        "/auth/token", data={"username": username, "password": "Test@1234"}
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_recommend_drivers_ranking(client, db_session):
    token = register_and_login(client, "disp_match1", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 drivers
    d1 = Driver(
        name="Driver Proximity",
        phone="9988776611",
        status="available",
        vehicle_type="cargo_truck",
    )
    d2 = Driver(
        name="Driver Far",
        phone="9988776622",
        status="available",
        vehicle_type="mini_van",
    )
    db_session.add_all([d1, d2])
    db_session.commit()

    # Create trip
    trip = Trip(source="Mumbai", destination="Pune", status="created")
    db_session.add(trip)
    db_session.commit()

    res = client.get(f"/trips/{trip.id}/recommend-drivers", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["trip_id"] == trip.id
    assert len(data["candidates"]) >= 2
    # Candidates should be sorted by total_score descending
    assert data["candidates"][0]["total_score"] >= data["candidates"][1]["total_score"]


def test_auto_dispatch_trip(client, db_session):
    token = register_and_login(client, "disp_match2", "dispatcher")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(
        name="Available Star Driver",
        phone="9988776633",
        status="available",
        vehicle_type="cargo_truck",
    )
    db_session.add(driver)
    db_session.commit()

    trip = Trip(source="Delhi Depot", destination="Agra Hub", status="created")
    db_session.add(trip)
    db_session.commit()

    res = client.post(f"/trips/{trip.id}/auto-dispatch", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["trip_id"] == trip.id
    assert data["assigned_driver_id"] == driver.id
    assert data["assigned_driver_name"] == "Available Star Driver"
    assert data["match_score"] > 0

    db_session.refresh(trip)
    db_session.refresh(driver)
    assert trip.status == "assigned"
    assert trip.driver_id == driver.id
    assert driver.status == "on_trip"
