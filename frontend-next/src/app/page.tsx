'use client';

import React, { useState } from 'react';
import {
  Truck,
  Users,
  ShieldAlert,
  DollarSign,
  Fuel,
  Send,
  FileCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { LiveMap } from '@/components/maps/LiveMap';
import { DynamicPricingCalculatorCard } from '@/components/pricing/DynamicPricingCalculatorCard';
import { IntelligentDispatchModal } from '@/components/modals/IntelligentDispatchModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  INITIAL_DRIVERS,
  INITIAL_TRIPS,
  INITIAL_VEHICLES,
  INITIAL_FUEL_THEFT_ALERTS,
} from '@/lib/mockData';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const REVENUE_DATA = [
  { day: 'Mon', revenue: 42000, expenses: 18000 },
  { day: 'Tue', revenue: 58000, expenses: 22000 },
  { day: 'Wed', revenue: 65000, expenses: 24000 },
  { day: 'Thu', revenue: 72000, expenses: 29000 },
  { day: 'Fri', revenue: 89000, expenses: 31000 },
  { day: 'Sat', revenue: 95000, expenses: 34000 },
  { day: 'Sun', revenue: 110000, expenses: 38000 },
];

export default function DashboardOverviewPage() {
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [trips, setTrips] = useState(INITIAL_TRIPS);
  const [drivers] = useState(INITIAL_DRIVERS);
  const [vehicles] = useState(INITIAL_VEHICLES);
  const [fuelAlerts] = useState(INITIAL_FUEL_THEFT_ALERTS);

  const handleDispatch = (data: any) => {
    const newTrip = {
      id: 100 + trips.length + 1,
      driver_id: data.driverId,
      vehicle_id: data.vehicleId,
      driver_name: drivers.find((d) => d.id === data.driverId)?.name || 'Rajesh Kumar',
      vehicle_plate: vehicles.find((v) => v.id === data.vehicleId)?.license_plate || 'MH-12-PQ-8890',
      origin: data.origin,
      destination: data.destination,
      status: 'DISPATCHED' as const,
      freight_rate_inr: data.freightRate,
      cargo_weight_kg: 24000,
    };
    setTrips([newTrip, ...trips]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            Executive Fleet Overview
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              FastAPI Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time GPS dispatching, driver safety scores, FASTag toll audit & automated fuel theft detection.
          </p>
        </div>

        <button
          onClick={() => setIsDispatchModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shrink-0"
        >
          <Send className="w-3.5 h-3.5" /> Create Dispatch Load
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active En-Route Trips"
          value={trips.filter((t) => t.status === 'EN_ROUTE' || t.status === 'DISPATCHED').length}
          change="12%"
          isPositive={true}
          icon={Truck}
          color="blue"
          subtext="4 Active Dispatches"
        />
        <KpiCard
          title="On-Duty Drivers"
          value={`${drivers.filter((d) => d.status === 'on_duty' || d.status === 'active').length} / ${drivers.length}`}
          change="98% Safety"
          isPositive={true}
          icon={Users}
          color="emerald"
          subtext="0 Safety Violations"
        />
        <KpiCard
          title="Fuel Theft Alerts"
          value={fuelAlerts.filter((a) => a.status === 'PENDING').length}
          change="2 Critical"
          isPositive={false}
          icon={ShieldAlert}
          color="rose"
          subtext="NH-48 Corridor Alert"
        />
        <KpiCard
          title="Monthly Revenue"
          value="₹4,28,500"
          change="18.4%"
          isPositive={true}
          icon={DollarSign}
          color="indigo"
          subtext="Net Profit: ₹1,85,200"
        />
      </div>

      {/* Live Map & Pricing Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              Live Vehicle Telematics & Route Mapping
            </h2>
            <span className="text-xs text-slate-400 font-mono">4 Vehicles Tracked</span>
          </div>
          <LiveMap height="h-[360px]" />
        </div>

        <div className="space-y-4">
          <DynamicPricingCalculatorCard />

          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> High-Priority Fuel Anomaly
            </h3>
            {fuelAlerts.slice(0, 1).map((alert) => (
              <div key={alert.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between font-medium text-slate-200">
                  <span>Vehicle #{alert.vehicle_id} Drop</span>
                  <StatusBadge status={alert.severity} />
                </div>
                <div className="text-slate-300 font-semibold">{alert.fuel_lost_liters} Liters Lost</div>
                <div className="text-[11px] text-slate-400">{alert.location}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Charts & Live Dispatch Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Expenses Trend Chart */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue & Operating Expenses
              </h3>
              <p className="text-[11px] text-slate-400">Weekly breakdown of earnings vs operating costs</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_DATA}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Trip Activity Feed */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Active Trip Dispatches
            </h3>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Live Feed</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1">
            {trips.map((trip) => (
              <div key={trip.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Trip #{trip.id}</span>
                  <StatusBadge status={trip.status} />
                </div>
                <div className="text-slate-300 font-medium">
                  {trip.origin} <span className="text-blue-400 font-bold">→</span> {trip.destination}
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Driver: <strong className="text-slate-200">{trip.driver_name}</strong></span>
                  <span className="text-emerald-400 font-medium">₹{trip.freight_rate_inr?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      <IntelligentDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        drivers={drivers}
        vehicles={vehicles}
        onDispatch={handleDispatch}
      />
    </div>
  );
}
