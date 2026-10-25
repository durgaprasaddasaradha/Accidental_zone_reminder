"""Unit tests for the Official Data Source Adapter layer."""

import pandas as pd
from api.services.official_data_service import MoRTHBlackSpotAdapter, OfficialDataSource


def test_adapter_inheritance_contract():
    adapter = MoRTHBlackSpotAdapter()
    assert isinstance(adapter, OfficialDataSource)
    assert adapter.OFFICIAL_SOURCE_NAME == "MORTH_BLACK_SPOT"
    assert "Approaching an officially identified accident-prone" in adapter.LEGAL_DISCLAIMER_MESSAGE


def test_morth_column_normalization():
    adapter = MoRTHBlackSpotAdapter()
    raw_df = pd.DataFrame({
        "Black Spot ID": ["BS-DL-101"],
        "Location Description": ["Mukarba Chowk Flyover Merge"],
        "State Name": ["Delhi"],
        "District Name": ["North West Delhi"],
        "NH No": ["NH-44"],
        "Lat": [28.7366],
        "Long": [77.1611],
        "Total Accidents": [54],
        "Total Fatalities": [18]
    })

    normalized = adapter.normalize_data(raw_df)
    assert "black_spot_code" in normalized.columns
    assert "name" in normalized.columns
    assert "state" in normalized.columns
    assert "district" in normalized.columns
    assert "highway" in normalized.columns
    assert "latitude" in normalized.columns
    assert "longitude" in normalized.columns
    assert "accident_count" in normalized.columns
    assert "fatalities" in normalized.columns

    records = adapter.convert_to_accident_zones(normalized)
    assert len(records) == 1
    zone = records[0]
    assert zone["black_spot_code"] == "BS-DL-101"
    assert zone["name"] == "Mukarba Chowk Flyover Merge"
    assert zone["source"] == "MORTH_BLACK_SPOT"
    assert zone["location_source"] == "OFFICIAL"
    assert zone["location_accuracy"] == "EXACT"
