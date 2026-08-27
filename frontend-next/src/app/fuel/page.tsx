'use client';

import React, { useState } from 'react';
import { Fuel, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_FUEL_THEFT_ALERTS } from '@/lib/mockData';
import { FuelTheftAlert } from '@/lib/types';

export default function FuelPage() {
  const [alerts, setAlerts] = useState<FuelTheftAlert[]>(INITIAL_FUEL_THEFT_ALERTS);

  const handleResolve = (id: number) => {
    setAlerts(
      alerts.map((a) =>
        a.id === id ? { ...a, status: 'CONFIRMED' as const, notes: 'Driver confirmed siphon incident.' } : a
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Fuel className="w-6 h-6 text-rose-400" />
            Fuel Log Audit & Theft Anomaly Detection Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detect sudden fuel level drops, fuel theft anomalies, and sensor discrepancies during driver rest stops.
          </p>
        </div>
      </div>

      {/* Fuel Theft Alerts Feed */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" /> Active High-Severity Theft Anomaly Feed
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                  <span className="font-extrabold text-slate-100 text-sm">
                    Vehicle #{alert.vehicle_id} Anomaly
                  </span>
                </div>
                <StatusBadge status={alert.status} />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/20 text-xs space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-400">Fuel Lost:</span>
                  <span className="text-rose-400 font-extrabold text-sm">{alert.fuel_lost_liters} Liters</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="text-emerald-400 font-bold">{alert.confidence_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-200 font-medium">{alert.location}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Detected At:</span>
                  <span className="text-slate-400">{alert.detected_at}</span>
                </div>
              </div>

              {alert.notes && <p className="text-xs text-slate-400 italic">"{alert.notes}"</p>}

              {alert.status === 'PENDING' && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20"
                  >
                    Confirm Fuel Theft & Audit Driver
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
