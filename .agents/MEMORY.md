# Workspace Memory & Technical Reference

> **Repository**: Driver & Fleet Management System (`Driver_dashboard`)  
> **Last Updated**: July 31, 2026  

---

## 1. Project Overview

The **Driver & Fleet Management System** is an enterprise-grade platform designed for managing driver profiles, fleet vehicles, trip dispatches, fuel monitoring & theft detection, Proof of Delivery (POD) processing with OCR, FASTag toll reconciliation, driver payouts/payroll, and financial metrics.

---

## 2. Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: SQLite (`app.db`) with SQLAlchemy ORM
- **Migrations**: Alembic (`alembic/`)
- **Authentication**: JWT tokens (OAuth2 password bearer flow)
- **Logging & Observability**: Production-grade logging with `X-Request-ID` correlation ID middleware
- **PDF Generation**: ReportLab (`app/core/pdf.py`)
- **Email Services**: SMTP integration (`app/core/email.py`)
- **Testing**: Pytest (`tests/`)

### Frontend
- **Framework**: React 18 with TypeScript (Vite)
- **Styling**: Vanilla CSS / Tailwind utilities, dark mode, glassmorphism, responsive UI
- **Icons**: `lucide-react`
- **Mapping**: Leaflet / React-Leaflet (Dark Mode map rendering, real-time GPS tracking)
- **Charts**: Recharts (`recharts`)
- **Payments**: Razorpay integration (`app/api/payments_razorpay.py`)

#### Frontend (Dual Stack Supported)
1. **Original Vite App (`frontend/`)**: React 18 + TypeScript + Vite.
2. **Next.js App Router App (`frontend-next/`)**: Next.js 14+ with App Router, TypeScript, Tailwind CSS, Glassmorphism design system, Lucide icons, Leaflet dark maps, and Recharts.

---

## 3. Architecture & Code Structure

```
Driver_dashboard/
├── alembic/                    # Database migration scripts
├── app/                        # Backend FastAPI Application
├── frontend/                   # Original Vite React + TypeScript App (Preserved)
├── frontend-next/              # Enterprise Next.js App Router Application
│   ├── src/
│   │   ├── app/                # Next.js App Router Pages & Layouts
│   │   │   ├── layout.tsx      # Root Layout with Glassmorphism Shell
│   │   │   ├── page.tsx        # Dashboard Overview
│   │   │   ├── trips/          # Trips & Live Telematics Dispatch
│   │   │   ├── drivers/        # Driver Roster & Payroll
│   │   │   ├── vehicles/       # Fleet Compliance & FASTag Toll Audit
│   │   │   ├── fuel/           # Fuel Monitoring & Theft Alerts
│   │   │   ├── pod/            # Proof of Delivery & OCR Center
│   │   │   ├── finance/        # Finance & Razorpay Integration
│   │   │   └── maintenance/    # Maintenance, Detention Clock & ESG
│   │   ├── components/         # Reusable Dark Theme Components & Modals
│   │   └── lib/                # API Client Layer (`api.ts`), Types & Mock Data
├── tests/                      # Automated test suite
└── .agents/                    # Workspace agent rules & memory files
```

---

## 4. Key Capabilities & Recent Features

1. **Enterprise Next.js Application (`frontend-next`)**:
   - Production-grade App Router UI connected to FastAPI backend.
   - Glassmorphism design system, live map telemetry, Recharts analytics, and full modal workflows (Intelligent Dispatch, Cancellation Audit, Driver Modal, OCR Uploader, Razorpay Gateway).

2. **Production Logging & Correlation IDs**:
   - HTTP request middleware tracks incoming requests with UUID correlation IDs (`X-Request-ID`), binding them to context variables for structured logs.

3. **Real-time GPS & Geofencing**:
   - Live Leaflet map rendering with dark tiles, driver position markers, geofence arrival detection, and route geometries.

4. **Proof of Delivery (POD) & OCR**:
   - Receipt and document upload system connected to automated OCR parsing (`app/api/ocr.py`).

5. **Trip Cancellation & Audit Logging**:
   - Structured modal for trip cancellations with detailed audit logging for compliance.

6. **Financial & Payout Hub**:
   - Razorpay payment integration, driver payroll center, FASTag toll audit, dynamic pricing calculator, and expense reimbursement workflow.

---

## 5. Quick Commands & Developer Workflow

- **Backend Dev Server**: `uvicorn app.main:app --reload`
- **Next.js Dev Server**: `cd frontend-next && npm run dev`
- **Original Vite Dev Server**: `cd frontend && npm run dev`
- **Run Unit Tests**: `pytest`
- **Database Migration**: `alembic upgrade head`
- **Seed Initial Data**: `python seed_data.py`
