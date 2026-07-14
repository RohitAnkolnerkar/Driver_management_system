from app.core.security import hash_password
from app.models.user import User


def get_token(client, username="dispatcher", password="secret123"):
    login_data = {"username": username, "password": password}
    response = client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    return response.json()["access_token"]


def create_user_with_role(
    db_session,
    username="dispatcher",
    email="dispatcher@example.com",
    password="secret123",
    role="dispatcher",
):
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_vehicle_lifecycle(client, db_session):
    # Setup users
    create_user_with_role(db_session, role="dispatcher")
    token = get_token(client)

    # 1. Create a vehicle
    vehicle_payload = {
        "make": "Tata",
        "model": "Prima",
        "year": 2024,
        "license_plate": "MH-12-PQ-1234",
        "odometer_km": 1500.0,
        "status": "active",
    }
    response = client.post(
        "/vehicles/", json=vehicle_payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    vehicle = response.json()
    assert vehicle["make"] == "Tata"
    assert vehicle["license_plate"] == "MH-12-PQ-1234"
    assert vehicle["is_service_overdue"] is False  # Odometer (1500) < 10000 (default)

    # 2. Get list of vehicles
    response = client.get("/vehicles/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    vehicles = response.json()
    assert len(vehicles) >= 1
    assert any(v["license_plate"] == "MH-12-PQ-1234" for v in vehicles)

    # 3. Get vehicle details
    response = client.get(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["model"] == "Prima"

    # 4. Update vehicle details
    response = client.patch(
        f"/vehicles/{vehicle['id']}",
        json={"odometer_km": 2000.0, "status": "maintenance"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    updated_vehicle = response.json()
    assert updated_vehicle["odometer_km"] == 2000.0
    assert updated_vehicle["status"] == "maintenance"

    # 5. Delete vehicle
    response = client.delete(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Vehicle deleted successfully"

    # Verify deleted
    response = client.get(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


def test_vehicle_maintenance_and_alerts(client, db_session):
    create_user_with_role(db_session, role="dispatcher")
    token = get_token(client)

    # Create vehicle
    response = client.post(
        "/vehicles/",
        json={
            "make": "Mahindra",
            "model": "Blazo",
            "year": 2023,
            "license_plate": "MH-14-AB-5678",
            "odometer_km": 9500.0,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    vehicle = response.json()
    assert vehicle["is_service_overdue"] is False

    # Update odometer past 10000 km to trigger default alert
    response = client.patch(
        f"/vehicles/{vehicle['id']}",
        json={"odometer_km": 10500.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["is_service_overdue"] is True

    # Log maintenance to resolve alert and schedule next service
    maintenance_payload = {
        "service_type": "oil_change",
        "description": "Routine oil change and filter replacement",
        "cost": 4500.0,
        "odometer_at_service": 10500.0,
        "next_service_due_odometer": 20500.0,
    }
    response = client.post(
        f"/vehicles/{vehicle['id']}/maintenance",
        json=maintenance_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    log = response.json()
    assert log["service_type"] == "oil_change"
    assert log["cost"] == 4500.0

    # Fetch vehicle status again, is_service_overdue should now be False
    # (since 10500 < 20500 next due)
    response = client.get(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    updated_vehicle = response.json()
    assert updated_vehicle["is_service_overdue"] is False
    assert updated_vehicle["next_service_due_odometer"] == 20500.0

    # Fetch maintenance history
    response = client.get(
        f"/vehicles/{vehicle['id']}/maintenance",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["service_type"] == "oil_change"


def test_driver_assignment_and_odometer_sync(client, db_session):
    # Setup users/drivers
    create_user_with_role(db_session, role="dispatcher")
    token = get_token(client)

    driver_user = create_user_with_role(
        db_session,
        username="driver_test",
        email="driver_test@example.com",
        password="secret123",
        role="driver",
    )
    driver_token = get_token(client, username="driver_test")

    # Create vehicle
    response = client.post(
        "/vehicles/",
        json={
            "make": "Ashok Leyland",
            "model": "Dost",
            "year": 2022,
            "license_plate": "MH-43-XY-9999",
            "odometer_km": 5000.0,
            "status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    vehicle = response.json()

    # Create Driver with vehicle link
    response = client.post(
        "/drivers/",
        json={
            "name": "Suresh",
            "phone": "9999999999",
            "license_number": "DL-12-2018-7777777",
            "license_expiry": "2027-12-31T00:00:00",
            "user_id": driver_user.id,
            "vehicle_id": vehicle["id"],
            "vehicle_type": "cargo_truck",
            "odometer_km": 5000.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    driver = response.json()
    assert driver["vehicle_id"] == vehicle["id"]

    # 1. Test Fuel Log updates assigned vehicle's odometer
    response = client.post(
        "/fuel/fuel-logs",
        json={"liters_refueled": 40.0, "cost": 3600.0, "odometer": 5200.0},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert response.status_code == 200

    # Check that vehicle odometer updated to 5200.0
    response = client.get(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.json()["odometer_km"] == 5200.0

    # 2. Test Trip Completion updates assigned vehicle's odometer
    # Create and start a trip
    response = client.post(
        "/trips/",
        json={
            "source": "Mumbai",
            "destination": "Pune",
            "distance_km": 150.0,
            "duration_minutes": 180,
            "estimated_fare": 5000.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    trip = response.json()

    # Assign Suresh
    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Start trip
    client.patch(
        f"/trips/{trip['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    # Complete trip
    client.patch(
        f"/trips/{trip['id']}/complete", headers={"Authorization": f"Bearer {token}"}
    )

    # Check Suresh's driver odometer and vehicle odometer increased by 150.0
    response = client.get(
        f"/vehicles/{vehicle['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.json()["odometer_km"] == 5350.0

    response = client.get(
        f"/drivers/{driver['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.json()["odometer_km"] == 5350.0
