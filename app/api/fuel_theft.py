import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.driver import Driver
from app.models.fuel import FuelLog
from app.models.fuel_theft import FuelTheftAlert
from app.models.user import User
from app.schemas.fuel_theft import (
    AlertResolveRequest,
    FuelTheftAlertResponse,
    FuelTheftAnalyticsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fuel/theft", tags=["fuel-theft-detection"])


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def evaluate_fuel_log_for_theft(
    db: Session,
    fuel_log: FuelLog,
    driver: Driver,
    station_lat: Optional[float] = None,
    station_lng: Optional[float] = None,
) -> List[FuelTheftAlert]:
    alerts_created = []
    diesel_price_per_liter = 95.0

    # 1. Off-Site Refuel Location Mismatch Check
    if (
        station_lat is not None
        and station_lng is not None
        and driver.current_latitude is not None
        and driver.current_longitude is not None
    ):
        dist_km = haversine_km(
            driver.current_latitude,
            driver.current_longitude,
            station_lat,
            station_lng,
        )
        if dist_km > 1.5:
            desc = (
                f"Off-site refuel detected. Fuel claim at station ({station_lat:.4f}, "
                f"{station_lng:.4f}), but vehicle GPS was {dist_km:.1f} km away."
            )
            est_loss = round(fuel_log.liters_refueled * diesel_price_per_liter, 2)
            alert = FuelTheftAlert(
                driver_id=driver.id,
                vehicle_id=driver.vehicle_id,
                fuel_log_id=fuel_log.id,
                alert_type="offsite_refuel_fraud",
                severity="high",
                detected_loss_liters=fuel_log.liters_refueled,
                estimated_financial_loss=est_loss,
                description=desc,
                status="unresolved",
            )
            db.add(alert)
            logger.warning(
                f"Potential fuel theft alert created (off-site refuel): {desc}"
            )
            alerts_created.append(alert)

    # 2. Abnormal Fuel Consumption Spike Check
    prev_log = (
        db.query(FuelLog)
        .filter(FuelLog.driver_id == driver.id, FuelLog.id < fuel_log.id)
        .order_by(FuelLog.id.desc())
        .first()
    )

    if prev_log and fuel_log.odometer > prev_log.odometer:
        distance_driven = fuel_log.odometer - prev_log.odometer
        actual_km_per_liter = distance_driven / fuel_log.liters_refueled
        baseline_km_per_liter = 4.0  # Fleet standard baseline efficiency

        expected_liters = round(distance_driven / baseline_km_per_liter, 2)
        fuel_log.expected_consumption_liters = expected_liters

        if fuel_log.liters_refueled > 0:
            diff_l = fuel_log.liters_refueled - expected_liters
            var_pct = round((diff_l / expected_liters) * 100.0, 1)
            fuel_log.variance_percentage = var_pct

        # If actual efficiency is > 25% worse than baseline
        if actual_km_per_liter < (baseline_km_per_liter * 0.75):
            stolen_liters = round(fuel_log.liters_refueled - expected_liters, 1)
            if stolen_liters > 5.0:
                est_loss = round(stolen_liters * diesel_price_per_liter, 2)
                desc = (
                    f"Abnormal consumption spike. Vehicle: {actual_km_per_liter:.1f} "
                    f"km/L (expected {baseline_km_per_liter:.1f} km/L). "
                    f"Stolen: {stolen_liters} L."
                )
                alert = FuelTheftAlert(
                    driver_id=driver.id,
                    vehicle_id=driver.vehicle_id,
                    fuel_log_id=fuel_log.id,
                    alert_type="abnormal_consumption_spike",
                    severity="critical" if stolen_liters > 20.0 else "medium",
                    detected_loss_liters=stolen_liters,
                    estimated_financial_loss=est_loss,
                    description=desc,
                    status="unresolved",
                )
                db.add(alert)
                logger.warning(
                    f"Potential fuel theft alert created (consumption spike): {desc}"
                )
                alerts_created.append(alert)

    db.commit()

    if alerts_created:
        from app.models.notification import Notification

        for alert in alerts_created:
            notif = Notification(
                title="🚨 Potential Fuel Theft Alert",
                message=alert.description,
                severity=alert.severity,
                category="fuel_theft",
                link_id=str(alert.id),
                is_read=False,
            )
            db.add(notif)
        db.commit()

    return alerts_created


@router.get("/alerts", response_model=List[FuelTheftAlertResponse])
def get_fuel_theft_alerts(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FuelTheftAlert)
    if status_filter:
        query = query.filter(FuelTheftAlert.status == status_filter)
    alerts = query.order_by(FuelTheftAlert.created_at.desc()).all()

    result = []
    for a in alerts:
        res = FuelTheftAlertResponse.model_validate(a)
        if a.driver:
            res.driver_name = a.driver.name
        result.append(res)
    return result


@router.get("/analytics", response_model=FuelTheftAnalyticsResponse)
def get_fuel_theft_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alerts = db.query(FuelTheftAlert).all()
    unresolved = [a for a in alerts if a.status == "unresolved"]
    confirmed = [a for a in alerts if a.status == "confirmed_theft"]

    total_stolen_l = sum(a.detected_loss_liters for a in confirmed)
    total_loss_inr = sum(a.estimated_financial_loss for a in confirmed)

    recent = (
        db.query(FuelTheftAlert)
        .order_by(FuelTheftAlert.created_at.desc())
        .limit(10)
        .all()
    )
    recent_res = []
    for a in recent:
        r = FuelTheftAlertResponse.model_validate(a)
        if a.driver:
            r.driver_name = a.driver.name
        recent_res.append(r)

    return FuelTheftAnalyticsResponse(
        total_alerts=len(alerts),
        unresolved_count=len(unresolved),
        confirmed_theft_count=len(confirmed),
        total_stolen_liters=round(total_stolen_l, 1),
        total_financial_loss_inr=round(total_loss_inr, 2),
        recent_alerts=recent_res,
    )


@router.post("/alerts/{alert_id}/resolve", response_model=FuelTheftAlertResponse)
def resolve_fuel_theft_alert(
    alert_id: int,
    req: AlertResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(FuelTheftAlert).filter(FuelTheftAlert.id == alert_id).first()
    if not alert:
        logger.warning(f"Resolve fuel theft alert failed: Alert {alert_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Theft alert not found"
        )

    if req.status not in ["confirmed_theft", "dismissed"]:
        logger.warning(
            f"Resolve fuel theft alert failed: Invalid status '{req.status}'"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'confirmed_theft' or 'dismissed'",
        )

    alert.status = req.status
    alert.resolution_notes = req.notes or f"Resolved by {current_user.username}"
    db.commit()
    db.refresh(alert)

    res = FuelTheftAlertResponse.model_validate(alert)
    if alert.driver:
        res.driver_name = alert.driver.name
    return res
