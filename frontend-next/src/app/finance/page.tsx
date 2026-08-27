'use client';

import React, { useState } from 'react';
import { CreditCard, DollarSign, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { INITIAL_INVOICES } from '@/lib/mockData';

export default function FinancePage() {
  const [invoices] = useState(INITIAL_INVOICES);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-400" />
            Financial Analytics & Razorpay Payment Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track gross freight revenues, driver expense reimbursements, invoice billing, and Razorpay gateway payouts.
          </p>
        </div>

        <button
          onClick={() => setIsRazorpayModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 shrink-0"
        >
          <CreditCard className="w-4 h-4" /> Trigger Razorpay Payout
        </button>
      </div>

      {/* Finance Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Monthly Gross Revenue</span>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-center gap-1">
            ₹4,28,500 <ArrowUpRight className="w-5 h-5 text-emerald-400 inline" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Fuel & Toll Operating Expenses</span>
          <div className="text-2xl font-extrabold text-rose-400 flex items-center gap-1">
            ₹1,85,200 <ArrowDownRight className="w-5 h-5 text-rose-400 inline" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Net Operating Profit</span>
          <div className="text-2xl font-extrabold text-blue-400">₹2,43,300</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-slate-100 text-sm">Trip Freight Invoices & Receivables</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">Subtotal</th>
                <th className="px-5 py-3">GST Tax (18%)</th>
                <th className="px-5 py-3">Total Payable</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold font-mono text-blue-400">{inv.invoice_number}</td>
                  <td className="px-5 py-3.5 text-slate-200 font-semibold">{inv.customer_name}</td>
                  <td className="px-5 py-3.5 font-mono">₹{inv.amount_inr.toLocaleString()}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-400">₹{inv.tax_inr.toLocaleString()}</td>
                  <td className="px-5 py-3.5 font-extrabold text-emerald-400">₹{inv.total_amount_inr.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Razorpay Demo Trigger Modal */}
      {isRazorpayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 text-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" /> Razorpay Payout Gateway
              </h3>
              <button onClick={() => setIsRazorpayModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <p className="text-slate-300">FastAPI backend Razorpay route endpoint `/payments/create-payout` ready.</p>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
              Initiating payout of <strong>₹42,480</strong> to Rajesh Kumar (DL-04201912345).
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsRazorpayModalOpen(false)} className="px-4 py-2 rounded-xl glass-panel text-slate-400">
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Razorpay Payout Order Created Successfully!');
                  setIsRazorpayModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Execute Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
