from datetime import timedelta

from app.core.time_utils import get_now_ist_naive
from app.models.trip import Trip


def register_and_login(client, username="det_user", role="dispatcher"):
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


def test_detention_grace_period_no_charge(client, db_session):
    token = register_and_login(client, "det_user1")
    headers = {"Authorization": f"Bearer {token}"}

    now = get_now_ist_naive()
    trip = Trip(
        source="Dock A",
        destination="Store B",
        status="started",
        detention_start_time=now - timedelta(minutes=90),  # 1.5 hrs stay
        detention_grace_minutes=120,
        detention_hourly_rate=500.0,
    )
    db_session.add(trip)
    db_session.commit()

    res = client.get(f"/trips/{trip.id}/detention", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["trip_id"] == trip.id
    assert data["is_grace_exceeded"] is False
    assert data["billable_hours"] == 0.0
    assert data["estimated_detention_charge"] == 0.0


def test_detention_exceeded_billing_calculation(client, db_session):
    token = register_and_login(client, "det_user2")
    headers = {"Authorization": f"Bearer {token}"}

    now = get_now_ist_naive()
    # 270 min stay - 120 min grace = 150 excess min (2.5 billable hrs)
    trip = Trip(
        source="Warehouse North",
        destination="Hub South",
        status="started",
        detention_start_time=now - timedelta(minutes=270),
        detention_grace_minutes=120,
        detention_hourly_rate=500.0,
    )
    db_session.add(trip)
    db_session.commit()

    # Clock out
    res = client.post(f"/trips/{trip.id}/detention/clock-out", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["is_grace_exceeded"] is True
    assert data["billable_hours"] == 2.5
    assert data["estimated_detention_charge"] == 1250.0  # 2.5 * 500


def test_detention_invoice_line_item_injection(client, db_session):
    token = register_and_login(client, "det_user3")
    headers = {"Authorization": f"Bearer {token}"}

    trip = Trip(
        source="Factory 1",
        destination="Client 2",
        distance_km=50.0,
        estimated_fare=2000.0,
        detention_charge=1000.0,
        detention_billable_hours=2.0,
        detention_hourly_rate=500.0,
        status="completed",
    )
    db_session.add(trip)
    db_session.commit()

    res = client.get(f"/trips/{trip.id}/invoice", headers=headers)
    assert res.status_code == 200
    inv = res.json()

    # Base fare 2000 + Detention 1000 = 3000 subtotal
    assert inv["subtotal"] == 3000.0
    assert inv["tax_amount"] == round(3000.0 * 0.18, 2)
    assert inv["total_amount"] == round(3000.0 * 1.18, 2)

    descriptions = [item["description"] for item in inv["line_items"]]
    assert any("Detention Fee" in d for d in descriptions)
