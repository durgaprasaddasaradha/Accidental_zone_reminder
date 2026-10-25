import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

import { AccidentZone, ZoneStats } from "../types/zone";
import { zoneService } from "../services/zoneService";
import { ZoneCard } from "./ZoneCard";

import {
  Database,
  Filter,
  AlertTriangle,
  RefreshCw,
  Layers,
  MapPin,
  Navigation,
  Volume2,
} from "lucide-react";

import {
  calculateDistance,
  getSafetyLevel,
} from "../../computation/distance";

import SafetyAlert from "../../alert/SafetyAlert";

import { LocationData } from "../../location/LocationTracker";

interface ZoneListProps {
  currentLocation?: LocationData | null;
}

interface ZoneWithDistance {
  zone: AccidentZone;
  distanceMeters: number;
  distanceKm: number;
  isDemo?: boolean;
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

export const ZoneList: React.FC<ZoneListProps> = ({
  currentLocation,
}) => {
  const [zones, setZones] = useState<AccidentZone[]>([]);
  const [demoZones, setDemoZones] = useState<DemoZone[]>([]);
  const [stats, setStats] = useState<ZoneStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedState, setSelectedState] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");

  const [coordinateFilter, setCoordinateFilter] =
    useState<"all" | "with" | "without">("all");

  const previousSafetyLevel = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const statsData =
        await zoneService.fetchZoneStats();

      setStats(statsData);

      const hasCoords =
        coordinateFilter === "with"
          ? true
          : coordinateFilter === "without"
            ? false
            : undefined;

      const response =
        await zoneService.fetchZones({
          state:
            selectedState ||
            undefined,

          district:
            districtQuery ||
            undefined,

          has_coordinates:
            hasCoords,
        });

      setZones(response.zones);

      const demoResponse =
        await fetch("/api/demo-zones", {
          headers: {
            Accept: "application/json",
          },
        });

      if (!demoResponse.ok) {
        throw new Error(
          `Demo GPS API returned ${demoResponse.status}`
        );
      }

      const demoData =
        await demoResponse.json();

      setDemoZones(
        Array.isArray(demoData.zones)
          ? demoData.zones
          : []
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error occurred";

      setError(
        `Failed to connect to Data Module API: ${message}`
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedState,
    districtQuery,
    coordinateFilter,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const realZonesWithDistance =
    useMemo<ZoneWithDistance[]>(() => {
      if (!currentLocation) {
        return [];
      }

      return zones
        .filter(
          (zone) =>
            zone.latitude !== null &&
            zone.longitude !== null
        )
        .map((zone) => {
          const result =
            calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              zone.latitude as number,
              zone.longitude as number
            );

          return {
            zone,
            distanceMeters:
              result.distanceMeters,
            distanceKm:
              result.distanceKm,
            isDemo: false,
          };
        });
    }, [zones, currentLocation]);

  const demoZonesWithDistance =
    useMemo<ZoneWithDistance[]>(() => {
      if (!currentLocation) {
        return [];
      }

      return demoZones.map(
        (demoZone) => {
          const result =
            calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              demoZone.latitude,
              demoZone.longitude
            );

          return {
            zone:
              demoZone as unknown as AccidentZone,
            distanceMeters:
              result.distanceMeters,
            distanceKm:
              result.distanceKm,
            isDemo: true,
          };
        }
      );
    }, [
      demoZones,
      currentLocation,
    ]);

  const zonesWithDistance =
    useMemo<ZoneWithDistance[]>(() => {
      return [
        ...realZonesWithDistance,
        ...demoZonesWithDistance,
      ].sort(
        (a, b) =>
          a.distanceMeters -
          b.distanceMeters
      );
    }, [
      realZonesWithDistance,
      demoZonesWithDistance,
    ]);

  const nearestZone =
    zonesWithDistance[0] ?? null;

  /*
   * IMPORTANT:
   * getSafetyLevel() returns a SafetyResult object.
   * SafetyAlert expects that complete object.
   */
  const safetyResult =
    nearestZone
      ? getSafetyLevel(
        nearestZone.distanceMeters
      )
      : null;

  const safetyLevel =
    safetyResult?.level ?? null;

  useEffect(() => {
    if (
      !nearestZone ||
      !safetyResult
    ) {
      return;
    }

    const currentLevel =
      safetyResult.level;

    if (
      previousSafetyLevel.current ===
      currentLevel
    ) {
      return;
    }

    previousSafetyLevel.current =
      currentLevel;

    if (
      currentLevel === "CAUTION" &&
      nearestZone.distanceMeters <= 1000
    ) {
      if (
        "speechSynthesis" in
        window
      ) {
        window.speechSynthesis.cancel();

        const speech =
          new SpeechSynthesisUtterance(
            "Caution. Accident-prone zone ahead."
          );

        speech.rate = 0.95;
        speech.pitch = 1;

        window.speechSynthesis.speak(
          speech
        );
      }
    }

    if (
      currentLevel === "WARNING" &&
      nearestZone.distanceMeters <= 500
    ) {
      if (
        "speechSynthesis" in
        window
      ) {
        window.speechSynthesis.cancel();

        const speech =
          new SpeechSynthesisUtterance(
            "Warning! Accident-prone zone ahead. Slow down."
          );

        speech.rate = 0.9;
        speech.pitch = 1;

        window.speechSynthesis.speak(
          speech
        );
      }
    }
  }, [
    nearestZone,
    safetyResult,
  ]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Accident Zones
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Accident-prone locations from the Data Module
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading
              ? "animate-spin"
              : ""
              }`}
          />

          Refresh
        </button>
      </div>

      {/* Demo GPS notice */}
      {demoZones.length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-3">

            <Navigation className="w-5 h-5 text-purple-600" />

            <div>
              <p className="font-semibold text-purple-800">
                Demo GPS Layer Active
              </p>

              <p className="text-sm text-purple-700">
                {demoZones.length} simulated GPS zones are available for live warning demonstration.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Safety Alert */}
      {currentLocation &&
        nearestZone &&
        safetyResult && (
          <SafetyAlert
            level={safetyResult}
            distanceMeters={
              nearestZone.distanceMeters
            }
            severity={
              nearestZone.zone.severity ??
              undefined
            }
          />
        )}

      {/* Nearest Zone */}
      {currentLocation &&
        nearestZone && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">

            <div className="flex items-start gap-4">

              <div className="rounded-xl bg-indigo-50 p-3">
                <MapPin className="w-6 h-6 text-indigo-600" />
              </div>

              <div className="flex-1">

                <div className="flex flex-wrap items-center gap-2">

                  <h3 className="font-bold text-slate-900">
                    Nearest Accident Zone
                  </h3>

                  {nearestZone.isDemo && (
                    <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                      DEMO
                    </span>
                  )}

                </div>

                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {nearestZone.zone.name}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">

                  {/* Distance */}
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Distance
                    </p>

                    <p className="font-bold text-slate-900">

                      {nearestZone.distanceMeters < 1000
                        ? `${Math.round(
                          nearestZone.distanceMeters
                        )} m`
                        : `${nearestZone.distanceKm.toFixed(
                          2
                        )} km`}

                    </p>
                  </div>

                  {/* Safety */}
                  <div className="rounded-lg bg-slate-50 p-3">

                    <p className="text-xs text-slate-500">
                      Safety Level
                    </p>

                    <p className="font-bold text-slate-900">
                      {safetyLevel}
                    </p>

                  </div>

                  {/* Source */}
                  <div className="rounded-lg bg-slate-50 p-3">

                    <p className="text-xs text-slate-500">
                      Source
                    </p>

                    <p className="font-bold text-slate-900">

                      {nearestZone.isDemo
                        ? "Demo GPS"
                        : "2024 Dataset"}

                    </p>

                  </div>

                </div>

                {safetyLevel !== "SAFE" && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-600">

                    <Volume2 className="w-4 h-4" />

                    Voice warning activated

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      {/* GPS active but no zone */}
      {currentLocation &&
        !nearestZone &&
        !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">

            <div className="flex items-center gap-3">

              <MapPin className="w-6 h-6 text-indigo-600" />

              <div>

                <h3 className="font-bold text-slate-900">
                  GPS Active
                </h3>

                <p className="text-sm text-slate-500">
                  No accident zones are currently available for distance calculation.
                </p>

              </div>

            </div>

          </div>
        )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">

            <div className="flex items-center gap-3">

              <Database className="w-5 h-5 text-indigo-600" />

              <div>

                <p className="text-xs text-slate-500">
                  Total Zones
                </p>

                <p className="text-xl font-bold text-slate-900">
                  {stats.total_zones}
                </p>

              </div>

            </div>

          </div>

          {/* Coordinates */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">

            <div className="flex items-center gap-3">

              <Layers className="w-5 h-5 text-green-600" />

              <div>

                <p className="text-xs text-slate-500">
                  With Coordinates
                </p>

                <p className="text-xl font-bold text-slate-900">
                  {stats.zones_with_coordinates}
                </p>

              </div>

            </div>

          </div>

          {/* No coordinates */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">

            <div className="flex items-center gap-3">

              <AlertTriangle className="w-5 h-5 text-amber-600" />

              <div>

                <p className="text-xs text-slate-500">
                  Without Coordinates
                </p>

                <p className="text-xl font-bold text-slate-900">
                  {stats.zones_without_coordinates}
                </p>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">

        <div className="flex items-center gap-2 mb-4">

          <Filter className="w-5 h-5 text-indigo-600" />

          <h3 className="font-bold text-slate-900">
            Filters
          </h3>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* State */}
          <div>

            <label className="block text-xs font-semibold text-slate-500 mb-2">
              State
            </label>

            <input
              type="text"
              value={selectedState}
              onChange={(e) =>
                setSelectedState(
                  e.target.value
                )
              }
              placeholder="Enter state"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />

          </div>

          {/* District */}
          <div>

            <label className="block text-xs font-semibold text-slate-500 mb-2">
              District
            </label>

            <input
              type="text"
              value={districtQuery}
              onChange={(e) =>
                setDistrictQuery(
                  e.target.value
                )
              }
              placeholder="Enter district"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />

          </div>

          {/* Coordinates */}
          <div>

            <label className="block text-xs font-semibold text-slate-500 mb-2">
              Coordinates
            </label>

            <select
              value={coordinateFilter}
              onChange={(e) =>
                setCoordinateFilter(
                  e.target.value as
                  | "all"
                  | "with"
                  | "without"
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >

              <option value="all">
                All Zones
              </option>

              <option value="with">
                With Coordinates
              </option>

              <option value="without">
                Without Coordinates
              </option>

            </select>

          </div>

        </div>

      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">

          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600" />

          <p className="mt-3 text-sm text-slate-500">
            Loading accident zones...
          </p>

        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">

          <p className="font-semibold">
            Data Connection Error
          </p>

          <p className="text-sm mt-1">
            {error}
          </p>

        </div>
      )}

      {/* Zone list */}
      {!loading &&
        !error && (
          <div className="space-y-4">

            {zones.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">

                <Database className="w-8 h-8 mx-auto text-slate-400" />

                <p className="mt-3 font-semibold text-slate-700">
                  No accident zones found
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  Try changing the filters.
                </p>

              </div>
            ) : (
              zones.map(
                (zone) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                  />
                )
              )
            )}

          </div>
        )}

    </div>
  );
};