import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';
  subtext?: string;
}

const iconStyles = {
  blue: 'text-blue-400 bg-slate-900 border-slate-800',
  emerald: 'text-emerald-400 bg-slate-900 border-slate-800',
  amber: 'text-amber-400 bg-slate-900 border-slate-800',
  rose: 'text-rose-400 bg-slate-900 border-slate-800',
  indigo: 'text-indigo-400 bg-slate-900 border-slate-800',
  purple: 'text-purple-400 bg-slate-900 border-slate-800',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  isPositive,
  icon: Icon,
  color,
  subtext,
}) => {
  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`p-2 rounded-lg border ${iconStyles[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-xl font-semibold text-slate-100 tracking-tight">{value}</div>
      </div>
      {(change || subtext) && (
        <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-800/60">
          {change && (
            <span
              className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
                isPositive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
              }`}
            >
              {isPositive ? '+' : ''}{change}
            </span>
          )}
          {subtext && <span className="text-slate-400 text-[11px]">{subtext}</span>}
        </div>
      )}
    </div>
  );
};
