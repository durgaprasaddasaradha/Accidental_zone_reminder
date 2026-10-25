import React, { useEffect, useMemo, useState } from "react";

import {
  Shield,
  LayoutDashboard,
  Radio,
  Map as MapIcon,
  BarChart3,
  Upload,
  Database,
  Info,
  MapPin,
  AlertTriangle,
  Activity,
  Navigation,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ExternalLink,
  TrendingUp,
  PieChart,
  TableProperties,
  LocateFixed,
} from "lucide-react";

import { ZoneList } from "./modules/data/components/ZoneList";

import LocationTracker, {
  LocationData,
} from "./modules/location/LocationTracker";

import AccidentMap from "./modules/map/AccidentMap";

import { zoneService } from "./modules/data/services/zoneService";

type Page =
  | "dashboard"
  | "monitor"
  | "map"
  | "analysis"
  | "upload"
  | "sources"
  | "about";

interface ZoneStats {
  total_zones: number;
  high_risk_zones?: number;
  zones_with_coordinates: number;
  zones_without_coordinates: number;
  total_fatalities: number;
  total_accidents: number;
  states_count: number;
  states_represented: string[];
}

interface AnalysisZone {
  id?: string | number;
  name?: string | null;
  state?: string | null;
  district?: string | null;
  highway?: string | null;
  accident_count?: number | string | null;
  fatalities?: number | string | null;
  injuries?: number | string | null;
  severity?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface StateAnalysis {
  state: string;
  zones: number;
  accidents: number;
  fatalities: number;
  severityTotal: number;
  severityCount: number;
  averageSeverity: number;
}

interface MonitorZone {
  id?: string | number;
  name?: string | null;
  state?: string | null;
  district?: string | null;
  highway?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  severity?: number | string | null;
  warning_radius?: number | string | null;
  is_demo?: boolean;
}

interface MonitorNearestZone {
  zone: MonitorZone;
  distanceMeters: number;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("en-IN").format(
    Math.round(num(value))
  );
};

const textValue = (
  value: unknown,
  fallback = "Unknown"
): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const valueText = String(value).trim();

  return valueText || fallback;
};

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quotes && next === '"') {
        cell += '"';
        i++;
      } else {
        quotes = !quotes;
      }
      continue;
    }

    if (char === "," && !quotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (
      (char === "\n" || char === "\r") &&
      !quotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(cell.trim());
      cell = "";

      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());

    if (row.some((item) => item.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
};

const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const earthRadius = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
};

const App: React.FC = () => {
  const [activePage, setActivePage] =
    useState<Page>("dashboard");

  const [currentLocation, setCurrentLocation] =
    useState<LocationData | null>(null);

  const [zoneStats, setZoneStats] =
    useState<ZoneStats | null>(null);

  const [analysisZones, setAnalysisZones] =
    useState<AnalysisZone[]>([]);

  const [monitorZones, setMonitorZones] =
    useState<MonitorZone[]>([]);

  const [analysisLoading, setAnalysisLoading] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState("");

  const [monitorLoading, setMonitorLoading] =
    useState(false);

  const [uploadFileName, setUploadFileName] =
    useState("");

  const [uploadRows, setUploadRows] =
    useState<string[][]>([]);

  const [uploadError, setUploadError] =
    useState("");

  const navigation = [
    {
      id: "dashboard" as Page,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "monitor" as Page,
      label: "Safety Monitor",
      icon: Radio,
    },
    {
      id: "map" as Page,
      label: "Accident Map",
      icon: MapIcon,
    },
    {
      id: "analysis" as Page,
      label: "Data Analysis",
      icon: BarChart3,
    },
    {
      id: "upload" as Page,
      label: "Upload Dataset",
      icon: Upload,
    },
    {
      id: "sources" as Page,
      label: "Data Sources",
      icon: Database,
    },
    {
      id: "about" as Page,
      label: "About Project",
      icon: Info,
    },
  ];

  const loadZoneStats = async () => {
    try {
      const stats =
        await zoneService.fetchZoneStats();

      setZoneStats(stats as ZoneStats);
    } catch (error) {
      console.error(
        "Failed to load zone statistics:",
        error
      );
    }
  };

const loadAnalysisData = async () => {
  setAnalysisLoading(true);
  setAnalysisError("");

  try {
    const response = await zoneService.fetchZones({
      limit: 100,
      offset: 0,
    });

    const extractRecords = (value: unknown): AnalysisZone[] => {
      if (Array.isArray(value)) {
        return value as AnalysisZone[];
      }

      if (!value || typeof value !== "object") {
        return [];
      }

      const obj = value as Record<string, unknown>;

      // Check common API response formats.
      const possibleKeys = [
        "zones",
        "data",
        "items",
        "results",
        "records",
      ];

      for (const key of possibleKeys) {
        const candidate = obj[key];

        if (Array.isArray(candidate)) {
          return candidate as AnalysisZone[];
        }

        if (candidate && typeof candidate === "object") {
          const nestedRecords = extractRecords(candidate);

          if (nestedRecords.length > 0) {
            return nestedRecords;
          }
        }
      }

      return [];
    };

    const records = extractRecords(response);

    console.log("Analysis API response:", response);
    console.log("Analysis records loaded:", records.length);
    console.log("First analysis record:", records[0]);

    setAnalysisZones(records);

    if (records.length === 0) {
      setAnalysisError(
        "The API responded, but no zone records were found. Check the browser console for the response format."
      );
    }
  } catch (error) {
    console.error("Failed to load analysis data:", error);

    setAnalysisZones([]);

    setAnalysisError(
      "Could not load analysis data. Check VITE_API_URL and the backend connection."
    );
  } finally {
    setAnalysisLoading(false);
  }
};

  const loadMonitorZones = async () => {
    setMonitorLoading(true);

    try {
      const response = await fetch(
        "/api/demo-zones"
      );

      if (!response.ok) {
        throw new Error(
          "Could not load demo zones."
        );
      }

      const data = (await response.json()) as {
        zones?: MonitorZone[];
      };

      setMonitorZones(
        Array.isArray(data.zones)
          ? data.zones
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load monitor zones:",
        error
      );

      setMonitorZones([]);
    } finally {
      setMonitorLoading(false);
    }
  };

  useEffect(() => {
    loadZoneStats();
    loadAnalysisData();
    loadMonitorZones();
  }, []);

  /*
   * LIVE MONITOR CALCULATIONS
   */

  const nearestMonitorZone =
    useMemo<MonitorNearestZone | null>(() => {
      if (!currentLocation) {
        return null;
      }

      const currentLat = Number(
        currentLocation.latitude
      );

      const currentLon = Number(
        currentLocation.longitude
      );

      if (
        !Number.isFinite(currentLat) ||
        !Number.isFinite(currentLon)
      ) {
        return null;
      }

      let nearest: MonitorNearestZone | null =
        null;

      monitorZones.forEach((zone) => {
        const latitude = Number(zone.latitude);
        const longitude = Number(zone.longitude);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return;
        }

        const distanceMeters =
          calculateDistanceMeters(
            currentLat,
            currentLon,
            latitude,
            longitude
          );

        if (
          nearest === null ||
          distanceMeters <
          nearest.distanceMeters
        ) {
          nearest = {
            zone,
            distanceMeters,
          };
        }
      });

      return nearest;
    }, [currentLocation, monitorZones]);

  const monitorDistance =
    nearestMonitorZone?.distanceMeters ?? null;

  const monitorStatus =
    monitorDistance === null
      ? "SAFE"
      : monitorDistance <= 500
        ? "WARNING"
        : monitorDistance <= 1000
          ? "CAUTION"
          : "SAFE";

  const monitorStatusText =
    monitorDistance === null
      ? "Waiting for GPS"
      : monitorStatus === "WARNING"
        ? "Accident zone very close"
        : monitorStatus === "CAUTION"
          ? "Accident zone nearby"
          : "No immediate danger";

  /*
   * STATE ANALYSIS
   */

  const stateAnalysis =
    useMemo<StateAnalysis[]>(() => {
      const grouped: Record<
        string,
        {
          zones: number;
          accidents: number;
          fatalities: number;
          severityTotal: number;
          severityCount: number;
        }
      > = {};

      analysisZones.forEach((zone) => {
        const state = textValue(zone.state);

        if (!grouped[state]) {
          grouped[state] = {
            zones: 0,
            accidents: 0,
            fatalities: 0,
            severityTotal: 0,
            severityCount: 0,
          };
        }

        grouped[state].zones += 1;

        grouped[state].accidents += num(
          zone.accident_count
        );

        grouped[state].fatalities += num(
          zone.fatalities
        );

        const severity = Number(zone.severity);

        if (Number.isFinite(severity)) {
          grouped[state].severityTotal +=
            severity;

          grouped[state].severityCount += 1;
        }
      });

      return Object.keys(grouped)
        .map((state) => {
          const item = grouped[state];

          return {
            state,
            zones: item.zones,
            accidents: item.accidents,
            fatalities: item.fatalities,
            severityTotal:
              item.severityTotal,
            severityCount:
              item.severityCount,
            averageSeverity:
              item.severityCount > 0
                ? item.severityTotal /
                item.severityCount
                : 0,
          };
        })
        .sort(
          (a, b) => b.zones - a.zones
        );
    }, [analysisZones]);

  const topAccidentStates = useMemo(() => {
    return [...stateAnalysis]
      .sort(
        (a, b) => b.accidents - a.accidents
      )
      .slice(0, 10);
  }, [stateAnalysis]);

  const topFatalityStates = useMemo(() => {
    return [...stateAnalysis]
      .sort(
        (a, b) =>
          b.fatalities - a.fatalities
      )
      .slice(0, 10);
  }, [stateAnalysis]);

  const topZones = useMemo(() => {
    return [...analysisZones]
      .sort(
        (a, b) =>
          num(b.accident_count) -
          num(a.accident_count)
      )
      .slice(0, 10);
  }, [analysisZones]);

  /*
   * SEVERITY
   */

  const severityAnalysis = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    let unknown = 0;

    analysisZones.forEach((zone) => {
      const severity = Number(zone.severity);

      if (!Number.isFinite(severity)) {
        unknown++;
      } else if (severity >= 50) {
        high++;
      } else if (severity >= 25) {
        medium++;
      } else {
        low++;
      }
    });

    return {
      high,
      medium,
      low,
      unknown,
      total:
        high +
        medium +
        low +
        unknown,
    };
  }, [analysisZones]);

  /*
   * COORDINATES
   */

  const coordinateAnalysis = useMemo(() => {
    let withCoordinates = 0;

    analysisZones.forEach((zone) => {
      const latitude = Number(
        zone.latitude
      );

      const longitude = Number(
        zone.longitude
      );

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        withCoordinates++;
      }
    });

    return {
      withCoordinates,
      withoutCoordinates:
        analysisZones.length -
        withCoordinates,
    };
  }, [analysisZones]);

  const maxZones = Math.max(
    1,
    ...stateAnalysis.map(
      (item) => item.zones
    )
  );

  const maxAccidents = Math.max(
    1,
    ...topAccidentStates.map(
      (item) => item.accidents
    )
  );

  const maxFatalities = Math.max(
    1,
    ...topFatalityStates.map(
      (item) => item.fatalities
    )
  );

  const maxZoneAccidents = Math.max(
    1,
    ...topZones.map((zone) =>
      num(zone.accident_count)
    )
  );

  /*
   * PAGE RENDER
   */

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <section className="rounded-2xl bg-slate-950 text-white p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <p className="text-indigo-300 text-sm font-semibold uppercase tracking-wide">
                    Road Safety System
                  </p>

                  <h1 className="text-3xl font-extrabold mt-2">
                    Accident Zone Reminder
                  </h1>

                  <p className="text-slate-300 mt-2 max-w-2xl">
                    Monitor accident-prone
                    locations and warn drivers
                    before they approach
                    identified accident zones.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setActivePage("monitor")
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-700 transition"
                >
                  <Navigation className="w-5 h-5" />
                  Start Safety Monitor
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Black Spots"
                value={
                  zoneStats
                    ? formatNumber(
                      zoneStats.total_zones
                    )
                    : "—"
                }
                subtitle="From database"
                icon={
                  <MapPin className="w-6 h-6" />
                }
              />

              <StatCard
                title="High Risk Zones"
                value={
                  zoneStats
                    ? formatNumber(
                      zoneStats.high_risk_zones ??
                      0
                    )
                    : "—"
                }
                subtitle="Project threshold ≥ 50"
                icon={
                  <AlertTriangle className="w-6 h-6" />
                }
              />

              <StatCard
                title="GPS Status"
                value={
                  currentLocation
                    ? "ACTIVE"
                    : "READY"
                }
                subtitle={
                  currentLocation
                    ? "Location available"
                    : "Start a ride to track"
                }
                icon={
                  <Activity className="w-6 h-6" />
                }
              />

              <StatCard
                title="System Status"
                value="ONLINE"
                subtitle="Frontend + API"
                icon={
                  <Shield className="w-6 h-6" />
                }
              />
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold">
                  System Modules
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Select a module to work with
                  the road-safety system.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ModuleCard
                  icon={<Radio />}
                  title="Safety Monitor"
                  description="Track the driver's current GPS location and monitor nearby risk zones."
                  onClick={() =>
                    setActivePage("monitor")
                  }
                />

                <ModuleCard
                  icon={<MapIcon />}
                  title="Accident Map"
                  description="Display accident-prone locations on an interactive map."
                  onClick={() =>
                    setActivePage("map")
                  }
                />

                <ModuleCard
                  icon={<BarChart3 />}
                  title="Data Analysis"
                  description="View graphs, charts, state-wise statistics and accident analysis."
                  onClick={() =>
                    setActivePage("analysis")
                  }
                />

                <ModuleCard
                  icon={<Upload />}
                  title="Upload Dataset"
                  description="Inspect and validate CSV accident datasets."
                  onClick={() =>
                    setActivePage("upload")
                  }
                />

                <ModuleCard
                  icon={<Database />}
                  title="Data Sources"
                  description="View the source and provenance of the stored accident data."
                  onClick={() =>
                    setActivePage("sources")
                  }
                />

                <ModuleCard
                  icon={<Info />}
                  title="About Project"
                  description="View the project objective, workflow, architecture and technology."
                  onClick={() =>
                    setActivePage("about")
                  }
                />
              </div>
            </section>
          </div>
        );

      case "monitor":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Radio />}
              title="Safety Monitor"
              description="Track the driver's live location and monitor nearby accident-prone zones."
            />

            <LocationTracker
              onLocationChange={
                setCurrentLocation
              }
            />

            {monitorLoading && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />

                <span className="text-sm text-slate-600">
                  Loading demo safety zones...
                </span>
              </div>
            )}

            <section
              className={`rounded-2xl border-2 p-6 ${monitorStatus === "WARNING"
                  ? "bg-red-50 border-red-300"
                  : monitorStatus ===
                    "CAUTION"
                    ? "bg-amber-50 border-amber-300"
                    : "bg-green-50 border-green-300"
                }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${monitorStatus ===
                        "WARNING"
                        ? "bg-red-500 text-white"
                        : monitorStatus ===
                          "CAUTION"
                          ? "bg-amber-500 text-white"
                          : "bg-green-500 text-white"
                      }`}
                  >
                    {monitorStatus ===
                      "WARNING" ? (
                      <AlertTriangle className="w-8 h-8" />
                    ) : (
                      <Shield className="w-8 h-8" />
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">
                      Current Safety Status
                    </p>

                    <h2
                      className={`text-3xl font-extrabold ${monitorStatus ===
                          "WARNING"
                          ? "text-red-700"
                          : monitorStatus ===
                            "CAUTION"
                            ? "text-amber-700"
                            : "text-green-700"
                        }`}
                    >
                      {monitorStatus}
                    </h2>

                    <p className="text-sm text-slate-600 mt-1">
                      {monitorStatusText}
                    </p>
                  </div>
                </div>

                <div className="text-left lg:text-right">
                  <p className="text-xs uppercase font-bold text-slate-500">
                    Nearest Zone
                  </p>

                  <p className="text-lg font-bold mt-1">
                    {nearestMonitorZone
                      ? textValue(
                        nearestMonitorZone.zone
                          .name,
                        "Unnamed Zone"
                      )
                      : "No zone detected"}
                  </p>

                  {nearestMonitorZone && (
                    <p className="text-sm text-slate-500">
                      {Math.round(
                        nearestMonitorZone.distanceMeters
                      )}{" "}
                      m away
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MonitorInfoCard
                title="GPS Status"
                value={
                  currentLocation
                    ? "ACTIVE"
                    : "WAITING"
                }
                subtitle={
                  currentLocation
                    ? "Location received"
                    : "Start a ride"
                }
                icon={
                  <LocateFixed className="w-5 h-5" />
                }
              />

              <MonitorInfoCard
                title="Distance"
                value={
                  monitorDistance !==
                    null
                    ? `${Math.round(
                      monitorDistance
                    )} m`
                    : "—"
                }
                subtitle="To nearest demo zone"
                icon={
                  <Navigation className="w-5 h-5" />
                }
              />

              <MonitorInfoCard
                title="Zone"
                value={
                  nearestMonitorZone
                    ? textValue(
                      nearestMonitorZone.zone
                        .name,
                      "Unknown"
                    )
                    : "—"
                }
                subtitle={
                  nearestMonitorZone
                    ? textValue(
                      nearestMonitorZone.zone
                        .district
                    )
                    : "No nearby zone"
                }
                icon={
                  <MapPin className="w-5 h-5" />
                }
              />

              <MonitorInfoCard
                title="GPS Type"
                value="DEMO"
                subtitle="Simulated ride data"
                icon={
                  <Activity className="w-5 h-5" />
                }
              />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <LocateFixed className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="font-bold text-lg">
                      Current Location
                    </h3>

                    <p className="text-sm text-slate-500">
                      Driver GPS information
                    </p>
                  </div>
                </div>

                {currentLocation ? (
                  <div className="space-y-3">
                    <LocationRow
                      label="Latitude"
                      value={Number(
                        currentLocation.latitude
                      ).toFixed(6)}
                    />

                    <LocationRow
                      label="Longitude"
                      value={Number(
                        currentLocation.longitude
                      ).toFixed(6)}
                    />

                    <LocationRow
                      label="Accuracy"
                      value={`${Math.round(
                        Number(
                          currentLocation.accuracy ??
                          0
                        )
                      )} m`}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <LocateFixed className="w-10 h-10 mx-auto mb-3" />

                    <p className="font-semibold">
                      GPS not started
                    </p>

                    <p className="text-sm mt-1">
                      Start the ride above to
                      receive location data.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="font-bold text-lg">
                      Nearest Risk Zone
                    </h3>

                    <p className="text-sm text-slate-500">
                      Real-time proximity calculation
                    </p>
                  </div>
                </div>

                {nearestMonitorZone ? (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">
                        Zone
                      </p>

                      <p className="font-bold text-lg mt-1">
                        {textValue(
                          nearestMonitorZone.zone
                            .name,
                          "Unnamed Zone"
                        )}
                      </p>

                      <p className="text-sm text-slate-500 mt-1">
                        {textValue(
                          nearestMonitorZone.zone
                            .state
                        )}{" "}
                        ·{" "}
                        {textValue(
                          nearestMonitorZone.zone
                            .district
                        )}
                      </p>
                    </div>

                    <LocationRow
                      label="Distance"
                      value={`${Math.round(
                        nearestMonitorZone.distanceMeters
                      )} m`}
                    />

                    <LocationRow
                      label="Severity"
                      value={
                        nearestMonitorZone.zone
                          .severity !== null
                          ? String(
                            nearestMonitorZone.zone
                              .severity
                          )
                          : "Unknown"
                      }
                    />

                    <LocationRow
                      label="Zone Type"
                      value={
                        nearestMonitorZone.zone
                          .is_demo
                          ? "DEMO ONLY"
                          : "OFFICIAL"
                      }
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <MapPin className="w-10 h-10 mx-auto mb-3" />

                    <p className="font-semibold">
                      No nearby zone
                    </p>

                    <p className="text-sm mt-1">
                      Start the demo ride to
                      calculate proximity.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <Activity className="w-5 h-5 text-indigo-600 shrink-0" />

                <div>
                  <p className="font-bold text-indigo-900">
                    Demo monitoring mode
                  </p>

                  <p className="text-sm text-indigo-800 mt-1">
                    The current live warning demonstration
                    uses simulated GPS coordinates and
                    clearly labelled demo zones. The
                    2024 official dataset currently has
                    no verified coordinates, so it is not
                    used for GPS proximity alerts.
                  </p>
                </div>
              </div>
            </div>

            <ZoneList
              currentLocation={currentLocation}
            />
          </div>
        );

      case "map":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<MapIcon />}
              title="Accident Map"
              description="View accident-prone locations together with the driver's current GPS position."
            />

            <AccidentMap
              currentLocation={currentLocation}
            />
          </div>
        );

      case "analysis":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<BarChart3 />}
              title="Data Analysis"
              description="Visual analysis of the stored 2024 accident-zone dataset."
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Dataset Analytics
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {analysisZones.length} records
                  loaded from the backend.
                </p>
              </div>

              <button
                onClick={() => {
                  loadZoneStats();
                  loadAnalysisData();
                }}
                disabled={analysisLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                <RefreshCw
                  className={
                    analysisLoading
                      ? "w-4 h-4 animate-spin"
                      : "w-4 h-4"
                  }
                />

                Refresh Analysis
              </button>
            </div>

            {analysisError && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
                {analysisError}
              </div>
            )}

            {analysisLoading &&
              analysisZones.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />

                <p className="mt-4 font-semibold">
                  Loading analysis data...
                </p>
              </div>
            ) : (
              <>
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <AnalysisStat
                    title="Total Zones"
                    value={formatNumber(
                      zoneStats?.total_zones ??
                      analysisZones.length
                    )}
                    icon={
                      <MapPin className="w-5 h-5" />
                    }
                  />

                  <AnalysisStat
                    title="Accidents"
                    value={formatNumber(
                      zoneStats?.total_accidents ??
                      0
                    )}
                    icon={
                      <TrendingUp className="w-5 h-5" />
                    }
                  />

                  <AnalysisStat
                    title="Fatalities"
                    value={formatNumber(
                      zoneStats?.total_fatalities ??
                      0
                    )}
                    icon={
                      <AlertTriangle className="w-5 h-5" />
                    }
                  />

                  <AnalysisStat
                    title="States"
                    value={formatNumber(
                      zoneStats?.states_count ??
                      stateAnalysis.length
                    )}
                    icon={
                      <Database className="w-5 h-5" />
                    }
                  />

                  <AnalysisStat
                    title="High Risk"
                    value={formatNumber(
                      zoneStats?.high_risk_zones ??
                      severityAnalysis.high
                    )}
                    icon={
                      <AlertTriangle className="w-5 h-5" />
                    }
                  />
                </section>

                <ChartCard
                  title="State-wise Zone Distribution"
                  description="Number of accident-zone records represented by each state."
                  icon={
                    <BarChart3 className="w-5 h-5" />
                  }
                >
                  {stateAnalysis.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <div className="space-y-4">
                      {stateAnalysis.map(
                        (item) => (
                          <div key={item.state}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-medium">
                                {item.state}
                              </span>

                              <span className="text-slate-500">
                                {item.zones} zones
                              </span>
                            </div>

                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full"
                                style={{
                                  width: `${(item.zones /
                                      maxZones) *
                                    100
                                    }%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </ChartCard>

                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ChartCard
                    title="Top States by Accident Count"
                    description="States with the highest recorded accident totals."
                    icon={
                      <TrendingUp className="w-5 h-5" />
                    }
                  >
                    <div className="space-y-4">
                      {topAccidentStates.map(
                        (item) => (
                          <div key={item.state}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-medium">
                                {item.state}
                              </span>

                              <span className="text-slate-500">
                                {formatNumber(
                                  item.accidents
                                )}
                              </span>
                            </div>

                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: `${(item.accidents /
                                      maxAccidents) *
                                    100
                                    }%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ChartCard>

                  <ChartCard
                    title="Top States by Fatalities"
                    description="States with the highest recorded fatality totals."
                    icon={
                      <AlertTriangle className="w-5 h-5" />
                    }
                  >
                    <div className="space-y-4">
                      {topFatalityStates.map(
                        (item) => (
                          <div key={item.state}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-medium">
                                {item.state}
                              </span>

                              <span className="text-slate-500">
                                {formatNumber(
                                  item.fatalities
                                )}
                              </span>
                            </div>

                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full"
                                style={{
                                  width: `${(item.fatalities /
                                      maxFatalities) *
                                    100
                                    }%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ChartCard>
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ChartCard
                    title="Severity Distribution"
                    description="Project-defined severity bands based on stored severity values."
                    icon={
                      <PieChart className="w-5 h-5" />
                    }
                  >
                    <SeverityDonut
                      high={severityAnalysis.high}
                      medium={
                        severityAnalysis.medium
                      }
                      low={severityAnalysis.low}
                      unknown={
                        severityAnalysis.unknown
                      }
                    />

                    <p className="text-xs text-slate-400 mt-5">
                      High ≥ 50 · Medium 25–49.99 ·
                      Low &lt; 25. These are
                      project-defined analysis bands,
                      not official MoRTH risk
                      classifications.
                    </p>
                  </ChartCard>

                  <ChartCard
                    title="Coordinate Availability"
                    description="Availability of latitude and longitude values."
                    icon={
                      <MapPin className="w-5 h-5" />
                    }
                  >
                    <CoordinateChart
                      withCoordinates={
                        coordinateAnalysis.withCoordinates
                      }
                      withoutCoordinates={
                        coordinateAnalysis.withoutCoordinates
                      }
                    />

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <MiniValue
                        label="Coordinates available"
                        value={formatNumber(
                          coordinateAnalysis.withCoordinates
                        )}
                      />

                      <MiniValue
                        label="Coordinates missing"
                        value={formatNumber(
                          coordinateAnalysis.withoutCoordinates
                        )}
                      />
                    </div>
                  </ChartCard>
                </section>

                <ChartCard
                  title="Top 10 Accident Zones"
                  description="Zones ordered by recorded accident count."
                  icon={
                    <TableProperties className="w-5 h-5" />
                  }
                >
                  <div className="space-y-4">
                    {topZones.map(
                      (zone, index) => {
                        const accidents = num(
                          zone.accident_count
                        );

                        return (
                          <div
                            key={`${zone.id ?? "zone"}-${index}`}
                          >
                            <div className="flex gap-3 items-center">
                              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <p className="font-semibold truncate">
                                    {textValue(
                                      zone.name,
                                      "Unnamed Zone"
                                    )}
                                  </p>

                                  <span className="text-sm text-slate-500">
                                    {formatNumber(
                                      accidents
                                    )}{" "}
                                    accidents
                                  </span>
                                </div>

                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                                  <div
                                    className="h-full bg-indigo-600 rounded-full"
                                    style={{
                                      width: `${(accidents /
                                          maxZoneAccidents) *
                                        100
                                        }%`,
                                    }}
                                  />
                                </div>

                                <p className="text-xs text-slate-400 mt-1">
                                  {textValue(
                                    zone.state
                                  )}{" "}
                                  ·{" "}
                                  {textValue(
                                    zone.district
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="State-wise Analysis Table"
                  description="Zones, accidents, fatalities and average severity by state."
                  icon={
                    <TableProperties className="w-5 h-5" />
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-3 pr-4">
                            State
                          </th>

                          <th className="py-3 px-4">
                            Zones
                          </th>

                          <th className="py-3 px-4">
                            Accidents
                          </th>

                          <th className="py-3 px-4">
                            Fatalities
                          </th>

                          <th className="py-3 pl-4">
                            Avg. Severity
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {stateAnalysis.map(
                          (item) => (
                            <tr
                              key={item.state}
                              className="border-b border-slate-100"
                            >
                              <td className="py-3 pr-4 font-semibold">
                                {item.state}
                              </td>

                              <td className="py-3 px-4">
                                {formatNumber(
                                  item.zones
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {formatNumber(
                                  item.accidents
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {formatNumber(
                                  item.fatalities
                                )}
                              </td>

                              <td className="py-3 pl-4">
                                {item.averageSeverity.toFixed(
                                  1
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </>
            )}
          </div>
        );

      case "upload":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Upload />}
              title="Upload Dataset"
              description="Inspect and validate a CSV dataset before importing it into the Data Module."
            />

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-bold text-lg">
                    Select CSV Dataset
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Preview and validate a CSV locally.
                    This does not overwrite your backend
                    dataset.
                  </p>
                </div>
              </div>

              <label className="mt-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 cursor-pointer hover:border-indigo-400 transition">
                <Upload className="w-10 h-10 text-indigo-600" />

                <span className="mt-3 font-semibold">
                  Choose CSV file
                </span>

                <span className="text-sm text-slate-500 mt-1">
                  CSV files only
                </span>

                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];

                    setUploadError("");
                    setUploadRows([]);
                    setUploadFileName("");

                    if (!file) return;

                    if (
                      !file.name
                        .toLowerCase()
                        .endsWith(".csv")
                    ) {
                      setUploadError(
                        "Please select a CSV file."
                      );
                      return;
                    }

                    setUploadFileName(
                      file.name
                    );

                    const reader =
                      new FileReader();

                    reader.onload = () => {
                      const text = String(
                        reader.result ?? ""
                      );

                      const rows =
                        parseCSV(text);

                      if (rows.length === 0) {
                        setUploadError(
                          "The selected CSV is empty."
                        );
                        return;
                      }

                      setUploadRows(rows);
                    };

                    reader.onerror = () => {
                      setUploadError(
                        "Could not read the selected file."
                      );
                    };

                    reader.readAsText(file);
                  }}
                />
              </label>

              {uploadFileName && (
                <div className="mt-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />

                  <div>
                    <p className="font-semibold text-green-800">
                      {uploadFileName}
                    </p>

                    <p className="text-xs text-green-700">
                      {Math.max(
                        0,
                        uploadRows.length - 1
                      )}{" "}
                      data rows detected
                    </p>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mt-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                  <XCircle className="w-5 h-5" />

                  <span className="text-sm font-medium">
                    {uploadError}
                  </span>
                </div>
              )}
            </div>

            {uploadRows.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-5">
                  <h3 className="font-bold text-lg">
                    CSV Preview
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Showing the first 10 rows.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        {uploadRows[0].map(
                          (header, index) => (
                            <th
                              key={index}
                              className="text-left p-3 whitespace-nowrap"
                            >
                              {header}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {uploadRows
                        .slice(1, 11)
                        .map(
                          (
                            row,
                            rowIndex
                          ) => (
                            <tr
                              key={rowIndex}
                              className="border-b border-slate-100"
                            >
                              {uploadRows[0].map(
                                (
                                  _,
                                  columnIndex
                                ) => (
                                  <td
                                    key={
                                      columnIndex
                                    }
                                    className="p-3 whitespace-nowrap"
                                  >
                                    {row[
                                      columnIndex
                                    ] ?? ""}
                                  </td>
                                )
                              )}
                            </tr>
                          )
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case "sources":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Database />}
              title="Data Sources"
              description="Source and provenance information for the accident-zone dataset."
            />

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoCard
                title="Primary Source"
                icon={
                  <Database className="w-5 h-5" />
                }
              >
                <p className="text-sm text-slate-600">
                  Ministry of Road Transport and
                  Highways (MoRTH), Government of India.
                </p>
              </InfoCard>

              <InfoCard
                title="Dataset"
                icon={
                  <FileSpreadsheet className="w-5 h-5" />
                }
              >
                <p className="text-sm text-slate-600">
                  Road accident / accident-zone data
                  based on the stored 2024 dataset.
                </p>
              </InfoCard>

              <InfoCard
                title="Records Loaded"
                icon={
                  <TableProperties className="w-5 h-5" />
                }
              >
                <p className="text-3xl font-extrabold">
                  {zoneStats
                    ? formatNumber(
                      zoneStats.total_zones
                    )
                    : "—"}
                </p>
              </InfoCard>

              <InfoCard
                title="Coordinates"
                icon={
                  <MapPin className="w-5 h-5" />
                }
              >
                <p className="text-3xl font-extrabold">
                  {zoneStats
                    ? formatNumber(
                      zoneStats.zones_with_coordinates
                    )
                    : "—"}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  records with coordinates
                </p>
              </InfoCard>
            </section>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold">
                Data Pipeline
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
                <PipelineStep
                  number="01"
                  title="Official Data"
                  text="Accident information is collected from the source dataset."
                />

                <PipelineStep
                  number="02"
                  title="Pandas"
                  text="Python processes and structures the dataset."
                />

                <PipelineStep
                  number="03"
                  title="FastAPI"
                  text="The backend exposes the processed records."
                />

                <PipelineStep
                  number="04"
                  title="React"
                  text="The frontend displays analysis, maps and safety information."
                />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />

                <div>
                  <p className="font-bold text-amber-900">
                    Coordinate limitation
                  </p>

                  <p className="text-sm text-amber-800 mt-1">
                    The current stored 2024 dataset
                    contains accident statistics, but
                    currently has no latitude/longitude
                    values. GPS proximity alerts therefore
                    need verified coordinates before they
                    can use these records.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-lg">
                Official Source
              </h3>

              <a
                href="https://morth.nic.in/road-accident-in-india"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-indigo-600"
              >
                Open MoRTH Road Accident Information
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        );

      case "about":
        return (
          <div className="space-y-6">
            <PageHeader
              icon={<Info />}
              title="About Project"
              description="Accident Zone Reminder is a road-safety system designed to warn drivers when approaching identified accident-prone locations."
            />

            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-xl font-bold">
                Problem We Are Addressing
              </h3>

              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                Accident-prone locations such as sharp
                curves, blind spots, dangerous junctions
                and poorly visible road sections can
                repeatedly experience accidents. This system
                combines accident-zone data with driver
                location to provide an early warning.
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoCard
                title="Project Objective"
                icon={
                  <Navigation className="w-5 h-5" />
                }
              >
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Store accident-prone locations.</li>
                  <li>• Track driver GPS position.</li>
                  <li>• Calculate distance to risk zones.</li>
                  <li>• Provide safety warnings.</li>
                  <li>• Analyse accident data.</li>
                </ul>
              </InfoCard>

              <InfoCard
                title="Technology Stack"
                icon={
                  <Activity className="w-5 h-5" />
                }
              >
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• React + TypeScript</li>
                  <li>• Vite + Tailwind CSS</li>
                  <li>• Python + FastAPI</li>
                  <li>• Pandas + NumPy</li>
                  <li>• Leaflet / OpenStreetMap</li>
                  <li>• PostgreSQL / Supabase planned</li>
                </ul>
              </InfoCard>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-xl font-bold">
                System Workflow
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <PipelineStep
                  number="01"
                  title="Data Module"
                  text="Load and process accident-zone data."
                />

                <PipelineStep
                  number="02"
                  title="Location Module"
                  text="Capture the driver's current GPS position."
                />

                <PipelineStep
                  number="03"
                  title="Computation Module"
                  text="Calculate distance between driver and risk zones."
                />

                <PipelineStep
                  number="04"
                  title="Alert Module"
                  text="Display a warning when a risk zone is nearby."
                />
              </div>
            </section>

            <section className="bg-slate-950 text-white rounded-2xl p-6">
              <h3 className="text-xl font-bold">
                Future Scope
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm text-slate-300">
                <p>• Android background tracking</p>
                <p>• Real-time accident alerts</p>
                <p>• Crowd-sourced reports</p>
                <p>• Machine-learning risk ranking</p>
                <p>• Improved official GPS datasets</p>
                <p>• Voice/audio warnings</p>
              </div>
            </section>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Shield className="w-6 h-6" />
              </div>

              <div>
                <h1 className="font-extrabold">
                  Road Safety
                </h1>

                <p className="text-xs text-slate-500">
                  Accident Risk-Zone Reminder System
                </p>
              </div>
            </div>

            <span className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex">
        <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-64px)]">
          <nav className="p-4 space-y-1">
            <p className="px-3 pt-2 pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Main Menu
            </p>

            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                activePage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    setActivePage(item.id)
                  }
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${active
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 overflow-x-auto">
          <div className="flex min-w-max p-2 gap-1">
            {navigation
              .slice(0, 5)
              .map((item) => {
                const Icon = item.icon;
                const active =
                  activePage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      setActivePage(item.id)
                    }
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs ${active
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500"
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
};

/*
 * COMPONENTS
 */

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <p className="text-2xl font-extrabold mt-2">
          {value}
        </p>

        <p className="text-xs text-slate-400 mt-1">
          {subtitle}
        </p>
      </div>

      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>
    </div>
  </div>
);

interface MonitorInfoCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}

const MonitorInfoCard: React.FC<
  MonitorInfoCardProps
> = ({
  title,
  value,
  subtitle,
  icon,
}) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">
            {title}
          </p>

          <p className="text-xl font-extrabold mt-2 truncate">
            {value}
          </p>

          <p className="text-xs text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );

interface LocationRowProps {
  label: string;
  value: string;
}

const LocationRow: React.FC<LocationRowProps> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500">
      {label}
    </span>

    <span className="text-sm font-bold text-slate-800 text-right">
      {value}
    </span>
  </div>
);

interface AnalysisStatProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const AnalysisStat: React.FC<
  AnalysisStatProps
> = ({ title, value, icon }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">
          {title}
        </p>

        <p className="text-2xl font-extrabold mt-2">
          {value}
        </p>
      </div>

      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>
    </div>
  </div>
);

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const ModuleCard: React.FC<
  ModuleCardProps
> = ({
  icon,
  title,
  description,
  onClick,
}) => (
    <button
      onClick={onClick}
      className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition group"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
        {icon}
      </div>

      <h3 className="font-bold text-lg">
        {title}
      </h3>

      <p className="text-sm text-slate-500 mt-2">
        {description}
      </p>

      <p className="text-sm font-semibold text-indigo-600 mt-4">
        Open module →
      </p>
    </button>
  );

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const PageHeader: React.FC<
  PageHeaderProps
> = ({
  icon,
  title,
  description,
}) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          {icon}
        </div>

        <div>
          <h2 className="text-2xl font-extrabold">
            {title}
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            {description}
          </p>
        </div>
      </div>
    </div>
  );

interface ChartCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ChartCard: React.FC<
  ChartCardProps
> = ({
  title,
  description,
  icon,
  children,
}) => (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div>
          <h3 className="font-bold text-lg">
            {title}
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );

const EmptyChart: React.FC = () => (
  <div className="py-10 text-center text-slate-400">
    No analysis records available.
  </div>
);

interface InfoCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  icon,
  children,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>

      <h3 className="font-bold text-lg">
        {title}
      </h3>
    </div>

    {children}
  </div>
);

interface PipelineStepProps {
  number: string;
  title: string;
  text: string;
}

const PipelineStep: React.FC<
  PipelineStepProps
> = ({
  number,
  title,
  text,
}) => (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-xs font-bold text-indigo-600">
        {number}
      </div>

      <h4 className="font-bold mt-2">
        {title}
      </h4>

      <p className="text-sm text-slate-500 mt-1">
        {text}
      </p>
    </div>
  );

interface MiniValueProps {
  label: string;
  value: string;
}

const MiniValue: React.FC<
  MiniValueProps
> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-xl p-4">
    <p className="text-xs text-slate-500">
      {label}
    </p>

    <p className="text-xl font-extrabold mt-1">
      {value}
    </p>
  </div>
);

interface SeverityDonutProps {
  high: number;
  medium: number;
  low: number;
  unknown: number;
}

const SeverityDonut: React.FC<
  SeverityDonutProps
> = ({
  high,
  medium,
  low,
  unknown,
}) => {
    const total =
      high +
      medium +
      low +
      unknown;

    const highPercent =
      total > 0
        ? (high / total) * 100
        : 0;

    const mediumPercent =
      total > 0
        ? (medium / total) * 100
        : 0;

    const lowPercent =
      total > 0
        ? (low / total) * 100
        : 0;

    const mediumEnd =
      highPercent + mediumPercent;

    const lowEnd =
      mediumEnd + lowPercent;

    const background =
      total === 0
        ? "#e2e8f0"
        : `conic-gradient(
          #ef4444 0% ${highPercent}%,
          #f59e0b ${highPercent}% ${mediumEnd}%,
          #22c55e ${mediumEnd}% ${lowEnd}%,
          #94a3b8 ${lowEnd}% 100%
        )`;

    return (
      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div
          className="w-44 h-44 rounded-full relative shrink-0"
          style={{ background }}
        >
          <div className="absolute inset-6 rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold">
              {formatNumber(total)}
            </span>

            <span className="text-xs text-slate-500">
              zones
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <LegendRow
            label="High"
            value={high}
            dot="bg-red-500"
          />

          <LegendRow
            label="Medium"
            value={medium}
            dot="bg-amber-500"
          />

          <LegendRow
            label="Low"
            value={low}
            dot="bg-green-500"
          />

          <LegendRow
            label="Unknown"
            value={unknown}
            dot="bg-slate-400"
          />
        </div>
      </div>
    );
  };

interface LegendRowProps {
  label: string;
  value: number;
  dot: string;
}

const LegendRow: React.FC<
  LegendRowProps
> = ({
  label,
  value,
  dot,
}) => (
    <div className="flex items-center gap-3 min-w-44">
      <span
        className={`w-3 h-3 rounded-full ${dot}`}
      />

      <span className="text-sm text-slate-600 flex-1">
        {label}
      </span>

      <span className="font-bold">
        {formatNumber(value)}
      </span>
    </div>
  );

interface CoordinateChartProps {
  withCoordinates: number;
  withoutCoordinates: number;
}

const CoordinateChart: React.FC<
  CoordinateChartProps
> = ({
  withCoordinates,
  withoutCoordinates,
}) => {
    const total =
      withCoordinates +
      withoutCoordinates;

    const availablePercent =
      total > 0
        ? (withCoordinates / total) * 100
        : 0;

    return (
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold">
            Coordinate coverage
          </span>

          <span className="text-slate-500">
            {availablePercent.toFixed(1)}%
          </span>
        </div>

        <div className="h-6 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            className="h-full bg-indigo-600"
            style={{
              width: `${availablePercent}%`,
            }}
          />

          <div
            className="h-full bg-slate-300"
            style={{
              width: `${100 - availablePercent}%`,
            }}
          />
        </div>

        <div className="flex items-center gap-5 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-600" />
            Available
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-300" />
            Missing
          </div>
        </div>
      </div>
    );
  };

export default App;
