from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
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


def test_driver_scorecard_visibility_and_restrictions(client, db_session):
    # 1. Create two drivers and one dispatcher
    t_drv1 = create_user_helper(client, "driver_alpha", "driver", "9876543210")
    t_drv2 = create_user_helper(client, "driver_beta", "driver", "9876543211")
    t_disp = create_user_helper(client, "dispatcher_gamma", "dispatcher")

    # Get driver profile records to create trips for them
    drv1 = db_session.query(Driver).filter(Driver.phone == "9876543210").first()
    drv2 = db_session.query(Driver).filter(Driver.phone == "9876543211").first()

    assert drv1 is not None
    assert drv2 is not None

    # 2. Add a trip for both drivers so they have scorecard data
    now = get_now_ist_naive()

    trip1 = Trip(
        driver_id=drv1.id,
        status="completed",
        source="Source A",
        destination="Destination A",
        distance_km=10.0,
        odo_distance_km=10.0,
        gps_distance_km=10.0,
        duration_minutes=20,
        estimated_fare=500.0,
        payout_status="approved",
        created_at=now,
        end_time=now,
    )
    trip2 = Trip(
        driver_id=drv2.id,
        status="completed",
        source="Source B",
        destination="Destination B",
        distance_km=15.0,
        odo_distance_km=15.0,
        gps_distance_km=15.0,
        duration_minutes=30,
        estimated_fare=750.0,
        payout_status="approved",
        created_at=now,
        end_time=now,
    )
    db_session.add(trip1)
    db_session.add(trip2)
    db_session.commit()

    # 3. Request scorecard as Driver Alpha (drv1)
    headers_drv1 = {"Authorization": f"Bearer {t_drv1}"}
    res_drv1 = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers_drv1
    )
    assert res_drv1.status_code == 200
    data_drv1 = res_drv1.json()
    # Should only return exactly 1 scorecard, which belongs to driver_alpha
    assert len(data_drv1) == 1
    assert data_drv1[0]["driver_id"] == drv1.id
    assert data_drv1[0]["name"] == "driver_alpha"

    # 4. Request scorecard as Driver Beta (drv2)
    headers_drv2 = {"Authorization": f"Bearer {t_drv2}"}
    res_drv2 = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers_drv2
    )
    assert res_drv2.status_code == 200
    data_drv2 = res_drv2.json()
    # Should only return exactly 1 scorecard, which belongs to driver_beta
    assert len(data_drv2) == 1
    assert data_drv2[0]["driver_id"] == drv2.id
    assert data_drv2[0]["name"] == "driver_beta"

    # 5. Request scorecard as Dispatcher Gamma (should return both scorecards)
    headers_disp = {"Authorization": f"Bearer {t_disp}"}
    res_disp = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers_disp
    )
    assert res_disp.status_code == 200
    data_disp = res_disp.json()
    assert len(data_disp) >= 2
    driver_ids = [sc["driver_id"] for sc in data_disp]
    assert drv1.id in driver_ids
    assert drv2.id in driver_ids
