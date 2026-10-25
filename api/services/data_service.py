"""Data processing and CSV import service powered by pandas and numpy.

Performs robust validation, data hygiene, duplicate removal, coordinate range checking,
and record preparation for database storage.
"""

import math
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from api.database.supabase import get_supabase_client, is_supabase_configured

# Standard permissible values
VALID_LOCATION_SOURCES = {"OFFICIAL", "VERIFIED_DERIVED", "UNKNOWN"}
VALID_LOCATION_ACCURACIES = {"EXACT", "APPROXIMATE", "UNKNOWN"}

REQUIRED_COLUMNS = ["name", "state", "district", "source"]

OPTIONAL_COLUMNS = [
    "highway",
    "road_type",
    "black_spot_code",
    "latitude",
    "longitude",
    "accident_count",
    "fatalities",
    "severity",
    "official_priority",
    "warning_radius",
    "source_url",
    "source_date",
    "data_period_start",
    "data_period_end",
    "location_source",
    "location_accuracy",
    "is_active",
]


class InMemoryZoneStore:
    """In-memory cache for local development and testing when Supabase credentials are not configured."""
    _zones: List[Dict[str, Any]] = []

    @classmethod
    def set_zones(cls, zones: List[Dict[str, Any]]) -> None:
        cls._zones = zones

    @classmethod
    def get_zones(cls) -> List[Dict[str, Any]]:
        return list(cls._zones)

    @classmethod
    def clear(cls) -> None:
        cls._zones = []


class DataService:
    """Service handling accident zone data ingestion, cleaning, and validation."""

    def __init__(self):
        self.supabase = get_supabase_client()

    @staticmethod
    def read_csv(file_path: str) -> pd.DataFrame:
        """Reads CSV file with encoding fallbacks and whitespace stripping."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found at: {file_path}")

        try:
            # Try UTF-8 first, fallback to latin-1 for government legacy exports if needed
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        except Exception as exc:
            raise ValueError(f"Failed to read CSV file: {exc}") from exc

        # Strip whitespace from column headers
        df.columns = [str(col).strip() for col in df.columns]
        return df

    @staticmethod
    def validate_columns(df: pd.DataFrame) -> List[str]:
        """Checks for presence of required columns."""
        missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
        return missing

    @staticmethod
    def normalize_text_field(value: Any) -> Optional[str]:
        """Trims whitespace and converts empty/nan representations to None."""
        if value is None or pd.isna(value):
            return None
        text = str(value).strip()
        if text == "" or text.lower() in {"nan", "none", "null", "n/a", "na"}:
            return None
        return text

    @staticmethod
    def normalize_name_casing(text: Optional[str]) -> Optional[str]:
        """Normalizes state and district names cleanly."""
        if not text:
            return None
        # Clean multiple whitespaces
        cleaned = " ".join(text.split())
        return cleaned.title()

    def process_dataframe(
        self, df: pd.DataFrame
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Cleans, normalizes, deduplicates, and validates the DataFrame.
        
        Returns:
            Tuple of (clean_records, validation_issues)
        """
        missing_cols = self.validate_columns(df)
        if missing_cols:
            raise ValueError(f"Missing required columns in CSV: {', '.join(missing_cols)}")

        # Ensure all expected columns exist
        working_df = df.copy()
        for col in OPTIONAL_COLUMNS:
            if col not in working_df.columns:
                working_df[col] = None

        validation_issues: List[Dict[str, Any]] = []

        # 1. Clean string fields
        string_cols = [
            "name", "state", "district", "highway", "road_type",
            "black_spot_code", "severity", "official_priority",
            "source", "source_url", "source_date",
            "data_period_start", "data_period_end",
            "location_source", "location_accuracy"
        ]
        for col in string_cols:
            working_df[col] = working_df[col].apply(self.normalize_text_field)

        # Normalize State & District
        working_df["state"] = working_df["state"].apply(self.normalize_name_casing)
        working_df["district"] = working_df["district"].apply(self.normalize_name_casing)

        # 2. Check for missing required values row by row
        for idx, row in working_df.iterrows():
            row_num = idx + 2  # Accounting for 1-based index + header row
            for req in REQUIRED_COLUMNS:
                if not row[req]:
                    validation_issues.append({
                        "row": row_num,
                        "field": req,
                        "type": "MISSING_REQUIRED_FIELD",
                        "message": f"Row {row_num}: Required field '{req}' is empty."
                    })

        # Filter out rows missing required fields
        valid_mask = (
            working_df["name"].notna()
            & working_df["state"].notna()
            & working_df["district"].notna()
            & working_df["source"].notna()
        )
        working_df = working_df[valid_mask].copy()

        # 3. Handle duplicate records
        # Check by black_spot_code if present
        code_mask = working_df["black_spot_code"].notna()
        duplicates_by_code = working_df[code_mask].duplicated(subset=["black_spot_code"], keep="first")
        if duplicates_by_code.any():
            dup_indices = working_df[code_mask][duplicates_by_code].index
            for dup_idx in dup_indices:
                code_val = working_df.loc[dup_idx, "black_spot_code"]
                validation_issues.append({
                    "row": dup_idx + 2,
                    "field": "black_spot_code",
                    "type": "DUPLICATE_BLACK_SPOT_CODE",
                    "message": f"Row {dup_idx + 2}: Duplicate black_spot_code '{code_val}' detected and removed."
                })
            working_df = working_df.drop(index=dup_indices)

        # Check secondary duplicates on (name, state, district, highway)
        dup_names = working_df.duplicated(subset=["name", "state", "district", "highway"], keep="first")
        if dup_names.any():
            dup_indices = working_df[dup_names].index
            for dup_idx in dup_indices:
                name_val = working_df.loc[dup_idx, "name"]
                validation_issues.append({
                    "row": dup_idx + 2,
                    "field": "name",
                    "type": "DUPLICATE_LOCATION",
                    "message": f"Row {dup_idx + 2}: Duplicate location '{name_val}' detected and removed."
                })
            working_df = working_df.drop(index=dup_indices)

        # 4. Numeric fields conversion with numpy / pandas
        numeric_int_cols = ["accident_count", "fatalities", "warning_radius"]
        for col in numeric_int_cols:
            working_df[col] = pd.to_numeric(working_df[col], errors="coerce")

        # Set default warning_radius if empty or invalid
        working_df["warning_radius"] = working_df["warning_radius"].apply(
            lambda v: int(v) if pd.notna(v) and v > 0 else 500
        )

        # 5. Latitude & Longitude validation
        working_df["latitude"] = pd.to_numeric(working_df["latitude"], errors="coerce")
        working_df["longitude"] = pd.to_numeric(working_df["longitude"], errors="coerce")

        # Validate range using NumPy array checks
        lat_values = working_df["latitude"].to_numpy()
        lon_values = working_df["longitude"].to_numpy()

        # Latitude must be [-90, 90]
        invalid_lat = np.where(
            ~np.isnan(lat_values) & ((lat_values < -90.0) | (lat_values > 90.0))
        )[0]
        for pos in invalid_lat:
            row_idx = working_df.index[pos]
            bad_lat = working_df.loc[row_idx, "latitude"]
            validation_issues.append({
                "row": row_idx + 2,
                "field": "latitude",
                "type": "INVALID_COORDINATE_RANGE",
                "message": f"Row {row_idx + 2}: Latitude {bad_lat} out of range [-90, 90]. Reset to NULL."
            })
            working_df.loc[row_idx, "latitude"] = np.nan

        # Longitude must be [-180, 180]
        invalid_lon = np.where(
            ~np.isnan(lon_values) & ((lon_values < -180.0) | (lon_values > 180.0))
        )[0]
        for pos in invalid_lon:
            row_idx = working_df.index[pos]
            bad_lon = working_df.loc[row_idx, "longitude"]
            validation_issues.append({
                "row": row_idx + 2,
                "field": "longitude",
                "type": "INVALID_COORDINATE_RANGE",
                "message": f"Row {row_idx + 2}: Longitude {bad_lon} out of range [-180, 180]. Reset to NULL."
            })
            working_df.loc[row_idx, "longitude"] = np.nan

        # 6. Normalize location_source & location_accuracy enums
        def sanitize_enum(val: Optional[str], valid_set: set, default: str) -> str:
            if not val:
                return default
            val_upper = str(val).upper().strip()
            return val_upper if val_upper in valid_set else default

        working_df["location_source"] = working_df["location_source"].apply(
            lambda v: sanitize_enum(v, VALID_LOCATION_SOURCES, "UNKNOWN")
        )
        working_df["location_accuracy"] = working_df["location_accuracy"].apply(
            lambda v: sanitize_enum(v, VALID_LOCATION_ACCURACIES, "UNKNOWN")
        )

        # 7. Normalize is_active
        def sanitize_bool(val: Any) -> bool:
            if val is None or pd.isna(val):
                return True
            if isinstance(val, bool):
                return val
            val_str = str(val).strip().lower()
            return val_str not in {"false", "0", "no", "inactive"}

        working_df["is_active"] = working_df["is_active"].apply(sanitize_bool)

        # 8. Convert to list of sanitized dictionaries (replace np.nan with None)
        clean_records: List[Dict[str, Any]] = []
        for _, row in working_df.iterrows():
            record = {
                "id": str(uuid.uuid4()),
                "name": row["name"],
                "state": row["state"],
                "district": row["district"],
                "highway": row["highway"],
                "road_type": row["road_type"],
                "black_spot_code": row["black_spot_code"],
                "latitude": float(row["latitude"]) if pd.notna(row["latitude"]) else None,
                "longitude": float(row["longitude"]) if pd.notna(row["longitude"]) else None,
                "accident_count": int(row["accident_count"]) if pd.notna(row["accident_count"]) else None,
                "fatalities": int(row["fatalities"]) if pd.notna(row["fatalities"]) else None,
                "severity": row["severity"],
                "official_priority": row["official_priority"],
                "warning_radius": int(row["warning_radius"]),
                "source": row["source"],
                "source_url": row["source_url"],
                "source_date": row["source_date"],
                "data_period_start": row["data_period_start"],
                "data_period_end": row["data_period_end"],
                "location_source": row["location_source"],
                "location_accuracy": row["location_accuracy"],
                "is_active": row["is_active"],
            }
            clean_records.append(record)

        return clean_records, validation_issues

    def load_and_process_csv(
        self, file_path: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Convenience method to read and process a CSV file."""
        df = self.read_csv(file_path)
        return self.process_dataframe(df)

    def import_records(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Inserts records into Supabase or fallback in-memory store."""
        if not records:
            return {"inserted": 0, "status": "NO_RECORDS"}

        if is_supabase_configured() and self.supabase:
            try:
                # Strip generated 'id' to allow Supabase to use its default UUID generator,
                # or pass if desired. We include id for deterministic reference.
                response = self.supabase.table("accident_zones").insert(records).execute()
                return {
                    "inserted": len(records),
                    "target": "SUPABASE",
                    "status": "SUCCESS"
                }
            except Exception as exc:
                raise RuntimeError(f"Database insertion failed: {exc}") from exc
        else:
            # Fallback to in-memory store for local testing/development
            InMemoryZoneStore.set_zones(records)
            return {
                "inserted": len(records),
                "target": "IN_MEMORY_FALLBACK",
                "status": "SUCCESS",
                "note": "Supabase credentials not configured in .env. Saved to in-memory store."
            }


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python -m api.services.data_service <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    service = DataService()
    print(f"Reading and validating: {csv_path}")
    records, issues = service.load_and_process_csv(csv_path)

    print(f"Validation complete. Valid records: {len(records)}, Issues found: {len(issues)}")
    if issues:
        print("Validation Issues:")
        for issue in issues[:10]:
            print(f"  [{issue['type']}] {issue['message']}")
        if len(issues) > 10:
            print(f"  ...and {len(issues) - 10} more issues.")

    result = service.import_records(records)
    print(f"Import result: {json.dumps(result, indent=2)}")
