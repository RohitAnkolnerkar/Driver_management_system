import pytest

from app.config import settings
from app.models.driver import Driver
from app.models.vehicle import MaintenanceLog, Vehicle


@pytest.fixture(autouse=True)
def enable_mandatory_inspections():
    settings.MANDATORY_SAFETY_INSPECTION = True
    yield
    settings.MANDATORY_SAFETY_INSPECTION = False


def create_user_helper(client, username="inspect_disp", role="dispatcher"):
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


def test_pre_trip_inspection_lifecycle(client, db_session):
    dispatcher_token = create_user_helper(client, "dispatcher_inspect", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    # 1. Create a vehicle
    veh_res = client.post(
        "/vehicles/",
        json={
            "make": "Ashok Leyland",
            "model": "Dost",
            "year": 2023,
            "license_plate": "MH-12-AB-1234",
            "odometer_km": 1000.0,
            "status": "active",
        },
        headers=disp_headers,
    )
    assert veh_res.status_code == 201
    vehicle_id = veh_res.json()["id"]

    # 2. Register driver and associate with vehicle
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Safety Driver",
            "phone": "9998881234",
            "license_number": "DL-12-2020-0000005",
            "license_expiry": "2035-12-31T00:00:00",
            "username": "safety_driver",
            "password": "safety_password",
            "vehicle_type": "light_van",
            "vehicle_id": vehicle_id,
            "odometer_km": 1000.0,
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Log in as driver
    driver_token = client.post(
        "/auth/token",
        data={"username": "safety_driver", "password": "safety_password"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # 3. Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 100.0,
            "duration_minutes": 120,
            "vehicle_id": vehicle_id,
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # Assign driver to trip
    client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver_id, "vehicle_id": vehicle_id},
        headers=disp_headers,
    )

    # 4. Attempt to start trip before inspection: should fail with 400
    start_fail_res = client.patch(
        f"/trips/{trip_id}/start",
        json={"note": "starting"},
        headers=driver_headers,
    )
    assert start_fail_res.status_code == 400
    assert "Pre-trip safety inspection is required" in start_fail_res.json()["detail"]

    # 5. Submit unsafe inspection (brakes failed)
    unsafe_inspection_payload = {
        "brakes_passed": False,
        "tires_passed": True,
        "lights_passed": True,
        "steering_passed": True,
        "fluids_passed": True,
        "notes": "Brakes feel soft",
    }
    unsafe_res = client.post(
        f"/trips/{trip_id}/inspection",
        json=unsafe_inspection_payload,
        headers=driver_headers,
    )
    assert unsafe_res.status_code == 200
    assert unsafe_res.json()["is_safe"] is False

    # Check that vehicle status is updated to maintenance
    db_vehicle = db_session.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    assert db_vehicle.status == "maintenance"

    # Check maintenance log exists
    m_log = (
        db_session.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle_id)
        .first()
    )
    assert m_log is not None
    assert "Safety inspection failed" in m_log.description

    # 6. Attempt to start trip with failed inspection: should fail with 400
    start_unsafe_res = client.patch(
        f"/trips/{trip_id}/start",
        json={"note": "starting"},
        headers=driver_headers,
    )
    assert start_unsafe_res.status_code == 400
    assert "vehicle failed safety inspection" in start_unsafe_res.json()["detail"]

    # 7. Reset vehicle status to active and driver status to available,
    # then create a new trip to test passing inspection
    db_driver = db_session.query(Driver).filter(Driver.id == driver_id).first()
    db_driver.status = "available"
    db_vehicle.status = "active"
    db_session.commit()

    trip_res_2 = client.post(
        "/trips/",
        json={
            "source": "Terminal Alpha",
            "destination": "Warehouse Beta",
            "distance_km": 100.0,
            "duration_minutes": 120,
            "vehicle_id": vehicle_id,
        },
        headers=disp_headers,
    )
    trip_id_2 = trip_res_2.json()["id"]

    client.patch(
        f"/trips/{trip_id_2}/assign",
        json={"driver_id": driver_id, "vehicle_id": vehicle_id},
        headers=disp_headers,
    )

    # Submit clean inspection
    safe_inspection_payload = {
        "brakes_passed": True,
        "tires_passed": True,
        "lights_passed": True,
        "steering_passed": True,
        "fluids_passed": True,
        "notes": "All looks good",
    }
    safe_res = client.post(
        f"/trips/{trip_id_2}/inspection",
        json=safe_inspection_payload,
        headers=driver_headers,
    )
    assert safe_res.status_code == 200
    assert safe_res.json()["is_safe"] is True

    # 8. Start trip with clean inspection: should succeed (200)
    start_success_res = client.patch(
        f"/trips/{trip_id_2}/start",
        json={"note": "starting"},
        headers=driver_headers,
    )
    assert start_success_res.status_code == 200
