from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class VehicleTollCreate(BaseModel):
    vehicle_id: int
    driver_id: Optional[int] = None
    trip_id: Optional[int] = None
    toll_plaza_name: str
    highway_name: Optional[str] = None
    amount: float
    payment_method: Optional[str] = "FASTag"  # FASTag, Cash, UPI
    transaction_reference: Optional[str] = None
    toll_date: Optional[datetime] = None


class VehicleTollResponse(BaseModel):
    id: int
    vehicle_id: int
    driver_id: Optional[int] = None
    trip_id: Optional[int] = None
    toll_plaza_name: str
    highway_name: Optional[str] = None
    amount: float
    payment_method: str
    transaction_reference: Optional[str] = None
    toll_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VehicleTollSummaryItem(BaseModel):
    vehicle_id: int
    make: str
    model: str
    license_plate: str
    total_toll_spend: float
    fastag_spend: float
    cash_spend: float
    transaction_count: int
    toll_logs: List[VehicleTollResponse] = []


class FleetTollSummaryResponse(BaseModel):
    period_start: str
    period_end: str
    total_fleet_toll_spend: float
    total_fastag_spend: float
    total_cash_spend: float
    total_transactions: int
    vehicle_summaries: List[VehicleTollSummaryItem]
