from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver, DriverLocationHistory
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


def test_dispatcher_location_override_and_geofence_simulation(client, db_session):
    # 1. Register users
    t_disp = create_user_helper(client, "loc_disp", "dispatcher")
    create_user_helper(client, "loc_drv1", "driver", "9900001111")
    t_drv2 = create_user_helper(client, "loc_drv2", "driver", "9900002222")

    drv1 = db_session.query(Driver).filter(Driver.phone == "9900001111").first()
    drv2 = db_session.query(Driver).filter(Driver.phone == "9900002222").first()

    assert drv1 is not None
    assert drv2 is not None

    # Create assigned trip for drv1
    now = get_now_ist_naive()
    trip1 = Trip(
        driver_id=drv1.id,
        status="assigned",
        source="Source Terminal A",
        source_latitude=19.0,
        source_longitude=73.0,
        destination="Destination B",
        destination_latitude=19.1,
        destination_longitude=73.1,
        distance_km=15.0,
        duration_minutes=30,
        estimated_fare=600.0,
        created_at=now,
    )
    db_session.add(trip1)
    db_session.commit()

    # 2. Driver 2 tries to override Driver 1's location (should be Forbidden - 403)
    headers_drv2 = {"Authorization": f"Bearer {t_drv2}"}
    res_drv2 = client.post(
        f"/drivers/{drv1.id}/location",
        json={"latitude": 19.01, "longitude": 73.01},
        headers=headers_drv2,
    )
    assert res_drv2.status_code == 403

    # 3. Dispatcher overrides Driver 1's location (should be Success - 200)
    headers_disp = {"Authorization": f"Bearer {t_disp}"}
    res_disp = client.post(
        f"/drivers/{drv1.id}/location",
        json={"latitude": 19.001, "longitude": 73.001},
        headers=headers_disp,
    )
    assert res_disp.status_code == 200

    # 4. Check if location history recorded correctly
    histories = (
        db_session.query(DriverLocationHistory)
        .filter(DriverLocationHistory.driver_id == drv1.id)
        .all()
    )
    assert len(histories) == 1
    assert histories[0].latitude == 19.001
    assert histories[0].longitude == 73.001

    # 5. Check geofence source check-in (distance is within 0.2 km from 19.0, 73.0)
    db_session.refresh(trip1)
    assert trip1.arrived_at_source_time is not None
