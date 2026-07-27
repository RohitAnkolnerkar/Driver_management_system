from app.api.pricing import calculate_pricing_quote
from app.schemas.pricing import PricingQuoteRequest


def register_and_login(client, username, role="dispatcher"):
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


def test_pricing_quote_basic_calculation(db_session):
    """Standard cargo truck pricing quote calculation."""
    req = PricingQuoteRequest(
        source="Mumbai Depot",
        destination="Pune Logistics Hub",
        distance_km=150.0,
        cargo_weight_kg=1000.0,
        cargo_type="standard",
        vehicle_type="cargo_truck",
    )
    quote = calculate_pricing_quote(db_session, req)

    assert quote.base_tariff == 1500.0
    assert quote.distance_charge == 5250.0  # 150 * 35
    assert quote.weight_surcharge == 112.5  # 0.5 ton * 150km * 1.50
    assert quote.cargo_hazard_surcharge == 0.0
    assert quote.total_estimated_fare > 6700.0
    assert quote.projected_profit_margin_percent > 0.0


def test_pricing_quote_weight_and_hazard_surcharges(db_session):
    """Weight excess and hazardous cargo surcharges."""
    req = PricingQuoteRequest(
        source="Delhi",
        destination="Jaipur",
        distance_km=250.0,
        cargo_weight_kg=2500.0,  # +2.0 ton excess = +₹750 surcharge
        cargo_type="hazardous",  # +25% hazard surcharge
        vehicle_type="heavy_hauler",
    )
    quote = calculate_pricing_quote(db_session, req)

    assert quote.base_tariff == 3000.0
    assert quote.distance_charge == 16250.0  # 250 * 65
    assert quote.weight_surcharge == 750.0
    assert quote.cargo_hazard_surcharge > 0.0
    assert "Hazardous" in quote.breakdown_explanation


def test_pricing_quote_api_endpoint(client, db_session):
    """POST /pricing/quote endpoint returns dynamic tariff quote."""
    token = register_and_login(client, "pricing_disp_01")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/pricing/quote",
        json={
            "source": "Chennai Port",
            "destination": "Bengaluru Hub",
            "distance_km": 350.0,
            "cargo_weight_kg": 5000.0,
            "cargo_type": "heavy_machinery",
            "vehicle_type": "container_trailer",
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["source"] == "Chennai Port"
    assert data["vehicle_type"] == "container_trailer"
    assert data["base_tariff"] == 5000.0
    assert data["total_estimated_fare"] > 30000.0
    assert data["projected_profit_margin_percent"] > 0.0


def test_pricing_quote_invalid_location_rejection(client, db_session):
    """POST /pricing/quote rejects unresolvable location info with 400 Bad Request."""
    token = register_and_login(client, "pricing_disp_02")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/pricing/quote",
        json={
            "source": "wrong_invalid_address_123",
            "destination": "Pune Hub",
            "distance_km": None,
            "cargo_weight_kg": 1000.0,
        },
        headers=headers,
    )
    assert res.status_code == 400
    assert "Invalid Source location" in res.json()["detail"]
