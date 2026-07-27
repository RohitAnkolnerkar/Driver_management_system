import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.driver import Driver, DriverPayment
from app.models.expense import TripExpense
from app.models.fuel import FuelLog
from app.models.trip import Trip
from app.models.vehicle import MaintenanceLog, Vehicle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get("/dashboard-summary")
def get_finance_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    logger.info("Generating finance dashboard summary")
    # 1. Fetch completed trips
    completed_trips = db.query(Trip).filter(Trip.status == "completed").all()

    # Overall calculations
    overall_revenue = sum(float(t.estimated_fare or 0.0) for t in completed_trips)

    # Driver payments (actual payments in DB or fallback calculated commissions)
    actual_driver_payments = (
        db.query(func.sum(DriverPayment.total_paid)).scalar() or 0.0
    )
    calculated_commissions = sum(
        (float(t.estimated_fare or 0.0) * (t.driver.commission_percentage / 100.0))
        for t in completed_trips
        if t.driver
    )
    overall_driver_payments = (
        actual_driver_payments
        if actual_driver_payments > 0.0
        else calculated_commissions
    )

    overall_fuel = (
        db.query(func.sum(FuelLog.cost)).filter(FuelLog.is_personal == False).scalar()
        or 0.0
    )

    overall_tolls = (
        db.query(func.sum(TripExpense.amount))
        .filter(
            TripExpense.category == "toll",
            TripExpense.status.in_(["approved", "settled"]),
        )
        .scalar()
        or 0.0
    )

    overall_other_expenses = (
        db.query(func.sum(TripExpense.amount))
        .filter(
            TripExpense.category != "toll",
            TripExpense.status.in_(["approved", "settled"]),
        )
        .scalar()
        or 0.0
    )

    overall_maintenance = db.query(func.sum(MaintenanceLog.cost)).scalar() or 0.0

    overall_expenses = (
        overall_driver_payments
        + overall_fuel
        + overall_tolls
        + overall_other_expenses
        + overall_maintenance
    )
    overall_profit = overall_revenue - overall_expenses

    overall = {
        "revenue": round(overall_revenue, 2),
        "driver_payments": round(overall_driver_payments, 2),
        "fuel_expenses": round(overall_fuel, 2),
        "toll_expenses": round(overall_tolls, 2),
        "other_expenses": round(overall_other_expenses, 2),
        "maintenance_expenses": round(overall_maintenance, 2),
        "profit": round(overall_profit, 2),
    }

    # 2. Per-Trip Stats
    all_trips = db.query(Trip).order_by(Trip.created_at.desc()).all()
    trips_data = []
    for t in all_trips:
        is_completed = t.status == "completed"
        t_rev = float(t.estimated_fare or 0.0) if is_completed else 0.0

        t_driver_payment = 0.0
        if is_completed and t.driver:
            t_driver_payment = t_rev * (t.driver.commission_percentage / 100.0)

        t_fuel = (
            db.query(func.sum(FuelLog.cost))
            .filter(FuelLog.trip_id == t.id, FuelLog.is_personal == False)
            .scalar()
            or 0.0
        )

        t_toll = (
            db.query(func.sum(TripExpense.amount))
            .filter(
                TripExpense.trip_id == t.id,
                TripExpense.category == "toll",
                TripExpense.status.in_(["approved", "settled"]),
            )
            .scalar()
            or 0.0
        )

        t_other = (
            db.query(func.sum(TripExpense.amount))
            .filter(
                TripExpense.trip_id == t.id,
                TripExpense.category != "toll",
                TripExpense.status.in_(["approved", "settled"]),
            )
            .scalar()
            or 0.0
        )

        t_profit = t_rev - (t_driver_payment + t_fuel + t_toll + t_other)

        trips_data.append(
            {
                "trip_id": t.id,
                "source": t.source,
                "destination": t.destination,
                "driver_name": t.driver.name if t.driver else "Unassigned",
                "vehicle_plate": t.vehicle.license_plate if t.vehicle else "None",
                "status": t.status,
                "revenue": round(t_rev, 2),
                "driver_payment": round(t_driver_payment, 2),
                "fuel_expense": round(t_fuel, 2),
                "toll_expense": round(t_toll, 2),
                "other_expenses": round(t_other, 2),
                "profit": round(t_profit, 2),
                "date": (
                    t.end_time.isoformat()
                    if t.end_time
                    else (t.created_at.isoformat() if t.created_at else None)
                ),
            }
        )

    # 3. Per-Vehicle Stats
    vehicles = db.query(Vehicle).all()
    vehicles_data = []
    for v in vehicles:
        v_trips = [t for t in completed_trips if t.vehicle_id == v.id]
        v_rev = sum(float(t.estimated_fare or 0.0) for t in v_trips)
        v_driver_payment = sum(
            (float(t.estimated_fare or 0.0) * (t.driver.commission_percentage / 100.0))
            for t in v_trips
            if t.driver
        )

        # Fuel logs linked to vehicle's trips
        v_trip_ids = [t.id for t in v_trips]
        v_fuel = 0.0
        if v_trip_ids:
            v_fuel += (
                db.query(func.sum(FuelLog.cost))
                .filter(FuelLog.trip_id.in_(v_trip_ids), FuelLog.is_personal == False)
                .scalar()
                or 0.0
            )

        # Add unlinked fuel from assigned driver
        if v.assigned_driver:
            v_fuel += (
                db.query(func.sum(FuelLog.cost))
                .filter(
                    FuelLog.driver_id == v.assigned_driver.id,
                    FuelLog.trip_id.is_(None),
                    FuelLog.is_personal == False,
                )
                .scalar()
                or 0.0
            )

        v_toll = 0.0
        if v_trip_ids:
            v_toll += (
                db.query(func.sum(TripExpense.amount))
                .filter(
                    TripExpense.trip_id.in_(v_trip_ids),
                    TripExpense.category == "toll",
                    TripExpense.status.in_(["approved", "settled"]),
                )
                .scalar()
                or 0.0
            )

        v_maint = (
            db.query(func.sum(MaintenanceLog.cost))
            .filter(MaintenanceLog.vehicle_id == v.id)
            .scalar()
            or 0.0
        )

        v_other = 0.0
        if v_trip_ids:
            v_other += (
                db.query(func.sum(TripExpense.amount))
                .filter(
                    TripExpense.trip_id.in_(v_trip_ids),
                    TripExpense.category != "toll",
                    TripExpense.status.in_(["approved", "settled"]),
                )
                .scalar()
                or 0.0
            )

        v_profit = v_rev - (v_driver_payment + v_fuel + v_toll + v_maint + v_other)

        vehicles_data.append(
            {
                "vehicle_id": v.id,
                "license_plate": v.license_plate,
                "make_model": f"{v.make} {v.model}",
                "trips_completed": len(v_trips),
                "revenue": round(v_rev, 2),
                "driver_payments": round(v_driver_payment, 2),
                "fuel_expenses": round(v_fuel, 2),
                "toll_expenses": round(v_toll, 2),
                "maintenance_expenses": round(v_maint, 2),
                "other_expenses": round(v_other, 2),
                "profit": round(v_profit, 2),
            }
        )

    # 4. Per-Driver Stats
    drivers = db.query(Driver).all()
    drivers_data = []
    for d in drivers:
        d_trips = [t for t in completed_trips if t.driver_id == d.id]
        d_rev = sum(float(t.estimated_fare or 0.0) for t in d_trips)

        # Payouts paid
        d_paid = (
            db.query(func.sum(DriverPayment.total_paid))
            .filter(DriverPayment.driver_id == d.id)
            .scalar()
            or 0.0
        )
        if d_paid == 0.0:
            # Fallback to calculated commissions + base salary for trips
            d_paid = sum(
                (float(t.estimated_fare or 0.0) * (d.commission_percentage / 100.0))
                for t in d_trips
            )

        d_fuel = (
            db.query(func.sum(FuelLog.cost))
            .filter(FuelLog.driver_id == d.id, FuelLog.is_personal == False)
            .scalar()
            or 0.0
        )

        d_toll = (
            db.query(func.sum(TripExpense.amount))
            .filter(
                TripExpense.driver_id == d.id,
                TripExpense.category == "toll",
                TripExpense.status.in_(["approved", "settled"]),
            )
            .scalar()
            or 0.0
        )

        d_other = (
            db.query(func.sum(TripExpense.amount))
            .filter(
                TripExpense.driver_id == d.id,
                TripExpense.category != "toll",
                TripExpense.status.in_(["approved", "settled"]),
            )
            .scalar()
            or 0.0
        )

        d_profit = d_rev - (d_paid + d_fuel + d_toll + d_other)

        drivers_data.append(
            {
                "driver_id": d.id,
                "driver_name": d.name,
                "driver_phone": d.phone,
                "trips_completed": len(d_trips),
                "revenue": round(d_rev, 2),
                "driver_payments": round(d_paid, 2),
                "fuel_expenses": round(d_fuel, 2),
                "toll_expenses": round(d_toll, 2),
                "other_expenses": round(d_other, 2),
                "profit": round(d_profit, 2),
            }
        )

    return {
        "overall": overall,
        "trips": trips_data,
        "vehicles": vehicles_data,
        "drivers": drivers_data,
    }
