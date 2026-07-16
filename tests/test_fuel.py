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

    # Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 400.0,
            "duration_minutes": 300,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

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
            "trip_id": trip_id,
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
            "trip_id": trip_id,
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
            "trip_id": trip_id,
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
            "trip_id": trip_id,
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


def test_update_fuel_log(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_updater", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Register driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Updater Driver",
            "phone": "9998884444",
            "license_number": "DL-12-2018-7777777",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "updater_driver",
            "password": "updater_password",
            "vehicle_type": "cargo_truck",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200

    # Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 400.0,
            "duration_minutes": 300,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    driver_token = client.post(
        "/auth/token",
        data={"username": "updater_driver", "password": "updater_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # Create fuel log (flagged as fraud due to overflow)
    log_res = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 200.0,
            "cost": 18000.0,
            "odometer": 1500.0,
            "trip_id": trip_id,
        },
        headers=driver_headers,
    )
    assert log_res.status_code == 200
    log_id = log_res.json()["id"]
    assert log_res.json()["is_flagged_fraud"] is True

    # Dispatcher updates the log to clear the fraud flag and adjust liters
    update_res = client.patch(
        f"/fuel/fuel-logs/{log_id}",
        json={
            "liters_refueled": 120.0,
            "is_flagged_fraud": False,
            "fraud_reason": "Cleared manually by dispatcher after review",
        },
        headers=disp_headers,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["liters_refueled"] == 120.0
    assert updated_data["is_flagged_fraud"] is False
    assert updated_data["fraud_reason"] == "Cleared manually by dispatcher after review"

    # Driver role attempt to update should fail
    fail_res = client.patch(
        f"/fuel/fuel-logs/{log_id}",
        json={"is_flagged_fraud": True},
        headers=driver_headers,
    )
    assert fail_res.status_code == 403


def test_dispatcher_creates_fuel_log_on_behalf_of_driver(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_creator", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Register driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Behalf Driver",
            "phone": "9998885555",
            "license_number": "DL-12-2018-8888888",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "behalf_driver",
            "password": "behalf_password",
            "vehicle_type": "cargo_truck",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 400.0,
            "duration_minutes": 300,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # Dispatcher submits fuel log specifying the driver_id
    res = client.post(
        "/fuel/fuel-logs",
        json={
            "driver_id": driver_id,
            "liters_refueled": 50.0,
            "cost": 4500.0,
            "odometer": 1400.0,
            "trip_id": trip_id,
        },
        headers=disp_headers,
    )
    assert res.status_code == 200
    log = res.json()
    assert log["driver_id"] == driver_id
    assert log["is_flagged_fraud"] is False

    # Check driver odometer is updated
    db_driver = db_session.query(Driver).filter(Driver.id == driver_id).first()
    assert db_driver.odometer_km == 1400.0

    # Dispatcher submits without driver_id should return 400 Bad Request
    fail_res = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 50.0,
            "cost": 4500.0,
            "odometer": 1500.0,
            "trip_id": trip_id,
        },
        headers=disp_headers,
    )
    assert fail_res.status_code == 400
    assert "driver_id is required" in fail_res.json()["detail"]


def test_get_diesel_rate(client):
    dispatcher_token = create_user_helper(client, "dispatcher_diesel", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    res = client.get("/fuel/diesel-rate", headers=disp_headers)
    assert res.status_code == 200
    data = res.json()
    assert "national_average" in data
    assert "cities" in data
    assert isinstance(data["national_average"], (int, float))
    assert isinstance(data["cities"], dict)
    assert len(data["cities"]) > 0
    # Also verify some standard cities are in it, like Mumbai
    assert "Mumbai" in data["cities"]


def test_fuel_card_cost_mismatch_audit(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_cost_audit", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # Register driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Audit Driver",
            "phone": "9998881234",
            "license_number": "DL-12-2018-1234567",
            "license_expiry": "2030-12-31T00:00:00",
            "username": "audit_driver_cost",
            "password": "audit_password",
            "vehicle_type": "cargo_truck",
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200

    # Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 400.0,
            "duration_minutes": 300,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    driver_token = client.post(
        "/auth/token",
        data={"username": "audit_driver_cost", "password": "audit_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # Refuel: 50 Liters. Expected cost around 50 * 97.83 = 4891.50
    # Let's log a highly mismatched cost: 8000.0 (tampering / excessive markup)
    res_tampered = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 50.0,
            "cost": 8000.0,
            "odometer": 1400.0,
            "trip_id": trip_id,
        },
        headers=driver_headers,
    )
    assert res_tampered.status_code == 200
    log = res_tampered.json()
    assert log["is_flagged_fraud"] is True
    assert "Receipt cost" in log["fraud_reason"]
    assert "does not match expected local rate" in log["fraud_reason"]
