import React, { useState } from 'react';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react';

interface PricingQuote {
  source: string;
  destination: string;
  distance_km: number;
  cargo_weight_kg: number;
  cargo_type: string;
  vehicle_type: string;
  max_payload_kg: number;
  is_overweight?: boolean;
  overweight_warning?: string | null;
  base_tariff: number;
  distance_charge: number;
  weight_surcharge: number;
  cargo_hazard_surcharge: number;
  fuel_index_adjustment: number;
  demand_surge_multiplier: number;
  total_estimated_fare: number;
  estimated_fuel_cost: number;
  estimated_driver_commission: number;
  projected_gross_profit: number;
  projected_profit_margin_percent: number;
  breakdown_explanation: string;
}

const VEHICLE_MAX_PAYLOADS: Record<string, { label: string; max_kg: number }> = {
  mini_van: { label: '🚐 Mini Van', max_kg: 1000 },
  cargo_truck: { label: '🚚 Cargo Truck', max_kg: 3500 },
  heavy_hauler: { label: '🚛 Heavy Hauler', max_kg: 10000 },
  container_trailer: { label: '📦 Container Trailer', max_kg: 25000 },
};

interface DynamicPricingCalculatorProps {
  apiFetch: (url: string, options?: any) => Promise<any>;
  onApplyQuote?: (fare: number, details: PricingQuote) => void;
  defaultSource?: string;
  defaultDestination?: string;
  defaultDistance?: number;
}

export const DynamicPricingCalculator: React.FC<DynamicPricingCalculatorProps> = ({
  apiFetch,
  onApplyQuote,
  defaultSource = 'Mumbai Depot',
  defaultDestination = 'Pune Logistics Hub',
  defaultDistance = 150,
}) => {
  const [source, setSource] = useState(defaultSource);
  const [destination, setDestination] = useState(defaultDestination);
  const [distanceKm, setDistanceKm] = useState(defaultDistance);
  const [cargoWeightKg, setCargoWeightKg] = useState(1500);
  const [cargoType, setCargoType] = useState('standard');
  const [vehicleType, setVehicleType] = useState('cargo_truck');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<PricingQuote | null>(null);

  const currentVehicleSpec = VEHICLE_MAX_PAYLOADS[vehicleType] || VEHICLE_MAX_PAYLOADS.cargo_truck;
  const isFormOverweight = cargoWeightKg > currentVehicleSpec.max_kg;

  const handleCalculateQuote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!source || !destination) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          source,
          destination,
          distance_km: distanceKm > 0 ? Number(distanceKm) : null,
          cargo_weight_kg: Number(cargoWeightKg),
          cargo_type: cargoType,
          vehicle_type: vehicleType,
        }),
      });
      setQuote(res);
      if (res.distance_km) {
        setDistanceKm(res.distance_km);
      }
    } catch (err: any) {
      console.error('Failed to calculate pricing quote:', err);
      setError(err.message || 'Failed to calculate pricing quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-panel" style={{ padding: '24px', margin: 0 }}>
      <div className="panel-header" style={{ marginBottom: '20px' }}>
        <h2 className="panel-title" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calculator size={22} />
          Dynamic Freight Pricing & Demand Surge Calculator
        </h2>
      </div>

      <form onSubmit={handleCalculateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Source City / Location</label>
            <input
              type="text"
              className="form-input"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="e.g. Mumbai, Delhi, Chennai"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Destination City</label>
            <input
              type="text"
              className="form-input"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Pune, Jaipur, Bengaluru"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>Distance (KM)</label>
              <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>📍 Auto-Calculates if 0</span>
            </div>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="0 (Auto-Calculate)"
              className="form-input"
              value={distanceKm || ''}
              onChange={e => setDistanceKm(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>
              Cargo Weight (KG)
              <span style={{ fontSize: '11px', color: isFormOverweight ? '#f59e0b' : 'var(--text-secondary)', marginLeft: '6px' }}>
                (Max: {currentVehicleSpec.max_kg.toLocaleString()} kg)
              </span>
            </label>
            <input
              type="number"
              step="50"
              min="0"
              className="form-input"
              style={{ borderColor: isFormOverweight ? '#f59e0b' : undefined }}
              value={cargoWeightKg}
              onChange={e => setCargoWeightKg(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Vehicle Class & Max Payload Capacity</label>
            <select
              className="form-select"
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
            >
              <option value="mini_van">🚐 Mini Van (Max Payload: 1,000 kg | Base ₹500 + ₹18/km)</option>
              <option value="cargo_truck">🚚 Cargo Truck (Max Payload: 3,500 kg | Base ₹1,500 + ₹35/km)</option>
              <option value="heavy_hauler">🚛 Heavy Hauler (Max Payload: 10,000 kg | Base ₹3,000 + ₹65/km)</option>
              <option value="container_trailer">📦 Container Trailer (Max Payload: 25,000 kg | Base ₹5,000 + ₹90/km)</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Cargo Category / Hazard Level</label>
            <select
              className="form-select"
              value={cargoType}
              onChange={e => setCargoType(e.target.value)}
            >
              <option value="standard">📦 Standard Non-Hazardous Cargo (0% Surcharge)</option>
              <option value="perishable">🍎 Perishable / Cold-Chain (+15% Surcharge)</option>
              <option value="heavy_machinery">🏗️ Heavy Industrial Machinery (+20% Surcharge)</option>
              <option value="hazardous">⚠️ Dangerous Goods / Hazmat (+25% Surcharge)</option>
            </select>
          </div>
        </div>

        {/* Form Real-Time Overweight Capacity Warning Banner */}
        {isFormOverweight && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#f59e0b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Vehicle Payload Capacity Warning:</strong> Cargo weight (<strong>{cargoWeightKg.toLocaleString()} kg</strong>) exceeds maximum payload limit (<strong>{currentVehicleSpec.max_kg.toLocaleString()} kg</strong>) for <strong>{currentVehicleSpec.label}</strong>. An overweight capacity surcharge will apply; upgrading to a larger vehicle class is recommended.
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '12px', fontSize: '14px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          {loading ? 'Calculating Tariff Quote…' : '⚡ Calculate Dynamic Freight Tariff'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Pricing Output Cards */}
      {quote && (
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Output Overweight Alert */}
          {quote.is_overweight && (
            <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: '#fca5a5' }}>⚠️ Vehicle Overweight Capacity Warning (+20% Surcharge Applied)</strong>
                <span style={{ fontSize: '12.5px', color: '#fff' }}>
                  {quote.overweight_warning || `Cargo weight (${quote.cargo_weight_kg.toLocaleString()} kg) exceeds vehicle payload capacity (${quote.max_payload_kg.toLocaleString()} kg).`}
                </span>
              </div>
            </div>
          )}

          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
            <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.05)' }}>
              <div style={{ fontSize: '20px' }}>💰</div>
              <div className="metric-label">Estimated Dynamic Fare</div>
              <div className="metric-value" style={{ color: '#22c55e', fontSize: '24px' }}>
                ₹{quote.total_estimated_fare.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ fontSize: '20px' }}>⛽</div>
              <div className="metric-label">Est. Fuel Cost</div>
              <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '22px' }}>
                ₹{quote.estimated_fuel_cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ fontSize: '20px' }}>📈</div>
              <div className="metric-label">Gross Profit Margin</div>
              <div className="metric-value" style={{ color: quote.projected_profit_margin_percent >= 30 ? 'var(--accent-cyan)' : 'orange', fontSize: '22px' }}>
                {quote.projected_profit_margin_percent.toFixed(1)}%
              </div>
            </div>

            <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: quote.demand_surge_multiplier > 1.0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '20px' }}>⚡</div>
              <div className="metric-label">Fleet Demand Surge</div>
              <div className="metric-value" style={{ color: quote.demand_surge_multiplier > 1.0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: '22px' }}>
                {quote.demand_surge_multiplier}x
              </div>
            </div>
          </div>

          {/* Detailed Tariff Component Table */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dim)', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📋 Detailed Tariff Line-Item Breakdown
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Vehicle Tariff ({quote.vehicle_type.replace('_', ' ').toUpperCase()})</span>
                <strong style={{ color: '#fff' }}>₹{quote.base_tariff.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Mileage Rate ({quote.distance_km} km)</span>
                <strong style={{ color: '#ffffffff' }}>₹{quote.distance_charge.toFixed(2)}</strong>
              </div>
              {quote.weight_surcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                  <span style={{ color: quote.is_overweight ? '#f02121ff' : 'var(--accent-amber)' }}>
                    Weight Surcharge ({quote.cargo_weight_kg} kg {quote.is_overweight ? '• Overweight!' : ''})
                  </span>
                  <strong style={{ color: quote.is_overweight ? '#ef4444' : 'var(--accent-amber)' }}>
                    +₹{quote.weight_surcharge.toFixed(2)}
                  </strong>
                </div>
              )}
              {quote.fuel_index_adjustment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>Regional Fuel Price Index Adjustment</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>+₹{quote.fuel_index_adjustment.toFixed(2)}</strong>
                </div>
              )}
              {quote.cargo_hazard_surcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--accent-red)' }}>Cargo Hazard Category ({quote.cargo_type.toUpperCase()}) Surcharge</span>
                  <strong style={{ color: 'var(--accent-red)' }}>+₹{quote.cargo_hazard_surcharge.toFixed(2)}</strong>
                </div>
              )}
              {quote.demand_surge_multiplier > 1.0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-dim)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--accent-red)' }}>High Demand Surge Multiplier</span>
                  <strong style={{ color: 'var(--accent-red)' }}>{quote.demand_surge_multiplier}x</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '15px', fontWeight: 800 }}>
                <span style={{ color: '#fff' }}>Final Total Fare</span>
                <span style={{ color: '#22c55e' }}>₹{quote.total_estimated_fare.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
              💡 {quote.breakdown_explanation}
            </div>
          </div>

          {/* Action button if embedded in trip creation modal */}
          {onApplyQuote && (
            <button
              onClick={() => onApplyQuote(quote.total_estimated_fare, quote)}
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--accent-green)', color: '#000', fontWeight: 700 }}
            >
              <CheckCircle size={16} /> Apply Quote to Trip Creation (₹{quote.total_estimated_fare})
            </button>
          )}

        </div>
      )}
    </div>
  );
};
