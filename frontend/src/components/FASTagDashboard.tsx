import React, { useEffect, useState } from "react";
import { CreditCard, AlertTriangle, RefreshCw, DollarSign, ArrowUpRight, Search, PlusCircle, CheckCircle, Clock } from "lucide-react";
import { RazorpayButton } from "./RazorpayButton";

interface Props {
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

interface TollLog {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  trip_id: number | null;
  toll_plaza_name: string;
  highway_name: string | null;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  toll_date: string;
}

interface VehicleSummaryItem {
  vehicle_id: number;
  license_plate: string;
  make_model: string;
  total_toll_spend: number;
  transaction_count: number;
  toll_logs: TollLog[];
}

interface FleetTollSummary {
  total_fleet_toll_spend: number;
  total_fastag_spend: number;
  total_cash_spend: number;
  total_transactions: number;
  vehicle_summaries: VehicleSummaryItem[];
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  odometer_km: number;
  status: string;
  fasttag_balance: number;
  assigned_driver_name?: string | null;
}

export const FASTagDashboard: React.FC<Props> = ({ apiFetch }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tollSummary, setTollSummary] = useState<FleetTollSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "low" | "ok">("all");

  // Recharge Modal state
  const [showRechargeModal, setShowRechargeModal] = useState<Vehicle | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>("");
  const [recharging, setRecharging] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch vehicles list (to get fasttag balances)
      const dataVehicles = await apiFetch("/vehicles/");

      // 2. Fetch toll logs and summary
      const dataTolls = await apiFetch("/vehicles/tolls/summary");

      setVehicles(dataVehicles);
      setTollSummary(dataTolls);
    } catch (err: any) {
      setError(err.message || "Failed to load FASTag telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRechargeModal) return;

    const amountNum = parseFloat(rechargeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setActionError("Please enter a valid positive amount");
      return;
    }

    setRecharging(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiFetch(`/vehicles/${showRechargeModal.id}/fasttag-recharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });

      const result = res;
      setActionSuccess(result.message || `Successfully recharged ₹${amountNum.toFixed(2)}`);
      
      // Update local vehicle state immediately to reflect new balance
      setVehicles(prev => prev.map(v => 
        v.id === showRechargeModal.id 
          ? { ...v, fasttag_balance: v.fasttag_balance + amountNum } 
          : v
      ));

      setRechargeAmount("");
      
      // Hide modal after a brief delay
      setTimeout(() => {
        setShowRechargeModal(null);
        setActionSuccess(null);
        fetchData(); // Trigger full refresh to update expenditures
      }, 1500);

    } catch (err: any) {
      setActionError(err.message || "Recharge failed. Please try again.");
    } finally {
      setRecharging(false);
    }
  };

  // Compile statistics
  const lowBalanceCount = vehicles.filter(v => v.fasttag_balance < 500).length;
  const totalFleetTollSpend = tollSummary?.total_fleet_toll_spend || 0;
  const totalTransactionsCount = tollSummary?.total_transactions || 0;

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = 
      v.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const isLow = v.fasttag_balance < 500;
    const matchesBalance = 
      balanceFilter === "all" ? true :
      balanceFilter === "low" ? isLow : !isLow;

    return matchesSearch && matchesBalance;
  });

  // Extract all toll logs sorted by date
  const allTollLogs: (TollLog & { license_plate: string; make_model: string })[] = [];
  if (tollSummary?.vehicle_summaries) {
    tollSummary.vehicle_summaries.forEach(vs => {
      vs.toll_logs.forEach(log => {
        allTollLogs.push({
          ...log,
          license_plate: vs.license_plate,
          make_model: vs.make_model
        });
      });
    });
  }
  allTollLogs.sort((a, b) => new Date(b.toll_date).getTime() - new Date(a.toll_date).getTime());

  if (loading && vehicles.length === 0) {
    return (
      <div className="content-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ fontSize: '13px' }}>Loading fleet FASTag wallets & toll telemetry...</p>
        </div>
      </div>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <div className="alert alert-warning" style={{
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        color: 'var(--accent-red)',
        padding: '16px 20px',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{error}</span>
        <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header bar */}
      <div className="content-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 750, color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="var(--accent-cyan)" />
            ⚡ FASTag Smart Wallet Hub
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time toll balances, warning threshold monitoring, and express recharges.
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} />
          Sync Balances
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="metric-label">Total Toll Expenditures</div>
          <div className="metric-value" style={{ color: '#fff' }}>
            ₹{totalFleetTollSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <div className="metric-label">Active Wallet Accounts</div>
          <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
            {vehicles.length} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>trucks</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: lowBalanceCount > 0 ? '3px solid var(--accent-red)' : '3px solid var(--border-color)' }}>
          <div className="metric-label">Low Balance Warnings</div>
          <div className="metric-value" style={{ color: lowBalanceCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
            {lowBalanceCount} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>below ₹500</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="metric-label">Total Toll Crossings</div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            {totalTransactionsCount} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>scans</span>
          </div>
        </div>
      </div>

      {/* Main Filter and Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', alignItems: 'center' }}>
        {/* Toggle filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setBalanceFilter("all")}
            className={`btn ${balanceFilter === "all" ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: '11px', padding: '6px 12px' }}
          >
            All Wallets
          </button>
          <button
            onClick={() => setBalanceFilter("low")}
            className={`btn ${balanceFilter === "low" ? "btn-primary" : "btn-secondary"}`}
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              color: balanceFilter !== "low" && lowBalanceCount > 0 ? 'var(--accent-red)' : '',
              borderColor: balanceFilter !== "low" && lowBalanceCount > 0 ? 'rgba(239, 68, 68, 0.2)' : ''
            }}
          >
            Low Balance ({lowBalanceCount})
          </button>
          <button
            onClick={() => setBalanceFilter("ok")}
            className={`btn ${balanceFilter === "ok" ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: '11px', padding: '6px 12px' }}
          >
            Healthy Balance ({vehicles.length - lowBalanceCount})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search license plate, model, driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-select"
            style={{ paddingLeft: '32px', width: '100%', height: '34px', fontSize: '12px' }}
          />
        </div>
      </div>

      {/* Split Workspace Layout */}
      <div className="layout-split" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '24px' }}>
        
        {/* Left Column: Vehicles Balance Grid */}
        <div className="content-panel" style={{ padding: 0 }}>
          <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="panel-title" style={{ color: '#fff', margin: 0 }}>
              🚚 Fleet FASTag Wallets List
            </h3>
          </div>

          <div className="table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Vehicle Details</th>
                  <th>Assigned Driver</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>FASTag Balance</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '36px' }}>
                      No matching vehicles or balances found.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map(vehicle => {
                    const isLow = vehicle.fasttag_balance < 500;
                    return (
                      <tr key={vehicle.id} style={{ borderLeft: isLow ? '4px solid var(--accent-red)' : 'none' }}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: '#fff' }}>{vehicle.license_plate}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{vehicle.make} {vehicle.model} ({vehicle.year})</span>
                          </div>
                        </td>
                        <td>
                          {vehicle.assigned_driver_name ? (
                            <span style={{ color: 'var(--text-main)', fontSize: '12.5px' }}>👤 {vehicle.assigned_driver_name}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${vehicle.status === 'active' ? 'available' : vehicle.status === 'maintenance' ? 'assigned' : 'on_trip'}`}>
                            {vehicle.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isLow ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ color: 'var(--accent-red)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} />
                                ₹{vehicle.fasttag_balance.toFixed(2)}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--accent-red)', fontWeight: 600, letterSpacing: '0.05em' }}>LOW BALANCE</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                              ₹{vehicle.fasttag_balance.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setShowRechargeModal(vehicle);
                              setRechargeAmount("");
                              setActionError(null);
                              setActionSuccess(null);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <PlusCircle size={12} />
                            Recharge
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Toll Crossings Feed */}
        <div className="content-panel" style={{ padding: 0 }}>
          <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="panel-title" style={{ color: '#fff', margin: 0 }}>
              🕒 Recent Toll Plaza Crossings
            </h3>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '550px', overflowY: 'auto' }}>
            {allTollLogs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                No recent toll transactions recorded.
              </div>
            ) : (
              allTollLogs.map((log, index) => {
                const isFastag = log.payment_method.toLowerCase() === "fastag";
                return (
                  <div
                    key={log.id || index}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s hover',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '13px', color: '#fff' }}>{log.toll_plaza_name}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({log.highway_name || 'Highway'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.license_plate}</span>
                        <span>•</span>
                        <span>{new Date(log.toll_date).toLocaleString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: isFastag ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>
                        ₹{log.amount.toFixed(2)}
                      </span>
                      <span
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: isFastag ? 'rgba(102, 252, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: isFastag ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {log.payment_method}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recharge Modal Dialog */}
      {showRechargeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="content-panel" style={{
            width: '420px',
            padding: '24px',
            border: '1px solid var(--accent)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                ⚡ Recharge FASTag Wallet
              </h3>
              <button
                onClick={() => setShowRechargeModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vehicle Plate:</span>
                <strong style={{ fontSize: '12.5px', color: '#fff' }}>{showRechargeModal.license_plate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Model:</span>
                <span style={{ fontSize: '12px', color: '#fff' }}>{showRechargeModal.make} {showRechargeModal.model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Balance:</span>
                <strong style={{
                  fontSize: '13px',
                  color: showRechargeModal.fasttag_balance < 500 ? 'var(--accent-red)' : 'var(--accent-green)'
                }}>
                  ₹{showRechargeModal.fasttag_balance.toFixed(2)}
                </strong>
              </div>
            </div>

            <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Recharge Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 500, 1000, 2000"
                  required
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="form-select"
                  style={{ height: '38px', padding: '8px 12px', fontSize: '13px' }}
                />
              </div>

              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {["500", "1000", "2000", "5000"].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRechargeAmount(amt)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, padding: '6px 0', fontSize: '11px' }}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              {/* Success / Error Feedbacks */}
              {actionSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontSize: '12px', backgroundColor: 'rgba(69,242,72,0.06)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(69,242,72,0.15)' }}>
                  <CheckCircle size={14} />
                  <span>{actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-red)', fontSize: '12px', backgroundColor: 'rgba(239,68,68,0.06)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <AlertTriangle size={14} />
                  <span>{actionError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowRechargeModal(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '40px' }}
                >
                  Cancel
                </button>
                <div style={{ flex: 1 }}>
                  <RazorpayButton
                    apiFetch={apiFetch}
                    amount={parseFloat(rechargeAmount) || 0}
                    vehicleId={showRechargeModal.id}
                    label="Complete Payment"
                    description={`FASTag Recharge for ${showRechargeModal.license_plate}`}
                    onSuccess={(res: any) => {
                      setActionSuccess(res.message || "Recharged successfully!");
                      // Update local vehicle state immediately
                      setVehicles(prev => prev.map(v => 
                        v.id === showRechargeModal.id 
                          ? { ...v, fasttag_balance: res.new_fasttag_balance ?? (v.fasttag_balance + parseFloat(rechargeAmount)) } 
                          : v
                      ));
                      setRechargeAmount("");
                      setTimeout(() => {
                        setShowRechargeModal(null);
                        setActionSuccess(null);
                        fetchData();
                      }, 1500);
                    }}
                    onError={(err: string) => {
                      setActionError(err);
                    }}
                    disabled={!rechargeAmount || parseFloat(rechargeAmount) <= 0}
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
