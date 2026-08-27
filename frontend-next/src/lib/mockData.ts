import {
  Driver,
  Trip,
  Vehicle,
  FuelLog,
  FuelTheftAlert,
  PodDocument,
  Invoice,
  FASTagLog,
  EsgMetrics,
  DetentionRecord,
} from './types';

export const INITIAL_DRIVERS: Driver[] = [
  { id: 1, name: 'Rajesh Kumar', phone: '+91 98765 43210', license_number: 'DL-04201912345', status: 'active', safety_score: 98, total_trips: 142, experience_years: 6 },
  { id: 2, name: 'Vikram Singh', phone: '+91 98765 43211', license_number: 'DL-04201912346', status: 'on_duty', safety_score: 94, total_trips: 98, experience_years: 4 },
  { id: 3, name: 'Amit Sharma', phone: '+91 98765 43212', license_number: 'MH-12202054321', status: 'active', safety_score: 96, total_trips: 215, experience_years: 8 },
  { id: 4, name: 'Suresh Patil', phone: '+91 98765 43213', license_number: 'KA-01202198765', status: 'off_duty', safety_score: 89, total_trips: 74, experience_years: 3 },
  { id: 5, name: 'Priya Nair', phone: '+91 98765 43214', license_number: 'KL-07202211223', status: 'on_duty', safety_score: 99, total_trips: 62, experience_years: 5 },
];

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: 1, license_plate: 'MH-12-PQ-8890', make: 'Tata Motors', model: 'Prima 5530.S', year: 2023, capacity_tons: 28, fuel_capacity_liters: 400, status: 'active', odometer_km: 45210, insurance_expiry: '2027-03-15', fitness_expiry: '2027-01-20' },
  { id: 2, license_plate: 'KA-01-MJ-4321', make: 'Ashok Leyland', model: 'AVTR 3520', year: 2022, capacity_tons: 22, fuel_capacity_liters: 350, status: 'active', odometer_km: 68400, insurance_expiry: '2026-11-10', fitness_expiry: '2026-09-05' },
  { id: 3, license_plate: 'DL-01-AB-1234', make: 'Eicher', model: 'Pro 6028', year: 2024, capacity_tons: 18, fuel_capacity_liters: 300, status: 'active', odometer_km: 12500, insurance_expiry: '2027-06-30', fitness_expiry: '2027-05-12' },
  { id: 4, license_plate: 'HR-26-DQ-9911', make: 'BharatBenz', model: '3523R', year: 2021, capacity_tons: 25, fuel_capacity_liters: 380, status: 'maintenance', odometer_km: 112000, insurance_expiry: '2026-08-15', fitness_expiry: '2026-08-01' },
];

export const INITIAL_TRIPS: Trip[] = [
  { id: 101, driver_id: 1, vehicle_id: 1, driver_name: 'Rajesh Kumar', vehicle_plate: 'MH-12-PQ-8890', origin: 'Mumbai Port Hub', destination: 'Delhi Logistics Center', status: 'EN_ROUTE', planned_distance_km: 1420, eta: '2026-08-01 14:00', freight_rate_inr: 85000, cargo_weight_kg: 24500 },
  { id: 102, driver_id: 2, vehicle_id: 2, driver_name: 'Vikram Singh', vehicle_plate: 'KA-01-MJ-4321', origin: 'Bengaluru Industrial Area', destination: 'Chennai Port Yard', status: 'EN_ROUTE', planned_distance_km: 350, eta: '2026-07-31 22:30', freight_rate_inr: 28000, cargo_weight_kg: 18200 },
  { id: 103, driver_id: 3, vehicle_id: 3, driver_name: 'Amit Sharma', vehicle_plate: 'DL-01-AB-1234', origin: 'Pune Cargo Freight Terminal', destination: 'Ahmedabad Warehouse', status: 'DISPATCHED', planned_distance_km: 660, eta: '2026-08-01 08:00', freight_rate_inr: 45000, cargo_weight_kg: 15000 },
  { id: 104, driver_id: 4, vehicle_id: 4, driver_name: 'Suresh Patil', vehicle_plate: 'HR-26-DQ-9911', origin: 'Hyderabad Logistics Hub', destination: 'Nagpur Depot', status: 'DELIVERED', planned_distance_km: 500, eta: '2026-07-30 18:00', freight_rate_inr: 36000, cargo_weight_kg: 22000 },
];

export const INITIAL_FUEL_THEFT_ALERTS: FuelTheftAlert[] = [
  { id: 1, vehicle_id: 1, detected_at: '2026-07-31 03:14:22', location: 'NH-48 Highway Service Plaza (Km 340)', fuel_lost_liters: 45.5, confidence_score: 94.2, severity: 'HIGH', status: 'PENDING', notes: 'Abnormal fuel level drop detected while ignition was OFF.' },
  { id: 2, vehicle_id: 4, detected_at: '2026-07-30 21:40:05', location: 'Nagpur Bypass Parking Lot', fuel_lost_liters: 62.0, confidence_score: 98.7, severity: 'CRITICAL', status: 'INVESTIGATING', notes: 'Fuel sensor mismatch during overnight driver break.' },
];

export const INITIAL_FASTAG_LOGS: FASTagLog[] = [
  { id: 1, vehicle_id: 1, vehicle_plate: 'MH-12-PQ-8890', toll_plaza_name: 'Khed Shivapur Toll Plaza (MH)', amount_inr: 340, timestamp: '2026-07-31 10:15', status: 'CHARGED' },
  { id: 2, vehicle_id: 1, vehicle_plate: 'MH-12-PQ-8890', toll_plaza_name: 'Talegaon Toll Plaza (MH)', amount_inr: 215, timestamp: '2026-07-31 08:30', status: 'CHARGED' },
  { id: 3, vehicle_id: 2, vehicle_plate: 'KA-01-MJ-4321', toll_plaza_name: 'Attibele Toll Plaza (KA-TN border)', amount_inr: 180, timestamp: '2026-07-31 11:45', status: 'DISCREPANCY' },
];

export const INITIAL_POD_DOCS: PodDocument[] = [
  { id: 1, trip_id: 104, document_type: 'Signed Proof of Delivery', file_url: '/pod_receipt_104.pdf', parsed_text: 'Received in good condition. Consignee: Amazon Logistics Ltd. Items: 120 Crates.', ocr_confidence: 96.5, receiver_name: 'Manish Verma', receiver_signature: true, status: 'VERIFIED', uploaded_at: '2026-07-30 18:30' },
  { id: 2, trip_id: 101, document_type: 'Weight Scale Ticket', file_url: '/pod_weight_101.png', parsed_text: 'Gross Wt: 38400 kg. Tare Wt: 13900 kg. Net Cargo Wt: 24500 kg.', ocr_confidence: 92.1, receiver_name: 'Pending Delivery', receiver_signature: false, status: 'PENDING', uploaded_at: '2026-07-31 07:15' },
];

export const INITIAL_INVOICES: Invoice[] = [
  { id: 1, trip_id: 104, invoice_number: 'INV-2026-0089', customer_name: 'Reliance Logistics Hub', amount_inr: 36000, tax_inr: 6480, total_amount_inr: 42480, created_at: '2026-07-30', due_date: '2026-08-15', status: 'UNPAID' },
  { id: 2, trip_id: 101, invoice_number: 'INV-2026-0090', customer_name: 'Tata Steel Distribution', amount_inr: 85000, tax_inr: 15300, total_amount_inr: 100300, created_at: '2026-07-31', due_date: '2026-08-30', status: 'UNPAID' },
];

export const INITIAL_ESG_METRICS: EsgMetrics = {
  total_co2_kg: 18450,
  ev_fleet_percentage: 15.4,
  carbon_offset_trees: 920,
  fuel_efficiency_avg: 4.25,
};

export const INITIAL_DETENTION_RECORDS: DetentionRecord[] = [
  { id: 1, trip_id: 102, location_name: 'Chennai Port Gate 3', arrival_time: '2026-07-31 09:00', free_time_hours: 2, detention_hours: 3.5, rate_per_hour_inr: 500, total_detention_fee_inr: 1750 },
];
