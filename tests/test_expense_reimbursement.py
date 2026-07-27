from app.models.driver import Driver
from app.models.expense import TripExpense
from app.models.trip import Trip


def register_and_login(client, username="exp_user", role="dispatcher"):
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


def test_create_expense_success(client, db_session):
    token = register_and_login(client, "exp_user1")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(
        name="Ramesh Kumar",
        phone="+919876543210",
        license_number="MH-12-2018-0004567",
        status="available",
    )
    db_session.add(driver)
    db_session.commit()

    payload = {
        "driver_id": driver.id,
        "category": "toll",
        "amount": 350.0,
        "description": "FASTag toll charge on Mumbai-Pune Expressway",
        "receipt_number": "TXN987654",
    }
    res = client.post("/expenses/", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["driver_id"] == driver.id
    assert data["category"] == "toll"
    assert data["amount"] == 350.0
    assert data["status"] == "pending"
    assert data["driver_name"] == "Ramesh Kumar"


def test_create_expense_driver_not_found(client, db_session):
    token = register_and_login(client, "exp_user2")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "driver_id": 9999,
        "category": "food_allowance",
        "amount": 200.0,
    }
    res = client.post("/expenses/", json=payload, headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Driver not found"


def test_list_expenses_filtering(client, db_session):
    token = register_and_login(client, "exp_user3")
    headers = {"Authorization": f"Bearer {token}"}

    driver1 = Driver(
        name="Suresh Singh",
        phone="+919876543211",
        license_number="MH-14-2019-0001234",
    )
    driver2 = Driver(
        name="Amit Patel",
        phone="+919876543212",
        license_number="GJ-01-2020-0005678",
    )
    db_session.add_all([driver1, driver2])
    db_session.commit()

    exp1 = TripExpense(
        driver_id=driver1.id, category="lodging", amount=1200.0, status="approved"
    )
    exp2 = TripExpense(
        driver_id=driver1.id, category="toll", amount=150.0, status="pending"
    )
    exp3 = TripExpense(
        driver_id=driver2.id, category="lodging", amount=800.0, status="pending"
    )
    db_session.add_all([exp1, exp2, exp3])
    db_session.commit()

    # Filter by driver_id
    res = client.get(f"/expenses/?driver_id={driver1.id}", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 2

    # Filter by category
    res = client.get("/expenses/?category=lodging", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 2

    # Filter by status
    res = client.get("/expenses/?status=approved", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == exp1.id


def test_update_expense_status_approve_and_reject(client, db_session):
    token = register_and_login(client, "exp_user4")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(
        name="Vikram Sharma",
        phone="+919876543213",
        license_number="DL-04-2017-0009999",
    )
    db_session.add(driver)
    db_session.commit()

    exp = TripExpense(
        driver_id=driver.id,
        category="maintenance_emergency",
        amount=2500.0,
        status="pending",
    )
    db_session.add(exp)
    db_session.commit()

    # Approve expense
    approve_res = client.patch(
        f"/expenses/{exp.id}/status",
        json={"status": "approved", "reviewed_by": "fleet_manager"},
        headers=headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["reviewed_by"] == "fleet_manager"

    # Reject expense with reason
    reject_res = client.patch(
        f"/expenses/{exp.id}/status",
        json={
            "status": "rejected",
            "rejection_reason": "Receipt unreadable",
            "reviewed_by": "fleet_manager",
        },
        headers=headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert reject_res.json()["rejection_reason"] == "Receipt unreadable"


def test_get_driver_settlement_and_finalize(client, db_session):
    token = register_and_login(client, "exp_user5")
    headers = {"Authorization": f"Bearer {token}"}

    driver = Driver(
        name="Anil Kapoor",
        phone="+919876543214",
        license_number="KA-01-2016-0008888",
    )
    db_session.add(driver)
    db_session.commit()

    trip1 = Trip(
        driver_id=driver.id,
        source="Bangalore",
        destination="Chennai",
        estimated_fare=4500.0,
        status="completed",
        payout_status="pending",
    )
    trip2 = Trip(
        driver_id=driver.id,
        source="Chennai",
        destination="Hyderabad",
        estimated_fare=5500.0,
        status="completed",
        payout_status="pending",
    )
    db_session.add_all([trip1, trip2])
    db_session.commit()

    exp_approved = TripExpense(
        driver_id=driver.id,
        trip_id=trip1.id,
        category="toll",
        amount=600.0,
        status="approved",
    )
    exp_pending = TripExpense(
        driver_id=driver.id,
        trip_id=trip2.id,
        category="food_allowance",
        amount=400.0,
        status="pending",
    )
    exp_rejected = TripExpense(
        driver_id=driver.id, category="other", amount=200.0, status="rejected"
    )
    db_session.add_all([exp_approved, exp_pending, exp_rejected])
    db_session.commit()

    # Query settlement summary
    res = client.get(f"/expenses/settlement/{driver.id}", headers=headers)
    assert res.status_code == 200
    summary = res.json()

    assert summary["driver_id"] == driver.id
    assert summary["total_trips_completed"] == 2
    assert summary["base_trip_earnings"] == 10000.0  # 4500 + 5500
    assert summary["approved_expenses_amount"] == 600.0
    assert summary["pending_expenses_amount"] == 400.0
    assert summary["rejected_expenses_amount"] == 200.0
    assert summary["net_settlement_payout"] == 10600.0  # 10000 + 600

    # Finalize settlement
    settle_res = client.post(
        f"/expenses/settlement/{driver.id}/settle", headers=headers
    )
    assert settle_res.status_code == 200
    settled_summary = settle_res.json()

    assert settled_summary["approved_expenses_amount"] == 0.0
    assert settled_summary["settled_expenses_amount"] == 600.0
    assert settled_summary["net_settlement_payout"] == 10600.0

    # Verify DB state updated
    db_session.refresh(exp_approved)
    db_session.refresh(trip1)
    db_session.refresh(trip2)
    assert exp_approved.status == "settled"
    assert trip1.payout_status == "settled"
    assert trip2.payout_status == "settled"
