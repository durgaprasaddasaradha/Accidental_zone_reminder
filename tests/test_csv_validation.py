"""Unit tests for CSV reading and required column validation."""

import pytest
import pandas as pd
from api.services.data_service import DataService


def test_missing_required_columns():
    service = DataService()
    # Missing 'source' and 'district'
    df = pd.DataFrame({
        "name": ["Test Spot"],
        "state": ["Delhi"]
    })
    missing = service.validate_columns(df)
    assert "district" in missing
    assert "source" in missing
    assert "name" not in missing
    assert "state" not in missing

    with pytest.raises(ValueError, match="Missing required columns"):
        service.process_dataframe(df)


def test_valid_csv_processing():
    service = DataService()
    df = pd.DataFrame({
        "name": ["  Rajiv Chowk  "],
        "state": ["haryana"],
        "district": ["gurugram"],
        "source": ["MORTH_BLACK_SPOT"],
        "accident_count": ["25"],
        "fatalities": ["8"]
    })
    records, issues = service.process_dataframe(df)
    assert len(records) == 1
    assert records[0]["name"] == "Rajiv Chowk"
    assert records[0]["state"] == "Haryana"  # normalized title case
    assert records[0]["district"] == "Gurugram"  # normalized title case
    assert records[0]["accident_count"] == 25
    assert records[0]["fatalities"] == 8
    assert records[0]["latitude"] is None  # preserved as None
    assert records[0]["longitude"] is None  # preserved as None
