import { SafetyResult } from "../computation/distance";

interface SafetyAlertProps {
    level: SafetyResult;
    distanceMeters: number;
    severity?: string;
}

export default function SafetyAlert({
    level,
    distanceMeters,
    severity,
}: SafetyAlertProps) {
    const distanceText =
        distanceMeters >= 1000
            ? `${(distanceMeters / 1000).toFixed(2)} km`
            : `${Math.round(distanceMeters)} m`;

    if (level.level === "WARNING") {
        return (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="text-3xl">🔴</div>

                    <div>
                        <h3 className="text-lg font-extrabold text-red-800">
                            WARNING — Accident Zone Nearby
                        </h3>

                        <p className="mt-1 text-sm font-medium text-red-700">
                            You are approximately{" "}
                            <strong>{distanceText}</strong> from an identified
                            accident-prone zone.
                        </p>

                        {severity && (
                            <p className="mt-2 text-xs text-red-600">
                                Zone severity: <strong>{severity}</strong>
                            </p>
                        )}

                        <p className="mt-2 text-xs text-red-600">
                            Please reduce speed and drive carefully.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (level.level === "CAUTION") {
        return (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="text-3xl">🟡</div>

                    <div>
                        <h3 className="text-lg font-extrabold text-amber-800">
                            CAUTION — Accident Zone Approaching
                        </h3>

                        <p className="mt-1 text-sm font-medium text-amber-700">
                            An identified accident-prone zone is{" "}
                            <strong>{distanceText}</strong> away.
                        </p>

                        {severity && (
                            <p className="mt-2 text-xs text-amber-600">
                                Zone severity: <strong>{severity}</strong>
                            </p>
                        )}

                        <p className="mt-2 text-xs text-amber-600">
                            Stay alert and prepare to reduce speed.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-5 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="text-3xl">🟢</div>

                <div>
                    <h3 className="text-lg font-extrabold text-green-800">
                        SAFE — No Immediate Warning
                    </h3>

                    <p className="mt-1 text-sm font-medium text-green-700">
                        No accident-zone warning is currently required.
                    </p>

                    <p className="mt-2 text-xs text-green-600">
                        Nearest identified zone: <strong>{distanceText}</strong> away.
                    </p>
                </div>
            </div>
        </div>
    );
}