def test_dashboard_page_serves_html(client):
    response = client.get("/dashboard")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "FleetFlow" in response.text
    assert "Sign in to your workspace" in response.text
