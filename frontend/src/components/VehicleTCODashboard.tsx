import React, { useEffect, useState } from "react";

export interface VehicleTCO {
  vehicle_id: number;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  total_km_driven: number;
  fuel_cost: number;
  maintenance_cost: number;
  operational_revenue: number;
  total_operating_cost: number;
  net_profit_loss: number;
  cost_per_km: number;
  profit_per_km: number;
  efficiency_rating: "EFFICIENT" | "AVERAGE" | "HIGH_COST_MONEY_DRAINER";
}

export interface FleetTCOSummary {
  total_vehicles: number;
  fleet_total_km: number;
  fleet_fuel_cost: number;
  fleet_maintenance_cost: number;
  fleet_total_cost: number;
  fleet_total_revenue: number;
  fleet_net_profit: number;
  fleet_avg_cost_per_km: number;
  vehicles_tco: VehicleTCO[];
}

interface Props {
  token: string;
}

export const VehicleTCODashboard: React.FC<Props> = ({ token }) => {
  const [tcoSummary, setTcoSummary] = useState<FleetTCOSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTCO = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/vehicles/tco-summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch fleet TCO analytics (${res.status})`);
      }
      const data = await res.json();
      setTcoSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load TCO analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTCO();
    }
  }, [token]);

  const getEfficiencyBadge = (rating: string) => {
    switch (rating) {
      case "HIGH_COST_MONEY_DRAINER":
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
            💸 HIGH COST (DRAINER)
          </span>
        );
      case "AVERAGE":
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ⚖️ AVERAGE COST
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ⚡ HIGHLY EFFICIENT
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-800/60 rounded-xl border border-slate-700">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
        <p>Calculating Total Cost of Ownership (TCO) analytics...</p>
      </div>
    );
  }

  if (error || !tcoSummary) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm flex justify-between items-center">
        <span>{error || "Failed to load summary."}</span>
        <button
          onClick={fetchTCO}
          className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-xs rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-800/80 p-4 rounded-xl border border-slate-700 shadow-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            💰 Total Cost of Ownership (TCO) & Financial Transparency
          </h3>
          <p className="text-xs text-slate-400">
            Comprehensive financial breakdown: Fuel, Repairs, Cost/KM, and Net Profitability
          </p>
        </div>
        <button
          onClick={fetchTCO}
          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition shadow-sm"
        >
          🔄 Refresh TCO Report
        </button>
      </div>

      {/* Fleet KPI Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700">
          <span className="text-xs font-semibold text-slate-400 block uppercase">
            Fleet Avg Cost / KM
          </span>
          <span className="text-2xl font-black text-indigo-400">
            ₹{tcoSummary.fleet_avg_cost_per_km}
            <span className="text-xs text-slate-400 font-normal"> / km</span>
          </span>
        </div>

        <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700">
          <span className="text-xs font-semibold text-slate-400 block uppercase">
            Total Fuel Spend
          </span>
          <span className="text-2xl font-black text-amber-400">
            ₹{tcoSummary.fleet_fuel_cost.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700">
          <span className="text-xs font-semibold text-slate-400 block uppercase">
            Maintenance & Repairs
          </span>
          <span className="text-2xl font-black text-rose-400">
            ₹{tcoSummary.fleet_maintenance_cost.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700">
          <span className="text-xs font-semibold text-slate-400 block uppercase">
            Net Fleet Profitability
          </span>
          <span
            className={`text-2xl font-black ${
              tcoSummary.fleet_net_profit >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            ₹{tcoSummary.fleet_net_profit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Vehicle TCO Table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center">
          <h4 className="font-bold text-white text-sm">
            Fleet Vehicle TCO Breakdown ({tcoSummary.total_vehicles} Vehicles)
          </h4>
          <span className="text-xs text-slate-400">
            Total Fleet Mileage: {tcoSummary.fleet_total_km.toLocaleString()} km
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Total Distance</th>
                <th className="px-4 py-3">Fuel Cost</th>
                <th className="px-4 py-3">Maintenance</th>
                <th className="px-4 py-3">Total Operating Cost</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Cost / KM</th>
                <th className="px-4 py-3">Efficiency Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {tcoSummary.vehicles_tco.map((v) => (
                <tr key={v.vehicle_id} className="hover:bg-slate-700/40 transition">
                  <td className="px-4 py-3 font-medium text-white">
                    <div>{v.make} {v.model} ({v.year})</div>
                    <div className="text-[10px] font-mono text-indigo-300">
                      {v.license_plate}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {v.total_km_driven.toLocaleString()} km
                  </td>
                  <td className="px-4 py-3 text-amber-300">
                    ₹{v.fuel_cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-rose-300">
                    ₹{v.maintenance_cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-100">
                    ₹{v.total_operating_cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-emerald-300">
                    ₹{v.operational_revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-bold font-mono text-indigo-300">
                    ₹{v.cost_per_km} / km
                  </td>
                  <td className="px-4 py-3">
                    {getEfficiencyBadge(v.efficiency_rating)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VehicleTCODashboard;
