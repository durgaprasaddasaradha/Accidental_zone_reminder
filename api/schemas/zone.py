"""Pydantic schemas for accident zone models and API request/response payloads."""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LocationSource(str, Enum):
    OFFICIAL = "OFFICIAL"
    VERIFIED_DERIVED = "VERIFIED_DERIVED"
    UNKNOWN = "UNKNOWN"


class LocationAccuracy(str, Enum):
    EXACT = "EXACT"
    APPROXIMATE = "APPROXIMATE"
    UNKNOWN = "UNKNOWN"


class AccidentZoneBase(BaseModel):
    name: str = Field(
        ...,
        description="Official name or descriptive location of the accident zone",
    )
    state: str = Field(
        ...,
        description="State where the zone is situated",
    )
    district: str = Field(
        ...,
        description="District where the zone is situated",
    )
    highway: Optional[str] = Field(
        None,
        description="Highway code (e.g. NH-48) if applicable",
    )
    road_type: Optional[str] = Field(
        None,
        description="Type of road (e.g. National Highway, State Highway)",
    )
    black_spot_code: Optional[str] = Field(
        None,
        description="Official black spot identifier code",
    )
    latitude: Optional[float] = Field(
        None,
        description="Latitude in decimal degrees (-90 to 90), nullable",
    )
    longitude: Optional[float] = Field(
        None,
        description="Longitude in decimal degrees (-180 to 180), nullable",
    )
    accident_count: Optional[int] = Field(
        None,
        description="Total reported accidents in official observation period",
    )
    fatalities: Optional[int] = Field(
        None,
        description="Total recorded fatalities in official observation period",
    )
    severity: Optional[str] = Field(
        None,
        description="Severity value recorded in the source dataset",
    )
    official_priority: Optional[str] = Field(
        None,
        description="Official rectification priority ranking",
    )
    warning_radius: int = Field(
        500,
        description="Warning trigger radius in meters",
    )
    source: str = Field(
        ...,
        description="Verified data source (e.g. MORTH_BLACK_SPOT)",
    )
    source_url: Optional[str] = Field(
        None,
        description="Official source URL or reference link",
    )
    source_date: Optional[str] = Field(
        None,
        description="Publication date of the official source report (YYYY-MM-DD)",
    )
    data_period_start: Optional[str] = Field(
        None,
        description="Start date of study/data collection window",
    )
    data_period_end: Optional[str] = Field(
        None,
        description="End date of study/data collection window",
    )
    location_source: LocationSource = Field(
        LocationSource.UNKNOWN,
        description="Source provenance of coordinates",
    )
    location_accuracy: LocationAccuracy = Field(
        LocationAccuracy.UNKNOWN,
        description="Accuracy rating of coordinates",
    )
    is_active: bool = Field(
        True,
        description="Whether this black spot zone is actively monitored",
    )

    @field_validator("latitude")
    @classmethod
    def validate_latitude(
        cls,
        v: Optional[float],
    ) -> Optional[float]:
        if v is not None:
            if not (-90.0 <= v <= 90.0):
                raise ValueError(
                    "Latitude must be between -90.0 and 90.0 degrees"
                )
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(
        cls,
        v: Optional[float],
    ) -> Optional[float]:
        if v is not None:
            if not (-180.0 <= v <= 180.0):
                raise ValueError(
                    "Longitude must be between -180.0 and 180.0 degrees"
                )
        return v


class AccidentZoneCreate(AccidentZoneBase):
    pass


class AccidentZoneResponse(AccidentZoneBase):
    id: str = Field(
        ...,
        description="Unique zone identifier (UUID)",
    )
    created_at: Optional[str] = Field(
        None,
        description="Timestamp of record creation",
    )
    updated_at: Optional[str] = Field(
        None,
        description="Timestamp of record update",
    )

    model_config = ConfigDict(from_attributes=True)


class ZoneStatsResponse(BaseModel):
    total_zones: int = Field(
        ...,
        description="Total active accident zones recorded",
    )
    high_risk_zones: int = Field(
        ...,
        description="Number of zones classified as high risk by the project severity threshold",
    )
    zones_with_coordinates: int = Field(
        ...,
        description="Count of zones having verified GPS coordinates",
    )
    zones_without_coordinates: int = Field(
        ...,
        description="Count of zones with location description only (null GPS)",
    )
    total_fatalities: Optional[int] = Field(
        0,
        description="Cumulative fatalities across zones where recorded",
    )
    total_accidents: Optional[int] = Field(
        0,
        description="Cumulative accidents across zones where recorded",
    )
    states_count: int = Field(
        ...,
        description="Number of distinct states represented",
    )
    states_represented: List[str] = Field(
        ...,
        description="List of distinct state names in database",
    )


class ZoneListResponse(BaseModel):
    zones: List[AccidentZoneResponse]
    total: int
    limit: int
    offset: int