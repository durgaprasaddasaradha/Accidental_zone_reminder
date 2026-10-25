export interface DriverLocation {
    latitude: number;
    longitude: number;
}

export interface AccidentZone {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    warning_radius?: number;
    severity?: string;
    district?: string;
    state?: string;
    accident_count?: number;
    fatalities?: number;
}

export interface ZoneDistance extends AccidentZone {
    distanceMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function calculateDistance(
    driver: DriverLocation,
    zone: AccidentZone
): number | null {
    if (
        zone.latitude === null ||
        zone.longitude === null
    ) {
        return null;
    }

    const lat1 =
        (driver.latitude * Math.PI) / 180;

    const lat2 =
        (zone.latitude * Math.PI) / 180;

    const deltaLat =
        ((zone.latitude - driver.latitude) *
            Math.PI) /
        180;

    const deltaLon =
        ((zone.longitude - driver.longitude) *
            Math.PI) /
        180;

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return EARTH_RADIUS_METERS * c;
}

export function calculateZoneDistances(
    driver: DriverLocation,
    zones: AccidentZone[]
): ZoneDistance[] {
    return zones
        .map((zone) => {
            const distance = calculateDistance(
                driver,
                zone
            );

            if (distance === null) {
                return null;
            }

            return {
                ...zone,
                distanceMeters: distance,
            };
        })
        .filter(
            (zone): zone is ZoneDistance =>
                zone !== null
        )
        .sort(
            (a, b) =>
                a.distanceMeters - b.distanceMeters
        );
}

export function getNearestZone(
    driver: DriverLocation,
    zones: AccidentZone[]
): ZoneDistance | null {
    const distances =
        calculateZoneDistances(
            driver,
            zones
        );

    return distances.length > 0
        ? distances[0]
        : null;
}

export function isInsideWarningRadius(
    distanceMeters: number,
    warningRadius: number
): boolean {
    return distanceMeters <= warningRadius;
}

export function formatDistance(
    distanceMeters: number
): string {
    if (distanceMeters < 1000) {
        return `${Math.round(distanceMeters)} m`;
    }

    return `${(
        distanceMeters / 1000
    ).toFixed(2)} km`;
}