from typing import List

from pydantic import BaseModel, ConfigDict


class DriverEcoRating(BaseModel):
    driver_id: int
    driver_name: str
    total_trips: int
    total_distance_km: float
    total_co2_kg: float
    avg_co2_per_km: float
    eco_grade: str


class ESGAnalyticsResponse(BaseModel):
    total_fleet_co2_kg: float
    total_fleet_distance_km: float
    total_fuel_consumed_liters: float
    avg_fleet_co2_per_km: float
    fleet_eco_score: float
    top_eco_drivers: List[DriverEcoRating]
    sustainability_recommendations: List[str]

    model_config = ConfigDict(from_attributes=True)
