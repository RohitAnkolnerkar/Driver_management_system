import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.driver import Driver
from app.models.trip import Trip
from app.schemas.esg import DriverEcoRating, ESGAnalyticsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/esg", tags=["esg-analytics"])


@router.get(
    "/analytics",
    response_model=ESGAnalyticsResponse,
    dependencies=[Depends(require_roles("admin", "dispatcher"))],
)
def get_esg_analytics(db: Session = Depends(get_db)):
    logger.info("Computing ESG analytics summary")
    completed_trips = db.query(Trip).filter(Trip.status == "completed").all()

    total_dist = sum(t.distance_km or 0.0 for t in completed_trips)
    total_fuel = sum(t.fuel_consumed_liters or 0.0 for t in completed_trips)

    # Diesel carbon factor: 2.68 kg CO2 per liter
    total_co2 = (
        sum(t.carbon_emissions_kg or 0.0 for t in completed_trips)
        if any(t.carbon_emissions_kg for t in completed_trips)
        else round(total_fuel * 2.68, 2)
    )

    avg_co2_per_km = round(total_co2 / total_dist, 3) if total_dist > 0 else 0.25

    # Fleet Eco Score (0 to 100)
    fleet_eco_score = max(0.0, min(100.0, round(100.0 - (avg_co2_per_km * 120.0), 1)))

    # Compute Driver Eco Ratings
    drivers = db.query(Driver).all()
    driver_ratings: List[DriverEcoRating] = []

    for d in drivers:
        d_trips = [t for t in completed_trips if t.driver_id == d.id]
        if not d_trips:
            continue
        d_dist = sum(t.distance_km or 0.0 for t in d_trips)
        d_fuel = sum(t.fuel_consumed_liters or 0.0 for t in d_trips)
        d_co2 = round(d_fuel * 2.68, 2) if d_fuel > 0 else round(d_dist * 0.25, 2)
        d_avg_co2 = round(d_co2 / d_dist, 3) if d_dist > 0 else 0.25

        if d_avg_co2 <= 0.20:
            grade = "A+"
        elif d_avg_co2 <= 0.25:
            grade = "A"
        elif d_avg_co2 <= 0.30:
            grade = "B"
        else:
            grade = "C"

        driver_ratings.append(
            DriverEcoRating(
                driver_id=d.id,
                driver_name=d.name,
                total_trips=len(d_trips),
                total_distance_km=round(d_dist, 1),
                total_co2_kg=round(d_co2, 1),
                avg_co2_per_km=d_avg_co2,
                eco_grade=grade,
            )
        )

    driver_ratings.sort(key=lambda r: r.avg_co2_per_km)

    recommendations = [
        "🌱 Transition short-haul routes (<50km) to electric vehicle fleet models.",
        "⚡ Enforce idling limit policies to reduce excess fuel consumption by ~8%.",
        "🎯 Prioritize eco-certified drivers for high-tonnage freight dispatches.",
    ]

    return ESGAnalyticsResponse(
        total_fleet_co2_kg=round(total_co2, 1),
        total_fleet_distance_km=round(total_dist, 1),
        total_fuel_consumed_liters=round(total_fuel, 1),
        avg_fleet_co2_per_km=avg_co2_per_km,
        fleet_eco_score=fleet_eco_score,
        top_eco_drivers=driver_ratings[:5],
        sustainability_recommendations=recommendations,
    )
