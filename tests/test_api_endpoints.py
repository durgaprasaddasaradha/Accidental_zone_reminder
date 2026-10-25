"""Integration tests for FastAPI endpoints using TestClient."""

import pytest
from fastapi.testclient import TestClient

from api.index import app
from api.services.data_service import InMemoryZoneStore

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_data():
    """Sets up controlled sample data in memory for deterministic test execution."""
    sample_zones = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "Rajiv Chowk Junction",
            "state": "Haryana",
            "district": "Gurugram",
            "highway": "NH-48",
            "road_type": "National Highway",
            "black_spot_code": "DEMO-HR-001",
            "latitude": 28.459497,
            "longitude": 77.026638,
            "accident_count": 42,
            "fatalities": 14,
            "severity": "High",
            "official_priority": "Priority 1",
            "warning_radius": 500,
            "source": "MORTH_BLACK_SPOT",
            "source_url": "https://morth.nic.in",
            "location_source": "OFFICIAL",
            "location_accuracy": "EXACT",
            "is_active": True,
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "name": "Katraj Ghat Curve Km 842",
            "state": "Maharashtra",
            "district": "Pune",
            "highway": "NH-48",
            "road_type": "National Highway",
            "black_spot_code": "DEMO-MH-102",
            "latitude": None,  # Test null coordinates
            "longitude": None,
            "accident_count": 35,
            "fatalities": 12,
            "severity": "High",
            "official_priority": "Priority 1",
            "warning_radius": 500,
            "source": "MORTH_BLACK_SPOT",
            "source_url": "https://morth.nic.in",
            "location_source": "UNKNOWN",
            "location_accuracy": "UNKNOWN",
            "is_active": True,
        },
    ]
    InMemoryZoneStore.set_zones(sample_zones)
    yield
    InMemoryZoneStore.clear()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Accidental Zone Reminder API"
    assert data["module"] == "DATA_MODULE"


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_list_zones_all():
    response = client.get("/api/zones")
    assert response.status_code == 200
    data = response.json()
    assert "zones" in data
    assert data["total"] == 2
    assert len(data["zones"]) == 2


def test_list_zones_filter_state():
    response = client.get("/api/zones?state=Haryana")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["zones"][0]["state"] == "Haryana"


def test_list_zones_filter_coordinates():
    # Only zones with coordinates
    res_coords = client.get("/api/zones?has_coordinates=true")
    assert res_coords.status_code == 200
    data_coords = res_coords.json()
    assert data_coords["total"] == 1
    assert data_coords["zones"][0]["latitude"] is not None

    # Only zones WITHOUT coordinates
    res_no_coords = client.get("/api/zones?has_coordinates=false")
    assert res_no_coords.status_code == 200
    data_no_coords = res_no_coords.json()
    assert data_no_coords["total"] == 1
    assert data_no_coords["zones"][0]["latitude"] is None


def test_get_zone_by_id_success():
    response = client.get("/api/zones/11111111-1111-1111-1111-111111111111")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Rajiv Chowk Junction"
    assert data["black_spot_code"] == "DEMO-HR-001"


def test_get_zone_by_id_not_found():
    response = client.get("/api/zones/99999999-9999-9999-9999-999999999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_zone_stats():
    response = client.get("/api/zones/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_zones"] == 2
    assert stats["zones_with_coordinates"] == 1
    assert stats["zones_without_coordinates"] == 1
    assert stats["total_fatalities"] == 26
    assert stats["total_accidents"] == 77
    assert stats["states_count"] == 2
    assert "Haryana" in stats["states_represented"]
    assert "Maharashtra" in stats["states_represented"]
