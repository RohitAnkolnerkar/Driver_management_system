from app.models.driver import Driver
from app.models.fuel import FuelLog
from app.models.fuel_theft import FuelTheftAlert


def register_and_login(client, username="theft_user", role="dispatcher"):
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


def test_offsite_refuel_fraud_detection(client, db_session):
    register_and_login(client, "theft_disp1")

    driver = Driver(
        name="Theft Test Driver",
        phone="9988776655",
        status="available",
        current_latitude=18.5204,  # Pune Center
        current_longitude=73.8567,
    )
    db_session.add(driver)
    db_session.commit()

    fuel_log = FuelLog(
        driver_id=driver.id,
        liters_refueled=50.0,
        cost=4750.0,
        odometer=12000.0,
    )
    db_session.add(fuel_log)
    db_session.commit()

    from app.api.fuel_theft import evaluate_fuel_log_for_theft

    # Declared station is 10 km away in Hadapsar (18.5089, 73.9259)
    alerts = evaluate_fuel_log_for_theft(
        db=db_session,
        fuel_log=fuel_log,
        driver=driver,
        station_lat=18.5089,
        station_lng=73.9259,
    )

    assert len(alerts) >= 1
    offsite_alert = [a for a in alerts if a.alert_type == "offsite_refuel_fraud"][0]
    assert offsite_alert.driver_id == driver.id
    assert offsite_alert.detected_loss_liters == 50.0
    assert offsite_alert.estimated_financial_loss == 4750.0


def test_abnormal_consumption_spike_detection(client, db_session):
    register_and_login(client, "theft_disp2")

    driver = Driver(
        name="Spike Test Driver",
        phone="9988776654",
        status="available",
        vehicle_type="cargo_truck",
    )
    db_session.add(driver)
    db_session.commit()

    log1 = FuelLog(
        driver_id=driver.id,
        liters_refueled=50.0,
        cost=4750.0,
        odometer=10000.0,
    )
    db_session.add(log1)
    db_session.commit()

    # Log 2: Driven only 100 km but claims 100 L refueled (1.0 km/L vs 4.0 baseline)
    log2 = FuelLog(
        driver_id=driver.id,
        liters_refueled=100.0,
        cost=9500.0,
        odometer=10100.0,
    )
    db_session.add(log2)
    db_session.commit()

    from app.api.fuel_theft import evaluate_fuel_log_for_theft

    alerts = evaluate_fuel_log_for_theft(
        db=db_session,
        fuel_log=log2,
        driver=driver,
    )

    spike_alert = [a for a in alerts if a.alert_type == "abnormal_consumption_spike"][0]
    assert spike_alert.driver_id == driver.id
    assert spike_alert.detected_loss_liters == 75.0  # 100 - (100/4.0) = 75.0 L
    assert spike_alert.estimated_financial_loss == round(75.0 * 95.0, 2)


def test_theft_alert_resolution_workflow(client, db_session):
    token = register_and_login(client, "theft_disp3")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(
        name="Resolve Driver",
        phone="9988776653",
        status="available",
    )
    db_session.add(driver)
    db_session.commit()

    alert = FuelTheftAlert(
        driver_id=driver.id,
        alert_type="siphoning_detected",
        severity="critical",
        detected_loss_liters=40.0,
        estimated_financial_loss=3800.0,
        description="Stationary tank drop detected while parked overnight.",
        status="unresolved",
    )
    db_session.add(alert)
    db_session.commit()

    res = client.post(
        f"/fuel/theft/alerts/{alert.id}/resolve",
        json={"status": "confirmed_theft", "notes": "CCTV verified siphoning"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "confirmed_theft"
    assert "CCTV verified" in data["resolution_notes"]
