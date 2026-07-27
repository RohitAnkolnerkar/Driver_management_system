from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DetentionClockUpdate(BaseModel):
    grace_minutes: Optional[int] = Field(default=None, ge=0)
    hourly_rate: Optional[float] = Field(default=None, ge=0.0)


class DetentionClockResponse(BaseModel):
    trip_id: int
    detention_start_time: Optional[str] = None
    detention_end_time: Optional[str] = None
    elapsed_minutes: float
    grace_minutes: int
    is_grace_exceeded: bool
    billable_hours: float
    hourly_rate: float
    estimated_detention_charge: float
    status_summary: str

    model_config = ConfigDict(from_attributes=True)
