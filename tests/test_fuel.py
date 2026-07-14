from app.models.driver import Driver
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
    assert (
        res.status_code == 200
    ), f"Token request failed: {res.status_code} - {res.text}"
    return res.json()["access_token"]


def test_fuel_logging_odometer_update_and_fraud_audits(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_fuel", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Register driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Eco Driver",
            "phone": "9998887777",
            "license_number": "DL-12-2018-6666666",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "eco_driver",
            "password": "eco_password",
            "vehicle_type": "cargo_truck",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_data = driver_res.json()

    # Log in as driver
    driver_token = client.post(
        "/auth/token",
        data={"username": "eco_driver", "password": "eco_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # 1. Compliant Refueling: 50 Liters over 400km
    # (12.5 L/100km, which is close to standard 12L)
    res_compliant = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 50.0,
            "cost": 4500.0,
            "odometer": 1400.0,
        },
        headers=driver_headers,
    )
    assert res_compliant.status_code == 200
    log1 = res_compliant.json()
    assert log1["is_flagged_fraud"] is False
    assert log1["fraud_reason"] is None

    # Check driver odometer is updated
    db_driver = db_session.query(Driver).filter(Driver.id == driver_data["id"]).first()
    assert db_driver.odometer_km == 1400.0

    # 2. Capacity Breach Check: Refuel 200 Liters
    # (Tank capacity is 150L for cargo_truck)
    res_overflow = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 200.0,
            "cost": 18000.0,
            "odometer": 1500.0,
        },
        headers=driver_headers,
    )
    assert res_overflow.status_code == 200
    log2 = res_overflow.json()
    assert log2["is_flagged_fraud"] is True
    assert "exceeds maximum tank capacity" in log2["fraud_reason"]

    # 3. Odometer Backward Tampering Check: Refuel with odometer 1300km
    # (less than current 1500km)
    res_tamper = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 10.0,
            "cost": 900.0,
            "odometer": 1300.0,
        },
        headers=driver_headers,
    )
    assert res_tamper.status_code == 200
    log3 = res_tamper.json()
    assert log3["is_flagged_fraud"] is True
    assert "not greater than previous" in log3["fraud_reason"]

    # 4. Efficiency Violation Check (Too high): 80L over 100km
    # (80 L/100km vs standard 12L)
    # Set odometer forward first to avoid progression check failure
    res_inefficient = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 80.0,
            "cost": 7200.0,
            "odometer": 1600.0,
        },
        headers=driver_headers,
    )
    assert res_inefficient.status_code == 200
    log4 = res_inefficient.json()
    assert log4["is_flagged_fraud"] is True
    assert "Anomalously high fuel consumption" in log4["fraud_reason"]


def test_trip_completion_calculates_emissions(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_emissions", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Register driver as electric_truck to check emission coefficient (0.04 kg CO2/km)
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "EV Driver",
            "phone": "8887776666",
            "license_number": "DL-12-2018-5555555",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "ev_driver",
            "password": "ev_password",
            "vehicle_type": "electric_truck",
            "odometer_km": 0.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Create a trip of 100km
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 100.0,
            "duration_minutes": 120,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # Assign, start, and complete
    client.patch(
        f"/trips/{trip_id}/assign", json={"driver_id": driver_id}, headers=disp_headers
    )
    client.patch(f"/trips/{trip_id}/start", headers=disp_headers)
    client.patch(
        f"/trips/{trip_id}/complete", json={"note": "arrived"}, headers=disp_headers
    )

    # Assert emissions are calculated and saved in database
    db_trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
    assert db_trip.status == "completed"
    # 100km * 0.04 kg/km = 4.0 kg CO2
    assert db_trip.carbon_emissions_kg == 4.0
    # 100km * 0.20 kWh/km = 20.0 kWh equivalent
    assert db_trip.fuel_consumed_liters == 20.0


def test_get_fleet_fuel_analytics(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_analytics", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Fetch empty analytics
    res = client.get("/fuel/fleet-fuel-analytics", headers=disp_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_fuel_cost"] == 0.0
    assert data["total_liters"] == 0.0
    assert data["active_fraud_alerts_count"] == 0
