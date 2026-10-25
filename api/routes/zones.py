"""FastAPI router for accident zone queries and summary statistics."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from api.database.supabase import (
    get_supabase_client,
    is_supabase_configured,
)
from api.schemas.zone import (
    AccidentZoneResponse,
    ZoneListResponse,
    ZoneStatsResponse,
)
from api.services.data_service import InMemoryZoneStore


router = APIRouter(
    prefix="/api/zones",
    tags=["Accident Zones"],
)


# Project-defined threshold.
# This is NOT an official MoRTH high-risk classification.
HIGH_RISK_SEVERITY_THRESHOLD = 50.0


def _get_severity_value(zone: dict) -> Optional[float]:
    """Safely convert the stored severity value to a number."""
    value = zone.get("severity")

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_high_risk(zone: dict) -> bool:
    """Return True when the zone meets the project-defined severity threshold."""
    severity = _get_severity_value(zone)

    if severity is None:
        return False

    return severity >= HIGH_RISK_SEVERITY_THRESHOLD


def _query_supabase_zones(
    state: Optional[str] = None,
    district: Optional[str] = None,
    has_coordinates: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[dict], int]:
    """Queries zones directly from Supabase PostgreSQL table."""
    client = get_supabase_client()

    query = (
        client.table("accident_zones")
        .select("*", count="exact")
        .eq("is_active", True)
    )

    if state:
        query = query.ilike(
            "state",
            f"%{state.strip()}%",
        )

    if district:
        query = query.ilike(
            "district",
            f"%{district.strip()}%",
        )

    if has_coordinates is True:
        query = (
            query.not_.is_("latitude", "null")
            .not_.is_("longitude", "null")
        )

    elif has_coordinates is False:
        query = query.is_("latitude", "null")

    query = query.range(
        offset,
        offset + limit - 1,
    )

    response = query.execute()

    total = (
        response.count
        if response.count is not None
        else len(response.data)
    )

    return response.data, total


def _query_memory_zones(
    state: Optional[str] = None,
    district: Optional[str] = None,
    has_coordinates: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[dict], int]:
    """Queries zones from the in-memory fallback store."""

    all_zones = [
        z
        for z in InMemoryZoneStore.get_zones()
        if z.get("is_active", True)
    ]

    filtered = []

    for z in all_zones:

        if state and state.lower() not in (
            z.get("state") or ""
        ).lower():
            continue

        if district and district.lower() not in (
            z.get("district") or ""
        ).lower():
            continue

        if has_coordinates is True:
            if (
                z.get("latitude") is None
                or z.get("longitude") is None
            ):
                continue

        elif has_coordinates is False:
            if (
                z.get("latitude") is not None
                and z.get("longitude") is not None
            ):
                continue

        filtered.append(z)

    total = len(filtered)

    paged = filtered[
        offset : offset + limit
    ]

    return paged, total


@router.get(
    "",
    response_model=ZoneListResponse,
    summary="List active accident black spots",
    description=(
        "Retrieve active accident black-spot zones with "
        "optional state/district and coordinate filters."
    ),
)
async def list_zones(
    state: Optional[str] = Query(
        None,
        description=(
            "Filter by state name "
            "(case-insensitive substring)"
        ),
    ),
    district: Optional[str] = Query(
        None,
        description=(
            "Filter by district name "
            "(case-insensitive substring)"
        ),
    ),
    has_coordinates: Optional[bool] = Query(
        None,
        description=(
            "Filter by presence of verified GPS coordinates"
        ),
    ),
    limit: int = Query(
        100,
        ge=1,
        le=500,
        description="Maximum records to return",
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Offset for pagination",
    ),
):
    try:

        if is_supabase_configured():

            zones, total = _query_supabase_zones(
                state=state,
                district=district,
                has_coordinates=has_coordinates,
                limit=limit,
                offset=offset,
            )

        else:

            zones, total = _query_memory_zones(
                state=state,
                district=district,
                has_coordinates=has_coordinates,
                limit=limit,
                offset=offset,
            )

        return ZoneListResponse(
            zones=zones,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to query accident zones: {str(exc)}"
            ),
        ) from exc


@router.get(
    "/stats",
    response_model=ZoneStatsResponse,
    summary="Accident zones summary statistics",
    description=(
        "Returns aggregate counts including total zones, "
        "project-defined high-risk zones, coordinate availability, "
        "fatalities, accidents, and states represented."
    ),
)
async def get_zone_stats():

    try:

        if is_supabase_configured():

            client = get_supabase_client()

            res = (
                client.table("accident_zones")
                .select("*")
                .eq("is_active", True)
                .execute()
            )

            data = res.data or []

        else:

            data = [
                z
                for z in InMemoryZoneStore.get_zones()
                if z.get("is_active", True)
            ]

        total_zones = len(data)

        high_risk_zones = sum(
            1
            for z in data
            if _is_high_risk(z)
        )

        zones_with_coords = sum(
            1
            for z in data
            if (
                z.get("latitude") is not None
                and z.get("longitude") is not None
            )
        )

        zones_without_coords = (
            total_zones - zones_with_coords
        )

        total_fatalities = sum(
            z.get("fatalities") or 0
            for z in data
        )

        total_accidents = sum(
            z.get("accident_count") or 0
            for z in data
        )

        distinct_states = sorted(
            list(
                {
                    z.get("state")
                    for z in data
                    if z.get("state")
                }
            )
        )

        return ZoneStatsResponse(
            total_zones=total_zones,
            high_risk_zones=high_risk_zones,
            zones_with_coordinates=zones_with_coords,
            zones_without_coordinates=zones_without_coords,
            total_fatalities=total_fatalities,
            total_accidents=total_accidents,
            states_count=len(distinct_states),
            states_represented=distinct_states,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to compute statistics: {str(exc)}"
            ),
        ) from exc


@router.get(
    "/{zone_id}",
    response_model=AccidentZoneResponse,
    summary="Get details of a specific accident zone",
    description=(
        "Retrieve a single accident black-spot record "
        "by its unique identifier."
    ),
)
async def get_zone_by_id(
    zone_id: str,
):

    try:

        if is_supabase_configured():

            client = get_supabase_client()

            res = (
                client.table("accident_zones")
                .select("*")
                .eq("id", zone_id)
                .execute()
            )

            if not res.data:

                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        f"Accident zone with ID "
                        f"'{zone_id}' not found."
                    ),
                )

            return res.data[0]

        else:

            for z in InMemoryZoneStore.get_zones():

                if str(z.get("id")) == str(zone_id):
                    return z

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Accident zone with ID "
                    f"'{zone_id}' not found."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Error retrieving zone "
                f"'{zone_id}': {str(exc)}"
            ),
        ) from exc