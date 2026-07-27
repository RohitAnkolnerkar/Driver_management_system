from app.models.trip import Trip


def register_and_login(client, username="pod_user", role="dispatcher"):
    client.post(
        "/users/",
        json={
            "username": username,
            "password": "Test@1234",
            "email": f"{username}@test.com",
            "role": role,
        },
    )
    res = client.post(
        "/auth/token", data={"username": username, "password": "Test@1234"}
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_proof_of_delivery_lifecycle(client, db_session):
    token = register_and_login(client, "pod_user1")
    headers = {"Authorization": f"Bearer {token}"}

    trip = Trip(source="Warehouse A", destination="Store B", status="completed")
    db_session.add(trip)
    db_session.commit()

    # Submit PoD
    res = client.post(
        f"/trips/{trip.id}/proof-of-delivery",
        json={
            "recipient_name": "Manager John",
            "recipient_signature": "SIG_DATA_12345",
            "delivery_notes": "Delivered intact with seal #8812",
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["trip_id"] == trip.id
    assert data["recipient_name"] == "Manager John"
    assert data["geofence_verified"] is True

    # Retrieve PoD
    get_res = client.get(f"/trips/{trip.id}/proof-of-delivery", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["recipient_name"] == "Manager John"


def test_trip_invoice_generation(client, db_session):
    token = register_and_login(client, "inv_user1")
    headers = {"Authorization": f"Bearer {token}"}

    trip = Trip(
        source="Factory X",
        destination="Client Y",
        distance_km=100.0,
        cargo_weight_kg=1500.0,
        estimated_fare=3500.0,
        status="completed",
    )
    db_session.add(trip)
    db_session.commit()

    res = client.get(f"/trips/{trip.id}/invoice", headers=headers)
    assert res.status_code == 200
    inv = res.json()

    assert inv["invoice_number"] == f"INV-TRIP-{trip.id:05d}"
    assert inv["subtotal"] == 3500.0
    assert inv["tax_amount"] == round(3500.0 * 0.18, 2)
    assert inv["total_amount"] == round(3500.0 * 1.18, 2)
    assert inv["payment_status"] == "paid"
