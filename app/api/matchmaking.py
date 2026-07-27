import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.deps import get_db, require_roles
from app.api.driver import compute_single_driver_scorecard
from app.api.trip import geocode_location, get_driver_fatigue_hours
from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver, DriverAvailabilityHistory
from app.models.trip import Trip
from app.schemas.matchmaking import DriverMatchScore, MatchmakingRecommendationResponse

router = APIRouter(prefix="/trips", tags=["matchmaking"])


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Radius of earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def get_driver_idle_hours(driver: Driver, db: Session) -> float:
    now = get_now_ist_naive()
    hist = (
        db.query(DriverAvailabilityHistory)
        .filter(
            DriverAvailabilityHistory.driver_id == driver.id,
            DriverAvailabilityHistory.status == "available",
        )
        .order_by(DriverAvailabilityHistory.changed_at.desc())
        .first()
    )
    if hist and hist.changed_at:
        delta = (now - hist.changed_at).total_seconds() / 3600.0
        return max(0.0, delta)
    return 1.0


def calculate_driver_match_scores(
    db: Session, trip: Trip, required_vehicle_type: Optional[str] = None
) -> List[DriverMatchScore]:
    # 1. Fetch trip source coordinates
    src_lat, src_lon, _ = geocode_location(trip.source)

    # 2. Get available drivers
    available_drivers = db.query(Driver).filter(Driver.status == "available").all()

    candidates: List[DriverMatchScore] = []

    req_v_type = required_vehicle_type or getattr(trip, "vehicle_type", None)

    for driver in available_drivers:
        # Distance Proximity
        d_lat = getattr(driver, "current_latitude", None) or src_lat
        d_lon = getattr(driver, "current_longitude", None) or src_lon
        prox_km = haversine_distance(src_lat, src_lon, d_lat, d_lon)

        # Proximity Score (0 to 35 points)
        prox_score = max(0.0, 35.0 - (prox_km * 0.5))

        # Fatigue & Legal Driving Hours Compliance (0 to 25 points)
        fatigue_logged = get_driver_fatigue_hours(driver, db)
        remaining_hours = max(0.0, 8.0 - fatigue_logged)
        fatigue_score = (remaining_hours / 8.0) * 25.0

        # Vehicle Compatibility (0 to 20 points)
        v_type = getattr(driver, "vehicle_type", "cargo_truck") or "cargo_truck"
        if req_v_type:
            if v_type.lower() == req_v_type.lower():
                vehicle_score = 20.0
            else:
                vehicle_score = 5.0
        else:
            vehicle_score = 20.0

        # Safety & Telematics Scorecard (0 to 10 points)
        safety_index = 85.0
        try:
            scorecard = compute_single_driver_scorecard(driver.id, db)
            safety_index = scorecard.safety_score
        except Exception:
            pass
        safety_score = (safety_index / 100.0) * 10.0

        # Idle Time Fairness (0 to 10 points)
        idle_h = get_driver_idle_hours(driver, db)
        idle_score = min(10.0, idle_h * 2.0)

        # Total Weighted Score
        total = round(
            prox_score + fatigue_score + vehicle_score + safety_score + idle_score,
            1,
        )

        match_reasons = [
            f"📍 {prox_km} km away from dispatch origin",
            f"⏱️ {round(remaining_hours, 1)} hrs remaining driving window",
            f"🛡️ {round(safety_index, 1)}% safety compliance rating",
            f"🚚 Vehicle: {v_type.replace('_', ' ').title()}",
        ]

        candidates.append(
            DriverMatchScore(
                driver_id=driver.id,
                driver_name=driver.name,
                phone=driver.phone,
                vehicle_type=v_type,
                total_score=min(100.0, max(0.0, total)),
                proximity_km=prox_km,
                fatigue_hours_logged=round(fatigue_logged, 1),
                remaining_hours=round(remaining_hours, 1),
                idle_hours=round(idle_h, 1),
                safety_score=round(safety_index, 1),
                match_reasons=match_reasons,
            )
        )

    # Sort candidates by total_score descending
    candidates.sort(key=lambda c: c.total_score, reverse=True)
    return candidates


@router.get(
    "/{trip_id}/recommend-drivers",
    response_model=MatchmakingRecommendationResponse,
    dependencies=[Depends(require_roles("admin", "dispatcher"))],
)
def recommend_drivers_for_trip(
    trip_id: int,
    required_vehicle_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Recommend drivers failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    candidates = calculate_driver_match_scores(
        db, trip, required_vehicle_type=required_vehicle_type
    )

    return MatchmakingRecommendationResponse(
        trip_id=trip.id,
        source=trip.source,
        destination=trip.destination,
        required_vehicle_type=required_vehicle_type,
        candidates=candidates,
    )


@router.post(
    "/{trip_id}/auto-dispatch",
    dependencies=[Depends(require_roles("admin", "dispatcher"))],
)
def auto_dispatch_trip(
    trip_id: int,
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Auto dispatch failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    if trip.status not in ["created", "unassigned"]:
        logger.warning(
            f"Auto dispatch failed: Trip {trip_id} is in invalid state '{trip.status}'"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot dispatch trip in state '{trip.status}'",
        )

    candidates = calculate_driver_match_scores(db, trip)
    if not candidates:
        logger.warning(
            f"Auto dispatch failed: No available drivers found for Trip {trip_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No available drivers available for auto-dispatch",
        )

    best_match = candidates[0]
    driver = db.query(Driver).filter(Driver.id == best_match.driver_id).first()
    if not driver:
        logger.error(
            f"Auto dispatch failed: Top matched driver {best_match.driver_id} not found in DB"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Top matched driver not found",
        )
    logger.info(
        f"Auto-dispatching Trip {trip_id} to Driver {driver.id} ('{driver.name}') with score {best_match.total_score}"
    )

    # Assign trip to top candidate
    trip.driver_id = driver.id
    trip.status = "assigned"
    driver.status = "on_trip"
    db.commit()
    db.refresh(trip)

    return {
        "message": f"Successfully auto-dispatched Trip #{trip.id} to {driver.name}",
        "trip_id": trip.id,
        "assigned_driver_id": driver.id,
        "assigned_driver_name": driver.name,
        "match_score": best_match.total_score,
        "match_reasons": best_match.match_reasons,
    }
