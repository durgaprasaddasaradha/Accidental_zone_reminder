import { useEffect, useRef, useState } from "react";

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
}

interface LocationTrackerProps {
    onLocationChange?: (location: LocationData | null) => void;
}

export default function LocationTracker({
    onLocationChange,
}: LocationTrackerProps) {
    const [location, setLocation] = useState<LocationData | null>(null);
    const [tracking, setTracking] = useState(false);
    const [demoMode, setDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const watchId = useRef<number | null>(null);
    const demoTimer = useRef<number | null>(null);

    const updateLocation = (newLocation: LocationData) => {
        setLocation(newLocation);
        onLocationChange?.(newLocation);
    };

    const startTracking = () => {
        setError(null);
        setDemoMode(false);

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by this browser.");
            return;
        }

        const id = navigator.geolocation.watchPosition(
            (position) => {
                updateLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });

                setError(null);
            },
            (err) => {
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError("Location permission was denied.");
                        break;

                    case err.POSITION_UNAVAILABLE:
                        setError("Location information is unavailable.");
                        break;

                    case err.TIMEOUT:
                        setError("Location request timed out.");
                        break;

                    default:
                        setError("Unable to get your location.");
                }

                setTracking(false);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000,
            }
        );

        watchId.current = id;
        setTracking(true);
    };

    const startDemoRide = () => {
        setError(null);

        stopTracking();

        setDemoMode(true);
        setTracking(true);

        /*
         * DEMO ROUTE
         * Starts approximately 1.5 km from Rajiv Chowk Demo Zone
         * and moves toward it automatically.
         *
         * These coordinates are DEMO ONLY.
         */

        const startLatitude = 28.4730;
        const targetLatitude = 28.4595;
        const longitude = 77.0266;

        let step = 0;
        const totalSteps = 30;

        const runDemoStep = () => {
            const progress = Math.min(step / totalSteps, 1);

            const latitude =
                startLatitude +
                (targetLatitude - startLatitude) * progress;

            updateLocation({
                latitude,
                longitude,
                accuracy: 10,
            });

            step++;

            if (step > totalSteps) {
                if (demoTimer.current !== null) {
                    window.clearInterval(demoTimer.current);
                    demoTimer.current = null;
                }

                return;
            }
        };

        runDemoStep();

        demoTimer.current = window.setInterval(
            runDemoStep,
            1000
        );
    };

    const stopTracking = () => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }

        if (demoTimer.current !== null) {
            window.clearInterval(demoTimer.current);
            demoTimer.current = null;
        }

        setTracking(false);
        setDemoMode(false);
    };

    useEffect(() => {
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }

            if (demoTimer.current !== null) {
                window.clearInterval(demoTimer.current);
            }
        };
    }, []);

    return (
        <div className="rounded-xl border p-6 space-y-4">
            <div>
                <h2 className="text-xl font-semibold">
                    Driver Location
                </h2>

                <p className="text-sm text-gray-500">
                    GPS tracking for the current ride
                </p>
            </div>

            <div className="flex flex-wrap gap-3">
                {!tracking ? (
                    <>
                        <button
                            onClick={startTracking}
                            className="rounded-lg px-5 py-2 bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Start Ride
                        </button>

                        <button
                            onClick={startDemoRide}
                            className="rounded-lg px-5 py-2 bg-purple-600 text-white hover:bg-purple-700"
                        >
                            Start Demo Ride
                        </button>
                    </>
                ) : (
                    <button
                        onClick={stopTracking}
                        className="rounded-lg px-5 py-2 bg-red-600 text-white hover:bg-red-700"
                    >
                        Stop Ride
                    </button>
                )}
            </div>

            {demoMode && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                    <p className="font-semibold text-purple-700">
                        ● DEMO RIDE ACTIVE
                    </p>

                    <p className="text-sm text-purple-600 mt-1">
                        Simulated vehicle approaching Rajiv Chowk Demo Zone.
                    </p>
                </div>
            )}

            {tracking && !demoMode && (
                <div className="rounded-lg bg-green-50 p-4">
                    <p className="font-medium text-green-700">
                        ● GPS Tracking Active
                    </p>
                </div>
            )}

            {location && (
                <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                    <p>
                        <strong>Latitude:</strong>{" "}
                        {location.latitude.toFixed(6)}
                    </p>

                    <p>
                        <strong>Longitude:</strong>{" "}
                        {location.longitude.toFixed(6)}
                    </p>

                    <p>
                        <strong>Accuracy:</strong>{" "}
                        {Math.round(location.accuracy)} meters
                    </p>
                </div>
            )}

            {error && (
                <div className="rounded-lg bg-red-50 p-4 text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
}