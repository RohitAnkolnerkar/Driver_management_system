'use client';

import React, { useState } from 'react';
import { Truck, ShieldAlert, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_VEHICLES, INITIAL_FASTAG_LOGS } from '@/lib/mockData';

export default function VehiclesPage() {
  const [vehicles] = useState(INITIAL_VEHICLES);
  const [fastagLogs] = useState(INITIAL_FASTAG_LOGS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            Fleet Vehicles & FASTag Toll Audit Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor vehicle fitness expiration countdowns, total cost of ownership (TCO), and automated FASTag plaza reconciliation.
          </p>
        </div>
      </div>

      {/* Fleet Compliance Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {vehicles.map((v) => (
          <div key={v.id} className="glass-panel glass-panel-hover p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-100 text-sm font-mono">{v.license_plate}</span>
              <StatusBadge status={v.status} />
            </div>

            <div className="text-xs text-slate-300 font-semibold">{v.make} {v.model} ({v.capacity_tons}T)</div>

            <div className="space-y-1.5 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
              <div className="flex justify-between">
                <span>Odometer Reading:</span>
                <span className="font-mono text-slate-200">{v.odometer_km.toLocaleString()} km</span>
              </div>
              <div className="flex justify-between">
                <span>Insurance Expiry:</span>
                <span className="text-emerald-400 font-medium">{v.insurance_expiry}</span>
              </div>
              <div className="flex justify-between">
                <span>Fitness Cert Expiry:</span>
                <span className="text-amber-400 font-medium">{v.fitness_expiry}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FASTag Reconciliation Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" /> FASTag Toll Audit & Discrepancy Logs
            </h3>
            <p className="text-[11px] text-slate-400">Automated plaza charge validation against vehicle GPS toll geofences</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            FASTag API Sync
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Vehicle Plate</th>
                <th className="px-5 py-3">Toll Plaza Location</th>
                <th className="px-5 py-3">Charged Amount</th>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Reconciliation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {fastagLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold font-mono text-blue-400">{log.vehicle_plate}</td>
                  <td className="px-5 py-3.5 text-slate-200 font-medium">{log.toll_plaza_name}</td>
                  <td className="px-5 py-3.5 font-extrabold text-slate-100">₹{log.amount_inr}</td>
                  <td className="px-5 py-3.5 text-slate-400">{log.timestamp}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
