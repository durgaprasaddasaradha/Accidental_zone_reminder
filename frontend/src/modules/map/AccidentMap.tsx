import { useEffect, useMemo, useState } from "react";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Circle,
    useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

interface CurrentLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
}

interface AccidentZone {
    id: string;
    name: string;
    state: string;
    district: string;
    highway?: string;
    latitude: number | null;
    longitude: number | null;
    accident_count: number;
    fatalities: number;
    severity: string | number;
    official_priority?: string;
    warning_radius?: number;
    source?: string;
}

interface DemoZone {
    id: string;
    name: string;
    state: string;
    district: string;
    highway: string;
    latitude: number;
    longitude: number;
    severity: number;
    warning_radius: number;
    is_demo: boolean;
}

interface AccidentMapProps {
    currentLocation?: CurrentLocation | null;
}

interface ZoneWithDistance {
    zone: AccidentZone | DemoZone;
    distance: number;
    isDemo: boolean;
}

const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const earthRadiusKm = 6371;

    const dLat =
        ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
        ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusKm * c;
};

/*
 * Current driver location icon
 */
const currentLocationIcon = L.divIcon({
    className: "",
    html: `
        <div style="
            width: 20px;
            height: 20px;
            background: #2563eb;
            border: 4px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
        "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

/*
 * Real accident-zone icon
 */
const accidentIcon = L.divIcon({
    className: "",
    html: `
        <div style="
            width: 30px;
            height: 30px;
            background: #dc2626;
            border: 3px solid white;
            border-radius: 50%;
            color: white;
            font-weight: bold;
            font-size: 17px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">!</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

/*
 * Demo accident-zone icon
 */
const demoAccidentIcon = L.divIcon({
    className: "",
    html: `
        <div style="
            width: 30px;
            height: 30px;
            background: #9333ea;
            border: 3px solid white;
            border-radius: 50%;
            color: white;
            font-weight: bold;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">D</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

/*
 * Map automatically follows the current driver location.
 */
function MapController({
    currentLocation,
}: {
    currentLocation?: CurrentLocation | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (currentLocation) {
            map.setView(
                [
                    currentLocation.latitude,
                    currentLocation.longitude,
                ],
                14
            );
        }
    }, [currentLocation, map]);

    return null;
}

export default function AccidentMap({
    currentLocation,
}: AccidentMapProps) {
    const [zones, setZones] =
        useState<AccidentZone[]>([]);

    const [demoZones, setDemoZones] =
        useState<DemoZone[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    /*
     * Load real + demo zones.
     */
    useEffect(() => {
        const loadZones = async () => {
            try {
                setLoading(true);
                setError(null);

                /*
                 * Real 2024 accident data.
                 */
                const response =
                    await fetch("/api/zones");

                if (!response.ok) {
                    throw new Error(
                        "Failed to fetch accident zones"
                    );
                }

                const data =
                    await response.json();

                setZones(
                    Array.isArray(data.zones)
                        ? data.zones
                        : []
                );

                /*
                 * Demo GPS zones.
                 */
                const demoResponse =
                    await fetch(
                        "/api/demo-zones"
                    );

                if (!demoResponse.ok) {
                    throw new Error(
                        "Failed to fetch demo zones"
                    );
                }

                const demoData =
                    await demoResponse.json();

                setDemoZones(
                    Array.isArray(
                        demoData.zones
                    )
                        ? demoData.zones
                        : []
                );
            } catch (err) {
                console.error(err);

                setError(
                    "Unable to load accident zones."
                );
            } finally {
                setLoading(false);
            }
        };

        loadZones();
    }, []);

    /*
     * Real zones having coordinates.
     */
    const mappedZones = useMemo(
        () =>
            zones.filter(
                (zone) =>
                    zone.latitude !== null &&
                    zone.longitude !== null
            ),
        [zones]
    );

    /*
     * Real zones without coordinates.
     */
    const pendingZones = useMemo(
        () =>
            zones.filter(
                (zone) =>
                    zone.latitude === null ||
                    zone.longitude === null
            ),
        [zones]
    );

    /*
     * All zones with coordinates for distance calculation.
     */
    const zonesWithDistance =
        useMemo<ZoneWithDistance[]>(() => {
            if (!currentLocation) {
                return [];
            }

            const realResults =
                mappedZones.map((zone) => ({
                    zone,
                    distance:
                        calculateDistance(
                            currentLocation.latitude,
                            currentLocation.longitude,
                            Number(zone.latitude),
                            Number(zone.longitude)
                        ),
                    isDemo: false,
                }));

            const demoResults =
                demoZones.map((zone) => ({
                    zone,
                    distance:
                        calculateDistance(
                            currentLocation.latitude,
                            currentLocation.longitude,
                            zone.latitude,
                            zone.longitude
                        ),
                    isDemo: true,
                }));

            return [
                ...realResults,
                ...demoResults,
            ].sort(
                (a, b) =>
                    a.distance -
                    b.distance
            );
        }, [
            currentLocation,
            mappedZones,
            demoZones,
        ]);

    /*
     * Nearest zone.
     */
    const nearestZone =
        zonesWithDistance[0] ?? null;

    /*
     * Distance to nearest zone.
     */
    const nearestDistance =
        nearestZone?.distance ?? null;

    return (
        <div className="space-y-4">

            {/* Live Safety Information */}
            {currentLocation && (
                <div className="bg-white rounded-xl border border-indigo-200 p-5">

                    <div className="flex items-center gap-3 mb-4">

                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">

                            <span className="text-xl">
                                📍
                            </span>

                        </div>

                        <div>

                            <h2 className="text-lg font-bold text-slate-900">
                                Live Safety Information
                            </h2>

                            <p className="text-sm text-slate-500">
                                Nearest known accident-prone location
                            </p>

                        </div>

                    </div>

                    {nearestZone ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Current Location */}
                            <div className="rounded-lg bg-slate-50 p-4">

                                <p className="text-sm font-semibold text-slate-500">
                                    YOUR CURRENT LOCATION
                                </p>

                                <p className="font-bold text-slate-900 mt-2">
                                    {currentLocation.latitude.toFixed(
                                        6
                                    )}
                                    ,{" "}
                                    {currentLocation.longitude.toFixed(
                                        6
                                    )}
                                </p>

                                <p className="text-sm text-slate-500 mt-1">
                                    GPS accuracy:{" "}
                                    {Math.round(
                                        currentLocation.accuracy
                                    )}{" "}
                                    m
                                </p>

                            </div>

                            {/* Nearest Zone */}
                            <div
                                className={
                                    nearestZone.isDemo
                                        ? "rounded-lg bg-purple-50 border border-purple-200 p-4"
                                        : "rounded-lg bg-amber-50 border border-amber-200 p-4"
                                }
                            >

                                <div className="flex items-center gap-2">

                                    <p
                                        className={
                                            nearestZone.isDemo
                                                ? "text-sm font-semibold text-purple-700"
                                                : "text-sm font-semibold text-amber-700"
                                        }
                                    >
                                        NEAREST ACCIDENT ZONE
                                    </p>

                                    {nearestZone.isDemo && (
                                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">
                                            DEMO
                                        </span>
                                    )}

                                </div>

                                <p className="font-bold text-slate-900 mt-2">
                                    {nearestZone.zone.name}
                                </p>

                                <p className="text-sm text-slate-600 mt-1">
                                    {nearestZone.zone.district},{" "}
                                    {nearestZone.zone.state}
                                </p>

                                {nearestDistance !==
                                    null && (
                                        <p className="text-2xl font-extrabold text-indigo-700 mt-3">

                                            {nearestDistance <
                                                1
                                                ? `${Math.round(
                                                    nearestDistance *
                                                    1000
                                                )} m`
                                                : `${nearestDistance.toFixed(
                                                    2
                                                )} km`}

                                        </p>
                                    )}

                                <p className="text-xs text-slate-500">
                                    Distance from current location
                                </p>

                            </div>

                        </div>
                    ) : (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">

                            <p className="font-semibold text-amber-800">
                                No mapped accident zones are available for distance calculation.
                            </p>

                        </div>
                    )}

                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                {/* Real zones */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                        Real Zones
                    </p>

                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        {zones.length}
                    </p>

                </div>

                {/* Demo zones */}
                <div className="bg-white rounded-xl border border-purple-200 p-5">

                    <p className="text-sm text-purple-600">
                        Demo GPS Zones
                    </p>

                    <p className="text-2xl font-bold text-purple-600 mt-1">
                        {demoZones.length}
                    </p>

                </div>

                {/* Mapped */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                        Mapped Real Zones
                    </p>

                    <p className="text-2xl font-bold text-green-600 mt-1">
                        {mappedZones.length}
                    </p>

                </div>

                {/* Pending */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                        Coordinates Pending
                    </p>

                    <p className="text-2xl font-bold text-orange-600 mt-1">
                        {pendingZones.length}
                    </p>

                </div>

            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">

                <div className="flex flex-wrap gap-6 text-sm">

                    <div className="flex items-center gap-2">

                        <span className="w-3 h-3 rounded-full bg-red-600" />

                        <span>
                            Real Accident / Black Spot
                        </span>

                    </div>

                    <div className="flex items-center gap-2">

                        <span className="w-3 h-3 rounded-full bg-purple-600" />

                        <span>
                            Demo GPS Zone
                        </span>

                    </div>

                    <div className="flex items-center gap-2">

                        <span className="w-3 h-3 rounded-full bg-blue-600" />

                        <span>
                            Current Location
                        </span>

                    </div>

                </div>

            </div>

            {/* Map */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

                <MapContainer
                    center={[
                        20.5937,
                        78.9629,
                    ]}
                    zoom={5}
                    scrollWheelZoom={true}
                    style={{
                        height: "600px",
                        width: "100%",
                    }}
                >

                    <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapController
                        currentLocation={
                            currentLocation
                        }
                    />

                    {/* ========================= */}
                    {/* REAL ACCIDENT ZONES       */}
                    {/* ========================= */}

                    {mappedZones.map(
                        (zone) => (
                            <div
                                key={`real-${zone.id}`}
                            >

                                <Marker
                                    position={[
                                        Number(
                                            zone.latitude
                                        ),
                                        Number(
                                            zone.longitude
                                        ),
                                    ]}
                                    icon={
                                        accidentIcon
                                    }
                                >

                                    <Popup>

                                        <div className="space-y-2">

                                            <h3 className="font-bold text-red-700">
                                                {zone.name}
                                            </h3>

                                            <p>
                                                <strong>
                                                    District:
                                                </strong>{" "}
                                                {zone.district}
                                            </p>

                                            <p>
                                                <strong>
                                                    State:
                                                </strong>{" "}
                                                {zone.state}
                                            </p>

                                            {zone.highway && (
                                                <p>
                                                    <strong>
                                                        Highway:
                                                    </strong>{" "}
                                                    {zone.highway}
                                                </p>
                                            )}

                                            <p>
                                                <strong>
                                                    Severity:
                                                </strong>{" "}
                                                {zone.severity}
                                            </p>

                                            <p>
                                                <strong>
                                                    Accidents:
                                                </strong>{" "}
                                                {zone.accident_count}
                                            </p>

                                            <p>
                                                <strong>
                                                    Fatalities:
                                                </strong>{" "}
                                                {zone.fatalities}
                                            </p>

                                            {zone.official_priority && (
                                                <p>
                                                    <strong>
                                                        Priority:
                                                    </strong>{" "}
                                                    {zone.official_priority}
                                                </p>
                                            )}

                                            {zone.warning_radius && (
                                                <p>
                                                    <strong>
                                                        Warning Radius:
                                                    </strong>{" "}
                                                    {zone.warning_radius}{" "}
                                                    m
                                                </p>
                                            )}

                                            {zone.source && (
                                                <p>
                                                    <strong>
                                                        Source:
                                                    </strong>{" "}
                                                    {zone.source}
                                                </p>
                                            )}

                                        </div>

                                    </Popup>

                                </Marker>

                                <Circle
                                    center={[
                                        Number(
                                            zone.latitude
                                        ),
                                        Number(
                                            zone.longitude
                                        ),
                                    ]}
                                    radius={
                                        zone.warning_radius ||
                                        500
                                    }
                                    pathOptions={{
                                        color: "red",
                                        fillColor: "red",
                                        fillOpacity: 0.08,
                                        weight: 1,
                                    }}
                                />

                            </div>
                        )
                    )}

                    {/* ========================= */}
                    {/* DEMO GPS ZONES            */}
                    {/* ========================= */}

                    {demoZones.map(
                        (zone) => (
                            <div
                                key={`demo-${zone.id}`}
                            >

                                <Marker
                                    position={[
                                        zone.latitude,
                                        zone.longitude,
                                    ]}
                                    icon={
                                        demoAccidentIcon
                                    }
                                >

                                    <Popup>

                                        <div className="space-y-2">

                                            <div className="flex items-center gap-2">

                                                <h3 className="font-bold text-purple-700">
                                                    {zone.name}
                                                </h3>

                                                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">
                                                    DEMO
                                                </span>

                                            </div>

                                            <p>
                                                <strong>
                                                    District:
                                                </strong>{" "}
                                                {zone.district}
                                            </p>

                                            <p>
                                                <strong>
                                                    State:
                                                </strong>{" "}
                                                {zone.state}
                                            </p>

                                            <p>
                                                <strong>
                                                    Highway:
                                                </strong>{" "}
                                                {zone.highway}
                                            </p>

                                            <p>
                                                <strong>
                                                    Severity:
                                                </strong>{" "}
                                                {zone.severity}
                                            </p>

                                            <p>
                                                <strong>
                                                    Warning Radius:
                                                </strong>{" "}
                                                {zone.warning_radius}{" "}
                                                m
                                            </p>

                                            <p className="text-xs text-purple-600 font-semibold">
                                                DEMO ONLY — NOT OFFICIAL COORDINATES
                                            </p>

                                        </div>

                                    </Popup>

                                </Marker>

                                <Circle
                                    center={[
                                        zone.latitude,
                                        zone.longitude,
                                    ]}
                                    radius={
                                        zone.warning_radius
                                    }
                                    pathOptions={{
                                        color: "purple",
                                        fillColor: "purple",
                                        fillOpacity: 0.08,
                                        weight: 1,
                                        dashArray: "6 6",
                                    }}
                                />

                            </div>
                        )
                    )}

                    {/* ========================= */}
                    {/* CURRENT DRIVER LOCATION   */}
                    {/* ========================= */}

                    {currentLocation && (
                        <>
                            <Marker
                                position={[
                                    currentLocation.latitude,
                                    currentLocation.longitude,
                                ]}
                                icon={
                                    currentLocationIcon
                                }
                            >

                                <Popup>

                                    <div>

                                        <h3 className="font-bold text-blue-700">
                                            📍 Your Current Location
                                        </h3>

                                        <p className="mt-2">
                                            <strong>
                                                Latitude:
                                            </strong>{" "}
                                            {currentLocation.latitude.toFixed(
                                                6
                                            )}
                                        </p>

                                        <p>
                                            <strong>
                                                Longitude:
                                            </strong>{" "}
                                            {currentLocation.longitude.toFixed(
                                                6
                                            )}
                                        </p>

                                        <p>
                                            <strong>
                                                Accuracy:
                                            </strong>{" "}
                                            {Math.round(
                                                currentLocation.accuracy
                                            )}{" "}
                                            m
                                        </p>

                                    </div>

                                </Popup>

                            </Marker>

                            <Circle
                                center={[
                                    currentLocation.latitude,
                                    currentLocation.longitude,
                                ]}
                                radius={
                                    currentLocation.accuracy
                                }
                                pathOptions={{
                                    color: "#2563eb",
                                    fillColor: "#2563eb",
                                    fillOpacity: 0.08,
                                    weight: 1,
                                }}
                            />
                        </>
                    )}

                </MapContainer>

            </div>

            {/* GPS status */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">

                {currentLocation ? (
                    <div className="flex items-center gap-3">

                        <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />

                        <div>

                            <p className="font-semibold text-slate-900">
                                GPS Location Active
                            </p>

                            <p className="text-sm text-slate-500">

                                {currentLocation.latitude.toFixed(
                                    6
                                )}
                                ,{" "}
                                {currentLocation.longitude.toFixed(
                                    6
                                )}

                                {" • "}

                                Accuracy:{" "}
                                {Math.round(
                                    currentLocation.accuracy
                                )}{" "}
                                m

                            </p>

                        </div>

                    </div>
                ) : (
                    <div className="text-sm text-slate-500">

                        GPS location not active.
                        Start a ride from Safety Monitor.

                    </div>
                )}

            </div>

            {loading && (
                <div className="text-sm text-slate-500">
                    Loading accident zones...
                </div>
            )}

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
                    {error}
                </div>
            )}

        </div>
    );
}