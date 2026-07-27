import pytest

from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
from app.models.vehicle import MaintenanceLog, Vehicle


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


def test_get_all_maintenance_logs_permissions(client, db_session):
    # 1. Create dispatcher and driver accounts
    t_disp = create_user_helper(client, "gantt_disp", "dispatcher")
    t_drv = create_user_helper(client, "gantt_drv", "driver", "9966551111")

    # 2. Add some test vehicles and maintenance logs
    now = get_now_ist_naive()
    v1 = Vehicle(
        make="Tata",
        model="Prima",
        year=2022,
        license_plate="MH-12-GG-4444",
        status="active",
    )
    db_session.add(v1)
    db_session.commit()

    log1 = MaintenanceLog(
        vehicle_id=v1.id,
        service_type="oil_change",
        description="Routine maintenance",
        cost=3500.0,
        odometer_at_service=12000.0,
        service_date=now,
    )
    db_session.add(log1)
    db_session.commit()

    # 3. Call global endpoint as driver (should be 403 Forbidden)
    headers_drv = {"Authorization": f"Bearer {t_drv}"}
    res_drv = client.get("/vehicles/maintenance/all", headers=headers_drv)
    assert res_drv.status_code == 403

    # 4. Call global endpoint as dispatcher (should be 200 OK)
    headers_disp = {"Authorization": f"Bearer {t_disp}"}
    res_disp = client.get("/vehicles/maintenance/all", headers=headers_disp)
    assert res_disp.status_code == 200

    logs = res_disp.json()
    assert len(logs) >= 1
    assert logs[0]["service_type"] == "oil_change"
    assert logs[0]["cost"] == 3500.0
