'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface TripCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number | null;
  onConfirmCancel: (tripId: number, reason: string, cancelledBy: string) => void;
}

export const TripCancellationModal: React.FC<TripCancellationModalProps> = ({
  isOpen,
  onClose,
  tripId,
  onConfirmCancel,
}) => {
  const [reason, setReason] = useState('Vehicle breakdown on route');
  const [cancelledBy, setCancelledBy] = useState('Dispatcher Admin');

  if (!tripId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmCancel(tripId, reason, cancelledBy);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚠️ Cancel Trip Audit Trail">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>This action will abort Trip #{tripId} and log a compliance audit record.</span>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Structured Cancellation Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 rounded-xl glass-input focus:outline-none"
          >
            <option value="Vehicle breakdown on route" className="bg-slate-900">Vehicle mechanical breakdown</option>
            <option value="Consignee cancelled order" className="bg-slate-900">Consignee cancelled order</option>
            <option value="Driver illness / emergency" className="bg-slate-900">Driver illness / medical emergency</option>
            <option value="Severe weather / road blocked" className="bg-slate-900">Severe weather / landslide</option>
            <option value="Other compliance issue" className="bg-slate-900">Other compliance issue</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Authorizing Dispatcher</label>
          <input
            type="text"
            value={cancelledBy}
            onChange={(e) => setCancelledBy(e.target.value)}
            className="w-full p-2.5 rounded-xl glass-input"
            required
          />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 glass-panel"
          >
            Keep Trip Active
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/20"
          >
            Confirm Cancellation
          </button>
        </div>
      </form>
    </Modal>
  );
};
