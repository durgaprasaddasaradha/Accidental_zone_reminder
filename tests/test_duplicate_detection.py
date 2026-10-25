"""Unit tests for duplicate detection in CSV data processing."""

import pandas as pd
from api.services.data_service import DataService


def test_duplicate_black_spot_code_removal():
    service = DataService()
    df = pd.DataFrame({
        "name": ["Spot A", "Spot B"],
        "state": ["Punjab", "Punjab"],
        "district": ["Ludhiana", "Ludhiana"],
        "black_spot_code": ["PB-LUD-001", "PB-LUD-001"],  # Duplicate code
        "source": ["MORTH_BLACK_SPOT", "MORTH_BLACK_SPOT"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    assert records[0]["name"] == "Spot A"
    issue_types = [i["type"] for i in issues]
    assert "DUPLICATE_BLACK_SPOT_CODE" in issue_types


def test_duplicate_location_name_removal():
    service = DataService()
    df = pd.DataFrame({
        "name": ["Intersection Km 12", "Intersection Km 12"],
        "state": ["Rajasthan", "Rajasthan"],
        "district": ["Jaipur", "Jaipur"],
        "highway": ["NH-48", "NH-48"],
        "black_spot_code": [None, None],
        "source": ["MORTH_BLACK_SPOT", "MORTH_BLACK_SPOT"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    issue_types = [i["type"] for i in issues]
    assert "DUPLICATE_LOCATION" in issue_types
