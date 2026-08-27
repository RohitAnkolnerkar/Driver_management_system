from app.models.trip import Trip


def create_user_helper(client, username, role, phone=None):
    client.post(
        "/users/",
        json={
            "username": username,
            "password": "password123",
            "email": f"{username}@example.com",
            "role": role,
            "phone": phone,
        },
    )
    res = client.post(
        "/auth/token",
        data={"username": username, "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_trip_creation_with_cargo_specifications(client, db_session):
    # 1. Register dispatcher
    t_disp = create_user_helper(client, "cargo_disp", "dispatcher")

    # 2. Create a trip with cargo weight and volume
    headers_disp = {"Authorization": f"Bearer {t_disp}"}
    res = client.post(
        "/trips/",
        json={
            "source": "Mumbai Terminal",
            "destination": "Pune Terminal",
            "distance_km": 150.0,
            "duration_minutes": 180,
            "estimated_fare": 3000.0,
            "is_regular": False,
            "priority": "high",
            "cargo_weight_kg": 1200.0,
            "cargo_volume_m3": 7.5,
        },
        headers=headers_disp,
    )
    assert res.status_code == 200
    trip_data = res.json()
    assert trip_data["cargo_weight_kg"] == 1200.0
    assert trip_data["cargo_volume_m3"] == 7.5

    # 3. Verify in database
    db_trip = db_session.query(Trip).filter(Trip.id == trip_data["id"]).first()
    assert db_trip is not None
    assert db_trip.cargo_weight_kg == 1200.0
    assert db_trip.cargo_volume_m3 == 7.5
