'use client';

import React, { useState } from 'react';
import { Truck, Send, AlertTriangle, MapPin, Search, Filter } from 'lucide-react';
import { LiveMap } from '@/components/maps/LiveMap';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TripCancellationModal } from '@/components/modals/TripCancellationModal';
import { IntelligentDispatchModal } from '@/components/modals/IntelligentDispatchModal';
import { INITIAL_TRIPS, INITIAL_DRIVERS, INITIAL_VEHICLES } from '@/lib/mockData';
import { Trip } from '@/lib/types';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cancellingTripId, setCancellingTripId] = useState<number | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  const handleConfirmCancel = (tripId: number, reason: string, cancelledBy: string) => {
    setTrips(
      trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              status: 'CANCELLED',
              cancellation_reason: reason,
              cancelled_by: cancelledBy,
            }
          : t
      )
    );
  };

  const handleDispatch = (data: any) => {
    const newTrip: Trip = {
      id: 100 + trips.length + 1,
      driver_id: data.driverId,
      vehicle_id: data.vehicleId,
      driver_name: INITIAL_DRIVERS.find((d) => d.id === data.driverId)?.name || 'Driver',
      vehicle_plate: INITIAL_VEHICLES.find((v) => v.id === data.vehicleId)?.license_plate || 'MH-12-PQ-8890',
      origin: data.origin,
      destination: data.destination,
      status: 'DISPATCHED',
      freight_rate_inr: data.freightRate,
      cargo_weight_kg: 24000,
    };
    setTrips([newTrip, ...trips]);
  };

  const filteredTrips = trips.filter((t) => {
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesSearch =
      (t.origin || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.destination || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.vehicle_plate || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            Trip Management & Live Telematics Dispatch Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track active load movements, trigger automated geofencing, and manage trip cancellation compliance.
          </p>
        </div>

        <button
          onClick={() => setIsDispatchModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 shrink-0"
        >
          <Send className="w-4 h-4" /> Create New Dispatch
        </button>
      </div>

      {/* Map */}
      <LiveMap height="h-[320px]" />

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search trip, location or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-1.5 px-3 rounded-xl glass-input text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {['ALL', 'EN_ROUTE', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'glass-panel text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Data Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Trip ID</th>
                <th className="px-5 py-3.5">Driver & Vehicle</th>
                <th className="px-5 py-3.5">Route</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Freight Rate</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrips.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-200">#{t.id}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-200">{t.driver_name || 'Driver'}</div>
                    <div className="text-[10px] text-blue-400 font-mono">{t.vehicle_plate || 'MH-12'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t.origin}</span>
                      <span className="text-slate-500 font-bold">→</span>
                      <span>{t.destination}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={t.status} />
                    {t.cancellation_reason && (
                      <div className="text-[10px] text-rose-400 mt-1 max-w-xs truncate">
                        Reason: {t.cancellation_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 font-bold text-emerald-400">
                    ₹{t.freight_rate_inr?.toLocaleString() || '45,000'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {t.status !== 'CANCELLED' && t.status !== 'DELIVERED' ? (
                      <button
                        onClick={() => setCancellingTripId(t.id)}
                        className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-semibold text-[11px]"
                      >
                        Cancel Trip
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">Archived</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <TripCancellationModal
        isOpen={cancellingTripId !== null}
        onClose={() => setCancellingTripId(null)}
        tripId={cancellingTripId}
        onConfirmCancel={handleConfirmCancel}
      />

      <IntelligentDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        drivers={INITIAL_DRIVERS}
        vehicles={INITIAL_VEHICLES}
        onDispatch={handleDispatch}
      />
    </div>
  );
}
