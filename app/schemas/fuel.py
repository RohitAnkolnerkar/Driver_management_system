from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FuelLogCreate(BaseModel):
    liters_refueled: float
    cost: float
    odometer: float


class FuelLogResponse(BaseModel):
    id: int
    driver_id: int
    liters_refueled: float
    cost: float
    odometer: float
    is_flagged_fraud: bool
    fraud_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FleetFuelAnalyticsResponse(BaseModel):
    total_fuel_cost: float
    total_liters: float
    total_carbon_emissions_kg: float
    avg_cost_per_km: float
    active_fraud_alerts_count: int
