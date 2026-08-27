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
  DynamicPricingEstimate,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `req-next-${Date.now()}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[API Call Warning] Failed fetching ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth & User Management
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Request-ID': `req-next-auth-${Date.now()}`,
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed. Check credentials.');
    }

    return res.json() as Promise<{ access_token: string; token_type: string; role: string; username: string }>;
  },

  register: async (userData: { username: string; email: string; password: string; role: string; phone?: string }) => {
    const res = await fetch(`${API_BASE_URL}/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `req-next-reg-${Date.now()}`,
      },
      body: JSON.stringify(userData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed.');
    }

    return res.json();
  },

  getCurrentUser: (token: string) =>
    fetchApi<{ id: number; username: string; email: string; role: string }>('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Health
  getHealth: () => fetchApi<{ status: string; service: string }>('/health'),

  // Drivers
  getDrivers: () => fetchApi<Driver[]>('/drivers/'),
  getDriverById: (id: number) => fetchApi<Driver>(`/drivers/${id}`),
  createDriver: (data: Partial<Driver>) =>
    fetchApi<Driver>('/drivers/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDriver: (id: number, data: Partial<Driver>) =>
    fetchApi<Driver>(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Trips
  getTrips: () => fetchApi<Trip[]>('/trips/'),
  getTripById: (id: number) => fetchApi<Trip>(`/trips/${id}`),
  createTrip: (data: Partial<Trip>) =>
    fetchApi<Trip>('/trips/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelTrip: (id: number, reason: string, cancelledBy: string) =>
    fetchApi<Trip>(`/trips/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, cancelled_by: cancelledBy }),
    }),

  // Vehicles
  getVehicles: () => fetchApi<Vehicle[]>('/vehicles/'),
  createVehicle: (data: Partial<Vehicle>) =>
    fetchApi<Vehicle>('/vehicles/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // FASTag Tolls
  getFASTagLogs: () => fetchApi<FASTagLog[]>('/vehicles/fastag/logs'),

  // Fuel & Theft
  getFuelLogs: () => fetchApi<FuelLog[]>('/fuel/logs'),
  getFuelTheftAlerts: () => fetchApi<FuelTheftAlert[]>('/fuel-theft/alerts'),
  resolveFuelTheftAlert: (id: number, status: string, notes?: string) =>
    fetchApi<FuelTheftAlert>(`/fuel-theft/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // POD & OCR
  getPodDocuments: () => fetchApi<PodDocument[]>('/pod/documents'),
  processOcr: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/ocr/process`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('OCR upload failed');
    return res.json();
  },

  // Finance & Invoices
  getInvoices: () => fetchApi<Invoice[]>('/invoices/'),
  getFinanceSummary: () =>
    fetchApi<{ total_revenue: number; total_expenses: number; net_profit: number }>('/finance/summary'),

  // Dynamic Pricing
  calculatePricing: (origin: string, destination: string, weightKg: number) =>
    fetchApi<DynamicPricingEstimate>('/pricing/quote', {
      method: 'POST',
      body: JSON.stringify({ source: origin, destination, cargo_weight_kg: weightKg }),
    }),

  // ESG & Detention
  getEsgMetrics: () => fetchApi<EsgMetrics>('/esg/metrics'),
  getDetentionRecords: () => fetchApi<DetentionRecord[]>('/detention/records'),
};
