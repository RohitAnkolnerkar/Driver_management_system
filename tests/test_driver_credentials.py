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
    from unittest.mock import patch

    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    driver_data = {
        "name": "Auto Driver",
        "phone": "9999999999",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
    }
    with patch("app.core.email.send_email") as mock_send_email:
        response = client.post("/drivers/", json=driver_data, headers=headers)
        assert response.status_code == 200
        res = response.json()
        assert res["user_id"] is not None
        assert res["username"] == "9999999999"
        assert "password" not in res

        mock_send_email.assert_called_once()
        args, kwargs = mock_send_email.call_args
        assert args[0] == "9999999999@example.com"

        # Extract the password from email body and verify it works
        email_body = args[2]
        password_line = [
            line for line in email_body.splitlines() if "Password:" in line
        ][0]
        generated_password = password_line.split("Password:")[1].strip()
        assert len(generated_password) >= 12
        assert generated_password != "driver_secret123"

        # Verify user can log in with the random password
        login_res = client.post(
            "/auth/token",
            data={"username": "9999999999", "password": generated_password},
        )
        assert login_res.status_code == 200
        assert login_res.json()["role"] == "driver"


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


def test_driver_self_registration_and_restrictions(client):
    # 1. Create a user with role 'driver'
    client.post(
        "/users/",
        json={
            "username": "selfdriver",
            "email": "selfdriver@example.com",
            "password": "secretpassword123",
            "role": "driver",
            "phone": "5555555555",
        },
    )

    # 2. Get login token for the driver
    login_res = client.post(
        "/auth/token", data={"username": "selfdriver", "password": "secretpassword123"}
    )
    assert login_res.status_code == 200
    driver_token = login_res.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # Get the driver user's ID
    me_res = client.get("/users/me", headers=driver_headers)
    assert me_res.status_code == 200
    driver_user_id = me_res.json()["id"]

    # 3. Try to POST a new driver profile for self when one already exists (should fail with 400 Conflict)
    # Note: user registration with role 'driver' auto-creates a basic profile.
    driver_data = {
        "name": "Self Driver Name",
        "phone": "5555555555",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
        "user_id": driver_user_id,
    }
    response = client.post("/drivers/", json=driver_data, headers=driver_headers)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()

    # 4. Use PATCH /drivers/me to register detailed info for self
    update_data = {
        "name": "Self Driver Name",
        "phone": "5555555555",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
    }
    patch_res = client.patch("/drivers/me", json=update_data, headers=driver_headers)
    assert patch_res.status_code == 200
    res = patch_res.json()
    assert res["user_id"] == driver_user_id
    assert res["name"] == "Self Driver Name"

    # 5. Try to register/create driver profile for another user_id using POST (should fail with 403)
    # Create another user first
    client.post(
        "/users/",
        json={
            "username": "otherdriver",
            "email": "otherdriver@example.com",
            "password": "secretpassword123",
            "role": "driver",
            "phone": "4444444444",
        },
    )
    # Get other user's ID using login
    other_login = client.post(
        "/auth/token", data={"username": "otherdriver", "password": "secretpassword123"}
    )
    other_token = other_login.json()["access_token"]
    other_me = client.get(
        "/users/me", headers={"Authorization": f"Bearer {other_token}"}
    )
    other_user_id = other_me.json()["id"]

    # Now, try to register driver for other_user_id using first driver's token
    bad_driver_data = {
        "name": "Intruder",
        "phone": "4444444444",
        "license_number": "MH-12-2018-0004567",
        "license_expiry": "2026-12-31T00:00:00",
        "user_id": other_user_id,
    }
    response_forbidden = client.post(
        "/drivers/", json=bad_driver_data, headers=driver_headers
    )
    assert response_forbidden.status_code == 403
    assert (
        "only create driver profiles for themselves"
        in response_forbidden.json()["detail"]
    )

    # 6. Try to update sensitive fields using PATCH /drivers/me (should fail with 403)
    bad_salary_data = {
        "base_salary": 5000.0,
    }
    response_bad_salary = client.patch(
        "/drivers/me", json=bad_salary_data, headers=driver_headers
    )
    assert response_bad_salary.status_code == 403
    assert (
        "cannot update their own base_salary"
        in response_bad_salary.json()["detail"].lower()
    )

    bad_commission_data = {
        "commission_percentage": 10.0,
    }
    response_bad_commission = client.patch(
        "/drivers/me", json=bad_commission_data, headers=driver_headers
    )
    assert response_bad_commission.status_code == 403
    assert (
        "cannot update their own base_salary"
        in response_bad_commission.json()["detail"].lower()
    )

    bad_vehicle_data = {
        "vehicle_id": 1,
    }
    response_bad_vehicle = client.patch(
        "/drivers/me", json=bad_vehicle_data, headers=driver_headers
    )
    assert response_bad_vehicle.status_code == 403
    assert (
        "cannot update their own base_salary"
        in response_bad_vehicle.json()["detail"].lower()
    )
