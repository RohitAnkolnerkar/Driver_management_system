from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DriverMatchScore(BaseModel):
    driver_id: int
    driver_name: str
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    total_score: float = Field(..., description="Overall match score between 0 and 100")
    proximity_km: float
    fatigue_hours_logged: float
    remaining_hours: float
    idle_hours: float
    safety_score: float
    match_reasons: List[str]

    model_config = ConfigDict(from_attributes=True)


class MatchmakingRecommendationResponse(BaseModel):
    trip_id: int
    source: str
    destination: str
    required_vehicle_type: Optional[str] = None
    candidates: List[DriverMatchScore]

    model_config = ConfigDict(from_attributes=True)
