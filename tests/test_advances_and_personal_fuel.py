import pytest

from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.driver import Driver
from app.models.user import User


@pytest.fixture
def advance_fuel_test_data(db_session):
    dispatcher_user = User(
        username="dispatcher_adv_test",
        email="dispatcher_adv@example.com",
        hashed_password=hash_password("password123"),
        role="dispatcher",
        is_active=True,
    )
    db_session.add(dispatcher_user)
    db_session.commit()
    db_session.refresh(dispatcher_user)

    driver = Driver(
        name="Sunil Advance Driver",
        phone="+919876543888",
        license_number="MH-12-ADV-88",
        vehicle_type="cargo_truck",
        base_salary=30000.0,
        status="available",
    )
    db_session.add(driver)
    db_session.commit()
    db_session.refresh(driver)

    token = create_access_token(data={"sub": dispatcher_user.username})
    headers = {"Authorization": f"Bearer {token}"}

    return {"dispatcher": dispatcher_user, "driver": driver, "headers": headers}


def test_advances_and_personal_fuel_payroll_deduction(client, advance_fuel_test_data):
    driver = advance_fuel_test_data["driver"]
    headers = advance_fuel_test_data["headers"]

    # 1. Generate monthly payment draft for August 2026
    gen_res = client.post(
        f"/drivers/{driver.id}/payments/generate?year=2026&month=8", headers=headers
    )
    assert gen_res.status_code == 200
    payment_data = gen_res.json()
    payment_id = payment_data["id"]

    # 2. Update payment with ₹5000 Cash Advance and ₹1500 Personal Fuel Expense
    patch_res = client.patch(
        f"/drivers/payments/{payment_id}",
        headers=headers,
        json={
            "advance_payment": 5000.0,
            "personal_fuel_expense": 1500.0,
            "bonus": 1000.0,
            "status": "paid",
            "payment_method": "Bank Transfer (IMPS/NEFT)",
            "note": "August 2026 Salary Settled with Cash Advance & Personal Fuel Deductions",
        },
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["advance_payment"] == 5000.0
    assert updated_data["personal_fuel_expense"] == 1500.0
    # Net salary = 30000 (base) + 0 (comm) + 1000 (bonus) - 0 (ded) - 5000 (adv) - 1500 (fuel) = 24500.0
    assert updated_data["total_paid"] == 24500.0

    # 3. Verify detailed payslip includes advance and personal fuel deduction line items
    payslip_res = client.get(f"/drivers/payments/{payment_id}/payslip", headers=headers)
    assert payslip_res.status_code == 200
    payslip = payslip_res.json()
    assert payslip["net_salary"] == 24500.0

    deduction_categories = [d["category"] for d in payslip["deductions_items"]]
    assert "Salary Advances Issued" in deduction_categories
    assert "Personal Fuel Expense" in deduction_categories
