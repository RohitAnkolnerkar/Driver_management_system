import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface TheftAlert {
  id: number;
  driver_id: number;
  driver_name?: string;
  vehicle_id?: number;
  fuel_log_id?: number;
  alert_type: string;
  severity: string;
  detected_loss_liters: number;
  estimated_financial_loss: number;
  description: string;
  status: string;
  resolution_notes?: string;
  created_at: string;
}

interface TheftAnalytics {
  total_alerts: number;
  unresolved_count: number;
  confirmed_theft_count: number;
  total_stolen_liters: number;
  total_financial_loss_inr: number;
  recent_alerts: TheftAlert[];
}

interface FuelTheftDashboardProps {
  apiFetch: (url: string, options?: any) => Promise<any>;
}

export const FuelTheftDashboard: React.FC<FuelTheftDashboardProps> = ({ apiFetch }) => {
  const [analytics, setAnalytics] = useState<TheftAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/fuel/theft/analytics');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch fuel theft analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: number, status: 'confirmed_theft' | 'dismissed') => {
    setResolvingId(alertId);
    try {
      await apiFetch(`/fuel/theft/alerts/${alertId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          notes: status === 'confirmed_theft' ? 'Confirmed by Fleet Manager audit' : 'Dismissed as false positive'
        })
      });
      await fetchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>Loading fuel theft intelligence...</div>;
  }

  if (!analytics) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-1)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '20px',
        marginBottom: '24px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={22} color="var(--accent-red)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              Predictive Fuel Theft & Tank Siphoning Radar
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              GPS station verification, consumption anomaly detection, & siphoning audit
            </span>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchAnalytics}
          style={{ fontSize: '11px', padding: '4px 10px' }}
        >
          Refresh Radar
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Confirmed Stolen Fuel</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-red)', marginTop: '4px' }}>
            {analytics.total_stolen_liters} L
          </div>
        </div>

        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Financial Loss</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '4px' }}>
            ₹{analytics.total_financial_loss_inr.toLocaleString()}
          </div>
        </div>

        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(0, 242, 254, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Unresolved Alerts</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
            {analytics.unresolved_count} Pending
          </div>
        </div>

        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Audited Incidents</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {analytics.total_alerts}
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <h4 style={{ fontSize: '13px', color: '#fff', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Active & Recent Theft Anomalies
      </h4>

      {analytics.recent_alerts.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px' }}>
          No fuel theft or siphoning anomalies detected across active fleet logs.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {analytics.recent_alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: alert.status === 'unresolved' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid ' + (alert.status === 'unresolved' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-dim)'),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: alert.alert_type === 'offsite_refuel_fraud' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: alert.alert_type === 'offsite_refuel_fraud' ? 'var(--accent-red)' : 'var(--accent-amber)',
                      fontSize: '11px',
                      padding: '2px 8px',
                      fontWeight: 700
                    }}
                  >
                    {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                  </span>

                  <strong style={{ fontSize: '13px', color: '#fff' }}>
                    Driver: {alert.driver_name || `ID #${alert.driver_id}`}
                  </strong>

                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    ({new Date(alert.created_at).toLocaleDateString()})
                  </span>
                </div>

                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {alert.description}
                </p>

                <div style={{ fontSize: '11px', display: 'flex', gap: '12px' }}>
                  <span>Lost Fuel: <strong style={{ color: 'var(--accent-amber)' }}>{alert.detected_loss_liters} L</strong></span>
                  <span>Estimated Loss: <strong style={{ color: 'var(--accent-red)' }}>₹{alert.estimated_financial_loss.toFixed(2)}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                {alert.status === 'unresolved' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleResolve(alert.id, 'confirmed_theft')}
                      disabled={resolvingId === alert.id}
                      style={{ backgroundColor: 'var(--accent-red)', color: '#fff', fontSize: '11px', padding: '4px 10px', fontWeight: 600, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🚨 Confirm Theft
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleResolve(alert.id, 'dismissed')}
                      disabled={resolvingId === alert.id}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      ✓ Dismiss
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: alert.status === 'confirmed_theft' ? 'var(--accent-red)' : 'var(--accent-green)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    {alert.status === 'confirmed_theft' ? '❌ Theft Confirmed' : '✓ Dismissed'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
