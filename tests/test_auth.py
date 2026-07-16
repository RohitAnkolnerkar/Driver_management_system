from datetime import timedelta

from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.user import User


def test_user_registration_and_login(client):
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "secret123",
    }
    response = client.post("/users/", json=user_data)
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"
    assert response.json()["email"] == "test@example.com"

    login_data = {
        "username": "testuser",
        "password": "secret123",
    }
    response = client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    json_data = response.json()
    assert "access_token" in json_data
    assert json_data["token_type"] == "bearer"
    assert json_data["role"] == "dispatcher"


def test_signup_can_set_role(client):
    response = client.post(
        "/users/",
        json={
            "username": "driveruser",
            "email": "driver@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "driver"


def test_duplicate_user_registration(client):
    user_data = {
        "username": "dupeuser",
        "email": "dupe@example.com",
        "password": "secret123",
    }
    response = client.post("/users/", json=user_data)
    assert response.status_code == 200

    duplicate_response = client.post("/users/", json=user_data)
    assert duplicate_response.status_code == 400
    assert duplicate_response.json()["detail"] == "Username or email already registered"


def test_access_users_me_no_token(client):
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_access_users_me_invalid_token(client):
    response = client.get(
        "/users/me", headers={"Authorization": "Bearer invalid.token"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_access_users_me_expired_token(client):
    token = create_access_token(
        {"sub": "testuser"}, expires_delta=timedelta(seconds=-1)
    )
    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_inactive_user_access_denied(client, db_session):
    user = User(
        username="inactive",
        email="inactive@example.com",
        hashed_password=hash_password("secret123"),
        role="dispatcher",
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token({"sub": "inactive"})
    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"


def test_user_registration_invalid_email(client):
    response = client.post(
        "/users/",
        json={"username": "bademail", "email": "not-an-email", "password": "secret123"},
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "value_error"
    assert response.json()["detail"][0]["loc"] == ["body", "email"]


def test_user_registration_short_password(client):
    response = client.post(
        "/users/",
        json={
            "username": "shortpass",
            "email": "shortpass@example.com",
            "password": "123",
        },
    )
    assert response.status_code == 422
    assert any(error["loc"][-1] == "password" for error in response.json()["detail"])


def test_login_wrong_password(client):
    response = client.post(
        "/auth/token", data={"username": "testuser", "password": "wrong"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_login_nonexistent_user(client):
    response = client.post(
        "/auth/token", data={"username": "unknown", "password": "secret123"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_duplicate_user_email_registration(client):
    first_user = {
        "username": "emaildupe1",
        "email": "dupeemail@example.com",
        "password": "secret123",
    }
    response = client.post("/users/", json=first_user)
    assert response.status_code == 200

    second_user = {
        "username": "emaildupe2",
        "email": "dupeemail@example.com",
        "password": "secret123",
    }
    duplicate_response = client.post("/users/", json=second_user)
    assert duplicate_response.status_code == 400
    assert duplicate_response.json()["detail"] == "Username or email already registered"


def test_user_registration_missing_fields(client):
    response = client.post(
        "/users/", json={"username": "missingpass", "email": "missingpass@example.com"}
    )
    assert response.status_code == 422
    assert any(error["loc"][-1] == "password" for error in response.json()["detail"])


def test_driver_signup_creates_profile(client, db_session):
    from app.models.driver import Driver

    # 1. Driver signup with a specific phone number
    response = client.post(
        "/users/",
        json={
            "username": "driver_signup_test1",
            "email": "driver_test1@example.com",
            "password": "secret123",
            "role": "driver",
            "phone": "9998887776",
        },
    )
    assert response.status_code == 200
    user_id = response.json()["id"]

    # Verify driver profile exists in DB
    driver = db_session.query(Driver).filter(Driver.user_id == user_id).first()
    assert driver is not None
    assert driver.name == "driver_signup_test1"
    assert driver.phone == "9998887776"
    assert driver.status == "available"

    # 2. Driver signup without a phone number (generates temporary one)
    response_no_phone = client.post(
        "/users/",
        json={
            "username": "driver_signup_test2",
            "email": "driver_test2@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    assert response_no_phone.status_code == 200
    user_id_no_phone = response_no_phone.json()["id"]

    driver_no_phone = (
        db_session.query(Driver).filter(Driver.user_id == user_id_no_phone).first()
    )
    assert driver_no_phone is not None
    assert driver_no_phone.phone == f"TEMP-{user_id_no_phone}"

    # 3. Duplicate phone registration fails
    response_duplicate_phone = client.post(
        "/users/",
        json={
            "username": "driver_signup_test3",
            "email": "driver_test3@example.com",
            "password": "secret123",
            "role": "driver",
            "phone": "9998887776",  # duplicate of the first one
        },
    )
    assert response_duplicate_phone.status_code == 400
    assert "already exists" in response_duplicate_phone.json()["detail"].lower()
