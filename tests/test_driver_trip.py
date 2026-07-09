from app.core.security import hash_password
from app.models.user import User


def get_token(client, username="dispatcher", password="secret123"):
    login_data = {"username": username, "password": password}
    response = client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    return response.json()["access_token"]


def create_user(
    client, username="dispatcher", email="dispatcher@example.com", password="secret123"
):
    response = client.post(
        "/users/", json={"username": username, "email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()


def create_driver(
    client,
    token,
    name="Rohit",
    phone="1234567890",
    license_number="ABC123",
    license_expiry="2026-12-31T00:00:00",
):
    response = client.post(
        "/drivers/",
        json={
            "name": name,
            "phone": phone,
            "license_number": license_number,
            "license_expiry": license_expiry,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    return response.json()


def create_user_with_role(
    db_session,
    username="viewer",
    email="viewer@example.com",
    password="secret123",
    role="viewer",
):
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_driver_and_trip_lifecycle(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(client, token)
    assert driver["status"] == "available"

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["source"] == "A"
    assert trip["destination"] == "B"
    assert trip["status"] == "created"

    response = client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Driver assigned successfully"

    response = client.patch(
        f"/trips/{trip['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Trip started"

    response = client.patch(
        f"/trips/{trip['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Trip completed"


def test_protected_endpoints_require_token(client):
    response = client.post(
        "/drivers/",
        json={
            "name": "Test",
            "phone": "1112223333",
            "license_number": "ABC",
            "license_expiry": "2026-12-31T00:00:00",
        },
    )
    assert response.status_code == 401

    response = client.post("/trips/", json={"source": "A", "destination": "B"})
    assert response.status_code == 401

    response = client.patch("/trips/1/start")
    assert response.status_code == 401


def test_create_driver_duplicate_phone(client):
    create_user(client)
    token = get_token(client)
    create_driver(client, token, phone="5555555555")

    response = client.post(
        "/drivers/",
        json={
            "name": "Duplicate",
            "phone": "5555555555",
            "license_number": "ABC123",
            "license_expiry": "2026-12-31T00:00:00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Driver with this phone already exists"


def test_create_driver_invalid_license_expiry(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/drivers/",
        json={
            "name": "InvalidDate",
            "phone": "9998887777",
            "license_number": "ABC123",
            "license_expiry": "not-a-date",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
    assert any(
        error["loc"][-1] == "license_expiry" for error in response.json()["detail"]
    )


def test_create_trip_invalid_data(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
    assert any(error["loc"][-1] == "destination" for error in response.json()["detail"])


def test_create_trip_with_company_fields(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "source_company": "Acme Logistics",
            "destination_company": "Beta Warehousing",
            "duration_minutes": 30,
            "distance_km": 10.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["source_company"] == "Acme Logistics"
    assert trip["destination_company"] == "Beta Warehousing"
    assert trip["cost_per_trip"] == 40.0 + 10.0 * 12.0 + 30 * 1.5
    assert trip["time_taken_minutes"] == 30


def test_trip_priority_is_created_and_updated(client):
    create_user(client)
    token = get_token(client)

    create_response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B", "priority": "high"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_response.status_code == 200
    trip = create_response.json()
    assert trip["priority"] == "high"

    update_response = client.patch(
        f"/trips/{trip['id']}",
        json={"priority": "urgent"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["priority"] == "urgent"


def test_dispatch_board_returns_pending_trips_and_available_drivers(client):
    create_user(client)
    token = get_token(client)

    create_driver(client, token, name="Asha", phone="1111111111")

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B", "priority": "urgent"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    board_response = client.get(
        "/trips/dispatch/board",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert board_response.status_code == 200
    board = board_response.json()
    assert len(board["pending_trips"]) >= 1
    assert board["pending_trips"][0]["priority"] == "urgent"
    assert len(board["available_drivers"]) >= 1
    assert board["available_drivers"][0]["status"] == "available"


def test_list_trips_by_source_company_and_date(client):
    from datetime import datetime, timedelta

    create_user(client)
    token = get_token(client)

    future_date = datetime.utcnow() + timedelta(days=5)
    future_date_str = future_date.strftime("%Y-%m-%dT10:00:00")
    future_date_only_str = future_date.strftime("%Y-%m-%d")

    response = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "source_company": "Acme Logistics",
            "destination_company": "Beta Warehousing",
            "scheduled_date": future_date_str,
            "duration_minutes": 45,
            "distance_km": 20.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()

    response = client.get(
        f"/trips/?source_company=Acme Logistics&scheduled_on={future_date_only_str}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) == 1
    assert trips[0]["id"] == trip["id"]
    assert trips[0]["source_company"] == "Acme Logistics"
    assert trips[0]["cost_per_trip"] == 40.0 + 20.0 * 12.0 + 45 * 1.5
    assert trips[0]["time_taken_minutes"] == 45


def test_update_trip_company_fields(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip_id = response.json()["id"]

    update_response = client.patch(
        f"/trips/{trip_id}",
        json={
            "source_company": "Acme Logistics",
            "destination_company": "Beta Warehousing",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["source_company"] == "Acme Logistics"
    assert updated["destination_company"] == "Beta Warehousing"


def test_assign_invalid_driver_id(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip_id = response.json()["id"]

    response = client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": 9999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Driver not found"


def test_bulk_assign_trips_to_driver(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Bulk Driver", phone="5551112222")

    trip_one = client.post(
        "/trips/",
        json={"source": "North", "destination": "West"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    trip_two = client.post(
        "/trips/",
        json={"source": "East", "destination": "South"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.post(
        "/trips/bulk-assign",
        json={"trip_ids": [trip_one["id"], trip_two["id"]], "driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["assigned_count"] == 2
    assert payload["driver_id"] == driver["id"]
    assert set(payload["trip_ids"]) == {trip_one["id"], trip_two["id"]}

    for trip_id in [trip_one["id"], trip_two["id"]]:
        trip_response = client.get(
            f"/trips/{trip_id}", headers={"Authorization": f"Bearer {token}"}
        )
        assert trip_response.status_code == 200
        trip_data = trip_response.json()
        assert trip_data["driver_id"] == driver["id"]
        assert trip_data["status"] == "assigned"


def test_bulk_cancel_trips(client):
    create_user(client)
    token = get_token(client)

    trip_one = client.post(
        "/trips/",
        json={"source": "North", "destination": "West"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    trip_two = client.post(
        "/trips/",
        json={"source": "East", "destination": "South"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.post(
        "/trips/bulk-cancel",
        json={
            "trip_ids": [trip_one["id"], trip_two["id"]],
            "reason": "No longer needed",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["cancelled_count"] == 2
    assert set(payload["trip_ids"]) == {trip_one["id"], trip_two["id"]}

    for trip_id in [trip_one["id"], trip_two["id"]]:
        trip_response = client.get(
            f"/trips/{trip_id}", headers={"Authorization": f"Bearer {token}"}
        )
        assert trip_response.status_code == 200
        assert trip_response.json()["status"] == "cancelled"


def test_start_trip_before_assign(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = response.json()["id"]

    response = client.patch(
        f"/trips/{trip_id}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Trip must be assigned first"


def test_complete_trip_before_start(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = response.json()["id"]

    response = client.patch(
        f"/trips/{trip_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Trip not started"


def test_get_drivers_pagination_and_filtering(client):
    create_user(client)
    token = get_token(client)

    create_driver(client, token, name="Alpha", phone="1111111111")
    create_driver(client, token, name="Bravo", phone="2222222222")
    create_driver(client, token, name="Charlie", phone="3333333333")

    response = client.get(
        "/drivers/?limit=2&offset=0", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.get(
        "/drivers/?q=Bravo", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Bravo"

    response = client.get(
        "/drivers/?status=available", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert all(driver["status"] == "available" for driver in response.json())


def test_driver_creation_denied_for_non_dispatcher_role(client, db_session):
    create_user_with_role(
        db_session,
        username="viewer",
        email="viewer@example.com",
        password="secret123",
        role="viewer",
    )
    token = get_token(client, username="viewer", password="secret123")

    response = client.post(
        "/drivers/",
        json={
            "name": "Test",
            "phone": "4445556666",
            "license_number": "ABC",
            "license_expiry": "2026-12-31T00:00:00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_get_driver_by_id(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Detail Driver", phone="7778889999")

    response = client.get(
        f"/drivers/{driver['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Detail Driver"
    assert response.json()["phone"] == "7778889999"


def test_get_driver_availability_history(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="History Driver", phone="5556668888")

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"status": "inactive"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    history_response = client.get(
        f"/drivers/{driver['id']}/availability-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_response.status_code == 200
    history = history_response.json()
    assert any(entry["status"] == "inactive" for entry in history)
    assert any(entry["driver_id"] == driver["id"] for entry in history)


def test_get_driver_availability_analytics(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Analytics Driver", phone="5556669999")

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"status": "inactive"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    analytics_response = client.get(
        f"/drivers/{driver['id']}/availability-analytics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert analytics["driver_id"] == driver["id"]
    assert analytics["inactive_minutes"] >= 0
    assert analytics["total_observed_minutes"] >= 0


def test_get_driver_daily_availability_analytics(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(
        client, token, name="Daily Analytics Driver", phone="5556670000"
    )

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"status": "inactive"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    analytics_response = client.get(
        f"/drivers/{driver['id']}/daily-availability-analytics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert isinstance(analytics, list)
    assert analytics[0]["date"]


def test_get_dispatcher_workload_summary(client):
    create_user(client)
    token = get_token(client)

    response = client.get(
        "/drivers/dashboard/workload-summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    summary = response.json()
    assert "total_drivers" in summary
    assert "available_drivers" in summary
    assert "pending_trips" in summary
    assert summary["total_drivers"] >= 0


def test_get_trip_history(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip_id = response.json()["id"]

    history_response = client.get(
        f"/trips/{trip_id}/history", headers={"Authorization": f"Bearer {token}"}
    )
    assert history_response.status_code == 200
    history = history_response.json()
    assert any(entry["status"] == "created" for entry in history)


def test_get_driver_performance(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Performance Driver", phone="5556667778")

    completed_trip = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 12.0,
            "duration_minutes": 30,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{completed_trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{completed_trip['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{completed_trip['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    cancelled_trip = client.post(
        "/trips/",
        json={
            "source": "C",
            "destination": "D",
            "distance_km": 8.0,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{cancelled_trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{cancelled_trip['id']}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        f"/drivers/{driver['id']}/performance",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    performance = response.json()
    assert performance["completed_trips"] == 1
    assert performance["cancelled_trips"] == 1
    assert performance["total_trips"] == 2
    assert performance["completion_rate"] == 50.0
    assert performance["cancellation_rate"] == 50.0


def test_get_driver_summary(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Summary Driver", phone="5556667777")

    trip1 = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip1['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    trip2 = client.post(
        "/trips/",
        json={"source": "C", "destination": "D"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip2['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip2['id']}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        f"/drivers/{driver['id']}/summary", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["total_trips"] == 2
    assert summary["completed_trips"] == 1
    assert summary["cancelled_trips"] == 1
    assert summary["started_trips"] == 0
    assert summary["assigned_trips"] == 0


def test_update_driver_profile(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Profile Driver", phone="8887776666")

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"name": "Updated Driver", "phone": "9998887777", "status": "inactive"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Updated Driver"
    assert updated["phone"] == "9998887777"
    assert updated["status"] == "inactive"


def test_list_trips_filtering_by_status_and_driver(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Filter Driver", phone="1010101010")

    trip_response = client.post(
        "/trips/",
        json={"source": "Mumbai", "destination": "Delhi"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trip_response.status_code == 200
    trip_id = trip_response.json()["id"]

    client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        f"/trips/?status=assigned&driver_id={driver['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) == 1
    assert trips[0]["driver_id"] == driver["id"]
    assert trips[0]["status"] == "assigned"

    response = client.get(
        f"/trips/{trip_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["source"] == "Mumbai"
    assert response.json()["destination"] == "Delhi"


def test_update_driver_license_fields(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="License Driver", phone="6665554444")

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"license_number": "NEWLIC123", "license_expiry": "2027-10-01T00:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["license_number"] == "NEWLIC123"
    assert updated["license_expiry"].startswith("2027-10-01")


def test_update_driver_duplicate_phone_returns_400(client):
    create_user(client)
    token = get_token(client)
    create_driver(client, token, name="First", phone="1111111111")
    second_driver = create_driver(client, token, name="Second", phone="2222222222")

    response = client.patch(
        f"/drivers/{second_driver['id']}",
        json={"phone": "1111111111"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Driver with this phone already exists"


def test_get_driver_not_found_returns_404(client):
    create_user(client)
    token = get_token(client)

    response = client.get("/drivers/9999", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Driver not found"


def test_get_driver_trip_history(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="History Driver", phone="3243254321")

    trip_a = client.post(
        "/trips/",
        json={"source": "Home", "destination": "Cafe"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    response = client.patch(
        f"/trips/{trip_a['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    start_response = client.patch(
        f"/trips/{trip_a['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start_response.status_code == 200

    complete_response = client.patch(
        f"/trips/{trip_a['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_response.status_code == 200

    trip_b = client.post(
        "/trips/",
        json={"source": "Cafe", "destination": "Office"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    response = client.patch(
        f"/trips/{trip_b['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    response = client.get(
        f"/drivers/{driver['id']}/trips", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) == 2
    assert {trip["id"] for trip in trips} == {trip_a["id"], trip_b["id"]}


def test_create_and_discard_regular_trip(client):
    create_user(client)
    token = get_token(client)

    scheduled_date = "2026-12-31T10:00:00"
    response = client.post(
        "/trips/",
        json={
            "source": "Station",
            "destination": "Airport",
            "is_regular": True,
            "scheduled_date": scheduled_date,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["is_regular"] is True
    assert trip["scheduled_date"].startswith("2026-12-31")
    assert trip["status"] == "created"

    discard_response = client.patch(
        f"/trips/{trip['id']}/discard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert discard_response.status_code == 200
    assert discard_response.json()["message"] == "Trip discarded"

    trip_response = client.get(
        f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert trip_response.status_code == 200
    assert trip_response.json()["status"] == "cancelled"
    assert trip_response.json()["cancel_reason"] == "discarded"


def test_get_dashboard_summary(client):
    create_user(client)
    token = get_token(client)

    driver_a = create_driver(
        client, token, name="Dashboard Driver A", phone="1112223334"
    )
    create_driver(client, token, name="Dashboard Driver B", phone="1112223335")

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver_a["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/drivers/dashboard/summary", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["total_drivers"] == 2
    assert summary["available_drivers"] == 1
    assert summary["on_trip_drivers"] == 1
    assert summary["inactive_drivers"] == 0
    assert summary["active_trips"] == 1
    assert summary["completed_trips"] == 0
    assert summary["cancelled_trips"] == 0
    assert summary["total_trips_today"] == 1


def test_get_trip_stats(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Stats Driver", phone="5554443333")

    trip1 = client.post(
        "/trips/",
        json={
            "source": "X",
            "destination": "Y",
            "distance_km": 10,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip1['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    trip2 = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip2['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip2['id']}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get("/trips/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    stats = response.json()

    assert stats["total_trips"] == 2
    assert stats["completed_trips"] == 1
    assert stats["cancelled_trips"] == 1
    assert stats["created_trips"] == 0
    assert stats["assigned_trips"] == 0
    assert stats["started_trips"] == 0
    assert stats["total_estimated_fare"] == 230.0
    assert stats["average_estimated_fare"] == round((190.0 + 40.0) / 2, 2)


def test_trip_response_includes_driver_info(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Driver Info", phone="7778889990")

    trip = client.post(
        "/trips/",
        json={"source": "Station", "destination": "Mall"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assign_response = client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assign_response.status_code == 200

    response = client.get(
        f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    trip_json = response.json()
    assert trip_json["driver_id"] == driver["id"]
    assert trip_json["driver_name"] == driver["name"]
    assert trip_json["driver_phone"] == driver["phone"]


def test_get_trips_requires_auth(client):
    response = client.get("/trips/")
    assert response.status_code == 401


def test_get_trips_created_date_filters(client):
    create_user(client)
    token = get_token(client)
    create_driver(client, token, name="DateFilter Driver", phone="1010101012")

    client.post(
        "/trips/",
        json={"source": "Old", "destination": "Nowhere"},
        headers={"Authorization": f"Bearer {token}"},
    )

    client.post(
        "/trips/",
        json={"source": "New", "destination": "Somewhere"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/trips/?created_after=2000-01-01T00:00:00&created_before=2100-01-01T00:00:00",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert len(response.json()) >= 2

    response = client.get(
        "/trips/?created_before=2000-01-01T00:00:00",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_regular_trip_recurs_on_non_sunday(client):
    from datetime import datetime, timedelta

    create_user(client)
    token = get_token(client)

    now = datetime.utcnow()
    days_ahead = 0 - now.weekday()
    if days_ahead <= 2:
        days_ahead += 7
    next_monday = now + timedelta(days=days_ahead)
    scheduled_date = next_monday.strftime("%Y-%m-%dT10:00:00")
    query_date = (next_monday + timedelta(days=1)).strftime("%Y-%m-%d")

    response = client.post(
        "/trips/",
        json={
            "source": "Station",
            "destination": "Airport",
            "is_regular": True,
            "scheduled_date": scheduled_date,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["is_regular"] is True
    assert trip["scheduled_date"].startswith(next_monday.strftime("%Y-%m-%d"))

    response = client.get(
        f"/trips/?scheduled_on={query_date}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trips = response.json()
    assert any(t["id"] == trip["id"] for t in trips)


def test_regular_trip_does_not_show_on_sunday(client):
    from datetime import datetime, timedelta

    create_user(client)
    token = get_token(client)

    now = datetime.utcnow()
    days_ahead = 0 - now.weekday()
    if days_ahead <= 2:
        days_ahead += 7
    next_monday = now + timedelta(days=days_ahead)
    scheduled_date = next_monday.strftime("%Y-%m-%dT10:00:00")
    query_date = (next_monday - timedelta(days=1)).strftime("%Y-%m-%d")

    response = client.post(
        "/trips/",
        json={
            "source": "Station",
            "destination": "Airport",
            "is_regular": True,
            "scheduled_date": scheduled_date,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()

    response = client.get(
        f"/trips/?scheduled_on={query_date}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trips = response.json()
    assert all(t["id"] != trip["id"] for t in trips)


def test_estimate_trip_fare(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/estimate-fare",
        json={"distance_km": 10.0, "duration_minutes": 15},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["base_fare"] == 40.0
    assert data["distance_km"] == 10.0
    assert data["duration_minutes"] == 15
    assert data["estimated_fare"] == 40.0 + 10.0 * 12.0 + 15 * 1.5


def test_estimate_trip_fare_validation(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/estimate-fare",
        json={"distance_km": -1.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_create_trip_with_distance_and_duration(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 8.0,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["distance_km"] == 8.0
    assert trip["duration_minutes"] == 20
    assert trip["estimated_fare"] == 40.0 + 8.0 * 12.0 + 20 * 1.5


def test_update_trip_before_assignment(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={"source": "Old", "destination": "OldTown"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = response.json()["id"]

    update_response = client.patch(
        f"/trips/{trip_id}",
        json={
            "source": "New",
            "destination": "NewTown",
            "distance_km": 5.5,
            "duration_minutes": 12,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["source"] == "New"
    assert updated["destination"] == "NewTown"
    assert updated["distance_km"] == 5.5
    assert updated["duration_minutes"] == 12
    assert updated["estimated_fare"] == 40.0 + 5.5 * 12.0 + 12 * 1.5


def test_get_driver_earnings(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Earnings Driver", phone="1231231234")

    trip1 = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 10.0,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip1['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    client.patch(
        f"/trips/{trip1['id']}/complete", headers={"Authorization": f"Bearer {token}"}
    )

    trip2 = client.post(
        "/trips/",
        json={
            "source": "C",
            "destination": "D",
            "distance_km": 5.0,
            "duration_minutes": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip2['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip2['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    client.patch(
        f"/trips/{trip2['id']}/complete", headers={"Authorization": f"Bearer {token}"}
    )

    earnings_response = client.get(
        f"/drivers/{driver['id']}/earnings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert earnings_response.status_code == 200
    earnings = earnings_response.json()
    expected_total = round(
        40.0 + 10.0 * 12.0 + 20 * 1.5 + 40.0 + 5.0 * 12.0 + 10 * 1.5, 2
    )
    assert earnings["completed_trips"] == 2
    assert earnings["total_earnings"] == expected_total
    assert earnings["average_fare"] == round(expected_total / 2, 2)


def test_get_driver_earnings_date_filters(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Date Earnings", phone="1239876543")

    trip1 = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 10.0,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip1['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip1['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    client.patch(
        f"/trips/{trip1['id']}/complete", headers={"Authorization": f"Bearer {token}"}
    )

    trip2 = client.post(
        "/trips/",
        json={
            "source": "C",
            "destination": "D",
            "distance_km": 5.0,
            "duration_minutes": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{trip2['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip2['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    client.patch(
        f"/trips/{trip2['id']}/complete", headers={"Authorization": f"Bearer {token}"}
    )

    response = client.get(
        (
            f"/drivers/{driver['id']}/earnings?"
            "completed_after=2000-01-01T00:00:00&"
            "completed_before=2100-01-01T00:00:00"
        ),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    earnings = response.json()
    assert earnings["completed_trips"] == 2

    response = client.get(
        f"/drivers/{driver['id']}/earnings?completed_before=2000-01-01T00:00:00",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    earnings = response.json()
    assert earnings["completed_trips"] == 0


def test_driver_leaderboard_orders_by_earnings(client):
    create_user(client)
    token = get_token(client)
    top_driver = create_driver(client, token, name="Top Driver", phone="1112223333")
    second_driver = create_driver(
        client, token, name="Second Driver", phone="4445556666"
    )

    top_trip = client.post(
        "/trips/",
        json={
            "source": "Top",
            "destination": "Earn",
            "distance_km": 10,
            "duration_minutes": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{top_trip['id']}/assign",
        json={"driver_id": top_driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{top_trip['id']}/start", headers={"Authorization": f"Bearer {token}"}
    )
    client.patch(
        f"/trips/{top_trip['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    second_trip = client.post(
        "/trips/",
        json={
            "source": "Second",
            "destination": "Earn",
            "distance_km": 5,
            "duration_minutes": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    client.patch(
        f"/trips/{second_trip['id']}/assign",
        json={"driver_id": second_driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{second_trip['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{second_trip['id']}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/drivers/leaderboard", headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code != 200:
        print("LEADERBOARD RESPONSE CODE:", response.status_code)
        print("LEADERBOARD RESPONSE BODY:", response.json())
    assert response.status_code == 200
    leaderboard = response.json()

    assert leaderboard[0]["driver_id"] == top_driver["id"]
    assert leaderboard[0]["total_earnings"] > leaderboard[1]["total_earnings"]
    assert leaderboard[0]["average_fare"] == round((40.0 + 10 * 12.0 + 20 * 1.5), 2)
    assert leaderboard[1]["driver_id"] == second_driver["id"]


def test_update_and_get_trip_summary(client):
    create_user(client)
    token = get_token(client)
    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip_id = response.json()["id"]

    summary_response = client.patch(
        f"/trips/{trip_id}/summary",
        json={"distance_km": 12.5, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["trip_id"] == trip_id
    assert summary["distance_km"] == 12.5
    assert summary["duration_minutes"] == 30
    assert summary["estimated_fare"] == 40.0 + 12.5 * 12.0 + 30 * 1.5

    get_summary = client.get(
        f"/trips/{trip_id}/summary", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_summary.status_code == 200
    returned = get_summary.json()
    assert returned == summary


def test_get_trip_not_found_returns_404(client):
    create_user(client)
    token = get_token(client)

    response = client.get("/trips/9999", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_cancel_assigned_trip(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Cancel Driver", phone="9990001111")

    trip_response = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trip_response.status_code == 200
    trip_id = trip_response.json()["id"]

    response = client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    response = client.patch(
        f"/trips/{trip_id}/cancel",
        json={"reason": "Customer no-show"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Trip cancelled"

    trip = client.get(f"/trips/{trip_id}", headers={"Authorization": f"Bearer {token}"})
    assert trip.status_code == 200
    trip_data = trip.json()
    assert trip_data["status"] == "cancelled"
    assert trip_data["cancel_reason"] == "Customer no-show"

    driver_after = client.get(
        f"/drivers/{driver['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert driver_after.status_code == 200
    assert driver_after.json()["status"] == "available"


def test_cancel_started_trip_is_not_allowed(client):
    create_user(client)
    token = get_token(client)
    driver = create_driver(client, token, name="Started Driver", phone="2223334444")

    trip_response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = trip_response.json()["id"]

    client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip_id}/start",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.patch(
        f"/trips/{trip_id}/cancel",
        json={"reason": "Late start"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Trip cannot be cancelled"


def test_reassign_trip_to_new_driver(client):
    create_user(client)
    token = get_token(client)
    driver_one = create_driver(client, token, name="Driver One", phone="3334445555")
    driver_two = create_driver(client, token, name="Driver Two", phone="4445556666")

    trip_response = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = trip_response.json()["id"]

    assign_response = client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver_one["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assign_response.status_code == 200

    reassign_response = client.patch(
        f"/trips/{trip_id}/reassign",
        json={"driver_id": driver_two["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reassign_response.status_code == 200
    assert reassign_response.json()["message"] == "Driver reassigned successfully"

    trip = client.get(
        f"/trips/{trip_id}", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert trip["driver_id"] == driver_two["id"]

    driver_one_status = client.get(
        f"/drivers/{driver_one['id']}", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert driver_one_status["status"] == "available"
    driver_two_status = client.get(
        f"/drivers/{driver_two['id']}", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert driver_two_status["status"] == "on_trip"


def test_reassign_to_unavailable_driver_fails(client):
    create_user(client)
    token = get_token(client)
    driver_one = create_driver(client, token, name="Driver One", phone="5556667777")
    driver_two = create_driver(client, token, name="Driver Two", phone="6667778888")

    trip_response = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    )
    trip_id = trip_response.json()["id"]

    client.patch(
        f"/trips/{trip_id}/assign",
        json={"driver_id": driver_one["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    # make second driver unavailable by assigning them to a new trip
    trip_response2 = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip_response2.json()["id"]}/assign",
        json={"driver_id": driver_two["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.patch(
        f"/trips/{trip_id}/reassign",
        json={"driver_id": driver_two["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Driver is not available"


def test_get_drivers_license_expiry_filter(client):
    create_user(client)
    token = get_token(client)
    create_driver(
        client,
        token,
        name="Soon Expiry",
        phone="1010101011",
        license_expiry="2025-01-01T00:00:00",
    )
    create_driver(
        client,
        token,
        name="Later Expiry",
        phone="2020202020",
        license_expiry="2030-01-01T00:00:00",
    )

    response = client.get(
        "/drivers/?license_expiry_before=2026-01-01T00:00:00",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Soon Expiry"


def test_get_drivers_requires_auth(client):
    response = client.get("/drivers/")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_non_dispatcher_cannot_manage_trips(client, db_session):
    create_user_with_role(
        db_session,
        username="viewer2",
        email="viewer2@example.com",
        password="secret123",
        role="viewer",
    )
    token = get_token(client, username="viewer2", password="secret123")

    response = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_assign_driver_expired_license_fails(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(
        client,
        token,
        name="Expired Driver",
        phone="9998881111",
        license_expiry="2020-01-01T00:00:00",
    )

    trip = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Driver's license is expired"


def test_bulk_assign_driver_expired_license_fails(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(
        client,
        token,
        name="Expired Driver 2",
        phone="9998882222",
        license_expiry="2020-01-01T00:00:00",
    )

    trip = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.post(
        "/trips/bulk-assign",
        json={"trip_ids": [trip["id"]], "driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Driver's license is expired"


def test_reassign_driver_expired_license_fails(client):
    create_user(client)
    token = get_token(client)

    active_driver = create_driver(
        client,
        token,
        name="Active Driver",
        phone="9998883333",
        license_expiry="2030-01-01T00:00:00",
    )

    expired_driver = create_driver(
        client,
        token,
        name="Expired Driver 3",
        phone="9998884444",
        license_expiry="2020-01-01T00:00:00",
    )

    trip = client.post(
        "/trips/",
        json={"source": "X", "destination": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assign_res = client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": active_driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assign_res.status_code == 200

    reassign_res = client.patch(
        f"/trips/{trip['id']}/reassign",
        json={"driver_id": expired_driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reassign_res.status_code == 400
    assert reassign_res.json()["detail"] == "Driver's license is expired"


def test_get_expired_or_expiring_drivers_alerts(client):
    from datetime import datetime, timedelta

    create_user(client)
    token = get_token(client)

    create_driver(
        client,
        token,
        name="Expired License",
        phone="5550001111",
        license_expiry="2020-01-01T00:00:00",
    )

    create_driver(
        client,
        token,
        name="Soon Expiry",
        phone="5550002222",
        license_expiry=(datetime.utcnow() + timedelta(days=5)).strftime(
            "%Y-%m-%dT00:00:00"
        ),
    )

    create_driver(
        client,
        token,
        name="Later Expiry",
        phone="5550003333",
        license_expiry=(datetime.utcnow() + timedelta(days=40)).strftime(
            "%Y-%m-%dT00:00:00"
        ),
    )

    response = client.get(
        "/drivers/alerts/expired",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert data[0]["name"] == "Expired License"
    assert data[1]["name"] == "Soon Expiry"


def test_auto_assign_chooses_longest_available(client, db_session):
    from datetime import datetime, timedelta

    from app.models.driver import Driver, DriverAvailabilityHistory

    create_user(client)
    token = get_token(client)

    d1_data = create_driver(client, token, name="Long Idle Driver", phone="5551112222")
    d2_data = create_driver(client, token, name="Short Idle Driver", phone="5551113333")

    driver1 = db_session.query(Driver).filter(Driver.id == d1_data["id"]).first()
    driver2 = db_session.query(Driver).filter(Driver.id == d2_data["id"]).first()

    db_session.query(DriverAvailabilityHistory).filter(
        DriverAvailabilityHistory.driver_id.in_([driver1.id, driver2.id])
    ).delete()

    h1 = DriverAvailabilityHistory(
        driver_id=driver1.id,
        status="available",
        changed_at=datetime.utcnow() - timedelta(hours=2),
    )
    h2 = DriverAvailabilityHistory(
        driver_id=driver2.id,
        status="available",
        changed_at=datetime.utcnow() - timedelta(hours=1),
    )
    db_session.add_all([h1, h2])
    db_session.commit()

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.patch(
        f"/trips/{trip['id']}/auto-assign",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["driver_id"] == driver1.id
    assert data["driver_name"] == "Long Idle Driver"


def test_auto_assign_ignores_expired_license(client, db_session):
    from datetime import datetime, timedelta

    from app.models.driver import Driver, DriverAvailabilityHistory

    create_user(client)
    token = get_token(client)

    d1_data = create_driver(
        client,
        token,
        name="Expired Long Idle",
        phone="5552221111",
        license_expiry="2020-01-01T00:00:00",
    )
    d2_data = create_driver(
        client,
        token,
        name="Valid Short Idle",
        phone="5552222222",
        license_expiry="2030-01-01T00:00:00",
    )

    driver1 = db_session.query(Driver).filter(Driver.id == d1_data["id"]).first()
    driver2 = db_session.query(Driver).filter(Driver.id == d2_data["id"]).first()

    db_session.query(DriverAvailabilityHistory).filter(
        DriverAvailabilityHistory.driver_id.in_([driver1.id, driver2.id])
    ).delete()
    h1 = DriverAvailabilityHistory(
        driver_id=driver1.id,
        status="available",
        changed_at=datetime.utcnow() - timedelta(hours=2),
    )
    h2 = DriverAvailabilityHistory(
        driver_id=driver2.id,
        status="available",
        changed_at=datetime.utcnow() - timedelta(hours=1),
    )
    db_session.add_all([h1, h2])
    db_session.commit()

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.patch(
        f"/trips/{trip['id']}/auto-assign",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["driver_id"] == driver2.id
    assert data["driver_name"] == "Valid Short Idle"


def test_auto_assign_no_drivers_available_fails(client):
    create_user(client)
    token = get_token(client)

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    response = client.patch(
        f"/trips/{trip['id']}/auto-assign",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "No available drivers found"


def test_get_my_driver_profile_success(client):
    create_user(client)
    client.post(
        "/users/",
        json={
            "username": "driver_user",
            "email": "driver_user@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    token = get_token(client, username="driver_user", password="secret123")

    profile_res = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert profile_res.status_code == 200
    user_id = profile_res.json()["id"]

    disp_token = get_token(client)
    res = client.post(
        "/drivers/",
        json={
            "name": "Linked Driver",
            "phone": "5559990000",
            "license_number": "LIC999",
            "license_expiry": "2030-01-01T00:00:00",
            "user_id": user_id,
        },
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    assert res.status_code == 200
    driver_data = res.json()

    response = client.get(
        "/drivers/profile/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == driver_data["id"]
    assert data["name"] == "Linked Driver"
    assert data["user_id"] == user_id


def test_get_my_driver_profile_non_driver_fails(client):
    create_user(client)
    token = get_token(client)

    response = client.get(
        "/drivers/profile/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "User is not a driver"


def test_start_trip_with_custom_note(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(client, token)
    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.patch(
        f"/trips/{trip['id']}/start",
        json={"note": "custom start shift note"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    history_res = client.get(
        f"/trips/{trip['id']}/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    history = history_res.json()

    start_logs = [log for log in history if log["status"] == "started"]
    assert len(start_logs) == 1
    assert start_logs[0]["note"] == "custom start shift note"


def test_complete_trip_with_custom_note(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(client, token)
    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    client.patch(
        f"/trips/{trip['id']}/start",
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.patch(
        f"/trips/{trip['id']}/complete",
        json={"note": "custom complete shift note"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    history_res = client.get(
        f"/trips/{trip['id']}/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    history = history_res.json()

    complete_logs = [log for log in history if log["status"] == "completed"]
    assert len(complete_logs) == 1
    assert complete_logs[0]["note"] == "custom complete shift note"


def test_update_driver_status_with_custom_note(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(client, token)

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"status": "inactive", "note": "taking lunch break"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    history_res = client.get(
        f"/drivers/{driver['id']}/availability-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    history = history_res.json()

    inactive_logs = [log for log in history if log["status"] == "inactive"]
    assert len(inactive_logs) == 1
    assert inactive_logs[0]["note"] == "taking lunch break"


def test_update_driver_status_without_note_defaults(client):
    create_user(client)
    token = get_token(client)

    driver = create_driver(client, token)

    response = client.patch(
        f"/drivers/{driver['id']}",
        json={"status": "inactive"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    history_res = client.get(
        f"/drivers/{driver['id']}/availability-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    history = history_res.json()

    inactive_logs = [log for log in history if log["status"] == "inactive"]
    assert len(inactive_logs) == 1
    assert inactive_logs[0]["note"] == "status updated"


def test_delete_driver_success(client, db_session):
    from app.models.driver import Driver, DriverAvailabilityHistory
    from app.models.trip import Trip

    client.post(
        "/users/",
        json={
            "username": "admin_user",
            "email": "admin_user@example.com",
            "password": "secret123",
            "role": "admin",
        },
    )
    admin_token = get_token(client, username="admin_user", password="secret123")

    create_user(client)
    disp_token = get_token(client)

    driver = create_driver(client, disp_token)

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    client.patch(
        f"/trips/{trip['id']}/start",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    client.patch(
        f"/trips/{trip['id']}/complete",
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    response = client.delete(
        f"/drivers/{driver['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Driver deleted successfully"

    db_driver = db_session.query(Driver).filter(Driver.id == driver["id"]).first()
    assert db_driver is None

    history = (
        db_session.query(DriverAvailabilityHistory)
        .filter(DriverAvailabilityHistory.driver_id == driver["id"])
        .all()
    )
    assert len(history) == 0

    db_trip = db_session.query(Trip).filter(Trip.id == trip["id"]).first()
    assert db_trip is not None
    assert db_trip.driver_id is None


def test_delete_driver_on_trip_fails(client):
    client.post(
        "/users/",
        json={
            "username": "admin_user",
            "email": "admin_user@example.com",
            "password": "secret123",
            "role": "admin",
        },
    )
    admin_token = get_token(client, username="admin_user", password="secret123")

    create_user(client)
    disp_token = get_token(client)
    driver = create_driver(client, disp_token)

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    client.patch(
        f"/trips/{trip['id']}/start",
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    response = client.delete(
        f"/drivers/{driver['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 400
    assert (
        response.json()["detail"] == "Cannot delete a driver who is currently on a trip"
    )


def test_delete_driver_non_admin_forbidden(client):
    create_user(client)
    disp_token = get_token(client)

    driver = create_driver(client, disp_token)

    response = client.delete(
        f"/drivers/{driver['id']}",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_get_trip_history_as_assigned_driver_success(client):
    client.post(
        "/users/",
        json={
            "username": "driver_1",
            "email": "d1@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    d1_token = get_token(client, username="driver_1", password="secret123")

    profile_res = client.get(
        "/users/me", headers={"Authorization": f"Bearer {d1_token}"}
    )
    user_id = profile_res.json()["id"]

    create_user(client)
    disp_token = get_token(client)
    driver = client.post(
        "/drivers/",
        json={
            "name": "Driver 1",
            "phone": "5558880001",
            "license_number": "LIC001",
            "license_expiry": "2030-01-01T00:00:00",
            "user_id": user_id,
        },
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver["id"]},
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    response = client.get(
        f"/trips/{trip['id']}/history",
        headers={"Authorization": f"Bearer {d1_token}"},
    )
    assert response.status_code == 200
    assert len(response.json()) > 0


def test_get_trip_history_as_unassigned_driver_fails(client):
    client.post(
        "/users/",
        json={
            "username": "driver_1",
            "email": "d1@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    d1_token = get_token(client, username="driver_1", password="secret123")
    user_id_1 = client.get(
        "/users/me", headers={"Authorization": f"Bearer {d1_token}"}
    ).json()["id"]

    client.post(
        "/users/",
        json={
            "username": "driver_2",
            "email": "d2@example.com",
            "password": "secret123",
            "role": "driver",
        },
    )
    d2_token = get_token(client, username="driver_2", password="secret123")

    create_user(client)
    disp_token = get_token(client)
    driver_1 = client.post(
        "/drivers/",
        json={
            "name": "Driver 1",
            "phone": "5558880001",
            "license_number": "LIC001",
            "license_expiry": "2030-01-01T00:00:00",
            "user_id": user_id_1,
        },
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    trip = client.post(
        "/trips/",
        json={"source": "A", "destination": "B"},
        headers={"Authorization": f"Bearer {disp_token}"},
    ).json()

    client.patch(
        f"/trips/{trip['id']}/assign",
        json={"driver_id": driver_1["id"]},
        headers={"Authorization": f"Bearer {disp_token}"},
    )

    response = client.get(
        f"/trips/{trip['id']}/history",
        headers={"Authorization": f"Bearer {d2_token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to view this trip's history"


def test_update_user_profile_details_success(client):
    create_user(client)
    token = get_token(client)

    response = client.patch(
        "/users/me",
        json={"username": "updated_dispatcher", "email": "updated_disp@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "updated_dispatcher"
    assert data["email"] == "updated_disp@example.com"

    new_token = get_token(client, username="updated_dispatcher", password="secret123")
    me_res = client.get("/users/me", headers={"Authorization": f"Bearer {new_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "updated_dispatcher"


def test_update_user_password_success(client):
    create_user(client)
    token = get_token(client)

    response = client.patch(
        "/users/me",
        json={"password": "newpassword123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    login_fail = client.post(
        "/auth/token", data={"username": "dispatcher", "password": "secret123"}
    )
    assert login_fail.status_code == 401

    login_ok = client.post(
        "/auth/token", data={"username": "dispatcher", "password": "newpassword123"}
    )
    assert login_ok.status_code == 200
    assert "access_token" in login_ok.json()


def test_create_trip_with_custom_fare(client):
    create_user(client)
    token = get_token(client)

    # 1. Test custom fare price override
    response = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 10.0,
            "duration_minutes": 30,
            "estimated_fare": 999.50,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    assert trip["estimated_fare"] == 999.50

    # 2. Test auto-calculated fare when estimated_fare is not provided
    response = client.post(
        "/trips/",
        json={
            "source": "A",
            "destination": "B",
            "distance_km": 10.0,
            "duration_minutes": 30,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    trip = response.json()
    # base 40 + 10 * 12 + 30 * 1.5 = 40 + 120 + 45 = 205
    assert trip["estimated_fare"] == 205.0


def test_create_driver_with_credentials(client):
    create_user(client)
    token = get_token(client)

    # 1. Create driver with credentials
    response = client.post(
        "/drivers/",
        json={
            "name": "New Driver User",
            "phone": "9898989898",
            "license_number": "LIC-9898",
            "license_expiry": "2028-12-31T00:00:00",
            "username": "new_driver_user",
            "password": "driver_secret_password",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    driver_res = response.json()
    assert driver_res["username"] == "new_driver_user"
    assert driver_res["password"] == "driver_secret_password"
    assert driver_res["user_id"] is not None

    # 2. Verify we can log in with these new driver credentials
    login_response = client.post(
        "/auth/token",
        data={"username": "new_driver_user", "password": "driver_secret_password"},
    )
    assert login_response.status_code == 200
    driver_token = login_response.json()["access_token"]
    assert driver_token is not None

    # 3. Check profile endpoint works for this new driver
    profile_response = client.get(
        "/drivers/profile/me", headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["name"] == "New Driver User"


def test_driver_location_tracking_and_geofencing(client):
    create_user(client)
    token = get_token(client)

    # 1. Create a driver account with credentials
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "GPS Tracked Driver",
            "phone": "9000000001",
            "license_number": "LIC-GPS",
            "license_expiry": "2029-12-31T00:00:00",
            "username": "gps_driver",
            "password": "gps_password",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # Log in as the driver
    driver_token = client.post(
        "/auth/token", data={"username": "gps_driver", "password": "gps_password"}
    ).json()["access_token"]

    # 2. Create a trip with coordinates
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Mumbai Terminal",
            "destination": "Pune Hub",
            "distance_km": 150.0,
            "duration_minutes": 180,
            "source_latitude": 19.0760,
            "source_longitude": 72.8777,
            "destination_latitude": 18.5204,
            "destination_longitude": 73.8567,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # 3. Assign the driver and start the trip
    client.patch(
        f"/trips/{trip_res['id']}/assign",
        json={"driver_id": driver_res["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.patch(
        f"/trips/{trip_res['id']}/start",
        json={"note": "Driver starting GPS route"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # 4. Report location from driver (still far away)
    loc_res = client.post(
        "/drivers/location",
        json={"latitude": 19.0000, "longitude": 73.0000},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert loc_res.status_code == 200

    # Check trip is still started
    trip_check = client.get(
        f"/trips/{trip_res['id']}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert trip_check["status"] == "started"

    # 5. Report location matching destination geofence
    # (within 100 meters, Pune coordinates)
    geofence_res = client.post(
        "/drivers/location",
        json={"latitude": 18.5204, "longitude": 73.8567},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert geofence_res.status_code == 200

    # 6. Verify that trip is automatically transition-completed
    # and driver status is available
    trip_finished = client.get(
        f"/trips/{trip_res['id']}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert trip_finished["status"] == "completed"

    driver_check = client.get(
        "/drivers/profile/me",
        headers={"Authorization": f"Bearer {driver_token}"},
    ).json()
    assert driver_check["status"] == "available"


def test_create_trip_invalid_location_fails(client):
    create_user(client)
    token = get_token(client)

    response = client.post(
        "/trips/",
        json={
            "source": "Invalid Source Address That Does Not Exist",
            "destination": "Pune Hub",
            "distance_km": 10.0,
            "duration_minutes": 30,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "is invalid or could not be found" in response.json()["detail"]


def test_update_driver_profile_fields(client):
    create_user(client)
    token = get_token(client)

    # 1. Create a driver
    driver_res = client.post(
        "/drivers/",
        json={
            "name": "Original Name",
            "phone": "9998887777",
            "license_number": "LIC-ORIG",
            "license_expiry": "2029-12-31T00:00:00",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # 2. Update driver profile details
    update_res = client.patch(
        f"/drivers/{driver_res['id']}",
        json={
            "name": "Updated Name",
            "phone": "9998886666",
            "license_number": "LIC-UPDATED",
            "license_expiry": "2030-12-31T00:00:00",
            "status": "inactive",
            "note": "manually updating status to inactive",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    updated_driver = update_res.json()
    assert updated_driver["name"] == "Updated Name"
    assert updated_driver["phone"] == "9998886666"
    assert updated_driver["license_number"] == "LIC-UPDATED"
    assert updated_driver["status"] == "inactive"


def test_cancel_trip_with_reason(client):
    create_user(client)
    token = get_token(client)

    # 1. Create a trip
    trip_res = client.post(
        "/trips/",
        json={
            "source": "Mumbai Terminal",
            "destination": "Pune Hub",
            "distance_km": 150.0,
            "duration_minutes": 180,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # 2. Cancel the trip with a reason
    cancel_res = client.patch(
        f"/trips/{trip_res['id']}/cancel",
        json={"reason": "Driver emergency, vehicle breakdown"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cancel_res.status_code == 200

    # 3. Check that trip is marked cancelled and the cancel_reason is populated
    trip_check = client.get(
        f"/trips/{trip_res['id']}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert trip_check["status"] == "cancelled"
    assert trip_check["cancel_reason"] == "Driver emergency, vehicle breakdown"

    # 4. Check the history log note
    history_res = client.get(
        f"/trips/{trip_res['id']}/history",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert len(history_res) > 0
    # The last log item should contain our cancellation reason
    cancel_log = [log for log in history_res if log["status"] == "cancelled"][0]
    assert "Driver emergency, vehicle breakdown" in cancel_log["note"]
