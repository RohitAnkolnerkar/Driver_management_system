from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db import get_db
from app.models.driver import Driver
from app.models.fuel import FuelLog
from app.models.trip import Trip
from app.schemas.fuel import FleetFuelAnalyticsResponse, FuelLogCreate, FuelLogResponse

router = APIRouter(prefix="/fuel", tags=["fuel"])

# Standard average fuel consumption rates (Liters/kWh per 100km)
VEHICLE_FUEL_RATES = {
    "light_van": 7.0,
    "cargo_truck": 12.0,
    "semi_trailer": 32.0,
    "electric_truck": 20.0,
}

VEHICLE_TANK_CAPACITIES = {
    "light_van": 65.0,
    "cargo_truck": 150.0,
    "semi_trailer": 450.0,
    "electric_truck": 100.0,
}


@router.post("/fuel-logs", response_model=FuelLogResponse)
def create_fuel_log(
    log_in: FuelLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(
            status_code=400, detail="Only authenticated drivers can submit fuel logs."
        )

    is_flagged_fraud = False
    fraud_reason = None

    v_type = str(driver.vehicle_type or "cargo_truck")
    # Audit Check 1: Fuel Tank Capacity Check
    max_capacity = VEHICLE_TANK_CAPACITIES.get(v_type, 150.0)
    if log_in.liters_refueled > max_capacity:
        is_flagged_fraud = True
        fraud_reason = (
            f"Refueled volume ({log_in.liters_refueled}L) exceeds maximum "
            f"tank capacity ({max_capacity}L) for vehicle type "
            f"{driver.vehicle_type}."
        )

    # Audit Check 2: Odometer Progression & Fuel Efficiency Check
    prev_odometer = driver.odometer_km
    if driver.vehicle:
        prev_odometer = driver.vehicle.odometer_km

    if log_in.odometer <= prev_odometer:
        is_flagged_fraud = True
        fraud_reason = (
            f"Odometer input error or tampering: current reading "
            f"({log_in.odometer} km) is not greater than previous "
            f"({prev_odometer} km)."
        )
    elif not is_flagged_fraud:
        odometer_diff = log_in.odometer - prev_odometer
        if odometer_diff > 0:
            actual_rate = (log_in.liters_refueled / odometer_diff) * 100.0
            expected_rate = VEHICLE_FUEL_RATES.get(v_type, 12.0)

            variance = 0.30
            lower_bound = expected_rate * (1 - variance)
            upper_bound = expected_rate * (1 + variance)

            if actual_rate > upper_bound:
                is_flagged_fraud = True
                fraud_reason = (
                    f"Anomalously high fuel consumption ({actual_rate:.1f} "
                    f"L/100km vs expected {expected_rate} L/100km). "
                    f"Potential siphoning/fuel theft."
                )
            elif actual_rate < lower_bound:
                is_flagged_fraud = True
                fraud_reason = (
                    f"Anomalously low fuel consumption ({actual_rate:.1f} "
                    f"L/100km vs expected {expected_rate} L/100km). "
                    f"Potential odometer manipulation or unlogged refuel."
                )

    # Create fuel log
    fuel_log = FuelLog(
        driver_id=driver.id,
        liters_refueled=log_in.liters_refueled,
        cost=log_in.cost,
        odometer=log_in.odometer,
        is_flagged_fraud=is_flagged_fraud,
        fraud_reason=fraud_reason,
    )
    db.add(fuel_log)

    if log_in.odometer > prev_odometer:
        driver.odometer_km = log_in.odometer
        if driver.vehicle:
            driver.vehicle.odometer_km = log_in.odometer

    db.commit()
    db.refresh(fuel_log)
    return fuel_log


@router.get("/fuel-logs", response_model=list[FuelLogResponse])
def get_fuel_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role in ["admin", "dispatcher"]:
        return db.query(FuelLog).order_by(FuelLog.created_at.desc()).all()

    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        return []
    return (
        db.query(FuelLog)
        .filter(FuelLog.driver_id == driver.id)
        .order_by(FuelLog.created_at.desc())
        .all()
    )


@router.get("/fleet-fuel-analytics", response_model=FleetFuelAnalyticsResponse)
def get_fleet_fuel_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    fuel_stats = db.query(
        func.coalesce(func.sum(FuelLog.cost), 0.0).label("total_cost"),
        func.coalesce(func.sum(FuelLog.liters_refueled), 0.0).label("total_liters"),
    ).first()

    emissions_stats = (
        db.query(
            func.coalesce(func.sum(Trip.carbon_emissions_kg), 0.0).label(
                "total_emissions"
            )
        )
        .filter(Trip.status == "completed")
        .first()
    )

    distance_stats = (
        db.query(func.coalesce(func.sum(Trip.distance_km), 0.0).label("total_distance"))
        .filter(Trip.status == "completed")
        .first()
    )

    fraud_count = db.query(FuelLog).filter(FuelLog.is_flagged_fraud.is_(True)).count()

    total_dist = float(distance_stats.total_distance or 0.0) if distance_stats else 0.0
    total_cost = float(fuel_stats.total_cost or 0.0) if fuel_stats else 0.0
    avg_cost_per_km = total_cost / total_dist if total_dist > 0 else 0.0

    return {
        "total_fuel_cost": total_cost,
        "total_liters": float(fuel_stats.total_liters or 0.0) if fuel_stats else 0.0,
        "total_carbon_emissions_kg": (
            float(emissions_stats.total_emissions or 0.0) if emissions_stats else 0.0
        ),
        "avg_cost_per_km": avg_cost_per_km,
        "active_fraud_alerts_count": fraud_count,
    }
