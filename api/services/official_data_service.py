"""Official Government Road Accident Data Adapter.

Provides an extensible, contract-based adapter for officially sourced data from:
- Ministry of Road Transport and Highways (MoRTH), Government of India
- Open Government Data (OGD) Platform India (data.gov.in)

DESIGN PRINCIPLES:
1. No Invented APIs: Never assume or mock fake government endpoints or fake API keys.
2. File-Based Adapter for Phase 1: Ingests verified official files placed in data/official/.
3. Future-Proof: When an authorized government API credential is confirmed,
   implement `fetch_data()` to query that authorized endpoint without altering downstream models.
4. Strict Source Provenance: Preserves official document dates, references, and exact wording:
   "Approaching an officially identified accident-prone / black-spot location."
"""

from abc import ABC, abstractmethod
import glob
import os
from typing import Any, Dict, List, Optional
import pandas as pd

from api.services.data_service import DataService


class OfficialDataSource(ABC):
    """Abstract Base Class establishing the contract for official accident data providers."""

    @abstractmethod
    def fetch_data(self) -> Any:
        """Retrieves raw data from the configured official repository or authorized endpoint."""
        pass

    @abstractmethod
    def normalize_data(self, raw_data: Any) -> pd.DataFrame:
        """Transforms raw source-specific schema into the standardized accident_zones tabular format."""
        pass

    @abstractmethod
    def validate_data(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Performs domain-specific validation and returns any integrity issues found."""
        pass

    @abstractmethod
    def convert_to_accident_zones(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Converts validated tabular records into standardized accident zone dictionaries."""
        pass


class MoRTHBlackSpotAdapter(OfficialDataSource):
    """Official Adapter for Ministry of Road Transport and Highways (MoRTH) black-spot publications.
    
    Reads verified CSV/Excel/JSON files deposited in data/official/ and normalizes them
    according to official MoRTH protocol guidelines.
    """

    OFFICIAL_SOURCE_NAME = "MORTH_BLACK_SPOT"
    DEFAULT_SOURCE_URL = "https://morth.nic.in/road-accident-in-india"
    LEGAL_DISCLAIMER_MESSAGE = "Approaching an officially identified accident-prone / black-spot location."

    def __init__(self, official_data_dir: Optional[str] = None):
        self.data_dir = official_data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "data",
            "official",
        )
        self.data_service = DataService()

    def fetch_data(self) -> pd.DataFrame:
        """Scans data/official/ for officially deposited dataset files.
        
        Note: When an official government API endpoint and authorized API key
        are made available, the HTTP request call will be plugged in here.
        """
        if not os.path.exists(self.data_dir):
            raise FileNotFoundError(
                f"Official data directory does not exist: {self.data_dir}"
            )

        csv_files = glob.glob(os.path.join(self.data_dir, "*.csv"))
        if not csv_files:
            raise FileNotFoundError(
                f"No official CSV datasets found in '{self.data_dir}'. "
                f"Please place verified MoRTH or data.gov.in datasets into this directory."
            )

        # Ingest the most recently modified official dataset file
        latest_file = max(csv_files, key=os.path.getmtime)
        return self.data_service.read_csv(latest_file)

    def normalize_data(self, raw_data: pd.DataFrame) -> pd.DataFrame:
        """Normalizes source-specific column names from MoRTH reports to standard schema."""
        df = raw_data.copy()

        # Mapping for common MoRTH / OGD India column nomenclatures
        column_mapping = {
            "Black Spot ID": "black_spot_code",
            "Black Spot Code": "black_spot_code",
            "Location Description": "name",
            "Location Name": "name",
            "Name": "name",
            "State Name": "state",
            "State": "state",
            "District Name": "district",
            "District": "district",
            "NH No": "highway",
            "Highway": "highway",
            "Road Category": "road_type",
            "Road Type": "road_type",
            "Lat": "latitude",
            "Latitude": "latitude",
            "Long": "longitude",
            "Longitude": "longitude",
            "Total Accidents": "accident_count",
            "Accidents": "accident_count",
            "Total Fatalities": "fatalities",
            "Fatalities": "fatalities",
            "Priority": "official_priority",
            "Severity Index": "severity",
        }

        # Rename columns if recognized
        rename_dict = {
            col: column_mapping[col]
            for col in df.columns
            if col in column_mapping and column_mapping[col] not in df.columns
        }
        df = df.rename(columns=rename_dict)

        # Apply source provenance if missing
        if "source" not in df.columns or df["source"].isna().all():
            df["source"] = self.OFFICIAL_SOURCE_NAME
        if "source_url" not in df.columns or df["source_url"].isna().all():
            df["source_url"] = self.DEFAULT_SOURCE_URL

        # Official provenance settings
        if "location_source" not in df.columns:
            # If coordinates exist in official release, mark as OFFICIAL; otherwise UNKNOWN
            df["location_source"] = df.apply(
                lambda r: "OFFICIAL" if pd.notna(r.get("latitude")) and pd.notna(r.get("longitude")) else "UNKNOWN",
                axis=1
            )

        if "location_accuracy" not in df.columns:
            df["location_accuracy"] = df.apply(
                lambda r: "EXACT" if pd.notna(r.get("latitude")) and pd.notna(r.get("longitude")) else "UNKNOWN",
                axis=1
            )

        return df

    def validate_data(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validates that MoRTH standards are respected."""
        _, issues = self.data_service.process_dataframe(df)
        return issues

    def convert_to_accident_zones(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Transforms the normalized dataframe into finalized accident zone dictionaries."""
        clean_records, _ = self.data_service.process_dataframe(df)
        return clean_records
