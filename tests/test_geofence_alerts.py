from datetime import timedelta

from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
from app.models.trip import Trip


def create_user_helper(client, username="geofence_disp", role="dispatcher"):
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


def test_geofence_arrival_and_delay_alerts(client, db_session):
    # 1. Setup dispatcher and driver
    disp_token = create_user_helper(client, "geo_disp", "dispatcher")
    disp_headers = {"Authorization": f"Bearer {disp_token}"}

    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Geofence Driver",
            "phone": "9992223333",
            "license_number": "DL-12-2020-0000201",
            "license_expiry": "2032-12-31T00:00:00",
            "username": "geo_driver1",
            "password": "password123",
            "odometer_km": 1000.0,
            "vehicle_type": "cargo_truck",
        },
        headers=disp_headers,
    )
    assert driver_res.status_code == 200
    driver_id = driver_res.json()["id"]

    # Initialize driver position far away
    drv = db_session.query(Driver).filter(Driver.id == driver_id).first()
    drv.current_latitude = 19.99
    drv.current_longitude = 74.99
    db_session.commit()

    # 2. Create trip scheduled for 10 minutes in the past
    future_time = get_now_ist_naive() + timedelta(minutes=10)
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Terminal A",
            "destination": "Terminal B",
            "distance_km": 10.0,
            "duration_minutes": 20,
            "estimated_fare": 300.0,
            "source_latitude": 18.5,
            "source_longitude": 73.0,
            "scheduled_date": future_time.isoformat(),
        },
        headers=disp_headers,
    )
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # Update scheduled_date to past directly in database to bypass API constraint
    trip = db_session.query(Trip).filter(Trip.id == trip_id).first()
    trip.scheduled_date = get_now_ist_naive() - timedelta(minutes=10)
    db_session.commit()

    # Assign driver
    client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver_id},
        headers=disp_headers,
    )

    # 3. Check delay_risk
    # Driver is far away (19.99, 74.99) and trip is scheduled 10 minutes
    # ago, so it must be at delay risk!
    trip_get = client.get(f"/trips/{trip_id}", headers=disp_headers)
    assert trip_get.status_code == 200
    assert trip_get.json()["delay_risk"] is True
    assert trip_get.json()["arrived_at_source_time"] is None

    # Driver posts location inside the source geofence
    # (Terminal A: 18.5005, 73.0005 -> within 100m)
    driver_token = client.post(
        "/auth/token",
        data={"username": "geo_driver1", "password": "password123"},
    ).json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    loc_res = client.post(
        "/drivers/location",
        json={"latitude": 18.5005, "longitude": 73.0005},
        headers=driver_headers,
    )
    assert loc_res.status_code == 200

    # 5. Fetch trip again and verify geofence arrived time is updated
    # and delay risk resolved
    trip_get2 = client.get(f"/trips/{trip_id}", headers=disp_headers)
    assert trip_get2.status_code == 200
    assert trip_get2.json()["arrived_at_source_time"] is not None
    assert trip_get2.json()["delay_risk"] is False
