from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PreTripInspectionCreate(BaseModel):
    brakes_passed: bool
    tires_passed: bool
    lights_passed: bool
    steering_passed: bool
    fluids_passed: bool
    notes: Optional[str] = None


class PreTripInspectionResponse(BaseModel):
    id: int
    trip_id: int
    driver_id: int
    vehicle_id: int
    brakes_passed: bool
    tires_passed: bool
    lights_passed: bool
    steering_passed: bool
    fluids_passed: bool
    is_safe: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
