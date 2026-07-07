def test_dispatch_queue_returns_pending_trips_sorted_by_priority(client):
    create_user = client.post(
        "/users/",
        json={
            "username": "dispatcher2",
            "email": "dispatch2@example.com",
            "password": "secret123",
        },
    )
    assert create_user.status_code == 200

    login_response = client.post(
        "/auth/token",
        data={"username": "dispatcher2", "password": "secret123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    client.post(
        "/trips/",
        json={"source": "A", "destination": "B", "priority": "low"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/trips/",
        json={"source": "C", "destination": "D", "priority": "high"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/trips/",
        json={"source": "E", "destination": "F", "priority": "urgent"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/trips/dispatch/queue",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    queue = response.json()
    assert [trip["priority"] for trip in queue[:3]] == ["urgent", "high", "low"]
