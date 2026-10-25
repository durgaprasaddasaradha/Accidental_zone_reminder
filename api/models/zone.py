"""Internal domain model for accident zones."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class AccidentZone:
    id: Optional[str] = None
    name: str = ""
    state: str = ""
    district: str = ""
    highway: Optional[str] = None
    road_type: Optional[str] = None
    black_spot_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accident_count: Optional[int] = None
    fatalities: Optional[int] = None
    severity: Optional[str] = None
    official_priority: Optional[str] = None
    warning_radius: int = 500
    source: str = ""
    source_url: Optional[str] = None
    source_date: Optional[date] = None
    data_period_start: Optional[date] = None
    data_period_end: Optional[date] = None
    location_source: str = "UNKNOWN"
    location_accuracy: str = "UNKNOWN"
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
