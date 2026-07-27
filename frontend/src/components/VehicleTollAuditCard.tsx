import React, { useEffect, useState } from 'react';
import { Navigation, PlusCircle, Filter, X, Search } from 'lucide-react';

export interface VehicleTollLog {
  id: number;
  vehicle_id: number;
  driver_id?: number | null;
  trip_id?: number | null;
  toll_plaza_name: string;
  highway_name?: string | null;
  amount: number;
  payment_method: string;
  transaction_reference?: string | null;
  toll_date: string;
  created_at: string;
}

export interface VehicleTollSummaryItem {
  vehicle_id: number;
  make: string;
  model: string;
  license_plate: string;
  total_toll_spend: number;
  fastag_spend: number;
  cash_spend: number;
  transaction_count: number;
  toll_logs: VehicleTollLog[];
}

export interface FleetTollSummaryResponse {
  period_start: string;
  period_end: string;
  total_fleet_toll_spend: number;
  total_fastag_spend: number;
  total_cash_spend: number;
  total_transactions: number;
  vehicle_summaries: VehicleTollSummaryItem[];
}

interface VehicleTollAuditCardProps {
  apiFetch: (url: string, options?: any) => Promise<any>;
}

export const VehicleTollAuditCard: React.FC<VehicleTollAuditCardProps> = ({ apiFetch }) => {
  const [summary, setSummary] = useState<FleetTollSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Period Filter States
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Log Toll Modal State
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logVehicleId, setLogVehicleId] = useState<string>('');
  const [logPlazaName, setLogPlazaName] = useState<string>('');
  const [logHighwayName, setLogHighwayName] = useState<string>('');
  const [logAmount, setLogAmount] = useState<string>('');
  const [logMethod, setLogMethod] = useState<string>('FASTag');
  const [logRef, setLogRef] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Viewing Specific Vehicle History Modal State
  const [selectedVehicleSummary, setSelectedVehicleSummary] = useState<VehicleTollSummaryItem | null>(null);

  const fetchTollData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/vehicles/tolls/summary?year=${selectedYear}&month=${selectedMonth}`);
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load toll summary data:', err);
      setError(err.message || 'Failed to fetch vehicle toll data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTollData();
  }, [selectedYear, selectedMonth]);

  const handleCreateToll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logVehicleId || !logPlazaName || !logAmount) return;

    setSubmitting(true);
    try {
      await apiFetch(`/vehicles/${logVehicleId}/tolls`, {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: parseInt(logVehicleId),
          toll_plaza_name: logPlazaName,
          highway_name: logHighwayName || null,
          amount: parseFloat(logAmount),
          payment_method: logMethod,
          transaction_reference: logRef || null,
        }),
      });

      setShowLogModal(false);
      setLogPlazaName('');
      setLogHighwayName('');
      setLogAmount('');
      setLogRef('');
      await fetchTollData();
    } catch (err: any) {
      alert(`Failed to log toll: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const filteredSummaries = (summary?.vehicle_summaries || []).filter(v => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.license_plate.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="content-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛣️</div>
        <div>Calculating fleet vehicle FASTag & toll expenses...</div>
      </div>
    );
  }

  return (
    <div className="content-panel" style={{ padding: '24px', margin: 0 }}>
      {/* Header */}
      <div className="panel-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="panel-title" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Navigation size={22} />
            Vehicle FASTag & Highway Toll Expense Audit
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Audit FASTag electronic toll deductions & cash highway expenses per commercial vehicle for any period
          </p>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <PlusCircle size={15} />
          ➕ Record FASTag / Toll Transaction
        </button>
      </div>

      {/* KPI Cards Bar */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '18px' }}>🛣️</div>
          <div className="metric-label">Total Fleet Toll Spend</div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '22px' }}>
            ₹{(summary?.total_fleet_toll_spend || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.04)' }}>
          <div style={{ fontSize: '18px' }}>💳</div>
          <div className="metric-label">FASTag Auto Deductions</div>
          <div className="metric-value" style={{ color: '#22c55e', fontSize: '22px' }}>
            ₹{(summary?.total_fastag_spend || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <div style={{ fontSize: '18px' }}>💵</div>
          <div className="metric-label">Cash / UPI Highway Tolls</div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '22px' }}>
            ₹{(summary?.total_cash_spend || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '18px' }}>📊</div>
          <div className="metric-label">Plaza Transactions Audited</div>
          <div className="metric-value" style={{ color: '#fff', fontSize: '22px' }}>
            {summary?.total_transactions || 0}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-dim)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          <Filter size={14} /> Audit Window:
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Year:</label>
          <select
            className="form-select"
            style={{ padding: '5px 10px', fontSize: '12px' }}
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Month:</label>
          <select
            className="form-select"
            style={{ padding: '5px 10px', fontSize: '12px' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            {monthNames.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
          Period: <strong style={{ color: '#fff' }}>{summary?.period_start}</strong> ➔ <strong style={{ color: '#fff' }}>{summary?.period_end}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <Search size={14} color="var(--text-secondary)" />
          <input
            type="text"
            className="form-input"
            style={{ padding: '5px 10px', fontSize: '12px', width: '190px' }}
            placeholder="Search vehicle plate/make..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Per-Vehicle Toll Expenses Table */}
      {filteredSummaries.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px dashed var(--border-dim)', color: 'var(--text-secondary)' }}>
          No vehicle toll records found for {monthNames[selectedMonth - 1]} {selectedYear}. Click "Record FASTag / Toll Transaction" to log one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Vehicle Asset</th>
                <th style={{ padding: '12px' }}>License Plate</th>
                <th style={{ padding: '12px' }}>Plaza Crossings</th>
                <th style={{ padding: '12px' }}>FASTag Spend (₹)</th>
                <th style={{ padding: '12px' }}>Cash / UPI (₹)</th>
                <th style={{ padding: '12px' }}>Total Toll Cost (₹)</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map(v => (
                <tr key={v.vehicle_id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{v.make} {v.model}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: #{v.vehicle_id}</div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <code style={{ fontSize: '12.5px', color: 'var(--accent-cyan)', backgroundColor: 'rgba(0,242,254,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {v.license_plate}
                    </code>
                  </td>

                  <td style={{ padding: '12px', color: '#fff' }}>
                    {v.transaction_count} plaza{v.transaction_count === 1 ? '' : 's'}
                  </td>

                  <td style={{ padding: '12px', color: '#22c55e', fontWeight: 600 }}>
                    ₹{v.fastag_spend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>

                  <td style={{ padding: '12px', color: v.cash_spend > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
                    ₹{v.cash_spend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>

                  <td style={{ padding: '12px', color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '14px' }}>
                    ₹{v.total_toll_spend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedVehicleSummary(v)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                    >
                      📋 View Plaza History ({v.transaction_count})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Log Toll Deduction */}
      {showLogModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--accent-cyan)', margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={18} /> Record FASTag / Toll Transaction
              </h3>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateToll} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Vehicle Asset *</label>
                <select
                  className="form-select"
                  required
                  value={logVehicleId}
                  onChange={e => setLogVehicleId(e.target.value)}
                >
                  <option value="">-- Select Vehicle --</option>
                  {(summary?.vehicle_summaries || []).map(v => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>{v.make} {v.model} ({v.license_plate})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Toll Plaza Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Khed-Shivapur Plaza"
                    value={logPlazaName}
                    onChange={e => setLogPlazaName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Highway / Route</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. NH-48 Expressway"
                    value={logHighwayName}
                    onChange={e => setLogHighwayName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Toll Amount (₹) *</label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    required
                    className="form-input"
                    placeholder="e.g. 215"
                    value={logAmount}
                    onChange={e => setLogAmount(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-select"
                    value={logMethod}
                    onChange={e => setLogMethod(e.target.value)}
                  >
                    <option value="FASTag">💳 FASTag Auto-Deduction</option>
                    <option value="UPI">📱 UPI Payment</option>
                    <option value="Cash">💵 Cash Payment</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Transaction Ref / FASTag Tag ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FT-9912048820"
                  value={logRef}
                  onChange={e => setLogRef(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowLogModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Record Toll Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Vehicle Toll Plaza History */}
      {selectedVehicleSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '640px', padding: '24px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--accent-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Navigation size={18} /> {selectedVehicleSummary.make} {selectedVehicleSummary.model} ({selectedVehicleSummary.license_plate})
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Itemized Plaza History for {monthNames[selectedMonth - 1]} {selectedYear}</span>
              </div>
              <button onClick={() => setSelectedVehicleSummary(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {selectedVehicleSummary.toll_logs.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No toll plaza crossings recorded for this vehicle in the selected audit period.</div>
            ) : (
              <table className="dashboard-table" style={{ fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    <th>Plaza Name / Highway</th>
                    <th>Payment Method</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVehicleSummary.toll_logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{log.toll_plaza_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.highway_name || 'Highway Express'}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${log.payment_method.toLowerCase() === 'fastag' ? 'completed' : 'assigned'}`}>
                          {log.payment_method}
                        </span>
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {new Date(log.toll_date).toLocaleDateString()} {new Date(log.toll_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        ₹{log.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setSelectedVehicleSummary(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
