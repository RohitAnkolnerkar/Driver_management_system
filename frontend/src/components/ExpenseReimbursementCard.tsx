import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  FileText,
  Filter,
  CheckSquare,
  ShieldAlert,
  CreditCard
} from 'lucide-react';

interface Expense {
  id: number;
  driver_id: number;
  trip_id?: number | null;
  category: string;
  amount: number;
  description?: string | null;
  receipt_number?: string | null;
  status: string;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  driver_name?: string | null;
}

interface DriverSettlement {
  driver_id: number;
  driver_name: string;
  driver_phone?: string | null;
  total_trips_completed: number;
  base_trip_earnings: number;
  total_claimed_expenses: number;
  approved_expenses_amount: number;
  pending_expenses_amount: number;
  rejected_expenses_amount: number;
  settled_expenses_amount: number;
  net_settlement_payout: number;
  expenses: Expense[];
}

interface Driver {
  id: number;
  name: string;
  phone?: string;
}

interface ExpenseReimbursementCardProps {
  apiFetch: (url: string, options?: any) => Promise<any>;
  drivers?: Driver[];
}

export const ExpenseReimbursementCard: React.FC<ExpenseReimbursementCardProps> = ({
  apiFetch,
  drivers = []
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [rejectExpenseId, setRejectExpenseId] = useState<number | null>(null);

  // Form states
  const [newDriverId, setNewDriverId] = useState<string>('');
  const [newTripId, setNewTripId] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('toll');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newReceipt, setNewReceipt] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Settlement state
  const [selectedDriverIdForSettlement, setSelectedDriverIdForSettlement] = useState<string>('');
  const [settlementData, setSettlementData] = useState<DriverSettlement | null>(null);
  const [settlementLoading, setSettlementLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchExpenses();
  }, [statusFilter, driverFilter, categoryFilter]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let url = '/expenses/?';
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (driverFilter !== 'all') params.append('driver_id', driverFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const data = await apiFetch(url + params.toString());
      setExpenses(data);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverId || !newAmount) {
      alert('Please select a driver and enter amount.');
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch('/expenses/', {
        method: 'POST',
        body: JSON.stringify({
          driver_id: parseInt(newDriverId),
          trip_id: newTripId ? parseInt(newTripId) : null,
          category: newCategory,
          amount: parseFloat(newAmount),
          receipt_number: newReceipt || null,
          description: newDescription || null
        })
      });
      setShowLogModal(false);
      // Reset form
      setNewAmount('');
      setNewReceipt('');
      setNewDescription('');
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to submit expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveExpense = async (expenseId: number) => {
    try {
      await apiFetch(`/expenses/${expenseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          reviewed_by: 'Dispatcher'
        })
      });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleRejectExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectExpenseId) return;
    try {
      await apiFetch(`/expenses/${rejectExpenseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason || 'Information incomplete',
          reviewed_by: 'Dispatcher'
        })
      });
      setRejectExpenseId(null);
      setRejectionReason('');
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  const handleFetchSettlement = async (driverIdStr: string) => {
    setSelectedDriverIdForSettlement(driverIdStr);
    if (!driverIdStr) {
      setSettlementData(null);
      return;
    }
    setSettlementLoading(true);
    try {
      const data = await apiFetch(`/expenses/settlement/${driverIdStr}`);
      setSettlementData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load driver settlement summary');
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleFinalizeSettlement = async () => {
    if (!selectedDriverIdForSettlement) return;
    if (!window.confirm('Are you sure you want to finalize and pay out this driver settlement? Approved expenses will be marked as Settled.')) {
      return;
    }
    setSettlementLoading(true);
    try {
      const data = await apiFetch(`/expenses/settlement/${selectedDriverIdForSettlement}/settle`, {
        method: 'POST'
      });
      setSettlementData(data);
      fetchExpenses();
      alert('Settlement successfully finalized and processed!');
    } catch (err: any) {
      alert(err.message || 'Settlement finalization failed');
    } finally {
      setSettlementLoading(false);
    }
  };

  // KPI Calculations
  const totalClaimed = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved' || e.status === 'settled').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const totalSettled = expenses.filter(e => e.status === 'settled').reduce((acc, curr) => acc + curr.amount, 0);

  const getCategoryBadge = (category: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      toll: { label: 'Toll & FASTag', color: '#00f2fe' },
      food_allowance: { label: 'Food Allowance', color: '#10b981' },
      lodging: { label: 'Lodging & Stay', color: '#8b5cf6' },
      fuel_out_of_pocket: { label: 'Emergency Fuel', color: '#f59e0b' },
      maintenance_emergency: { label: 'Emergency Repair', color: '#ef4444' },
      other: { label: 'Other Misc', color: '#94a3b8' }
    };
    const cat = labels[category] || { label: category, color: '#94a3b8' };
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: `${cat.color}15`,
          color: cat.color,
          border: `1px solid ${cat.color}30`
        }}
      >
        {cat.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Approved</span>;
      case 'settled':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>Settled</span>;
      case 'rejected':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Rejected</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Pending Review</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={22} color="var(--accent-cyan)" />
            Driver Expense Reimbursements & Allowance Settlement
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Log trip allowances, review driver expense claims, and execute automated payout settlements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowSettlementModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CreditCard size={15} /> Driver Settlement Sheet
          </button>

          <button
            onClick={() => setShowLogModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-cyan)',
              border: 'none',
              color: '#000',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <PlusCircle size={15} /> Log New Expense
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-dim)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Total Expenses Claimed</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>₹{totalClaimed.toFixed(2)}</div>
        </div>

        <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> Pending Approval
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>₹{totalPending.toFixed(2)}</div>
        </div>

        <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> Approved & Payable
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>₹{totalApproved.toFixed(2)}</div>
        </div>

        <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: '12px', color: '#60a5fa', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckSquare size={14} /> Settled & Paid Out
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#60a5fa' }}>₹{totalSettled.toFixed(2)}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-dim)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Filter size={14} /> Filters:
        </div>

        <select
          value={driverFilter}
          onChange={e => setDriverFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#18181b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '12px' }}
        >
          <option value="all">All Drivers</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#18181b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '12px' }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="settled">Settled</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#18181b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '12px' }}
        >
          <option value="all">All Categories</option>
          <option value="toll">Toll & FASTag</option>
          <option value="food_allowance">Food Allowance</option>
          <option value="lodging">Lodging & Stay</option>
          <option value="fuel_out_of_pocket">Emergency Fuel</option>
          <option value="maintenance_emergency">Emergency Repair</option>
          <option value="other">Other Misc</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div style={{ borderRadius: '12px', border: '1px solid var(--border-dim)', overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading expense claims...</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No expense records found matching current filters.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-dim)' }}>
                <th style={{ padding: '12px 16px' }}>ID</th>
                <th style={{ padding: '12px 16px' }}>Driver</th>
                <th style={{ padding: '12px 16px' }}>Trip ID</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Amount (₹)</th>
                <th style={{ padding: '12px 16px' }}>Receipt #</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>#{exp.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff' }}>
                    {exp.driver_name || `Driver #${exp.driver_id}`}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {exp.trip_id ? `#${exp.trip_id}` : 'General Shift'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{getCategoryBadge(exp.category)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>
                    ₹{exp.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {exp.receipt_number || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(exp.status)}
                    {exp.rejection_reason && (
                      <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>
                        Reason: {exp.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {exp.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleApproveExpense(exp.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={12} /> Approve
                        </button>

                        <button
                          onClick={() => setRejectExpenseId(exp.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ef4444',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log New Expense Modal */}
      {showLogModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-dim)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '24px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={18} color="var(--accent-cyan)" /> Log Driver Trip Expense
            </h3>

            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Select Driver *</label>
                <select
                  value={newDriverId}
                  onChange={e => setNewDriverId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone || 'No phone'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Category *</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="toll">Toll & FASTag</option>
                    <option value="food_allowance">Food Allowance</option>
                    <option value="lodging">Lodging & Stay</option>
                    <option value="fuel_out_of_pocket">Emergency Fuel</option>
                    <option value="maintenance_emergency">Emergency Repair</option>
                    <option value="other">Other Misc</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 350.00"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Trip ID (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 101"
                    value={newTripId}
                    onChange={e => setNewTripId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Receipt / Txn #</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-998822"
                    value={newReceipt}
                    onChange={e => setNewReceipt(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Details regarding the expense claim..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--accent-cyan)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                >
                  {actionLoading ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectExpenseId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-dim)', borderRadius: '14px', width: '100%', maxWidth: '400px', padding: '24px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} /> Reject Expense Claim #{rejectExpenseId}
            </h3>

            <form onSubmit={handleRejectExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Receipt unreadable, unauthorized route stay..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRejectExpenseId(null)}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Settlement Breakdown Modal */}
      {showSettlementModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-dim)', borderRadius: '14px', width: '100%', maxWidth: '580px', padding: '24px', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="var(--accent-cyan)" /> Driver Allowance & Net Settlement
              </h3>
              <button
                onClick={() => setShowSettlementModal(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Select Driver</label>
              <select
                value={selectedDriverIdForSettlement}
                onChange={e => handleFetchSettlement(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#09090b', border: '1px solid var(--border-dim)', color: '#fff', fontSize: '13px' }}
              >
                <option value="">-- Select Driver to View Statement --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.phone || 'No phone'})</option>
                ))}
              </select>
            </div>

            {settlementLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Calculating settlement statement...</div>
            ) : settlementData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Statement Summary Card */}
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(0, 242, 254, 0.04)', border: '1px solid rgba(0, 242, 254, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Completed Trips Count:</span>
                    <strong style={{ color: '#fff' }}>{settlementData.total_trips_completed} trips</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Trip Earnings / Fares:</span>
                    <strong style={{ color: '#fff' }}>₹{settlementData.base_trip_earnings.toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Approved Reimbursements (+):</span>
                    <strong style={{ color: '#10b981' }}>+ ₹{settlementData.approved_expenses_amount.toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Settled Reimbursements:</span>
                    <strong style={{ color: '#60a5fa' }}>₹{settlementData.settled_expenses_amount.toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pending Claims (?):</span>
                    <strong style={{ color: '#f59e0b' }}>₹{settlementData.pending_expenses_amount.toFixed(2)}</strong>
                  </div>

                  <hr style={{ borderColor: 'var(--border-dim)', margin: '6px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Net Settlement Payout:</span>
                    <strong style={{ color: 'var(--accent-cyan)', fontSize: '18px' }}>₹{settlementData.net_settlement_payout.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Finalize Action */}
                <button
                  onClick={handleFinalizeSettlement}
                  disabled={settlementData.approved_expenses_amount === 0}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: settlementData.approved_expenses_amount > 0 ? '#10b981' : 'rgba(255,255,255,0.1)',
                    color: settlementData.approved_expenses_amount > 0 ? '#000' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: settlementData.approved_expenses_amount > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckSquare size={16} />
                  {settlementData.approved_expenses_amount > 0
                    ? `Finalize & Settle ₹${settlementData.approved_expenses_amount.toFixed(2)} Approved Claims`
                    : 'No Pending Approved Claims to Settle'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
