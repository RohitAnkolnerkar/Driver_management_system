'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DollarSign, CreditCard, ShieldCheck, CheckCircle2, FileText, HandCoins, AlertCircle } from 'lucide-react';
import { Driver } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface DriverPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSettlePayout?: (driverId: number, amount: number) => void;
}

export const DriverPayrollModal: React.FC<DriverPayrollModalProps> = ({
  isOpen,
  onClose,
  driver,
  onSettlePayout,
}) => {
  const [bonus, setBonus] = useState<number>(3000);
  const [deductions, setDeductions] = useState<number>(1200);
  const [advance, setAdvance] = useState<number>(5000);
  const [isSettled, setIsSettled] = useState<boolean>(false);
  const [showPayslip, setShowPayslip] = useState<boolean>(false);

  if (!driver) return null;

  const baseSalary = 28000;
  const tripCommissions = 14500;
  const netPayout = baseSalary + tripCommissions + bonus - deductions - advance;

  const handleSettle = () => {
    setIsSettled(true);
    if (onSettlePayout) onSettlePayout(driver.id, netPayout);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`💰 Payroll & Salary Payout Center — ${driver.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Header Summary */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-slate-400 font-semibold">Driver License & Credentials</div>
            <div className="text-sm font-bold text-slate-100 font-mono">{driver.license_number}</div>
            <div className="text-[11px] text-slate-400">{driver.phone}</div>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-semibold mb-1">Payout Status:</span>
            <StatusBadge status={isSettled ? 'PAID' : 'PENDING'} />
          </div>
        </div>

        {/* Breakdown Matrix */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
          <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-2 text-xs uppercase tracking-wider">
            Monthly Earnings & Payout Breakdown (July 2026)
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Base Monthly Salary:</span>
              <span className="font-bold text-slate-100">₹{baseSalary.toLocaleString()}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Trip Performance Commission:</span>
              <span className="font-bold text-emerald-400">+₹{tripCommissions.toLocaleString()}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Safety & Fuel Incentive Bonus:</span>
              <input
                type="number"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
                className="w-24 p-1 rounded glass-input text-right font-bold text-emerald-400"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Deductions (Fuel/Penalties):</span>
              <input
                type="number"
                value={deductions}
                onChange={(e) => setDeductions(Number(e.target.value))}
                className="w-24 p-1 rounded glass-input text-right font-bold text-rose-400"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center col-span-2">
              <span className="text-slate-400">Advance Salary Disbursed:</span>
              <input
                type="number"
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value))}
                className="w-28 p-1 rounded glass-input text-right font-bold text-amber-400"
              />
            </div>
          </div>

          {/* Net Calculation Summary Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 flex items-center justify-between mt-3">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Net Payable Salary</span>
              <span className="text-xs text-slate-400 font-mono">
                ₹{baseSalary} + ₹{tripCommissions} + ₹{bonus} - ₹{deductions} - ₹{advance}
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 tracking-tight">
              ₹{netPayout.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Payslip preview state */}
        {showPayslip && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-2 animate-in fade-in">
            <div className="text-center font-bold text-slate-200 border-b border-slate-800 pb-1">
              DRIVERHUB FLEET LOGISTICS — OFFICIAL PAYSLIP RECEIPT
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Driver: {driver.name}</span>
              <span>Period: July 2026</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>License: {driver.license_number}</span>
              <span>Status: {isSettled ? 'SETTLED & PAID' : 'PENDING APPROVAL'}</span>
            </div>
            <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-emerald-400">
              <span>NET SALARY TRANSFERRED:</span>
              <span>₹{netPayout.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 flex justify-between items-center border-t border-slate-800">
          <button
            onClick={() => setShowPayslip(!showPayslip)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-300 glass-panel hover:bg-slate-800/80 font-semibold"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            {showPayslip ? 'Hide Payslip' : 'Generate Payslip Receipt'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 glass-panel hover:text-slate-200"
            >
              Close
            </button>

            {!isSettled ? (
              <button
                onClick={handleSettle}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/20"
              >
                <HandCoins className="w-4 h-4" /> Settle Payout Now
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> Payout Settled
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
