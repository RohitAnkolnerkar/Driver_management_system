import sys
from unittest.mock import MagicMock, patch

from app.api.trip import geocode_location


def test_geocode_location_mocked_for_pytest():
    # Verify that in a pytest context, geocode_location uses local mocks directly
    lat, lng, name = geocode_location("Mumbai Terminal")
    assert lat == 19.0760
    assert lng == 72.8777
    assert name == "Mumbai Terminal"


def test_geocode_location_real_path_google_fallback(monkeypatch):
    # Temporarily remove pytest module indicator to test the actual API block
    with patch.dict(sys.modules):
        if "pytest" in sys.modules:
            sys_modules_mock = {k: v for k, v in sys.modules.items() if k != "pytest"}

            with patch("sys.modules", sys_modules_mock):
                # Set up Google API key
                monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "mock_key_123")

                # Mock urllib.request.urlopen context manager response
                mock_response = MagicMock()
                mock_response.read.return_value = b'{"status": "OK", "results": [{"geometry": {"location": {"lat": 18.5204, "lng": 73.8567}}, "formatted_address": "Google Pune Center"}]}'

                mock_urlopen = MagicMock()
                mock_urlopen.__enter__.return_value = mock_response

                with patch("urllib.request.urlopen", return_value=mock_urlopen):
                    lat, lng, name = geocode_location("Pune Center")
                    assert lat == 18.5204
                    assert lng == 73.8567
                    assert name == "Google Pune Center"
