from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver, DriverPayment
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


def test_fuel_reconciliation_workflow(client, db_session):
    # 1. Register dispatcher & driver
    t_disp = create_user_helper(client, "fuel_audit_disp", "dispatcher")
    t_drv = create_user_helper(client, "fuel_audit_drv", "driver", "9870001111")

    drv = db_session.query(Driver).filter(Driver.phone == "9870001111").first()
    assert drv is not None

    # Setup active trip and vehicle type
    drv.vehicle_type = "light_van"  # tank capacity: 65L

    now = get_now_ist_naive()
    trip = Trip(
        driver_id=drv.id,
        status="completed",
        source="Mumbai",
        source_latitude=19.0,
        source_longitude=72.8,
        destination="Pune",
        destination_latitude=18.5,
        destination_longitude=73.8,
        distance_km=150.0,
        duration_minutes=180,
        estimated_fare=3500.0,
        end_time=now,
        created_at=now,
    )
    db_session.add(trip)
    db_session.commit()

    # 2. Driver logs refueling exceeding capacity (e.g. 100 liters on a 65L tank)
    headers_drv = {"Authorization": f"Bearer {t_drv}"}
    res_log = client.post(
        "/fuel/fuel-logs",
        json={
            "liters_refueled": 100.0,
            "cost": 9500.0,
            "odometer": 200.0,
            "trip_id": trip.id,
        },
        headers=headers_drv,
    )
    assert res_log.status_code == 200
    log_data = res_log.json()
    assert log_data["is_flagged_fraud"] is True
    assert log_data["audit_status"] == "pending"

    # 3. Generating a payout for the driver while audit is pending
    # should put payment on hold_audit status
    headers_disp = {"Authorization": f"Bearer {t_disp}"}
    res_pay_pending = client.post(
        f"/drivers/{drv.id}/payments/generate?year={now.year}&month={now.month}",
        headers=headers_disp,
    )
    assert res_pay_pending.status_code == 200
    payment_pending = res_pay_pending.json()
    assert payment_pending["status"] == "hold_audit"

    # Delete the payment record so we can regenerate it for tests
    db_session.query(DriverPayment).filter(
        DriverPayment.id == payment_pending["id"]
    ).delete()
    db_session.commit()

    # 4. Dispatcher rejects (confirms fraud) on the fuel log
    res_patch = client.patch(
        f"/fuel/fuel-logs/{log_data['id']}",
        json={"audit_status": "rejected"},
        headers=headers_disp,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["audit_status"] == "rejected"

    # 5. Regenerating payout should now be status=pending, but deduct 9500.0
    res_pay_rejected = client.post(
        f"/drivers/{drv.id}/payments/generate?year={now.year}&month={now.month}",
        headers=headers_disp,
    )
    assert res_pay_rejected.status_code == 200
    payment_rejected = res_pay_rejected.json()
    assert payment_rejected["status"] == "pending"
    assert payment_rejected["deductions"] >= 9500.0
    assert "fuel card fraud audit deductions" in payment_rejected["note"]

    # Delete the payment record to try approval flow
    db_session.query(DriverPayment).filter(
        DriverPayment.id == payment_rejected["id"]
    ).delete()
    db_session.commit()

    # 6. Dispatcher overrides and approves the transaction (resolves exception)
    res_approve = client.patch(
        f"/fuel/fuel-logs/{log_data['id']}",
        json={"is_flagged_fraud": False, "audit_status": "approved"},
        headers=headers_disp,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["is_flagged_fraud"] is False
    assert res_approve.json()["audit_status"] == "approved"

    # 7. Regenerating payout should now be normal without the 9500 deduction
    res_pay_approved = client.post(
        f"/drivers/{drv.id}/payments/generate?year={now.year}&month={now.month}",
        headers=headers_disp,
    )
    assert res_pay_approved.status_code == 200
    payment_approved = res_pay_approved.json()
    assert payment_approved["status"] == "pending"
    # Deductions should not include the 9500.0 cost anymore
    assert payment_approved["deductions"] < 9500.0
