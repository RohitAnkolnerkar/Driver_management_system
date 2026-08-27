'use client';

import React, { useState } from 'react';
import { Users, UserPlus, ShieldCheck, Award, Edit3, DollarSign, HandCoins } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DriverModal } from '@/components/modals/DriverModal';
import { DriverPayrollModal } from '@/components/modals/DriverPayrollModal';
import { INITIAL_DRIVERS } from '@/lib/mockData';
import { Driver } from '@/lib/types';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [selectedDriverForEdit, setSelectedDriverForEdit] = useState<Driver | null>(null);
  const [selectedDriverForPayroll, setSelectedDriverForPayroll] = useState<Driver | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveDriver = (driverData: Partial<Driver>) => {
    if (driverData.id) {
      setDrivers(drivers.map((d) => (d.id === driverData.id ? { ...d, ...driverData } : d)));
    } else {
      const newDriver: Driver = {
        id: drivers.length + 1,
        name: driverData.name || 'New Driver',
        phone: driverData.phone || '+91 90000 00000',
        license_number: driverData.license_number || 'DL-0000',
        status: driverData.status || 'active',
        safety_score: 95,
        total_trips: 0,
        experience_years: driverData.experience_years || 2,
      };
      setDrivers([...drivers, newDriver]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Driver Roster & Payroll Management Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage driver profiles, verify commercial license status, track safety scores, and process payouts.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedDriverForEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Add New Driver
        </button>
      </div>

      {/* Driver Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Total Drivers</span>
            <div className="text-2xl font-bold text-slate-100">{drivers.length}</div>
          </div>
          <Users className="w-8 h-8 text-blue-400/80" />
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Avg Safety Score</span>
            <div className="text-2xl font-bold text-emerald-400">95.4 / 100</div>
          </div>
          <Award className="w-8 h-8 text-emerald-400/80" />
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Pending Payroll Payout</span>
            <div className="text-2xl font-bold text-indigo-400">₹1,42,800</div>
          </div>
          <DollarSign className="w-8 h-8 text-indigo-400/80" />
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            className="glass-panel glass-panel-hover p-5 rounded-2xl border border-slate-800 space-y-4 relative group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {driver.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{driver.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{driver.phone}</p>
                </div>
              </div>

              <StatusBadge status={driver.status} />
            </div>

            <div className="space-y-2 text-xs border-t border-b border-slate-800/80 py-3">
              <div className="flex justify-between">
                <span className="text-slate-400">License Number:</span>
                <span className="font-mono text-slate-200 font-semibold">{driver.license_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driving Experience:</span>
                <span className="text-slate-200 font-medium">{driver.experience_years} Years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Safety Score:</span>
                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-400" />
                  {driver.safety_score || 95}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setSelectedDriverForEdit(driver);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </button>

              <button
                onClick={() => setSelectedDriverForPayroll(driver)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold transition-all hover:scale-105"
              >
                <HandCoins className="w-3.5 h-3.5 text-indigo-400" /> View Payroll Payout
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Registration / Edit Modal */}
      <DriverModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDriverForEdit(null);
        }}
        driver={selectedDriverForEdit}
        onSave={handleSaveDriver}
      />

      {/* Driver Payroll Payout Modal */}
      <DriverPayrollModal
        isOpen={selectedDriverForPayroll !== null}
        onClose={() => setSelectedDriverForPayroll(null)}
        driver={selectedDriverForPayroll}
      />
    </div>
  );
}

