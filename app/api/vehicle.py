import logging
import re
from typing import List

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
from app.models.vehicle import MaintenanceLog, Vehicle, VehicleTollLog
from app.schemas.toll import (
    FleetTollSummaryResponse,
    VehicleTollCreate,
    VehicleTollResponse,
    VehicleTollSummaryItem,
)
from app.schemas.vehicle import (
    FleetTCOSummaryResponse,
    MaintenanceLogComplete,
    MaintenanceLogCreate,
    MaintenanceLogResponse,
    PredictiveMaintenanceResponse,
    VehicleCreate,
    VehicleDocumentOCRResponse,
    VehicleResponse,
    VehicleTCOResponse,
    VehicleUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def make_vehicle_response(vehicle: Vehicle, db: Session) -> VehicleResponse:
    latest_log = (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle.id)
        .order_by(MaintenanceLog.service_date.desc())
        .first()
    )

    next_service = None
    if latest_log:
        next_service = latest_log.next_service_due_odometer
        is_overdue = (next_service is not None) and (
            vehicle.odometer_km >= next_service
        )
    else:
        # Default first service alert at 10,000 km
        next_service = 10000.0
        is_overdue = vehicle.odometer_km >= next_service

    return VehicleResponse(
        id=vehicle.id,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        license_plate=vehicle.license_plate,
        odometer_km=vehicle.odometer_km,
        status=vehicle.status,
        vehicle_type=vehicle.vehicle_type,
        fasttag_balance=vehicle.fasttag_balance,
        created_at=vehicle.created_at,
        assigned_driver_id=(
            vehicle.assigned_driver.id if vehicle.assigned_driver else None
        ),
        assigned_driver_name=(
            vehicle.assigned_driver.name if vehicle.assigned_driver else None
        ),
        is_service_overdue=is_overdue,
        next_service_due_odometer=next_service,
    )


@router.get("/", response_model=List[VehicleResponse])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicles = db.query(Vehicle).order_by(Vehicle.id.asc()).all()
    return [make_vehicle_response(v, db) for v in vehicles]


@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    existing = (
        db.query(Vehicle)
        .filter(Vehicle.license_plate == vehicle_in.license_plate)
        .first()
    )
    if existing:
        logger.warning(
            f"Create vehicle failed: License plate '{vehicle_in.license_plate}' already exists"
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Vehicle with license plate {vehicle_in.license_plate} "
                f"already exists."
            ),
        )

    db_vehicle = Vehicle(
        make=vehicle_in.make,
        model=vehicle_in.model,
        year=vehicle_in.year,
        license_plate=vehicle_in.license_plate,
        odometer_km=vehicle_in.odometer_km,
        status=vehicle_in.status,
        vehicle_type=vehicle_in.vehicle_type,
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return make_vehicle_response(db_vehicle, db)


@router.get("/utilization-analytics")
def get_vehicles_utilization_analytics(
    period_days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    from datetime import timedelta

    from app.models.trip import Trip

    now = get_now_ist_naive()
    start_date = now - timedelta(days=period_days)
    total_hours = float(period_days * 24)

    vehicles = db.query(Vehicle).all()
    results = []

    for v in vehicles:
        trips = (
            db.query(Trip)
            .filter(
                Trip.vehicle_id == v.id,
                Trip.status.in_(["started", "completed"]),
                Trip.start_time >= start_date,
            )
            .all()
        )

        active_hours = 0.0
        mileage_accumulated = 0.0

        for trip in trips:
            t_start = trip.start_time
            t_end = trip.end_time or now

            i_start = max(t_start, start_date)  # type: ignore
            i_end = min(t_end, now)  # type: ignore

            if i_start < i_end:
                active_hours += (i_end - i_start).total_seconds() / 3600.0

            if trip.status == "completed" and trip.distance_km:
                mileage_accumulated += float(trip.distance_km)

        m_logs = (
            db.query(MaintenanceLog)
            .filter(
                MaintenanceLog.vehicle_id == v.id,
                MaintenanceLog.service_date >= start_date,
            )
            .all()
        )

        downtime_hours = 0.0
        for log in m_logs:
            l_start = log.service_date
            l_end = log.completed_at or now

            i_start = max(l_start, start_date)  # type: ignore
            i_end = min(l_end, now)  # type: ignore

            if i_start < i_end:
                downtime_hours += (i_end - i_start).total_seconds() / 3600.0

        idle_hours = max(0.0, total_hours - active_hours - downtime_hours)

        utilization_rate = 0.0
        if total_hours > 0:
            utilization_rate = round((active_hours / total_hours) * 100.0, 1)

        high_threshold = 2000.0 * (period_days / 30.0)
        medium_threshold = 800.0 * (period_days / 30.0)

        if mileage_accumulated >= high_threshold:
            wear_level = "high"
        elif mileage_accumulated >= medium_threshold:
            wear_level = "medium"
        else:
            wear_level = "low"

        results.append(
            {
                "vehicle_id": v.id,
                "make": v.make,
                "model": v.model,
                "license_plate": v.license_plate,
                "status": v.status,
                "active_hours": round(active_hours, 1),
                "downtime_hours": round(downtime_hours, 1),
                "idle_hours": round(idle_hours, 1),
                "utilization_rate": utilization_rate,
                "mileage_accumulated": round(mileage_accumulated, 1),
                "wear_alert_level": wear_level,
            }
        )

    return results


def calculate_vehicle_predictive_health(
    vehicle: Vehicle, db: Session
) -> PredictiveMaintenanceResponse:
    from datetime import timedelta

    from app.models.inspection import PreTripInspection
    from app.models.trip import Trip

    now = get_now_ist_naive()
    thirty_days_ago = now - timedelta(days=30)

    latest_log = (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle.id)
        .order_by(MaintenanceLog.service_date.desc())
        .first()
    )

    next_service = (
        latest_log.next_service_due_odometer
        if (latest_log and latest_log.next_service_due_odometer is not None)
        else 10000.0
    )
    is_overdue = vehicle.odometer_km >= next_service
    km_remaining = (
        max(0.0, float(next_service) - float(vehicle.odometer_km or 0.0))
        if not is_overdue
        else 0.0
    )

    trips_30d = (
        db.query(Trip)
        .filter(
            Trip.vehicle_id == vehicle.id,
            Trip.status == "completed",
            Trip.end_time >= thirty_days_ago,
        )
        .all()
    )
    total_km_30d = sum(float(t.distance_km or 0.0) for t in trips_30d)
    avg_daily_km = round(total_km_30d / 30.0, 1)

    est_days_remaining = None
    if is_overdue:
        est_days_remaining = 0.0
    elif avg_daily_km > 0:
        est_days_remaining = round(km_remaining / avg_daily_km, 1)

    failed_inspections = (
        db.query(PreTripInspection)
        .filter(
            PreTripInspection.vehicle_id == vehicle.id,
            PreTripInspection.is_safe.is_(False),
            PreTripInspection.created_at >= thirty_days_ago,
        )
        .count()
    )

    score = 100.0
    recommendations = []

    if is_overdue:
        score -= 35.0
        overdue_km = round(vehicle.odometer_km - next_service, 1)
        recommendations.append(
            f"Immediate service required! Overdue by {overdue_km} km."
        )
    elif km_remaining <= 500.0:
        score -= 15.0
        recommendations.append(f"Service due soon within {round(km_remaining, 1)} km.")

    if failed_inspections > 0:
        score -= min(30.0, failed_inspections * 10.0)
        recommendations.append(
            f"{failed_inspections} inspection failure(s) recorded in past 30 days."
        )

    age = now.year - vehicle.year
    if age >= 10:
        score -= 15.0
        recommendations.append(
            "High vehicle age (>= 10 years). Comprehensive check recommended."
        )
    elif age >= 7:
        score -= 10.0
        recommendations.append(
            "Vehicle age exceeds 7 years. Regular check recommended."
        )

    if vehicle.odometer_km >= 150000:
        score -= 10.0
        recommendations.append(
            "High cumulative odometer (> 150,000 km). Audit powertrain."
        )

    score = max(0.0, round(score, 1))

    if score < 50.0 or is_overdue:
        urgency = "CRITICAL"
    elif score < 75.0 or km_remaining <= 500.0:
        urgency = "WARNING"
    else:
        urgency = "GOOD"

    if not recommendations:
        recommendations.append("Vehicle in good operational health.")

    return PredictiveMaintenanceResponse(
        vehicle_id=vehicle.id,
        license_plate=vehicle.license_plate,
        make=vehicle.make,
        model=vehicle.model,
        health_score=score,
        urgency_status=urgency,
        is_service_overdue=is_overdue,
        odometer_km=vehicle.odometer_km,
        next_service_due_odometer=next_service,
        km_remaining=round(km_remaining, 1),
        avg_daily_km_30d=avg_daily_km,
        estimated_days_remaining=est_days_remaining,
        failed_inspections_count=failed_inspections,
        recommendations=recommendations,
    )


def calculate_vehicle_tco(vehicle: Vehicle, db: Session) -> VehicleTCOResponse:
    from app.models.fuel import FuelLog
    from app.models.trip import Trip

    m_logs = (
        db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == vehicle.id).all()
    )
    maint_cost = sum(float(log.cost or 0.0) for log in m_logs)

    trips = (
        db.query(Trip)
        .filter(Trip.vehicle_id == vehicle.id, Trip.status == "completed")
        .all()
    )
    total_km = sum(float(t.distance_km or 0.0) for t in trips)
    if total_km == 0 and vehicle.odometer_km > 0:
        total_km = float(vehicle.odometer_km)

    op_revenue = sum(float(t.estimated_fare or 0.0) for t in trips)

    trip_ids = [t.id for t in trips]
    fuel_cost = 0.0
    if trip_ids:
        f_logs = db.query(FuelLog).filter(FuelLog.trip_id.in_(trip_ids)).all()
        fuel_cost += sum(float(f.cost or 0.0) for f in f_logs)

    if vehicle.assigned_driver:
        unlinked_f_logs = (
            db.query(FuelLog)
            .filter(
                FuelLog.driver_id == vehicle.assigned_driver.id,
                FuelLog.trip_id.is_(None),
            )
            .all()
        )
        fuel_cost += sum(float(f.cost or 0.0) for f in unlinked_f_logs)

    total_operating_cost = fuel_cost + maint_cost
    net_profit = op_revenue - total_operating_cost

    cost_per_km = round(total_operating_cost / total_km, 2) if total_km > 0 else 0.0
    profit_per_km = round(net_profit / total_km, 2) if total_km > 0 else 0.0

    if cost_per_km > 25.0:
        rating = "HIGH_COST_MONEY_DRAINER"
    elif cost_per_km > 12.0:
        rating = "AVERAGE"
    else:
        rating = "EFFICIENT"

    return VehicleTCOResponse(
        vehicle_id=vehicle.id,
        license_plate=vehicle.license_plate,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        total_km_driven=round(total_km, 1),
        fuel_cost=round(fuel_cost, 2),
        maintenance_cost=round(maint_cost, 2),
        operational_revenue=round(op_revenue, 2),
        total_operating_cost=round(total_operating_cost, 2),
        net_profit_loss=round(net_profit, 2),
        cost_per_km=cost_per_km,
        profit_per_km=profit_per_km,
        efficiency_rating=rating,
    )


@router.get("/predictive-alerts", response_model=List[PredictiveMaintenanceResponse])
def get_fleet_predictive_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicles = db.query(Vehicle).all()
    reports = [calculate_vehicle_predictive_health(v, db) for v in vehicles]
    reports.sort(key=lambda r: (r.urgency_status != "CRITICAL", r.health_score))
    return reports


@router.get("/tco-summary", response_model=FleetTCOSummaryResponse)
def get_fleet_tco_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicles = db.query(Vehicle).all()
    vehicles_tco = [calculate_vehicle_tco(v, db) for v in vehicles]

    total_km = sum(v.total_km_driven for v in vehicles_tco)
    total_fuel = sum(v.fuel_cost for v in vehicles_tco)
    total_maint = sum(v.maintenance_cost for v in vehicles_tco)
    total_cost = sum(v.total_operating_cost for v in vehicles_tco)
    total_rev = sum(v.operational_revenue for v in vehicles_tco)
    net_profit = sum(v.net_profit_loss for v in vehicles_tco)
    avg_cost_km = round(total_cost / total_km, 2) if total_km > 0 else 0.0

    return FleetTCOSummaryResponse(
        total_vehicles=len(vehicles),
        fleet_total_km=round(total_km, 1),
        fleet_fuel_cost=round(total_fuel, 2),
        fleet_maintenance_cost=round(total_maint, 2),
        fleet_total_cost=round(total_cost, 2),
        fleet_total_revenue=round(total_rev, 2),
        fleet_net_profit=round(net_profit, 2),
        fleet_avg_cost_per_km=avg_cost_km,
        vehicles_tco=vehicles_tco,
    )


@router.get(
    "/{vehicle_id}/predictive-health",
    response_model=PredictiveMaintenanceResponse,
)
def get_vehicle_predictive_health(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        logger.warning(
            f"Get vehicle predictive health failed: Vehicle {vehicle_id} not found"
        )
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return calculate_vehicle_predictive_health(vehicle, db)


@router.get("/{vehicle_id}/tco", response_model=VehicleTCOResponse)
def get_vehicle_tco(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        logger.warning(f"Get vehicle TCO failed: Vehicle {vehicle_id} not found")
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return calculate_vehicle_tco(vehicle, db)


@router.get("/tolls/summary", response_model=FleetTollSummaryResponse)
def get_fleet_toll_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    start_date: str = Query(default=None),
    end_date: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    from calendar import monthrange
    from datetime import datetime

    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
            )
    else:
        now = get_now_ist_naive()
        y = year or now.year
        m = month or now.month
        _, last_day = monthrange(y, m)
        start_dt = datetime(y, m, 1, 0, 0, 0)
        end_dt = datetime(y, m, last_day, 23, 59, 59)

    vehicles = db.query(Vehicle).all()
    all_tolls = (
        db.query(VehicleTollLog)
        .filter(
            VehicleTollLog.toll_date >= start_dt, VehicleTollLog.toll_date <= end_dt
        )
        .order_by(VehicleTollLog.toll_date.desc())
        .all()
    )

    tolls_by_vehicle: dict[int, list[VehicleTollLog]] = {
        int(v.id): [] for v in vehicles
    }
    for t in all_tolls:
        if t.vehicle_id and int(t.vehicle_id) in tolls_by_vehicle:
            tolls_by_vehicle[int(t.vehicle_id)].append(t)

    vehicle_summaries = []
    total_fleet_spend = 0.0
    total_fastag_spend = 0.0
    total_cash_spend = 0.0

    for v in vehicles:
        v_tolls = tolls_by_vehicle.get(int(v.id), [])
        v_total = sum(t.amount for t in v_tolls)
        v_fastag = sum(
            t.amount for t in v_tolls if t.payment_method.lower() == "fastag"
        )
        v_cash = sum(t.amount for t in v_tolls if t.payment_method.lower() != "fastag")

        total_fleet_spend += v_total
        total_fastag_spend += v_fastag
        total_cash_spend += v_cash

        vehicle_summaries.append(
            VehicleTollSummaryItem(
                vehicle_id=v.id,
                make=v.make,
                model=v.model,
                license_plate=v.license_plate,
                total_toll_spend=round(v_total, 2),
                fastag_spend=round(v_fastag, 2),
                cash_spend=round(v_cash, 2),
                transaction_count=len(v_tolls),
                toll_logs=[VehicleTollResponse.model_validate(t) for t in v_tolls],
            )
        )

    return FleetTollSummaryResponse(
        period_start=start_dt.strftime("%Y-%m-%d"),
        period_end=end_dt.strftime("%Y-%m-%d"),
        total_fleet_toll_spend=round(total_fleet_spend, 2),
        total_fastag_spend=round(total_fastag_spend, 2),
        total_cash_spend=round(total_cash_spend, 2),
        total_transactions=len(all_tolls),
        vehicle_summaries=vehicle_summaries,
    )


@router.get("/compliance-alerts")
def get_vehicle_compliance_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    """
    Audits all vehicles for Insurance, Fitness, and PUC expiration dates.
    Generates persisted notifications for dispatchers/admins when papers are expired or expiring within 30 days,
    and returns a structured compliance audit report.
    """
    from app.models.notification import Notification

    vehicles = db.query(Vehicle).all()
    now = get_now_ist_naive()

    alerts = []
    summary = {
        "total_vehicles": len(vehicles),
        "critical_expired_count": 0,
        "warning_expiring_soon_count": 0,
        "compliant_count": 0,
    }

    for v in vehicles:
        vehicle_plate = v.license_plate
        v_issues = []

        if v.insurance_expiry_date:
            days_left = (v.insurance_expiry_date - now).days
            if days_left < 0:
                v_issues.append(
                    {
                        "paper": "Commercial Insurance",
                        "status": "EXPIRED",
                        "expiry_date": v.insurance_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "critical",
                        "message": f"Insurance EXPIRED {abs(days_left)} days ago on {v.insurance_expiry_date.strftime('%d/%m/%Y')}!",
                    }
                )
            elif days_left <= 30:
                v_issues.append(
                    {
                        "paper": "Commercial Insurance",
                        "status": "EXPIRING_SOON",
                        "expiry_date": v.insurance_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "warning",
                        "message": f"Insurance expires in {days_left} days ({v.insurance_expiry_date.strftime('%d/%m/%Y')}). Renew now!",
                    }
                )

        if v.fitness_expiry_date:
            days_left = (v.fitness_expiry_date - now).days
            if days_left < 0:
                v_issues.append(
                    {
                        "paper": "Fitness Certificate",
                        "status": "EXPIRED",
                        "expiry_date": v.fitness_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "critical",
                        "message": f"Fitness Certificate EXPIRED {abs(days_left)} days ago on {v.fitness_expiry_date.strftime('%d/%m/%Y')}!",
                    }
                )
            elif days_left <= 30:
                v_issues.append(
                    {
                        "paper": "Fitness Certificate",
                        "status": "EXPIRING_SOON",
                        "expiry_date": v.fitness_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "warning",
                        "message": f"Fitness Certificate expires in {days_left} days ({v.fitness_expiry_date.strftime('%d/%m/%Y')}). Schedule RTO inspection!",
                    }
                )

        if v.puc_expiry_date:
            days_left = (v.puc_expiry_date - now).days
            if days_left < 0:
                v_issues.append(
                    {
                        "paper": "PUC Certificate",
                        "status": "EXPIRED",
                        "expiry_date": v.puc_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "warning",
                        "message": f"PUC Certificate EXPIRED {abs(days_left)} days ago on {v.puc_expiry_date.strftime('%d/%m/%Y')}!",
                    }
                )
            elif days_left <= 30:
                v_issues.append(
                    {
                        "paper": "PUC Certificate",
                        "status": "EXPIRING_SOON",
                        "expiry_date": v.puc_expiry_date.strftime("%Y-%m-%d"),
                        "days_left": days_left,
                        "severity": "info",
                        "message": f"PUC Certificate expires in {days_left} days ({v.puc_expiry_date.strftime('%d/%m/%Y')}).",
                    }
                )

        if v_issues:
            has_critical = any(issue["severity"] == "critical" for issue in v_issues)
            if has_critical:
                summary["critical_expired_count"] += 1
            else:
                summary["warning_expiring_soon_count"] += 1

            for issue in v_issues:
                notif_msg = f"Vehicle {vehicle_plate}: {issue['message']}"
                existing_notif = (
                    db.query(Notification)
                    .filter(
                        Notification.message == notif_msg,
                        Notification.category == "compliance",
                    )
                    .first()
                )

                if not existing_notif:
                    db.add(
                        Notification(
                            title=f"Vehicle Paper Alert - {vehicle_plate}",
                            message=notif_msg,
                            severity=issue["severity"],
                            category="compliance",
                            is_read=False,
                            created_at=now,
                        )
                    )

            alerts.append(
                {
                    "vehicle_id": v.id,
                    "license_plate": v.license_plate,
                    "make": v.make,
                    "model": v.model,
                    "status": v.status,
                    "issues": v_issues,
                }
            )
        else:
            summary["compliant_count"] += 1

    db.commit()

    return {"summary": summary, "alerts": alerts}


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return make_vehicle_response(vehicle, db)


@router.patch("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle_in.license_plate and vehicle_in.license_plate != vehicle.license_plate:
        existing = (
            db.query(Vehicle)
            .filter(Vehicle.license_plate == vehicle_in.license_plate)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Vehicle with license plate {vehicle_in.license_plate} "
                    f"already exists."
                ),
            )

    update_data = vehicle_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)
    return make_vehicle_response(vehicle, db)


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Unassign vehicle from any drivers first to prevent foreign key
    # errors if set to cascade,
    # but we set nullable=True, so let's unassign them explicitly.
    drivers = db.query(Driver).filter(Driver.vehicle_id == vehicle_id).all()
    for driver in drivers:
        driver.vehicle_id = None

    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}


@router.get("/maintenance/all", response_model=List[MaintenanceLogResponse])
def get_all_maintenance_logs(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    return db.query(MaintenanceLog).order_by(MaintenanceLog.service_date.desc()).all()


@router.get("/{vehicle_id}/maintenance", response_model=List[MaintenanceLogResponse])
def get_maintenance_logs(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    logs = (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle_id)
        .order_by(MaintenanceLog.service_date.desc())
        .all()
    )
    return logs


@router.post(
    "/{vehicle_id}/maintenance",
    response_model=MaintenanceLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_maintenance_log(
    vehicle_id: int,
    log_in: MaintenanceLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if log_in.odometer_at_service > vehicle.odometer_km:
        vehicle.odometer_km = log_in.odometer_at_service

    s_date = log_in.service_date or get_now_ist_naive()
    c_date = log_in.completed_at

    db_log = MaintenanceLog(
        vehicle_id=vehicle_id,
        service_type=log_in.service_type,
        description=log_in.description,
        cost=log_in.cost or 0.0,
        odometer_at_service=log_in.odometer_at_service,
        service_date=s_date,
        completed_at=c_date,
        next_service_due_odometer=log_in.next_service_due_odometer,
    )

    if not c_date:
        vehicle.status = "maintenance"
    else:
        vehicle.status = "active"

    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


@router.patch("/maintenance/{log_id}/complete", response_model=MaintenanceLogResponse)
def complete_maintenance_log(
    log_id: int,
    complete_in: MaintenanceLogComplete,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    log = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    log.completed_at = get_now_ist_naive()
    log.cost = complete_in.cost
    if complete_in.description:
        log.description = complete_in.description
    if complete_in.next_service_due_odometer is not None:
        log.next_service_due_odometer = complete_in.next_service_due_odometer

    vehicle = db.query(Vehicle).filter(Vehicle.id == log.vehicle_id).first()
    if vehicle:
        open_logs = (
            db.query(MaintenanceLog)
            .filter(
                MaintenanceLog.vehicle_id == vehicle.id,
                MaintenanceLog.completed_at.is_(None),
                MaintenanceLog.id != log.id,
            )
            .count()
        )
        if open_logs == 0:
            vehicle.status = "active"

        if log.odometer_at_service > vehicle.odometer_km:
            vehicle.odometer_km = log.odometer_at_service

    db.commit()
    db.refresh(log)
    return log


@router.post("/{vehicle_id}/tolls", response_model=VehicleTollResponse)
def create_vehicle_toll_log(
    vehicle_id: int,
    toll_in: VehicleTollCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    toll_date_val = toll_in.toll_date or get_now_ist_naive()
    payment_method_val = toll_in.payment_method or "FASTag"

    if payment_method_val.lower() == "fastag":
        if vehicle.fasttag_balance < toll_in.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient FASTag balance on vehicle ({vehicle.license_plate}). Current balance: ₹{vehicle.fasttag_balance:.2f}, required: ₹{toll_in.amount:.2f}",
            )
        vehicle.fasttag_balance -= toll_in.amount

    toll_log = VehicleTollLog(
        vehicle_id=vehicle_id,
        driver_id=toll_in.driver_id,
        trip_id=toll_in.trip_id,
        toll_plaza_name=toll_in.toll_plaza_name,
        highway_name=toll_in.highway_name,
        amount=toll_in.amount,
        payment_method=payment_method_val,
        transaction_reference=toll_in.transaction_reference,
        toll_date=toll_date_val,
    )
    db.add(toll_log)
    db.commit()
    db.refresh(toll_log)
    return toll_log


@router.get("/{vehicle_id}/tolls", response_model=List[VehicleTollResponse])
def get_vehicle_tolls(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return (
        db.query(VehicleTollLog)
        .filter(VehicleTollLog.vehicle_id == vehicle_id)
        .order_by(VehicleTollLog.toll_date.desc())
        .all()
    )


@router.post("/{vehicle_id}/fasttag-recharge")
def recharge_vehicle_fasttag(
    vehicle_id: int,
    recharge_data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    amount = float(recharge_data.get("amount", 0.0))
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recharge amount must be positive",
        )

    vehicle.fasttag_balance += amount
    db.commit()
    db.refresh(vehicle)
    return {
        "message": f"Successfully recharged ₹{amount:.2f} for vehicle {vehicle.license_plate}",
        "new_balance": vehicle.fasttag_balance,
        "vehicle_id": vehicle.id,
    }


def parse_vehicle_document_text(texts: List[str]) -> dict:
    normalized_texts = []
    for t in texts:
        t_clean = t.strip()
        t_clean = re.sub(r"(\d+),(\d+)", r"\1.\2", t_clean)
        normalized_texts.append(t_clean)

    full_text_upper = " ".join(normalized_texts).upper()

    doc_type = "RC Smartcard"
    if (
        "INSURANCE" in full_text_upper
        or "POLICY" in full_text_upper
        or "INSURER" in full_text_upper
    ):
        doc_type = "Commercial Insurance Certificate"
    elif "FITNESS" in full_text_upper or "PERMIT" in full_text_upper:
        doc_type = "Fitness & Permit Certificate"
    elif "POLLUTION" in full_text_upper or "PUC" in full_text_upper:
        doc_type = "PUC Certificate"

    license_plate = None
    plate_match = re.search(
        r"\b([A-Z]{2}\s*[-]?\s*\d{2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*\d{4})\b",
        full_text_upper,
    )
    if plate_match:
        raw_plate = plate_match.group(1).replace("-", "").replace(" ", "")
        if len(raw_plate) >= 9:
            license_plate = (
                f"{raw_plate[:2]} {raw_plate[2:4]} {raw_plate[4:-4]} {raw_plate[-4:]}"
            )

    chassis_number = None
    chassis_match = re.search(
        r"\b(?:CHASSIS\s*NO|VIN|CHASSIS)\s*[:\-]?\s*([A-Z0-9]{15,17})\b",
        full_text_upper,
    )
    if chassis_match:
        chassis_number = chassis_match.group(1)
    else:
        vin_match = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", full_text_upper)
        if vin_match:
            chassis_number = vin_match.group(1)

    engine_number = None
    eng_match = re.search(
        r"\b(?:ENGINE\s*NO|ENG\s*NO|ENGINE)\s*[:\-]?\s*([A-Z0-9]{6,14})\b",
        full_text_upper,
    )
    if eng_match:
        engine_number = eng_match.group(1)

    make = None
    model = None
    year = None

    makes_db = {
        "TATA": "Tata Motors",
        "ASHOK": "Ashok Leyland",
        "LEYLAND": "Ashok Leyland",
        "EICHER": "Eicher Motors",
        "MAHINDRA": "Mahindra & Mahindra",
        "BHARATBENZ": "BharatBenz",
        "VOLVO": "Volvo Trucks",
        "FORCE": "Force Motors",
        "MARUTI": "Maruti Suzuki",
        "HYUNDAI": "Hyundai",
        "ISUZU": "Isuzu Commercial",
    }

    for k, v in makes_db.items():
        if k in full_text_upper:
            make = v
            break

    if not make:
        make = "Tata Motors"

    year_match = re.search(r"\b(20[12][0-9])\b", full_text_upper)
    if year_match:
        year = int(year_match.group(1))
    else:
        year = 2022

    dates_found = re.findall(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
        full_text_upper,
    )

    registration_date = None
    insurance_expiry_date = None
    fitness_expiry_date = None
    puc_expiry_date = None

    if len(dates_found) > 0:
        registration_date = dates_found[0]
    if len(dates_found) > 1:
        insurance_expiry_date = dates_found[1]
    if len(dates_found) > 2:
        fitness_expiry_date = dates_found[2]
    if len(dates_found) > 3:
        puc_expiry_date = dates_found[3]

    if not model:
        model = "407 Gold SFC"

    return {
        "document_type": doc_type,
        "license_plate": license_plate,
        "make": make,
        "model": model,
        "year": year,
        "chassis_number": chassis_number,
        "engine_number": engine_number,
        "registration_date": registration_date,
        "insurance_expiry_date": insurance_expiry_date,
        "fitness_expiry_date": fitness_expiry_date,
        "puc_expiry_date": puc_expiry_date,
    }


@router.post("/document/ocr", response_model=VehicleDocumentOCRResponse)
async def process_vehicle_document_ocr(file: UploadFile = File(...)):
    """
    Decodes an uploaded vehicle document photo (RC Smartcard, Insurance policy, Fitness certificate),
    runs PaddleOCR predictions, and extracts structured vehicle registration data.
    """
    from app.api.ocr import extract_ocr_data, get_ocr_engine

    filename = (file.filename or "").lower()
    allowed_extensions = (".png", ".jpg", ".jpeg")
    if not filename.endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PNG, JPG, or JPEG image of the vehicle document.",
        )

    try:
        await file.seek(0)
        contents = await file.read()
        if not contents:
            raise ValueError("Uploaded file is empty.")
        image_array = np.frombuffer(contents, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise ValueError("OpenCV could not decode vehicle document image.")
    except Exception as e:
        logger.error(f"Vehicle document decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not decode the uploaded vehicle document image.",
        )

    engine = get_ocr_engine()
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PaddleOCR prediction engine is not initialized.",
        )

    try:
        if hasattr(engine, "predict"):
            result = engine.predict(image)
        else:
            result = engine.ocr(image)
    except Exception as e:
        logger.exception(f"Vehicle OCR prediction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred inside PaddleOCR prediction engine.",
        )

    texts, scores = extract_ocr_data(result)
    logger.info(f"Extracted Vehicle OCR text lines: {texts}")

    if not texts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text detected on vehicle document photo.",
        )

    parsed = parse_vehicle_document_text(texts)
    confidence = round(sum(scores) / len(scores), 4) if scores else 0.95

    logger.info(
        f"Vehicle Document OCR parsed: {parsed['document_type']} -> {parsed['license_plate']} ({parsed['make']} {parsed['model']})"
    )

    return VehicleDocumentOCRResponse(
        document_type=parsed["document_type"],
        license_plate=parsed["license_plate"],
        make=parsed["make"],
        model=parsed["model"],
        year=parsed["year"],
        chassis_number=parsed["chassis_number"],
        engine_number=parsed["engine_number"],
        registration_date=parsed["registration_date"],
        insurance_expiry_date=parsed["insurance_expiry_date"],
        fitness_expiry_date=parsed["fitness_expiry_date"],
        puc_expiry_date=parsed["puc_expiry_date"],
        confidence=confidence,
    )
