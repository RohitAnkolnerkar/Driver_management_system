'use client';

import React from 'react';
import { Wrench, Clock, Leaf, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { INITIAL_ESG_METRICS, INITIAL_DETENTION_RECORDS } from '@/lib/mockData';

export default function MaintenancePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-400" />
            Maintenance, Detention Clock & ESG Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Predictive maintenance alerts, warehouse detention fee calculators, and corporate ESG CO2 carbon reduction metrics.
          </p>
        </div>
      </div>

      {/* ESG Carbon Reduction Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Total CO2 Emitted
          </span>
          <div className="text-2xl font-bold text-slate-100">{INITIAL_ESG_METRICS.total_co2_kg.toLocaleString()} kg</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase">EV / Hybrid Fleet</span>
          <div className="text-2xl font-bold text-emerald-400">{INITIAL_ESG_METRICS.ev_fleet_percentage}%</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase">Carbon Offset Equivalent</span>
          <div className="text-2xl font-bold text-blue-400">{INITIAL_ESG_METRICS.carbon_offset_trees} Trees</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold uppercase">Average Fuel Efficiency</span>
          <div className="text-2xl font-bold text-amber-400">{INITIAL_ESG_METRICS.fuel_efficiency_avg} km/L</div>
        </div>
      </div>

      {/* Warehouse Detention Fee Clock */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" /> Warehouse Detention Fee Clock & Demurrage Audit
            </h3>
            <p className="text-[11px] text-slate-400">Track loading bay detention hours exceeding free turn-around window</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Trip ID</th>
                <th className="px-5 py-3">Warehouse Bay Location</th>
                <th className="px-5 py-3">Gate Arrival Time</th>
                <th className="px-5 py-3">Free Time Limit</th>
                <th className="px-5 py-3">Detention Hours</th>
                <th className="px-5 py-3">Total Demurrage Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {INITIAL_DETENTION_RECORDS.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-blue-400">#{rec.trip_id}</td>
                  <td className="px-5 py-3.5 text-slate-200 font-medium">{rec.location_name}</td>
                  <td className="px-5 py-3.5 text-slate-400">{rec.arrival_time}</td>
                  <td className="px-5 py-3.5">{rec.free_time_hours} Hours</td>
                  <td className="px-5 py-3.5 font-bold text-amber-400">+{rec.detention_hours} hrs</td>
                  <td className="px-5 py-3.5 font-extrabold text-rose-400">₹{rec.total_detention_fee_inr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
