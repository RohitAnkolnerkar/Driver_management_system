from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DriverStatus(str, Enum):
    available = "available"
    on_trip = "on_trip"
    inactive = "inactive"


class DriverCreate(BaseModel):
    name: str
    phone: str
    license_number: str
    license_expiry: datetime
    user_id: Optional[int] = None


class DriverStatusUpdate(BaseModel):
    status: DriverStatus


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[DriverStatus] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None


class DriverResponse(BaseModel):
    id: int
    name: str
    phone: str
    status: str
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DriverSummaryResponse(BaseModel):
    total_trips: int
    completed_trips: int
    assigned_trips: int
    started_trips: int
    cancelled_trips: int

    model_config = ConfigDict(from_attributes=True)


class DriverAvailabilityHistoryResponse(BaseModel):
    id: int
    driver_id: int
    status: str
    changed_at: datetime
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DriverAvailabilityAnalyticsResponse(BaseModel):
    driver_id: int
    driver_name: str
    available_minutes: int
    on_trip_minutes: int
    inactive_minutes: int
    total_observed_minutes: int

    model_config = ConfigDict(from_attributes=True)


class DriverDailyAvailabilityAnalyticsResponse(BaseModel):
    date: str
    available_minutes: int
    on_trip_minutes: int
    inactive_minutes: int
    total_observed_minutes: int

    model_config = ConfigDict(from_attributes=True)


class DispatcherWorkloadSummaryResponse(BaseModel):
    total_drivers: int
    available_drivers: int
    on_trip_drivers: int
    inactive_drivers: int
    active_trips: int
    assigned_trips: int
    started_trips: int
    completed_trips: int
    cancelled_trips: int
    pending_trips: int
    total_trips_today: int

    model_config = ConfigDict(from_attributes=True)


class DriverPerformanceResponse(BaseModel):
    driver_id: int
    total_trips: int
    completed_trips: int
    cancelled_trips: int
    assigned_trips: int
    started_trips: int
    completion_rate: float
    cancellation_rate: float
    total_earnings: float
    average_fare: float

    model_config = ConfigDict(from_attributes=True)


class DriverEarningsResponse(BaseModel):
    completed_trips: int
    total_earnings: float
    average_fare: float

    model_config = ConfigDict(from_attributes=True)


class DriverLeaderboardResponse(BaseModel):
    driver_id: int
    name: str
    phone: str
    completed_trips: int
    total_earnings: float
    average_fare: float

    model_config = ConfigDict(from_attributes=True)
