import pytest

from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.user import User


@pytest.fixture
def finance_test_data(db_session):
    admin_user = User(
        username="admin_fin_test",
        email="admin_fin@example.com",
        hashed_password=hash_password("password123"),
        role="admin",
        is_active=True,
    )
    db_session.add(admin_user)

    driver_user = User(
        username="driver_fin_test",
        email="driver_fin@example.com",
        hashed_password=hash_password("password123"),
        role="driver",
        is_active=True,
    )
    db_session.add(driver_user)

    db_session.commit()
    db_session.refresh(admin_user)
    db_session.refresh(driver_user)

    admin_token = create_access_token(data={"sub": admin_user.username})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    driver_token = create_access_token(data={"sub": driver_user.username})
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    return {"admin_headers": admin_headers, "driver_headers": driver_headers}


def test_get_finance_dashboard_summary_admin(client, finance_test_data):
    # 1. Fetch dashboard summary with admin credentials
    response = client.get(
        "/finance/dashboard-summary", headers=finance_test_data["admin_headers"]
    )
    assert response.status_code == 200
    data = response.json()
    assert "overall" in data
    assert "trips" in data
    assert "vehicles" in data
    assert "drivers" in data

    overall = data["overall"]
    assert "revenue" in overall
    assert "driver_payments" in overall
    assert "fuel_expenses" in overall
    assert "toll_expenses" in overall
    assert "maintenance_expenses" in overall
    assert "other_expenses" in overall
    assert "profit" in overall


def test_get_finance_dashboard_summary_unauthorized_driver(client, finance_test_data):
    # 2. Try fetching dashboard summary with driver credentials
    response = client.get(
        "/finance/dashboard-summary", headers=finance_test_data["driver_headers"]
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"
