import React, { useEffect, useState } from "react";

export interface PredictiveAlert {
  vehicle_id: number;
  license_plate: string;
  make: string;
  model: string;
  health_score: number;
  urgency_status: "CRITICAL" | "WARNING" | "GOOD";
  is_service_overdue: boolean;
  odometer_km: number;
  next_service_due_odometer: number;
  km_remaining: number;
  avg_daily_km_30d: number;
  estimated_days_remaining: number | null;
  failed_inspections_count: number;
  recommendations: string[];
}

interface Props {
  token: string;
}

export const PredictiveMaintenanceCard: React.FC<Props> = ({ token }) => {
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/vehicles/predictive-alerts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch predictive alerts (${res.status})`);
      }
      const data = await res.json();
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load predictive maintenance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAlerts();
    }
  }, [token]);

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
            🚨 CRITICAL
          </span>
        );
      case "WARNING":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ⚠️ WARNING
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ✅ GOOD
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500";
    if (score >= 50) return "text-amber-400 border-amber-500";
    return "text-red-400 border-red-500";
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-800/60 rounded-xl border border-slate-700">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
        <p>Analyzing vehicle telematics & service history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm flex justify-between items-center">
        <span>{error}</span>
        <button
          onClick={fetchAlerts}
          className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-xs rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-xl border border-slate-700 shadow-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🧠 Predictive Maintenance Diagnostic Alerts
          </h3>
          <p className="text-xs text-slate-400">
            Real-time vehicle health scoring & proactive breakdown prevention
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5"
        >
          🔄 Refresh Telematics
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((item) => (
          <div
            key={item.vehicle_id}
            className={`p-4 rounded-xl border transition duration-200 shadow-lg flex flex-col justify-between ${
              item.urgency_status === "CRITICAL"
                ? "bg-gradient-to-b from-slate-900 to-red-950/40 border-red-500/40"
                : item.urgency_status === "WARNING"
                ? "bg-gradient-to-b from-slate-900 to-amber-950/30 border-amber-500/30"
                : "bg-slate-800/60 border-slate-700"
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-white text-base">
                    {item.make} {item.model}
                  </h4>
                  <span className="inline-block mt-0.5 text-xs font-mono font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                    {item.license_plate}
                  </span>
                </div>
                {getUrgencyBadge(item.urgency_status)}
              </div>

              {/* Health Score Meter */}
              <div className="flex items-center gap-3 my-3 p-2.5 bg-slate-950/40 rounded-lg border border-slate-800">
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm shadow-inner ${getScoreColor(
                    item.health_score
                  )}`}
                >
                  {item.health_score}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">Health Index</span>
                    <span className="font-bold">{item.health_score} / 100</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        item.health_score >= 80
                          ? "bg-emerald-500"
                          : item.health_score >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(100, item.health_score)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Diagnostics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">
                    Distance to Service
                  </span>
                  <span className="font-bold text-slate-200">
                    {item.km_remaining} km
                  </span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">
                    Est. Days Remaining
                  </span>
                  <span className="font-bold text-slate-200">
                    {item.estimated_days_remaining !== null
                      ? `${item.estimated_days_remaining} days`
                      : "N/A (Idle)"}
                  </span>
                </div>
              </div>

              {/* Recommendations List */}
              <div className="mt-2 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Diagnostic Recommendations:
                </span>
                {item.recommendations.map((rec, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-slate-300 flex items-start gap-1.5 leading-tight"
                  >
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictiveMaintenanceCard;
