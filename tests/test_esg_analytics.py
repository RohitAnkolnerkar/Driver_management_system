from app.models.driver import Driver
from app.models.trip import Trip


def register_and_login(client, username="esg_user", role="dispatcher"):
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


def test_esg_analytics_endpoint(client, db_session):
    token = register_and_login(client, "esg_user1")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(name="Eco Driver", phone="9911223344", status="available")
    db_session.add(driver)
    db_session.commit()

    trip = Trip(
        driver_id=driver.id,
        source="Origin",
        destination="Destination",
        distance_km=200.0,
        fuel_consumed_liters=40.0,
        status="completed",
    )
    db_session.add(trip)
    db_session.commit()

    res = client.get("/esg/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_fleet_distance_km"] >= 200.0
    assert data["total_fuel_consumed_liters"] >= 40.0
    assert data["total_fleet_co2_kg"] > 0.0
    assert data["fleet_eco_score"] > 0.0
    assert len(data["sustainability_recommendations"]) == 3
