export type DriverStatus = 'active' | 'on_duty' | 'off_duty' | 'suspended' | 'inactive';
export type TripStatus = 'DISPATCHED' | 'EN_ROUTE' | 'DELIVERED' | 'CANCELLED' | 'PENDING';
export type VehicleStatus = 'active' | 'maintenance' | 'idle' | 'decommissioned';
export type ExpenseCategory = 'FUEL' | 'TOLL' | 'MAINTENANCE' | 'MEALS' | 'LODGING' | 'MISC';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  license_number: string;
  status: DriverStatus;
  safety_score?: number;
  total_trips?: number;
  experience_years?: number;
  on_duty_since?: string;
  created_at?: string;
}

export interface Trip {
  id: number;
  driver_id: number;
  vehicle_id: number;
  origin: string;
  destination: string;
  status: TripStatus;
  planned_distance_km?: number;
  start_time?: string;
  end_time?: string;
  eta?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  geofence_arrival_time?: string;
  cargo_weight_kg?: number;
  freight_rate_inr?: number;
  driver_name?: string;
  vehicle_plate?: string;
}

export interface Vehicle {
  id: number;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  capacity_tons: number;
  fuel_capacity_liters: number;
  status: VehicleStatus;
  odometer_km: number;
  insurance_expiry?: string;
  fitness_expiry?: string;
  permit_expiry?: string;
}

export interface FuelLog {
  id: number;
  vehicle_id: number;
  trip_id?: number;
  driver_id?: number;
  liters: number;
  cost_per_liter: number;
  total_cost: number;
  odometer_reading: number;
  station_name: string;
  timestamp: string;
  receipt_url?: string;
}

export interface FuelTheftAlert {
  id: number;
  vehicle_id: number;
  trip_id?: number;
  detected_at: string;
  location: string;
  fuel_lost_liters: number;
  confidence_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'INVESTIGATING' | 'DISMISSED' | 'CONFIRMED';
  notes?: string;
}

export interface PodDocument {
  id: number;
  trip_id: number;
  document_type: string;
  file_url: string;
  parsed_text?: string;
  ocr_confidence?: number;
  receiver_name?: string;
  receiver_signature?: boolean;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  uploaded_at: string;
}

export interface Invoice {
  id: number;
  trip_id: number;
  invoice_number: string;
  customer_name: string;
  amount_inr: number;
  tax_inr: number;
  total_amount_inr: number;
  created_at: string;
  due_date: string;
  status: 'PAID' | 'UNPAID' | 'OVERDUE';
}

export interface FASTagLog {
  id: number;
  vehicle_id: number;
  toll_plaza_name: string;
  amount_inr: number;
  timestamp: string;
  status: 'CHARGED' | 'DISCREPANCY' | 'REFUNDED';
  vehicle_plate?: string;
}

export interface EsgMetrics {
  total_co2_kg: number;
  ev_fleet_percentage: number;
  carbon_offset_trees: number;
  fuel_efficiency_avg: number;
}

export interface DetentionRecord {
  id: number;
  trip_id: number;
  location_name: string;
  arrival_time: string;
  free_time_hours: number;
  detention_hours: number;
  rate_per_hour_inr: number;
  total_detention_fee_inr: number;
}

export interface DynamicPricingEstimate {
  source?: string;
  destination?: string;
  distance_km?: number;
  base_tariff?: number;
  fuel_index_adjustment?: number;
  total_estimated_fare?: number;
  base_rate_inr?: number;
  fuel_surcharge_inr?: number;
  total_estimated_rate_inr?: number;
}
