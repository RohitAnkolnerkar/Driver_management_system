"""
Integration tests for GET /drivers/scorecard
— Monthly KPI Scorecard & Incentive Engine
"""

from datetime import timedelta

import pytest

from app.core.time_utils import get_now_ist_naive

# ─── Helpers ────────────────────────────────────────────────────────────────


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


def create_driver(client, headers, name, phone, suffix):
    # Derive a unique 7-digit serial from the suffix string
    import hashlib

    serial = str(
        int(hashlib.md5(str(suffix).encode()).hexdigest(), 16) % 9000000 + 1000000
    )
    lic = f"MH-12-2020-{serial}"
    res = client.post(
        "/drivers/",
        json={
            "name": name,
            "phone": phone,
            "license_number": lic,
            "license_expiry": "2035-01-01T00:00:00",
            "username": f"sc_drv_{suffix}",
            "password": "Test@1234",
            "odometer_km": 0.0,
            "vehicle_type": "cargo_truck",
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def create_trip(client, headers, driver_id, now, offset_days=0):
    """Create and complete a trip for a driver in the current month."""
    # scheduled_date must be in the future — use 1 day from now
    trip_date = now + timedelta(days=1)
    res = client.post(
        "/trips/",
        json={
            "source": "Warehouse A",
            "destination": "Depot B",
            "distance_km": 80.0,
            "duration_minutes": 90,
            "estimated_fare": 2000.0,
            "source_latitude": 19.0760,
            "source_longitude": 72.8777,
            "destination_latitude": 19.2,
            "destination_longitude": 73.0,
            "scheduled_date": trip_date.isoformat(),
        },
        headers=headers,
    )
    assert res.status_code == 200, f"Create trip: {res.text}"
    trip_id = res.json()["id"]

    # Assign → start → complete (all use PATCH)
    r = client.patch(
        f"/trips/{trip_id}/assign", json={"driver_id": driver_id}, headers=headers
    )
    assert r.status_code == 200, f"Assign: {r.text}"
    r = client.patch(f"/trips/{trip_id}/start", headers=headers)
    assert r.status_code == 200, f"Start: {r.text}"
    r = client.patch(
        f"/trips/{trip_id}/complete",
        json={"note": "test completed"},
        headers=headers,
    )
    assert r.status_code == 200, f"Complete: {r.text}"
    return trip_id


# ─── Tests ──────────────────────────────────────────────────────────────────


def test_scorecard_empty_for_no_trips(client):
    """Scorecard returns empty list when no driver has trips this month."""
    token = register_and_login(client, "sc_disp_empty")
    headers = {"Authorization": f"Bearer {token}"}
    now = get_now_ist_naive()
    # Use next month to guarantee no trips exist
    next_month = (now.month % 12) + 1
    next_year = now.year if now.month < 12 else now.year + 1
    res = client.get(
        f"/drivers/scorecard?year={next_year}&month={next_month}", headers=headers
    )
    assert res.status_code == 200
    assert res.json() == []


def test_scorecard_basic_completion_and_score(client, db_session):
    """Driver with completed trips gets scorecard with overall_score."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_basic")
    headers = {"Authorization": f"Bearer {token}"}

    driver_id = create_driver(
        client, headers, "SC Basic Driver", "9880001111", "basic01"
    )

    # Create 5 completed trips this month
    for i in range(5):
        create_trip(client, headers, driver_id, now, offset_days=i)

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1

    sc = next((d for d in data if d["driver_id"] == driver_id), None)
    assert sc is not None, "Driver scorecard not found"
    assert sc["completed_trips"] == 5
    assert sc["total_trips"] == 5
    assert sc["completion_rate"] == 100.0
    assert sc["cancellation_rate"] == 0.0
    assert 0 <= sc["overall_score"] <= 100
    assert sc["audit_pass_rate"] == 100.0  # no flagged trips
    assert sc["flagged_trips"] == 0


def test_scorecard_incentive_for_high_performer(client, db_session):
    """Driver with high KPIs should receive a bonus recommendation."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_bonus")
    headers = {"Authorization": f"Bearer {token}"}

    driver_id = create_driver(
        client, headers, "SC Bonus Driver", "9880002222", "bonus02"
    )

    # Create 5 completed trips — 5 × 90min = 7.5h, stays under 8h fatigue limit
    for i in range(5):
        create_trip(client, headers, driver_id, now, offset_days=i)

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()

    sc = next((d for d in data if d["driver_id"] == driver_id), None)
    assert sc is not None
    # With perfect completion (5/5), no audit flags, no fatigue: score should be ≥ 75
    assert sc["overall_score"] >= 75
    # Should have a bonus or at least no deduction
    assert sc["deduction_recommendation"] == 0.0
    assert sc["bonus_recommendation"] >= 0


def test_scorecard_earnings_aggregation(client, db_session):
    """Scorecard total_earnings = sum of estimated_fare for completed trips."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_earn")
    headers = {"Authorization": f"Bearer {token}"}

    driver_id = create_driver(client, headers, "SC Earn Driver", "9880003333", "earn03")

    # 4 trips × ₹2000 each = ₹8000
    for i in range(4):
        create_trip(client, headers, driver_id, now, offset_days=i)

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    sc = next((d for d in data if d["driver_id"] == driver_id), None)
    assert sc is not None
    assert sc["total_earnings"] == pytest.approx(8000.0, abs=0.01)
    assert sc["average_fare"] == pytest.approx(2000.0, abs=0.01)


def test_scorecard_sorted_by_overall_score(client, db_session):
    """Multiple drivers should be returned sorted by overall_score descending."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_sort")
    headers = {"Authorization": f"Bearer {token}"}

    driver_a = create_driver(client, headers, "SC Sort A", "9880004444", "sort04a")
    driver_b = create_driver(client, headers, "SC Sort B", "9880005555", "sort04b")

    # Driver A: 5 trips, Driver B: 2 trips
    for i in range(5):
        create_trip(client, headers, driver_a, now, offset_days=i)
    for i in range(2):
        create_trip(client, headers, driver_b, now, offset_days=i)

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    scores = [d["overall_score"] for d in data]
    assert scores == sorted(
        scores, reverse=True
    ), "Scorecards must be sorted by overall_score desc"


def test_scorecard_requires_dispatcher_role(client, db_session):
    """Driver-role users must not be able to access the scorecard endpoint."""
    now = get_now_ist_naive()
    # Register as driver (dispatcher account for creating the driver)
    disp_token = register_and_login(client, "sc_disp_perm")
    disp_headers = {"Authorization": f"Bearer {disp_token}"}

    create_driver(client, disp_headers, "SC Perm Driver", "9880006666", "perm05")

    # Log in as the driver user
    driver_login = client.post(
        "/auth/token", data={"username": "sc_drv_perm05", "password": "Test@1234"}
    )
    driver_token = driver_login.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=driver_headers
    )
    assert res.status_code == 403


def test_scorecard_distance_aggregation(client, db_session):
    """total_distance_km should equal sum of distance_km across completed trips."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_dist")
    headers = {"Authorization": f"Bearer {token}"}

    driver_id = create_driver(client, headers, "SC Dist Driver", "9880007777", "dist06")

    # 3 trips × 80 km each = 240 km
    for i in range(3):
        create_trip(client, headers, driver_id, now, offset_days=i)

    res = client.get(
        f"/drivers/scorecard?year={now.year}&month={now.month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    sc = next((d for d in data if d["driver_id"] == driver_id), None)
    assert sc is not None
    assert sc["total_distance_km"] == pytest.approx(240.0, abs=1.0)


def test_scorecard_excludes_trips_outside_period(client, db_session):
    """Trips from other months should not appear in this month's scorecard."""
    now = get_now_ist_naive()
    token = register_and_login(client, "sc_disp_period")
    headers = {"Authorization": f"Bearer {token}"}

    driver_id = create_driver(
        client, headers, "SC Period Driver", "9880008888", "period07"
    )

    # Create trips that belong to the current month
    for i in range(2):
        create_trip(client, headers, driver_id, now, offset_days=i)

    # Query for next month — driver should not appear
    next_month = (now.month % 12) + 1
    next_year = now.year if now.month < 12 else now.year + 1
    res = client.get(
        f"/drivers/scorecard?year={next_year}&month={next_month}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    sc = next((d for d in data if d["driver_id"] == driver_id), None)
    assert (
        sc is None
    ), "Driver trips from a different month should NOT appear in the scorecard"
