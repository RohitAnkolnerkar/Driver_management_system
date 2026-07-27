from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AlertResolveRequest(BaseModel):
    status: str = Field(
        ..., description="Resolution status: 'confirmed_theft' or 'dismissed'"
    )
    notes: Optional[str] = Field(
        default=None, description="Audit notes for theft resolution"
    )


class FuelTheftAlertResponse(BaseModel):
    id: int
    driver_id: int
    driver_name: Optional[str] = None
    vehicle_id: Optional[int] = None
    fuel_log_id: Optional[int] = None
    alert_type: str
    severity: str
    detected_loss_liters: float
    estimated_financial_loss: float
    description: str
    status: str
    resolution_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FuelTheftAnalyticsResponse(BaseModel):
    total_alerts: int
    unresolved_count: int
    confirmed_theft_count: int
    total_stolen_liters: float
    total_financial_loss_inr: float
    recent_alerts: List[FuelTheftAlertResponse]

    model_config = ConfigDict(from_attributes=True)
