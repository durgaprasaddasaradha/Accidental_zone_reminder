import csv
import os

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/api/demo-zones",
    tags=["Demo GPS Zones"]
)


@router.get("")
def get_demo_zones():
    csv_path = os.path.join(
        os.path.dirname(
            os.path.dirname(
                os.path.dirname(__file__)
            )
        ),
        "data",
        "raw",
        "accident_zones_gps_demo.csv",
    )

    if not os.path.exists(csv_path):
        raise HTTPException(
            status_code=404,
            detail=f"Demo dataset not found: {csv_path}"
        )

    zones = []

    with open(
        csv_path,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            zones.append({
                "id": row["id"],
                "name": row["name"],
                "state": row["state"],
                "district": row["district"],
                "highway": row["highway"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "severity": float(row["severity"]),
                "warning_radius": float(row["warning_radius"]),
                "is_demo": row["is_demo"].lower() == "true",
            })

    return {
        "demo": True,
        "source": "DEMO ONLY - NOT OFFICIAL COORDINATES",
        "count": len(zones),
        "zones": zones,
    }