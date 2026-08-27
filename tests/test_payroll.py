import pytest

from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.driver import Driver
from app.models.user import User


@pytest.fixture
def payroll_test_data(db_session):
    # Create test dispatcher user
    dispatcher_user = User(
        username="dispatcher_payroll_test",
        email="dispatcher_payroll@example.com",
        hashed_password=hash_password("password123"),
        role="dispatcher",
        is_active=True,
    )
    db_session.add(dispatcher_user)
    db_session.commit()
    db_session.refresh(dispatcher_user)

    # Create test driver
    driver = Driver(
        name="Rajesh Payroll Driver",
        phone="+919876543999",
        license_number="MH-12-PAYROLL-99",
        vehicle_type="cargo_truck",
        base_salary=25000.0,
        status="available",
    )
    db_session.add(driver)
    db_session.commit()
    db_session.refresh(driver)

    token = create_access_token(data={"sub": dispatcher_user.username})
    headers = {"Authorization": f"Bearer {token}"}

    return {"dispatcher": dispatcher_user, "driver": driver, "headers": headers}


def test_generate_and_settle_payroll(client, payroll_test_data):
    driver = payroll_test_data["driver"]
    headers = payroll_test_data["headers"]

    # 1. Generate monthly payroll for July 2026
    gen_response = client.post(
        f"/drivers/{driver.id}/payments/generate",
        headers=headers,
        json={"year": 2026, "month": 7},
    )
    assert gen_response.status_code == 200
    gen_data = gen_response.json()
    assert gen_data["driver_id"] == driver.id
    assert gen_data["base_salary_paid"] == 25000.0
    assert gen_data["status"] == "pending"

    payment_id = gen_data["id"]

    # 2. Settle payout with bonus and deductions
    patch_response = client.patch(
        f"/drivers/payments/{payment_id}",
        headers=headers,
        json={
            "bonus": 2500.0,
            "deductions": 500.0,
            "payment_method": "Bank Transfer (IMPS/NEFT)",
            "note": "July 2026 Salary Disbursed via IMPS Ref #UTR991122",
            "status": "paid",
        },
    )
    assert patch_response.status_code == 200
    patch_data = patch_response.json()
    assert patch_data["status"] == "paid"
    assert patch_data["total_paid"] == 27000.0  # 25000 + 2500 - 500
    assert patch_data["payment_method"] == "Bank Transfer (IMPS/NEFT)"

    # 3. Get itemized payslip breakdown
    payslip_response = client.get(
        f"/drivers/payments/{payment_id}/payslip", headers=headers
    )
    assert payslip_response.status_code == 200
    payslip_data = payslip_response.json()
    assert payslip_data["payslip_number"] == f"PAY-202607-{payment_id:04d}"
    assert payslip_data["driver_name"] == "Rajesh Payroll Driver"
    assert payslip_data["gross_earnings"] == 27500.0  # 25000 base + 2500 bonus
    assert payslip_data["total_deductions"] == 500.0
    assert payslip_data["net_salary"] == 27000.0
