from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.driver import DriverResponse


class TripCreate(BaseModel):
    source: str
    destination: str
    source_company: Optional[str] = None
    destination_company: Optional[str] = None
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    is_regular: bool = False
    scheduled_date: Optional[datetime] = None
    priority: str = "normal"


class AssignDriver(BaseModel):
    driver_id: int


class BulkTripAssignmentRequest(BaseModel):
    trip_ids: list[int]
    driver_id: int


class BulkTripAssignmentResponse(BaseModel):
    assigned_count: int
    driver_id: int
    trip_ids: list[int]


class BulkTripCancelRequest(BaseModel):
    trip_ids: list[int]
    reason: Optional[str] = None


class BulkTripCancelResponse(BaseModel):
    cancelled_count: int
    trip_ids: list[int]


class TripUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    source_company: Optional[str] = None
    destination_company: Optional[str] = None
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    priority: Optional[str] = None


class TripCancelRequest(BaseModel):
    reason: Optional[str] = None


class TripSummaryCreate(BaseModel):
    distance_km: float
    duration_minutes: Optional[int] = None


class TripResponse(BaseModel):
    id: int
    source: str
    destination: str
    source_company: Optional[str] = None
    destination_company: Optional[str] = None
    status: str
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    estimated_fare: Optional[float] = None
    cost_per_trip: Optional[float] = None
    time_taken_minutes: Optional[int] = None
    is_regular: bool = False
    scheduled_date: Optional[datetime] = None
    priority: str = "normal"
    cancel_reason: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TripSummaryResponse(BaseModel):
    trip_id: int
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    estimated_fare: Optional[float] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class TripHistoryResponse(BaseModel):
    id: int
    trip_id: int
    status: str
    changed_at: datetime
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DispatchBoardResponse(BaseModel):
    pending_trips: list[TripResponse]
    available_drivers: list[DriverResponse]

    model_config = ConfigDict(from_attributes=True)


class TripStatsResponse(BaseModel):
    total_trips: int
    created_trips: int
    assigned_trips: int
    started_trips: int
    completed_trips: int
    cancelled_trips: int
    total_estimated_fare: float
    average_estimated_fare: float

    model_config = ConfigDict(from_attributes=True)


class TripFareEstimateRequest(BaseModel):
    distance_km: float
    duration_minutes: Optional[int] = None


class TripFareEstimateResponse(BaseModel):
    base_fare: float
    base_fare_currency: str = "INR"
    distance_km: float
    duration_minutes: Optional[int] = None
    estimated_fare: float
    estimated_fare_currency: str = "INR"

    model_config = ConfigDict(from_attributes=True)
