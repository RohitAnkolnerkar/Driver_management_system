import React, { useEffect, useState } from 'react';
import { DollarSign, CreditCard, FileText, CheckCircle2, Clock, Zap, Search, Filter, Printer, X, AlertTriangle, Fuel, HandCoins } from 'lucide-react';

export interface DriverPayment {
  id: number;
  driver_id: number;
  year: number;
  month: number;
  base_salary_paid: number;
  commission_paid: number;
  bonus: number;
  deductions: number;
  advance_payment: number;
  personal_fuel_expense: number;
  total_paid: number;
  status: string;
  paid_at?: string | null;
  payment_method?: string | null;
  note?: string | null;
  driver_name?: string;
  driver_phone?: string;
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  base_salary: number;
  status: string;
}

interface DriverPayrollCenterProps {
  token: string;
  apiFetch: (url: string, options?: any) => Promise<any>;
}

export const DriverPayrollCenter: React.FC<DriverPayrollCenterProps> = ({ apiFetch }) => {
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Settle Payout Modal State
  const [settleModalPayment, setSettleModalPayment] = useState<DriverPayment | null>(null);
  const [payoutBonus, setPayoutBonus] = useState<number>(0);
  const [payoutDeductions, setPayoutDeductions] = useState<number>(0);
  const [payoutAdvance, setPayoutAdvance] = useState<number>(0);
  const [payoutPersonalFuel, setPayoutPersonalFuel] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<string>('Bank Transfer (IMPS/NEFT)');
  const [payoutNote, setPayoutNote] = useState<string>('');
  const [settling, setSettling] = useState<boolean>(false);

  // Advance Disbursement Modal State
  const [showAdvanceModal, setShowAdvanceModal] = useState<boolean>(false);
  const [advanceDriverId, setAdvanceDriverId] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceNote, setAdvanceNote] = useState<string>('');
  const [submittingAdvance, setSubmittingAdvance] = useState<boolean>(false);

  // Personal Fuel Modal State
  const [showPersonalFuelModal, setShowPersonalFuelModal] = useState<boolean>(false);
  const [personalFuelDriverId, setPersonalFuelDriverId] = useState<string>('');
  const [personalFuelCost, setPersonalFuelCost] = useState<string>('');
  const [personalFuelNote, setPersonalFuelNote] = useState<string>('');
  const [submittingPersonalFuel, setSubmittingPersonalFuel] = useState<boolean>(false);

  // Payslip Modal State
  const [payslipData, setPayslipData] = useState<any | null>(null);

  const fetchPayrollData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsData, driversData] = await Promise.all([
        apiFetch(`/drivers/payments?year=${selectedYear}&month=${selectedMonth}`),
        apiFetch('/drivers/'),
      ]);
      setPayments(paymentsData || []);
      setDrivers(driversData || []);
    } catch (err: any) {
      console.error('Failed to load driver payroll data:', err);
      setError(err.message || 'Failed to load payroll data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollData();
  }, [selectedYear, selectedMonth]);

  const handleGenerateBulkPayroll = async () => {
    if (!drivers || drivers.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      for (const d of drivers) {
        try {
          await apiFetch(`/drivers/${d.id}/payments/generate`, {
            method: 'POST',
            body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
          });
        } catch (err) {
          // ignore duplicate generation errors
        }
      }
      await fetchPayrollData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate monthly payroll.');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSettleModal = (payment: DriverPayment) => {
    setSettleModalPayment(payment);
    setPayoutBonus(payment.bonus || 0);
    setPayoutDeductions(payment.deductions || 0);
    setPayoutAdvance(payment.advance_payment || 0);
    setPayoutPersonalFuel(payment.personal_fuel_expense || 0);
    setPayoutMethod(payment.payment_method || 'Bank Transfer (IMPS/NEFT)');
    setPayoutNote(payment.note || '');
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalPayment) return;

    setSettling(true);
    try {
      const payload = {
        bonus: Number(payoutBonus),
        deductions: Number(payoutDeductions),
        advance_payment: Number(payoutAdvance),
        personal_fuel_expense: Number(payoutPersonalFuel),
        payment_method: payoutMethod,
        note: payoutNote || `Payroll settled for ${selectedMonth}/${selectedYear}`,
        status: 'paid',
      };

      await apiFetch(`/drivers/payments/${settleModalPayment.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSettleModalPayment(null);
      await fetchPayrollData();
    } catch (err: any) {
      alert(`Failed to settle payout: ${err.message}`);
    } finally {
      setSettling(false);
    }
  };

  const handleDisburseAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceDriverId || !advanceAmount) return;

    setSubmittingAdvance(true);
    try {
      const driverIdNum = parseInt(advanceDriverId);
      const amt = parseFloat(advanceAmount);

      // Find or generate payment draft for selected period
      let existingRecord: DriverPayment | null = payments.find(p => p.driver_id === driverIdNum) || null;
      if (!existingRecord) {
        existingRecord = await apiFetch(`/drivers/${driverIdNum}/payments/generate`, {
          method: 'POST',
          body: JSON.stringify({ year: selectedYear, month: selectedMonth })
        });
      }

      if (!existingRecord) return;

      const newAdvanceVal = (existingRecord.advance_payment || 0) + amt;
      await apiFetch(`/drivers/payments/${existingRecord.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          advance_payment: newAdvanceVal,
          note: advanceNote ? `Advance: ${advanceNote}` : existingRecord.note
        })
      });

      setShowAdvanceModal(false);
      setAdvanceAmount('');
      setAdvanceNote('');
      await fetchPayrollData();
    } catch (err: any) {
      alert(`Failed to record salary advance: ${err.message}`);
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const handleLogPersonalFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalFuelDriverId || !personalFuelCost) return;

    setSubmittingPersonalFuel(true);
    try {
      const driverIdNum = parseInt(personalFuelDriverId);
      const costVal = parseFloat(personalFuelCost);

      let existingRecord: DriverPayment | null = payments.find(p => p.driver_id === driverIdNum) || null;
      if (!existingRecord) {
        existingRecord = await apiFetch(`/drivers/${driverIdNum}/payments/generate`, {
          method: 'POST',
          body: JSON.stringify({ year: selectedYear, month: selectedMonth })
        });
      }

      if (!existingRecord) return;

      const newFuelVal = (existingRecord.personal_fuel_expense || 0) + costVal;
      await apiFetch(`/drivers/payments/${existingRecord.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          personal_fuel_expense: newFuelVal,
          note: personalFuelNote ? `Personal Fuel: ${personalFuelNote}` : existingRecord.note
        })
      });

      setShowPersonalFuelModal(false);
      setPersonalFuelCost('');
      setPersonalFuelNote('');
      await fetchPayrollData();
    } catch (err: any) {
      alert(`Failed to log personal fuel expense: ${err.message}`);
    } finally {
      setSubmittingPersonalFuel(false);
    }
  };

  const handleViewPayslip = async (paymentId: number) => {
    try {
      const data = await apiFetch(`/drivers/payments/${paymentId}/payslip`);
      setPayslipData(data);
    } catch (err: any) {
      alert(`Failed to fetch payslip details: ${err.message}`);
    }
  };

  const getDriverDetails = (driverId: number) => {
    return drivers.find(d => d.id === driverId);
  };

  // Filtered payments
  const filteredPayments = payments.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const dr = getDriverDetails(p.driver_id);
      const name = (p.driver_name || dr?.name || '').toLowerCase();
      const phone = (p.driver_phone || dr?.phone || '').toLowerCase();
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  // Calculate KPIs
  const totalPayrollSpend = filteredPayments.reduce((acc, p) => acc + (p.total_paid > 0 ? p.total_paid : (p.base_salary_paid + p.commission_paid + p.bonus - p.deductions - (p.advance_payment || 0) - (p.personal_fuel_expense || 0))), 0);
  const totalAdvancesSum = filteredPayments.reduce((acc, p) => acc + (p.advance_payment || 0), 0);
  const totalPersonalFuelSum = filteredPayments.reduce((acc, p) => acc + (p.personal_fuel_expense || 0), 0);
  const paidPayments = filteredPayments.filter(p => p.status === 'paid');
  const pendingPayments = filteredPayments.filter(p => p.status === 'pending');
  const totalPaidSum = paidPayments.reduce((acc, p) => acc + p.total_paid, 0);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading) {
    return (
      <div className="content-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>💳</div>
        <div>Loading driver earnings & advance ledger records...</div>
      </div>
    );
  }

  return (
    <div className="content-panel" style={{ padding: '24px', margin: 0 }}>
      {/* Header */}
      <div className="panel-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="panel-title" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <DollarSign size={22} />
            Driver Earnings, Salary Advances & Personal Fuel Board
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Track driver monthly earnings, disburse salary advances, audit personal fuel usage, and settle net monthly payouts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <HandCoins size={15} color="var(--accent-amber)" />
            💸 Issue Cash Advance
          </button>

          <button
            onClick={() => setShowPersonalFuelModal(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Fuel size={15} color="var(--accent-red)" />
            ⛽ Log Personal Fuel
          </button>

          <button
            onClick={handleGenerateBulkPayroll}
            disabled={generating}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={15} />
            {generating ? 'Computing...' : `⚡ Generate ${monthNames[selectedMonth - 1]} Payroll`}
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontSize: '18px' }}>💰</div>
          <div className="metric-label">Net Fleet Payroll Spend</div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '20px' }}>
            ₹{totalPayrollSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.04)' }}>
          <div style={{ fontSize: '18px' }}>🟢</div>
          <div className="metric-label">Disbursed Settlements ({paidPayments.length})</div>
          <div className="metric-value" style={{ color: '#22c55e', fontSize: '20px' }}>
            ₹{totalPaidSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <div style={{ fontSize: '18px' }}>💸</div>
          <div className="metric-label">Salary Advances Issued</div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '20px' }}>
            ₹{totalAdvancesSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.04)' }}>
          <div style={{ fontSize: '18px' }}>⛽</div>
          <div className="metric-label">Personal Fuel Expenses</div>
          <div className="metric-value" style={{ color: 'var(--accent-red)', fontSize: '20px' }}>
            ₹{totalPersonalFuelSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-dim)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          <Filter size={14} /> Audit Filters:
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</label>
          <select
            className="form-select"
            style={{ padding: '5px 10px', fontSize: '12px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">⏳ Pending Payout</option>
            <option value="paid">🟢 Paid / Settled</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <Search size={14} color="var(--text-secondary)" />
          <input
            type="text"
            className="form-input"
            style={{ padding: '5px 10px', fontSize: '12px', width: '190px' }}
            placeholder="Search driver..."
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

      {/* Driver Financial Ledger Table */}
      {filteredPayments.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px dashed var(--border-dim)', color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0 }}>No payroll records found for {monthNames[selectedMonth - 1]} {selectedYear}. Click "Generate Payroll" to compute driver salaries.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px' }}>Driver Profile</th>
                <th style={{ padding: '10px' }}>Base Salary</th>
                <th style={{ padding: '10px' }}>Commissions</th>
                <th style={{ padding: '10px' }}>Bonus</th>
                <th style={{ padding: '10px' }}>Advances (Deduction)</th>
                <th style={{ padding: '10px' }}>Personal Fuel (Deduction)</th>
                <th style={{ padding: '10px' }}>Net Payable</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => {
                const dr = getDriverDetails(p.driver_id);
                const dName = p.driver_name || dr?.name || `Driver #${p.driver_id}`;
                const dPhone = p.driver_phone || dr?.phone || '';

                const calculatedNet = p.total_paid > 0 ? p.total_paid : (p.base_salary_paid + p.commission_paid + p.bonus - p.deductions - (p.advance_payment || 0) - (p.personal_fuel_expense || 0));
                const isPaid = p.status === 'paid';

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{dName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dPhone}</div>
                    </td>

                    <td style={{ padding: '10px', color: '#fff' }}>
                      ₹{p.base_salary_paid.toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '10px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      +₹{p.commission_paid.toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '10px', color: p.bonus > 0 ? '#22c55e' : 'var(--text-secondary)' }}>
                      {p.bonus > 0 ? `+₹${p.bonus.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    <td style={{ padding: '10px', color: p.advance_payment > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)', fontWeight: p.advance_payment > 0 ? 600 : 400 }}>
                      {p.advance_payment > 0 ? `-₹${p.advance_payment.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    <td style={{ padding: '10px', color: p.personal_fuel_expense > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: p.personal_fuel_expense > 0 ? 600 : 400 }}>
                      {p.personal_fuel_expense > 0 ? `-₹${p.personal_fuel_expense.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    <td style={{ padding: '10px', color: '#22c55e', fontWeight: 800, fontSize: '13.5px' }}>
                      ₹{calculatedNet.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '10px' }}>
                      {isPaid ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '11.5px', fontWeight: 600 }}>
                          <CheckCircle2 size={13} /> Paid
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '11.5px', fontWeight: 600 }}>
                          <Clock size={13} /> Pending
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {!isPaid && (
                          <button
                            onClick={() => handleOpenSettleModal(p)}
                            className="btn btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'var(--accent-cyan)', color: '#000', fontWeight: 700, border: 'none' }}
                          >
                            <CreditCard size={12} /> Settle
                          </button>
                        )}
                        <button
                          onClick={() => handleViewPayslip(p.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          <FileText size={12} /> Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Disburse Cash Advance */}
      {showAdvanceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--accent-amber)', margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HandCoins size={20} /> Disburse Driver Cash Advance
              </h3>
              <button onClick={() => setShowAdvanceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDisburseAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Driver *</label>
                <select
                  className="form-select"
                  required
                  value={advanceDriverId}
                  onChange={e => setAdvanceDriverId(e.target.value)}
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Cash Advance Amount (₹) *</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  className="form-input"
                  placeholder="e.g. 5000"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Disbursement Reason / Reference Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Emergency medical advance / En-route allowance"
                  value={advanceNote}
                  onChange={e => setAdvanceNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingAdvance} className="btn btn-primary" style={{ backgroundColor: 'var(--accent-amber)', color: '#000', fontWeight: 700 }}>
                  {submittingAdvance ? 'Disbursing...' : 'Confirm Cash Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Log Personal Fuel Expense */}
      {showPersonalFuelModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--accent-red)', margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Fuel size={20} /> Log Driver Personal Fuel Expense
              </h3>
              <button onClick={() => setShowPersonalFuelModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLogPersonalFuel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Driver *</label>
                <select
                  className="form-select"
                  required
                  value={personalFuelDriverId}
                  onChange={e => setPersonalFuelDriverId(e.target.value)}
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Personal Refueling Amount (₹) *</label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  required
                  className="form-input"
                  placeholder="e.g. 1200"
                  value={personalFuelCost}
                  onChange={e => setPersonalFuelCost(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Personal Refuel Note / Vehicle Details</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Personal two-wheeler / Non-commercial trip fill"
                  value={personalFuelNote}
                  onChange={e => setPersonalFuelNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowPersonalFuelModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPersonalFuel} className="btn btn-primary" style={{ backgroundColor: 'var(--accent-red)', color: '#fff', fontWeight: 700 }}>
                  {submittingPersonalFuel ? 'Recording...' : 'Log Personal Fuel Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Settle Driver Payout */}
      {settleModalPayment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '540px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--accent-cyan)', margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} /> Settle Driver Earnings Payout
              </h3>
              <button onClick={() => setSettleModalPayment(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{settleModalPayment.driver_name || `Driver #${settleModalPayment.driver_id}`}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Period: {monthNames[settleModalPayment.month - 1]} {settleModalPayment.year} • Base: ₹{settleModalPayment.base_salary_paid} • Commissions: +₹{settleModalPayment.commission_paid}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Performance Bonus (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={payoutBonus}
                    onChange={e => setPayoutBonus(Number(e.target.value))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Other Deductions (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={payoutDeductions}
                    onChange={e => setPayoutDeductions(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Salary Advance Issued (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={payoutAdvance}
                    onChange={e => setPayoutAdvance(Number(e.target.value))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Personal Fuel Expense (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="form-input"
                    value={payoutPersonalFuel}
                    onChange={e => setPayoutPersonalFuel(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value)}
                >
                  <option value="Bank Transfer (IMPS/NEFT)">🏦 Direct Bank Transfer (IMPS / NEFT)</option>
                  <option value="UPI Payment">📱 Instant UPI Transfer (GPay / PhonePe)</option>
                  <option value="Company Cheque">📜 Company Cheque</option>
                  <option value="Cash Disbursement">💵 Cash Disbursement</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Transaction Ref ID / Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UTR-99882234102 / Net Payout Settled"
                  value={payoutNote}
                  onChange={e => setPayoutNote(e.target.value)}
                />
              </div>

              {/* Net payable calculation preview */}
              <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Final Net Payable Salary:</span>
                <strong style={{ fontSize: '18px', color: '#22c55e' }}>
                  ₹{(settleModalPayment.base_salary_paid + settleModalPayment.commission_paid + payoutBonus - payoutDeductions - payoutAdvance - payoutPersonalFuel).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setSettleModalPayment(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={settling} className="btn btn-primary" style={{ backgroundColor: '#22c55e', color: '#000', fontWeight: 700 }}>
                  {settling ? 'Processing...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Digital Printable Payslip Viewer */}
      {payslipData && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '680px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Payslip Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={24} /> TAX FREIGHT FLEET MANAGEMENT
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Official Driver Earnings & Deductions Payslip</span>
              </div>
              <button onClick={() => setPayslipData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Printable Payslip Body */}
            <div id="printable-payslip" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Meta Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Driver Details</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{payslipData.driver_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Phone: {payslipData.driver_phone}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>DL: <code>{payslipData.license_number}</code></div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Payslip Reference</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '2px' }}>{payslipData.payslip_number}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pay Period: <strong>{payslipData.period_label}</strong></div>
                  <div style={{ fontSize: '12px', color: payslipData.status === 'paid' ? '#22c55e' : '#f59e0b', fontWeight: 700, marginTop: '4px' }}>
                    Status: {payslipData.status.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Itemized Earnings Table */}
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#22c55e', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
                  🟢 Itemized Earnings Breakdown
                </h4>
                <table className="dashboard-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipData.earnings_items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{item.category}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.description}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>+₹{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Itemized Deductions Table if applicable */}
              {payslipData.deductions_items && payslipData.deductions_items.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#ef4444', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
                    🔴 Deductions & Advance Recoveries
                  </h4>
                  <table className="dashboard-table" style={{ fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslipData.deductions_items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: '#fff' }}>{item.category}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{item.description}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>-₹{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Net Summary Box */}
              <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Net Disbursed Amount</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>
                    ₹{payslipData.net_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>Method: <strong>{payslipData.payment_method}</strong></div>
                  {payslipData.paid_at && <div>Paid On: {payslipData.paid_at}</div>}
                  {payslipData.note && <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>Ref: {payslipData.note}</div>}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-dim)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print Payslip
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPayslipData(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
