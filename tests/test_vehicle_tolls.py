import pytest

from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleTollLog


@pytest.fixture
def toll_test_data(db_session):
    dispatcher_user = User(
        username="dispatcher_toll_test",
        email="dispatcher_toll@example.com",
        hashed_password=hash_password("password123"),
        role="dispatcher",
        is_active=True,
    )
    db_session.add(dispatcher_user)
    db_session.commit()
    db_session.refresh(dispatcher_user)

    vehicle = Vehicle(
        make="Tata Motors",
        model="Signa 4825.TK",
        year=2024,
        license_plate="MH-12-TOLL-8888",
        odometer_km=42000.0,
        status="active",
    )
    db_session.add(vehicle)
    db_session.commit()
    db_session.refresh(vehicle)

    token = create_access_token(data={"sub": dispatcher_user.username})
    headers = {"Authorization": f"Bearer {token}"}

    return {"dispatcher": dispatcher_user, "vehicle": vehicle, "headers": headers}


def test_vehicle_toll_logging_and_period_summary(client, toll_test_data):
    vehicle = toll_test_data["vehicle"]
    headers = toll_test_data["headers"]

    # 1. Post FASTag toll log
    t1_res = client.post(
        f"/vehicles/{vehicle.id}/tolls",
        headers=headers,
        json={
            "vehicle_id": vehicle.id,
            "toll_plaza_name": "Khed-Shivapur Toll Plaza",
            "highway_name": "NH-48 Pune-Satara Expressway",
            "amount": 285.0,
            "payment_method": "FASTag",
            "transaction_reference": "FT-99120488",
        },
    )
    assert t1_res.status_code == 200
    t1_data = t1_res.json()
    assert t1_data["toll_plaza_name"] == "Khed-Shivapur Toll Plaza"
    assert t1_data["amount"] == 285.0

    # 2. Post Cash toll log
    t2_res = client.post(
        f"/vehicles/{vehicle.id}/tolls",
        headers=headers,
        json={
            "vehicle_id": vehicle.id,
            "toll_plaza_name": "Anewadi Toll Plaza",
            "highway_name": "NH-48 Expressway",
            "amount": 165.0,
            "payment_method": "Cash",
            "transaction_reference": "CASH-9910",
        },
    )
    assert t2_res.status_code == 200

    # 3. Get itemized vehicle tolls
    v_tolls_res = client.get(f"/vehicles/{vehicle.id}/tolls", headers=headers)
    assert v_tolls_res.status_code == 200
    v_tolls = v_tolls_res.json()
    assert len(v_tolls) == 2

    # 4. Get fleet toll summary for current month
    summary_res = client.get("/vehicles/tolls/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_fleet_toll_spend"] >= 450.0  # 285 + 165
    assert summary["total_fastag_spend"] >= 285.0
    assert summary["total_cash_spend"] >= 165.0

    target_vehicle_summary = next(
        v for v in summary["vehicle_summaries"] if v["vehicle_id"] == vehicle.id
    )
    assert target_vehicle_summary["license_plate"] == "MH-12-TOLL-8888"
    assert target_vehicle_summary["total_toll_spend"] == 450.0
    assert target_vehicle_summary["fastag_spend"] == 285.0
    assert target_vehicle_summary["cash_spend"] == 165.0
    assert target_vehicle_summary["transaction_count"] == 2
