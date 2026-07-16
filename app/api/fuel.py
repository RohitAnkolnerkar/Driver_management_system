import re
import time
import urllib.request
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db import get_db
from app.models.driver import Driver
from app.models.fuel import FuelLog
from app.models.trip import Trip
from app.schemas.fuel import (
    FleetFuelAnalyticsResponse,
    FuelLogCreate,
    FuelLogResponse,
    FuelLogUpdate,
)

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
    # Validate Trip ID
    trip = db.query(Trip).filter(Trip.id == log_in.trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=404, detail=f"Trip with ID {log_in.trip_id} not found."
        )

    if current_user.role in ["admin", "dispatcher"]:
        driver_id = log_in.driver_id
        if not driver_id:
            if trip.driver_id:
                driver_id = trip.driver_id
            else:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "driver_id is required since the specified "
                        "trip has no assigned driver."
                    ),
                )
        else:
            # Validate driver_id matches trip.driver_id if the trip has
            # an assigned driver
            if trip.driver_id and driver_id != trip.driver_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Driver ID {driver_id} does not match the driver "
                        f"assigned to Trip ID {trip.id} ({trip.driver_id})."
                    ),
                )

        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            raise HTTPException(
                status_code=404, detail=f"Driver with ID {driver_id} not found."
            )
    else:
        driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
        if not driver:
            raise HTTPException(
                status_code=400,
                detail="Only authenticated drivers can submit fuel logs.",
            )

        # Verify driver is assigned to the trip
        if trip.driver_id and driver.id != trip.driver_id:
            raise HTTPException(
                status_code=400, detail=f"You are not assigned to Trip ID {trip.id}."
            )

    is_flagged_fraud = False
    fraud_reason = None

    if log_in.is_personal_two_wheeler:
        # Personal refuels bypass all commercial fraud audits and odometer syncs
        pass
    else:
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

        # Audit Check 3: Diesel Price / Invoice Cost Mismatch Check
        if not is_flagged_fraud:
            try:
                rates_data = get_diesel_rate(current_user=None)
                diesel_price = None
                if trip:
                    cities = rates_data.get("cities", {})
                    for city, price in cities.items():
                        if (
                            city.lower() in trip.source.lower()
                            or city.lower() in trip.destination.lower()
                        ):
                            diesel_price = price
                            break
                if diesel_price is None:
                    diesel_price = rates_data.get("national_average", 97.83)

                expected_cost = log_in.liters_refueled * diesel_price
                cost_variance = 0.15
                lower_cost_bound = expected_cost * (1 - cost_variance)
                upper_cost_bound = expected_cost * (1 + cost_variance)

                if log_in.cost > upper_cost_bound or log_in.cost < lower_cost_bound:
                    is_flagged_fraud = True
                    fraud_reason = (
                        f"Receipt cost (₹{log_in.cost:.2f}) does not match expected "
                        f"local rate (₹{expected_cost:.2f} based on "
                        f"₹{diesel_price:.2f}/L). "
                        f"Potential fuel card invoice tampering or "
                        f"unauthorized purchase."
                    )
            except Exception:
                pass

    # Create fuel log
    fuel_log = FuelLog(
        driver_id=driver.id,
        liters_refueled=log_in.liters_refueled,
        cost=log_in.cost,
        odometer=log_in.odometer,
        is_flagged_fraud=is_flagged_fraud,
        fraud_reason=fraud_reason,
        is_personal_two_wheeler=log_in.is_personal_two_wheeler,
        trip_id=log_in.trip_id,
    )
    db.add(fuel_log)

    if not log_in.is_personal_two_wheeler:
        prev_odometer = driver.odometer_km
        if driver.vehicle:
            prev_odometer = driver.vehicle.odometer_km
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


@router.patch("/fuel-logs/{log_id}", response_model=FuelLogResponse)
def update_fuel_log(
    log_id: int,
    log_in: FuelLogUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    fuel_log = db.query(FuelLog).filter(FuelLog.id == log_id).first()
    if not fuel_log:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    if log_in.liters_refueled is not None:
        fuel_log.liters_refueled = log_in.liters_refueled
    if log_in.cost is not None:
        fuel_log.cost = log_in.cost
    if log_in.odometer is not None:
        fuel_log.odometer = log_in.odometer
    if log_in.is_flagged_fraud is not None:
        fuel_log.is_flagged_fraud = log_in.is_flagged_fraud
    if log_in.fraud_reason is not None:
        fuel_log.fraud_reason = log_in.fraud_reason
    if log_in.trip_id is not None:
        trip = db.query(Trip).filter(Trip.id == log_in.trip_id).first()
        if not trip:
            raise HTTPException(
                status_code=404, detail=f"Trip with ID {log_in.trip_id} not found."
            )
        fuel_log.trip_id = log_in.trip_id

    db.commit()
    db.refresh(fuel_log)
    return fuel_log


DIESEL_CACHE: Dict[str, Any] = {"timestamp": 0.0, "data": None}
CACHE_DURATION = 86400  # 24 hours

FALLBACK_DIESEL_RATES = {
    "national_average": 97.83,
    "cities": {
        "Mumbai": 97.83,
        "New Delhi": 95.20,
        "Kolkata": 99.82,
        "Chennai": 99.56,
        "Gurgaon": 95.64,
        "Noida": 95.44,
        "Bangalore": 99.26,
        "Bhubaneswar": 100.68,
        "Chandigarh": 89.47,
        "Hyderabad": 103.82,
        "Jaipur": 98.34,
        "Lucknow": 96.07,
        "Patna": 100.31,
        "Thiruvananthapuram": 104.40,
    },
}


@router.get("/diesel-rate")
def get_diesel_rate(current_user=Depends(get_current_user)) -> Dict[str, Any]:
    global DIESEL_CACHE
    now = time.time()

    if (
        DIESEL_CACHE["data"] is not None
        and (now - DIESEL_CACHE["timestamp"]) < CACHE_DURATION
    ):
        return DIESEL_CACHE["data"]

    try:
        url = "https://www.goodreturns.in/diesel-price.html"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/100.0.0.0 Safari/537.36"
                )
            },
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode("utf-8")

        pattern = r'href="/diesel-price-in-([a-zA-Z-]+)\.html"[^>]*>\s*([a-zA-Z\s]+)\s*</a>\s*</td>\s*<td>\s*&#x20b9;\s*([\d.]+)'  # noqa: E501
        matches = re.findall(pattern, html)

        if len(matches) >= 3:
            cities_prices = {}
            for match in matches:
                city_name = match[1].strip()
                try:
                    price = float(match[2])
                    cities_prices[city_name] = price
                except ValueError:
                    continue

            if cities_prices:
                avg_price = round(sum(cities_prices.values()) / len(cities_prices), 2)
                # Use Mumbai as default representative or calculated average
                national_avg = cities_prices.get("Mumbai", avg_price)

                data = {"national_average": national_avg, "cities": cities_prices}
                DIESEL_CACHE["data"] = data
                DIESEL_CACHE["timestamp"] = now
                return data
    except Exception:
        pass

    if DIESEL_CACHE["data"] is not None:
        return DIESEL_CACHE["data"]

    return FALLBACK_DIESEL_RATES
