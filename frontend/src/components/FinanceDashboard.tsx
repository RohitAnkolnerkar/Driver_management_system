import React, { useEffect, useState } from "react";
import { DollarSign, Truck, User, MapPin, Search, Filter, RefreshCw } from "lucide-react";

export interface OverallSummary {
  revenue: number;
  driver_payments: number;
  fuel_expenses: number;
  toll_expenses: number;
  other_expenses: number;
  maintenance_expenses: number;
  profit: number;
}

export interface TripFinanceItem {
  trip_id: number;
  source: string;
  destination: string;
  driver_name: string;
  vehicle_plate: string;
  status: string;
  revenue: number;
  driver_payment: number;
  fuel_expense: number;
  toll_expense: number;
  other_expenses: number;
  profit: number;
  date: string | null;
}

export interface VehicleFinanceItem {
  vehicle_id: number;
  license_plate: string;
  make_model: string;
  trips_completed: number;
  revenue: number;
  driver_payments: number;
  fuel_expenses: number;
  toll_expenses: number;
  maintenance_expenses: number;
  other_expenses: number;
  profit: number;
}

export interface DriverFinanceItem {
  driver_id: number;
  driver_name: string;
  driver_phone: string;
  trips_completed: number;
  revenue: number;
  driver_payments: number;
  fuel_expenses: number;
  toll_expenses: number;
  other_expenses: number;
  profit: number;
}

export interface FinanceDashboardData {
  overall: OverallSummary;
  trips: TripFinanceItem[];
  vehicles: VehicleFinanceItem[];
  drivers: DriverFinanceItem[];
}

interface Props {
  token: string;
}

export const FinanceDashboard: React.FC<Props> = ({ token }) => {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [activeTab, setActiveTab] = useState<"overall" | "trips" | "vehicles" | "drivers">("overall");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchFinanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/finance/dashboard-summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch financial dashboard data (${res.status})`);
      }
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load financial summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFinanceData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="content-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ fontSize: '13px' }}>Calculating overall fleet financial metrics & costs...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
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
        <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{error || "Failed to load financial summary."}</span>
        <button onClick={fetchFinanceData} className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          Retry
        </button>
      </div>
    );
  }

  // Filter calculations based on searchQuery
  const filteredTrips = data.trips.filter(t => 
    t.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVehicles = data.vehicles.filter(v => 
    v.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.make_model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDrivers = data.drivers.filter(d => 
    d.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.driver_phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Refresh */}
      <div className="content-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 750, color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Executive Financial Dashboard & Analytics
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time tracking of operational revenue, driver payments, fuel/toll expenses, maintenance costs, and profits.
          </p>
        </div>
        <button onClick={fetchFinanceData} className="btn btn-primary" style={{ padding: '8px 16px', gap: '6px' }}>
          <RefreshCw size={13} />
          Refresh Financials
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            ₹{data.overall.revenue.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
          <div className="metric-label">Driver Payments</div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)' }}>
            ₹{data.overall.driver_payments.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="metric-label">Fuel Expenses</div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
            ₹{data.overall.fuel_expenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <div className="metric-label">Toll Expenses</div>
          <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
            ₹{data.overall.toll_expenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <div className="metric-label">Maintenance</div>
          <div className="metric-value" style={{ color: 'var(--accent-red)' }}>
            ₹{data.overall.maintenance_expenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid #a855f7' }}>
          <div className="metric-label">Other Expenses</div>
          <div className="metric-value" style={{ color: '#a855f7' }}>
            ₹{data.overall.other_expenses.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: `3px solid ${data.overall.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
          <div className="metric-label">Net Profit</div>
          <div className="metric-value" style={{ color: data.overall.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            ₹{data.overall.profit.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Main filter tabs & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', alignItems: 'center' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(["overall", "trips", "vehicles", "drivers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSearchQuery("");
              }}
              className={`btn ${activeTab === tab ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {tab === "overall" ? "🏢 Overall Overview" : tab === "trips" ? "📍 Per Trip" : tab === "vehicles" ? "🚚 Per Vehicle" : "👤 Per Driver"}
            </button>
          ))}
        </div>

        {/* Search input (hidden for overall overview) */}
        {activeTab !== "overall" && (
          <div style={{ position: 'relative', width: '240px', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-select"
              style={{ paddingLeft: '32px', width: '100%', height: '34px', fontSize: '12px' }}
            />
          </div>
        )}
      </div>

      {/* Dynamic Tab Views */}
      <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tab 1: Overall Overview */}
        {activeTab === "overall" && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Financial Structure Breakdown</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Detailed Lists */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>GROSS OPERATING REVENUE</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>₹{data.overall.revenue.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>DRIVER COMMISSIONS & SALARIES</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-amber)' }}>- ₹{data.overall.driver_payments.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>FUEL EXPENSES</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)' }}>- ₹{data.overall.fuel_expenses.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOLL EXPENSES</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-green)' }}>- ₹{data.overall.toll_expenses.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>MAINTENANCE COSTS</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-red)' }}>- ₹{data.overall.maintenance_expenses.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>OTHER OPERATIONS EXPENSES</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#a855f7' }}>- ₹{data.overall.other_expenses.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-light)', marginTop: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', display: 'block' }}>Total Net Profit</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Calculated as: Revenue - Total Operating Expenses</span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: data.overall.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                ₹{data.overall.profit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Per Trip Table */}
        {activeTab === "trips" && (
          <div className="table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Trip ID</th>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Driver Pay</th>
                  <th style={{ textAlign: 'right' }}>Fuel</th>
                  <th style={{ textAlign: 'right' }}>Toll</th>
                  <th style={{ textAlign: 'right' }}>Other</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => (
                  <tr key={trip.trip_id}>
                    <td style={{ fontWeight: 600 }}>#{trip.trip_id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={12} color="var(--text-muted)" />
                        <span style={{ fontWeight: 500, color: '#fff' }}>{trip.source}</span>
                        <span style={{ color: 'var(--text-muted)' }}>➔</span>
                        <span style={{ fontWeight: 500, color: '#fff' }}>{trip.destination}</span>
                      </div>
                    </td>
                    <td>{trip.driver_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{trip.vehicle_plate}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{trip.revenue.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>₹{trip.driver_payment.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>₹{trip.fuel_expense.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-green)' }}>₹{trip.toll_expense.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: '#a855f7' }}>₹{trip.other_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: trip.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ₹{trip.profit.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge badge-${trip.status === 'completed' ? 'available' : trip.status === 'cancelled' ? 'on_trip' : 'assigned'}`}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTrips.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      No matching trip financials found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Per Vehicle Table */}
        {activeTab === "vehicles" && (
          <div className="table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>License Plate</th>
                  <th>Model</th>
                  <th style={{ textAlign: 'center' }}>Completed Trips</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Driver Pay</th>
                  <th style={{ textAlign: 'right' }}>Fuel Expenses</th>
                  <th style={{ textAlign: 'right' }}>Toll Expenses</th>
                  <th style={{ textAlign: 'right' }}>Maintenance</th>
                  <th style={{ textAlign: 'right' }}>Other</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.vehicle_id}>
                    <td style={{ fontWeight: 600 }}>{vehicle.license_plate}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{vehicle.make_model}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{vehicle.trips_completed}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{vehicle.revenue.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>₹{vehicle.driver_payments.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>₹{vehicle.fuel_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-green)' }}>₹{vehicle.toll_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-red)' }}>₹{vehicle.maintenance_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: '#a855f7' }}>₹{vehicle.other_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: vehicle.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ₹{vehicle.profit.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      No matching vehicle financials found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Per Driver Table */}
        {activeTab === "drivers" && (
          <div className="table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'center' }}>Completed Trips</th>
                  <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                  <th style={{ textAlign: 'right' }}>Payout / Comm.</th>
                  <th style={{ textAlign: 'right' }}>Fuel Logs</th>
                  <th style={{ textAlign: 'right' }}>Toll Approved</th>
                  <th style={{ textAlign: 'right' }}>Other Approved</th>
                  <th style={{ textAlign: 'right' }}>Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => (
                  <tr key={driver.driver_id}>
                    <td style={{ fontWeight: 600 }}>{driver.driver_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{driver.driver_phone}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{driver.trips_completed}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{driver.revenue.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>₹{driver.driver_payments.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>₹{driver.fuel_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-green)' }}>₹{driver.toll_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: '#a855f7' }}>₹{driver.other_expenses.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: driver.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ₹{driver.profit.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      No matching driver financials found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
