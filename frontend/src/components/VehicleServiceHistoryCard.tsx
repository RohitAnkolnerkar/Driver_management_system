import React, { useEffect, useState } from 'react';
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, Filter, DollarSign, Calendar } from 'lucide-react';

export interface MaintenanceLog {
  id: number;
  vehicle_id: number;
  service_type: string;
  description?: string;
  cost: number;
  odometer_at_service: number;
  service_date: string;
  completed_at?: string | null;
  next_service_due_odometer?: number | null;
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  license_plate: string;
  odometer_km: number;
  status: string;
}

interface VehicleServiceHistoryCardProps {
  token: string;
  apiFetch: (url: string, options?: any) => Promise<any>;
}

export const VehicleServiceHistoryCard: React.FC<VehicleServiceHistoryCardProps> = ({ token, apiFetch }) => {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('all');

  // New Maintenance Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalVehicleId, setModalVehicleId] = useState<number | ''>('');
  const [modalServiceType, setModalServiceType] = useState<string>('oil_change');
  const [modalDescription, setModalDescription] = useState<string>('');
  const [modalCost, setModalCost] = useState<number>(3500);
  const [modalOdometer, setModalOdometer] = useState<number>(0);
  const [modalNextDueOdometer, setModalNextDueOdometer] = useState<number>(0);
  const [modalIsCompleted, setModalIsCompleted] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchLogsAndVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, vehiclesData] = await Promise.all([
        apiFetch('/vehicles/maintenance/all'),
        apiFetch('/vehicles/'),
      ]);
      setLogs(logsData || []);
      setVehicles(vehiclesData || []);
    } catch (err: any) {
      console.error('Failed to load maintenance service history:', err);
      setError(err.message || 'Failed to load maintenance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndVehicles();
  }, []);

  const handleOpenModal = (vId?: number) => {
    const targetVeh = vId ? vehicles.find(v => v.id === vId) : vehicles[0];
    if (targetVeh) {
      setModalVehicleId(targetVeh.id);
      setModalOdometer(targetVeh.odometer_km);
      setModalNextDueOdometer(targetVeh.odometer_km + 10000);
    }
    setModalServiceType('oil_change');
    setModalDescription('');
    setModalCost(3500);
    setModalIsCompleted(true);
    setShowModal(true);
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalVehicleId) return;

    setSubmitting(true);
    try {
      const payload = {
        service_type: modalServiceType,
        description: modalDescription,
        cost: Number(modalCost),
        odometer_at_service: Number(modalOdometer),
        next_service_due_odometer: Number(modalNextDueOdometer) > 0 ? Number(modalNextDueOdometer) : null,
        completed_at: modalIsCompleted ? new Date().toISOString() : null,
      };

      await apiFetch(`/vehicles/${modalVehicleId}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      await fetchLogsAndVehicles();
    } catch (err: any) {
      alert(`Failed to record maintenance service: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteMaintenance = async (logId: number, currentCost: number) => {
    const costStr = prompt('Enter final completed maintenance cost (₹):', currentCost.toString());
    if (costStr === null) return;
    const finalCost = parseFloat(costStr);
    if (isNaN(finalCost)) return;

    try {
      await apiFetch(`/vehicles/maintenance/${logId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ cost: finalCost }),
      });
      await fetchLogsAndVehicles();
    } catch (err: any) {
      alert(`Failed to complete maintenance log: ${err.message}`);
    }
  };

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    if (selectedVehicleId !== 'all' && log.vehicle_id !== Number(selectedVehicleId)) {
      return false;
    }
    if (selectedServiceType !== 'all' && log.service_type !== selectedServiceType) {
      return false;
    }
    return true;
  });

  // Calculate metrics
  const totalSpend = filteredLogs.reduce((acc, l) => acc + (l.cost || 0), 0);
  const completedCount = filteredLogs.filter(l => l.completed_at).length;
  const pendingCount = filteredLogs.length - completedCount;

  const getServiceTypeBadge = (stype: string) => {
    switch (stype) {
      case 'oil_change':
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '11px', fontWeight: 700 }}>🛢️ Oil Change</span>;
      case 'brakes':
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '11px', fontWeight: 700 }}>🛑 Brake Service</span>;
      case 'tire_rotation':
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px', fontWeight: 700 }}>🛞 Tire Service</span>;
      case 'engine':
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '11px', fontWeight: 700 }}>⚙️ Engine Repair</span>;
      case 'inspection':
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', fontSize: '11px', fontWeight: 700 }}>📋 Safety Audit</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)', fontSize: '11px', fontWeight: 700 }}>🔧 {stype.replace('_', ' ').toUpperCase()}</span>;
    }
  };

  const getVehicleLabel = (vId: number) => {
    const v = vehicles.find(veh => veh.id === vId);
    return v ? `${v.make} ${v.model} (${v.license_plate})` : `Vehicle #${vId}`;
  };

  if (loading) {
    return (
      <div className="content-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛠️</div>
        <div>Loading vehicle service & maintenance history records...</div>
      </div>
    );
  }

  return (
    <div className="content-panel" style={{ padding: '24px', margin: 0 }}>
      {/* Header */}
      <div className="panel-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="panel-title" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Wrench size={22} />
            Commercial Vehicle Service & Maintenance History
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Complete audit trail of preventive maintenance, repairs, brake overhauls & oil changes
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary"
          style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Log New Maintenance Service
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '20px' }}>📋</div>
          <div className="metric-label">Total Maintenance Logs</div>
          <div className="metric-value" style={{ color: '#fff', fontSize: '22px' }}>
            {filteredLogs.length}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '20px' }}>💸</div>
          <div className="metric-label">Total Fleet Service Cost</div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '22px' }}>
            ₹{totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <div className="metric-label">Completed Services</div>
          <div className="metric-value" style={{ color: '#22c55e', fontSize: '22px' }}>
            {completedCount}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: pendingCount > 0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '20px' }}>🛠️</div>
          <div className="metric-label">In-Progress / Scheduled</div>
          <div className="metric-value" style={{ color: pendingCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: '22px' }}>
            {pendingCount}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-dim)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          <Filter size={14} /> Filter Logs:
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vehicle:</label>
          <select
            className="form-select"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            value={selectedVehicleId}
            onChange={e => setSelectedVehicleId(e.target.value)}
          >
            <option value="all">All Vehicles ({vehicles.length})</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} ({v.license_plate})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Service Type:</label>
          <select
            className="form-select"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            value={selectedServiceType}
            onChange={e => setSelectedServiceType(e.target.value)}
          >
            <option value="all">All Service Types</option>
            <option value="oil_change">🛢️ Oil Change</option>
            <option value="brakes">🛑 Brake Service</option>
            <option value="tire_rotation">🛞 Tire Rotation & Alignment</option>
            <option value="engine">⚙️ Engine Tuneup / Repair</option>
            <option value="inspection">📋 Safety Inspection</option>
            <option value="other">🔧 Other Maintenance</option>
          </select>
        </div>
      </div>

      {/* History Data Table */}
      {filteredLogs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px dashed var(--border-dim)', color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0 }}>No maintenance logs found matching the selected filters.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Vehicle</th>
                <th style={{ padding: '12px' }}>Service Category</th>
                <th style={{ padding: '12px' }}>Description / Notes</th>
                <th style={{ padding: '12px' }}>Odometer at Service</th>
                <th style={{ padding: '12px' }}>Service Cost</th>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const vehName = getVehicleLabel(log.vehicle_id);
                const isCompleted = !!log.completed_at;

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>
                      {vehName}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {getServiceTypeBadge(log.service_type)}
                    </td>

                    <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                      {log.description || 'Routine maintenance service'}
                    </td>

                    <td style={{ padding: '12px', color: '#fff', fontFamily: 'monospace' }}>
                      {log.odometer_at_service.toLocaleString()} km
                    </td>

                    <td style={{ padding: '12px', color: 'var(--accent-amber)', fontWeight: 700 }}>
                      ₹{log.cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {new Date(log.service_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {isCompleted ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Completed
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
                          <Clock size={14} /> In Progress
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {!isCompleted && (
                        <button
                          onClick={() => handleCompleteMaintenance(log.id, log.cost)}
                          className="btn btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                        >
                          Mark Complete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal to Log New Vehicle Maintenance */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px' }}>
            <h3 style={{ color: 'var(--accent-cyan)', margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={20} /> Log New Vehicle Maintenance Service
            </h3>

            <form onSubmit={handleCreateMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Vehicle</label>
                <select
                  className="form-select"
                  value={modalVehicleId}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setModalVehicleId(id);
                    const v = vehicles.find(veh => veh.id === id);
                    if (v) {
                      setModalOdometer(v.odometer_km);
                      setModalNextDueOdometer(v.odometer_km + 10000);
                    }
                  }}
                  required
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.license_plate}) - {v.odometer_km.toLocaleString()} km
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Service Type</label>
                  <select
                    className="form-select"
                    value={modalServiceType}
                    onChange={e => setModalServiceType(e.target.value)}
                    required
                  >
                    <option value="oil_change">🛢️ Oil & Filter Change</option>
                    <option value="brakes">🛑 Brake Pad / Disc Overhaul</option>
                    <option value="tire_rotation">🛞 Tire Rotation & Alignment</option>
                    <option value="engine">⚙️ Engine Diagnostics & Tuneup</option>
                    <option value="inspection">📋 Pre-Trip Safety Audit</option>
                    <option value="other">🔧 Other Repair Service</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Estimated Service Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={modalCost}
                    onChange={e => setModalCost(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Odometer at Service (KM)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={modalOdometer}
                    onChange={e => setModalOdometer(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Next Service Target (KM)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={modalNextDueOdometer}
                    onChange={e => setModalNextDueOdometer(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Mechanic Notes / Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Changed 15W-40 Synthetic Engine Oil and replaced air filter."
                  value={modalDescription}
                  onChange={e => setModalDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="modalIsCompleted"
                  checked={modalIsCompleted}
                  onChange={e => setModalIsCompleted(e.target.checked)}
                />
                <label htmlFor="modalIsCompleted" style={{ fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                  Mark service as completed immediately (Set vehicle status to Active)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Recording...' : 'Save Service Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
