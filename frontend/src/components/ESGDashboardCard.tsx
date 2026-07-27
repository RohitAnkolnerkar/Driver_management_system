import React, { useEffect, useState } from 'react';
import { Leaf, Fuel, Award, ShieldCheck } from 'lucide-react';

interface DriverEcoRating {
  driver_id: number;
  driver_name: string;
  total_trips: number;
  total_distance_km: number;
  total_co2_kg: number;
  avg_co2_per_km: number;
  eco_grade: string;
}

interface ESGAnalytics {
  total_fleet_co2_kg: number;
  total_fleet_distance_km: number;
  total_fuel_consumed_liters: number;
  avg_fleet_co2_per_km: number;
  fleet_eco_score: number;
  top_eco_drivers: DriverEcoRating[];
  sustainability_recommendations: string[];
}

interface ESGDashboardCardProps {
  apiFetch: (url: string, options?: any) => Promise<any>;
}

export const ESGDashboardCard: React.FC<ESGDashboardCardProps> = ({ apiFetch }) => {
  const [analytics, setAnalytics] = useState<ESGAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchESGData();
  }, []);

  const fetchESGData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/esg/analytics');
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load ESG Analytics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="metric-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ESG Fleet Analytics...</div>;
  }

  if (!analytics) return null;

  return (
    <div className="content-panel" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(5,150,105,0.01) 100%)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '24px' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid rgba(16,185,129,0.15)', paddingBottom: '12px' }}>
        <h3 className="panel-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Leaf size={20} color="#10b981" />
          ESG Carbon Footprint & Fleet Sustainability Dashboard
        </h3>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Real-time CO₂ emissions monitoring & green driver eco-ratings
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '20px 0' }}>
        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <Leaf size={14} color="#10b981" /> Total CO₂ Footprint
          </div>
          <div className="metric-value" style={{ color: '#10b981', fontSize: '22px' }}>
            {analytics.total_fleet_co2_kg.toLocaleString()} kg
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            ~{analytics.avg_fleet_co2_per_km} kg CO₂ / km
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', borderLeft: '3px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <Fuel size={14} color="var(--accent-cyan)" /> Total Fuel Consumed
          </div>
          <div className="metric-value" style={{ color: '#fff', fontSize: '22px' }}>
            {analytics.total_fuel_consumed_liters.toLocaleString()} L
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Across {analytics.total_fleet_distance_km.toLocaleString()} km
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', borderLeft: '3px solid var(--accent-amber)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <Award size={14} color="var(--accent-amber)" /> Fleet Eco Score
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '22px' }}>
            {analytics.fleet_eco_score} / 100
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            ESG Compliance Rating
          </div>
        </div>
      </div>

      {/* Driver Eco Leaderboard */}
      {analytics.top_eco_drivers.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            🌿 Eco-Certified Low Emission Drivers
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {analytics.top_eco_drivers.map(d => (
              <div key={d.driver_id} style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{d.driver_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {d.total_trips} trips · {d.total_distance_km} km · {d.total_co2_kg} kg CO₂
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                  Grade {d.eco_grade}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} /> Fleet Sustainability Action Recommendations
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {analytics.sustainability_recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
