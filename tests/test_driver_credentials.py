from app.core.security import hash_password
from app.models.driver import Driver
from app.models.user import User


def get_admin_token(client):
    client.post(
        "/users/",
        json={
            "username": "testadmin",
            "email": "admin@example.com",
            "password": "secret123",
            "role": "admin",
        },
    )
    login_data = {"username": "testadmin", "password": "secret123"}
    response = client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    return response.json()["access_token"]


def test_create_driver_auto_generates_user(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    driver_data = {
        "name": "Auto Driver",
        "phone": "9999999999",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
    }
    response = client.post("/drivers/", json=driver_data, headers=headers)
    assert response.status_code == 200
    res = response.json()
    assert res["user_id"] is not None
    assert res["username"] == "9999999999"
    assert res["password"] == "driver_secret123"


def test_update_driver_credentials(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    driver_data = {
        "name": "Updateable Driver",
        "phone": "8888888888",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
    }
    response = client.post("/drivers/", json=driver_data, headers=headers)
    assert response.status_code == 200
    driver_id = response.json()["id"]

    update_data = {
        "username": "new_driver_user",
        "email": "new_driver_email@example.com",
        "password": "newpassword123",
    }
    response = client.patch(f"/drivers/{driver_id}", json=update_data, headers=headers)
    assert response.status_code == 200

    login_data = {"username": "new_driver_user", "password": "newpassword123"}
    login_res = client.post("/auth/token", data=login_data)
    assert login_res.status_code == 200
    assert login_res.json()["role"] == "driver"


def test_create_driver_with_invalid_user_id(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    driver_data = {
        "name": "Invalid User Driver",
        "phone": "7777777777",
        "user_id": 999999,
    }
    response = client.post("/drivers/", json=driver_data, headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_create_driver_with_non_driver_role_user(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/users/",
        json={
            "username": "nondriveruser",
            "email": "nondriver@example.com",
            "password": "secret123",
            "role": "admin",
        },
    )

    login_res = client.post(
        "/auth/token", data={"username": "nondriveruser", "password": "secret123"}
    )
    assert login_res.status_code == 200

    me_res = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {login_res.json()['access_token']}"},
    )
    assert me_res.status_code == 200
    user_id = me_res.json()["id"]

    driver_data = {
        "name": "Non Driver Role Link",
        "phone": "6666666666",
        "user_id": user_id,
    }
    response = client.post("/drivers/", json=driver_data, headers=headers)
    assert response.status_code == 400
    assert "role" in response.json()["detail"].lower()
