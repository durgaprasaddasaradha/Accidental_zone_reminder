export interface DistanceResult {
    distanceKm: number;
    distanceMeters: number;
}

export type SafetyLevel =
    | "SAFE"
    | "CAUTION"
    | "WARNING";

export interface SafetyResult {
    level: SafetyLevel;
    message: string;
}

export function calculateDistance(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number
): DistanceResult {
    const earthRadiusKm = 6371;

    const dLatitude =
        ((latitude2 - latitude1) * Math.PI) / 180;

    const dLongitude =
        ((longitude2 - longitude1) * Math.PI) / 180;

    const latitude1Radians =
        (latitude1 * Math.PI) / 180;

    const latitude2Radians =
        (latitude2 * Math.PI) / 180;

    const a =
        Math.sin(dLatitude / 2) ** 2 +
        Math.cos(latitude1Radians) *
        Math.cos(latitude2Radians) *
        Math.sin(dLongitude / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    const distanceKm = earthRadiusKm * c;

    return {
        distanceKm,
        distanceMeters: distanceKm * 1000,
    };
}

export function getSafetyLevel(
    distanceMeters: number
): SafetyResult {
    if (distanceMeters <= 500) {
        return {
            level: "WARNING",
            message:
                "ACCIDENT ZONE AHEAD — Slow down and drive carefully.",
        };
    }

    if (distanceMeters <= 1000) {
        return {
            level: "CAUTION",
            message:
                "Accident-prone zone approaching. Stay alert.",
        };
    }

    return {
        level: "SAFE",
        message:
            "No immediate accident-zone warning.",
    };
}