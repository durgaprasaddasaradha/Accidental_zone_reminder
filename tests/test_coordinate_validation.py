"""Unit tests for GPS coordinate validation and NULL preservation."""

import pytest
import pandas as pd
from pydantic import ValidationError

from api.schemas.zone import AccidentZoneBase
from api.services.data_service import DataService


def test_missing_coordinates_preserved_as_null():
    """Verify that records without coordinates have latitude/longitude preserved as None."""
    service = DataService()
    df = pd.DataFrame({
        "name": ["Katraj Ghat Blackspot"],
        "state": ["Maharashtra"],
        "district": ["Pune"],
        "source": ["MORTH_BLACK_SPOT"],
        "latitude": [None],
        "longitude": [None],
        "location_source": ["UNKNOWN"],
        "location_accuracy": ["UNKNOWN"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    assert records[0]["latitude"] is None
    assert records[0]["longitude"] is None
    assert records[0]["location_source"] == "UNKNOWN"
    assert records[0]["location_accuracy"] == "UNKNOWN"


def test_valid_coordinates_accepted():
    """Verify that legitimate GPS coordinates are properly accepted and formatted."""
    service = DataService()
    df = pd.DataFrame({
        "name": ["Rajiv Chowk"],
        "state": ["Haryana"],
        "district": ["Gurugram"],
        "source": ["MORTH_BLACK_SPOT"],
        "latitude": [28.459497],
        "longitude": [77.026638],
        "location_source": ["OFFICIAL"],
        "location_accuracy": ["EXACT"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    assert records[0]["latitude"] == pytest.approx(28.459497, abs=1e-5)
    assert records[0]["longitude"] == pytest.approx(77.026638, abs=1e-5)
    assert len(issues) == 0


def test_invalid_out_of_range_coordinates_rejected():
    """Verify that fake/out-of-range coordinates are flagged as errors and reset to NULL."""
    service = DataService()
    df = pd.DataFrame({
        "name": ["Fake Coordinates Spot 1", "Fake Coordinates Spot 2"],
        "state": ["Karnataka", "Tamil Nadu"],
        "district": ["Bengaluru", "Chennai"],
        "source": ["MORTH_BLACK_SPOT", "MORTH_BLACK_SPOT"],
        "latitude": [999.0, 13.0827],       # 999.0 is invalid
        "longitude": [77.5946, -300.0]      # -300.0 is invalid
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 2

    # Verify issues recorded
    issue_types = [i["type"] for i in issues]
    assert "INVALID_COORDINATE_RANGE" in issue_types

    # Ensure fake coordinates were nullified
    assert records[0]["latitude"] is None
    assert records[0]["longitude"] == pytest.approx(77.5946, abs=1e-4)

    assert records[1]["latitude"] == pytest.approx(13.0827, abs=1e-4)
    assert records[1]["longitude"] is None


def test_non_numeric_coordinates_handled():
    """Verify that textual string values in coordinate fields are safely coerced to None."""
    service = DataService()
    df = pd.DataFrame({
        "name": ["Text Coordinate Spot"],
        "state": ["Kerala"],
        "district": ["Kochi"],
        "source": ["MORTH_BLACK_SPOT"],
        "latitude": ["near toll plaza"],
        "longitude": ["km 42"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    assert records[0]["latitude"] is None
    assert records[0]["longitude"] is None


def test_pydantic_schema_rejects_invalid_coordinates():
    """Verify that Pydantic models reject invalid coordinates."""
    with pytest.raises(ValidationError):
        AccidentZoneBase(
            name="Invalid Lat Zone",
            state="Maharashtra",
            district="Mumbai",
            source="MORTH_BLACK_SPOT",
            latitude=105.0,  # Invalid
            longitude=72.8777
        )

    with pytest.raises(ValidationError):
        AccidentZoneBase(
            name="Invalid Lon Zone",
            state="Maharashtra",
            district="Mumbai",
            source="MORTH_BLACK_SPOT",
            latitude=19.0760,
            longitude=-200.0  # Invalid
        )
