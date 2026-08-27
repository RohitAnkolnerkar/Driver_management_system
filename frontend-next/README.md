# Driver & Fleet Management System — Next.js Frontend (`frontend-next`)

This is the Next.js (App Router) frontend application for the **Driver & Fleet Management System**, operating alongside the original Vite frontend (`frontend/`).

## Tech Stack & Features

- **Framework**: Next.js 14+ App Router (`src/app/`)
- **Language**: TypeScript with strict typing
- **Design & Styling**: Premium Dark Mode Theme with Glassmorphism, CSS variables, Lucide icons
- **Telemetry & Maps**: Leaflet / React-Leaflet with dark tile rendering
- **Analytics & Data**: Recharts for revenue, cost & fuel analytics
- **Backend Connectivity**: Native integration with FastAPI backend endpoints (`http://localhost:8000`)

## Modules Included

1. **Dashboard Overview (`/`)**: Executive KPI statistics, active load dispatch map, revenue/expense trends, dynamic pricing calculator, and high-priority fuel theft feed.
2. **Trips & Live GPS Tracking (`/trips`)**: Real-time vehicle telematics, route geometry, dispatch modal, and cancellation compliance audit.
3. **Drivers & Payroll (`/drivers`)**: Commercial license verification, driver safety scores, profile editor modal, and driver payroll center.
4. **Fleet Vehicles & FASTag (`/vehicles`)**: Compliance matrix (insurance/fitness countdowns), vehicle TCO, and FASTag toll plaza reconciliation table.
5. **Fuel & Theft Audit (`/fuel`)**: Fuel logs and real-time fuel theft anomaly detection feed with dispute management.
6. **Proof of Delivery & OCR (`/pod`)**: Drag-and-drop OCR document processor, receiver signature parsing, and POD gallery.
7. **Finance & Razorpay (`/finance`)**: Monthly gross revenue, freight invoices, GST tax audit, and Razorpay payout trigger.
8. **Maintenance, Detention & ESG (`/maintenance`)**: Predictive maintenance, loading bay detention fee clock, and corporate carbon offset metrics.

## Running Locally

1. **Start Backend FastAPI App** (from root directory):
   ```bash
   uvicorn app.main:app --reload
   ```

2. **Start Next.js Dev Server** (from `frontend-next` directory):
   ```bash
   cd frontend-next
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
