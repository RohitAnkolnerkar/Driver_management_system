import React, { useState, useEffect } from 'react';
import { Compass, Zap, UserCheck, AlertTriangle, X } from 'lucide-react';

interface CandidateDriver {
  driver_id: number;
  driver_name: string;
  phone?: string;
  vehicle_type?: string;
  total_score: number;
  proximity_km: number;
  fatigue_hours_logged: number;
  remaining_hours: number;
  idle_hours: number;
  safety_score: number;
  match_reasons: string[];
}

interface IntelligentDispatchModalProps {
  tripId: number;
  tripSource: string;
  tripDestination: string;
  token: string;
  apiFetch: (url: string, options?: any) => Promise<any>;
  onClose: () => void;
  onDispatchSuccess: (assignedDriverName: string) => void;
}

export const IntelligentDispatchModal: React.FC<IntelligentDispatchModalProps> = ({
  tripId,
  tripSource,
  tripDestination,
  apiFetch,
  onClose,
  onDispatchSuccess
}) => {
  const [candidates, setCandidates] = useState<CandidateDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [tripId]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/trips/${tripId}/recommend-drivers`);
      setCandidates(res.candidates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate driver match scores');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDispatch = async () => {
    setDispatching(true);
    try {
      const res = await apiFetch(`/trips/${tripId}/auto-dispatch`, {
        method: 'POST'
      });
      onDispatchSuccess(res.assigned_driver_name);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Auto-dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#00f2fe';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '680px', width: '90%' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-dim)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--accent-cyan)" />
              Intelligent Driver Matchmaker
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Trip #{tripId}: <strong style={{ color: '#fff' }}>{tripSource}</strong> ➔ <strong style={{ color: '#fff' }}>{tripDestination}</strong>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)', fontSize: '13px', margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
            <Compass size={36} color="var(--accent-cyan)" className="animate-spin" style={{ animationDuration: '4s', marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500 }}>Analyzing GPS Proximity, Legal Driving Hours, and Telematics Safety Scores...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
            <UserCheck size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '14px' }}>No available drivers found in proximity. Ensure drivers are marked 'Available'.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
            {/* Top Recommended Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Optimal Candidate Match
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                  {candidates[0].driver_name} ({candidates[0].total_score}% Match)
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAutoDispatch}
                disabled={dispatching}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Zap size={14} />
                {dispatching ? 'Dispatching...' : 'Auto-Dispatch Best Match'}
              </button>
            </div>

            {/* Candidate List */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {candidates.map((c, index) => (
                <div
                  key={c.driver_id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    backgroundColor: index === 0 ? 'rgba(255,255,255,0.03)' : 'var(--surface-1)',
                    border: '1px solid ' + (index === 0 ? 'var(--accent-cyan)' : 'var(--border-dim)'),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        #{index + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{c.driver_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.phone || 'No phone'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          backgroundColor: `${getScoreBadgeColor(c.total_score)}15`,
                          color: getScoreBadgeColor(c.total_score),
                          border: `1px solid ${getScoreBadgeColor(c.total_score)}40`
                        }}
                      >
                        {c.total_score}% Match
                      </span>
                    </div>
                  </div>

                  {/* Match Rationale Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {c.match_reasons.map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-dim)'
                        }}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border-dim)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
