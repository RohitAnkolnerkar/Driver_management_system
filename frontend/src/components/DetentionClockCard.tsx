import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, Play, Square } from 'lucide-react';

interface DetentionMetrics {
  trip_id: number;
  detention_start_time?: string;
  detention_end_time?: string;
  elapsed_minutes: number;
  grace_minutes: number;
  is_grace_exceeded: boolean;
  billable_hours: number;
  hourly_rate: number;
  estimated_detention_charge: number;
  status_summary: string;
}

interface DetentionClockCardProps {
  tripId: number;
  apiFetch: (url: string, options?: any) => Promise<any>;
  onStatusChange?: () => void;
}

export const DetentionClockCard: React.FC<DetentionClockCardProps> = ({
  tripId,
  apiFetch,
  onStatusChange
}) => {
  const [metrics, setMetrics] = useState<DetentionMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchDetention();
  }, [tripId]);

  const fetchDetention = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/trips/${tripId}/detention`);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch detention status', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const data = await apiFetch(`/trips/${tripId}/detention/clock-in`, { method: 'POST' });
      setMetrics(data);
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      alert(err.message || 'Clock-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      const data = await apiFetch(`/trips/${tripId}/detention/clock-out`, { method: 'POST' });
      setMetrics(data);
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      alert(err.message || 'Clock-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Loading detention clock...</div>;
  }

  if (!metrics) return null;

  const isActive = !!metrics.detention_start_time && !metrics.detention_end_time;
  const gracePct = Math.min(100, Math.round((metrics.elapsed_minutes / metrics.grace_minutes) * 100));

  return (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: '10px',
        backgroundColor: metrics.is_grace_exceeded
          ? 'rgba(239, 68, 68, 0.06)'
          : isActive
          ? 'rgba(0, 242, 254, 0.06)'
          : 'rgba(255, 255, 255, 0.02)',
        border: '1px solid ' + (metrics.is_grace_exceeded ? 'rgba(239, 68, 68, 0.3)' : isActive ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-dim)'),
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        margin: '12px 0'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color={metrics.is_grace_exceeded ? 'var(--accent-red)' : 'var(--accent-cyan)'} />
          <strong style={{ fontSize: '13px', color: '#fff' }}>Warehouse Loading Dock Detention Clock</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!metrics.detention_start_time ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleClockIn}
              disabled={actionLoading}
              style={{ backgroundColor: 'var(--accent-cyan)', color: '#000', fontWeight: 700, padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Play size={12} /> {actionLoading ? 'Starting...' : '📍 Dock Clock-In'}
            </button>
          ) : isActive ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleClockOut}
              disabled={actionLoading}
              style={{ backgroundColor: 'var(--accent-amber)', color: '#000', fontWeight: 700, padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Square size={12} /> {actionLoading ? 'Stopping...' : '⏱️ Dock Clock-Out'}
            </button>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Clock Complete
            </span>
          )}
        </div>
      </div>

      {/* Details Row */}
      {metrics.detention_start_time && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Dock Stay:</span>{' '}
            <strong style={{ color: '#fff' }}>{Math.round(metrics.elapsed_minutes)} min</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Free Grace:</span>{' '}
            <strong style={{ color: '#fff' }}>{metrics.grace_minutes} min</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Billable Hours:</span>{' '}
            <strong style={{ color: metrics.billable_hours > 0 ? 'var(--accent-amber)' : '#fff' }}>{metrics.billable_hours} hrs</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Detention Fee:</span>{' '}
            <strong style={{ color: metrics.estimated_detention_charge > 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: '13px' }}>
              ₹{metrics.estimated_detention_charge.toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {/* Grace Progress Bar */}
      {isActive && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>Grace Period Usage</span>
            <span>{gracePct}% ({metrics.status_summary})</span>
          </div>
          <div style={{ height: '5px', backgroundColor: 'var(--border-dim)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, gracePct)}%`,
                backgroundColor: metrics.is_grace_exceeded ? 'var(--accent-red)' : 'var(--accent-cyan)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
