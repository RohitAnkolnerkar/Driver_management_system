import React from 'react';

type StatusType =
  | 'active'
  | 'on_duty'
  | 'off_duty'
  | 'EN_ROUTE'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PENDING'
  | 'HIGH'
  | 'CRITICAL'
  | 'VERIFIED'
  | 'UNPAID'
  | 'PAID'
  | string;

interface StatusBadgeProps {
  status: StatusType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toUpperCase();

  let style = 'bg-slate-800/80 text-slate-300 border-slate-700/60';

  if (['ACTIVE', 'ON_DUTY', 'EN_ROUTE', 'DELIVERED', 'VERIFIED', 'PAID', 'CHARGED'].includes(normalized)) {
    style = 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50';
  } else if (['DISPATCHED', 'PENDING', 'UNPAID', 'INVESTIGATING', 'DISCREPANCY'].includes(normalized)) {
    style = 'bg-amber-950/50 text-amber-300 border-amber-800/50';
  } else if (['CANCELLED', 'HIGH', 'CRITICAL', 'SUSPENDED', 'MAINTENANCE', 'REJECTED'].includes(normalized)) {
    style = 'bg-rose-950/50 text-rose-300 border-rose-800/50';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status.replace('_', ' ')}
    </span>
  );
};
