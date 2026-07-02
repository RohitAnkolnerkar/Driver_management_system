import pytest
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
    response = client.get("/users/me", headers={"Authorization": "Bearer invalid.token"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_access_users_me_expired_token(client):
    token = create_access_token({"sub": "testuser"}, expires_delta=timedelta(seconds=-1))
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
    response = client.post("/users/", json={"username": "bademail", "email": "not-an-email", "password": "secret123"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "value_error"
    assert response.json()["detail"][0]["loc"] == ["body", "email"]


def test_user_registration_short_password(client):
    response = client.post("/users/", json={"username": "shortpass", "email": "shortpass@example.com", "password": "123"})
    assert response.status_code == 422
    assert any(error["loc"][-1] == "password" for error in response.json()["detail"])


def test_login_wrong_password(client):
    response = client.post("/auth/token", data={"username": "testuser", "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_login_nonexistent_user(client):
    response = client.post("/auth/token", data={"username": "unknown", "password": "secret123"})
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
    response = client.post("/users/", json={"username": "missingpass", "email": "missingpass@example.com"})
    assert response.status_code == 422
    assert any(error["loc"][-1] == "password" for error in response.json()["detail"])
