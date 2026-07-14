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
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    base_salary: Optional[float] = 0.0
    commission_percentage: Optional[float] = 100.0
    vehicle_type: Optional[str] = "cargo_truck"
    odometer_km: Optional[float] = 0.0
    vehicle_id: Optional[int] = None


class DriverStatusUpdate(BaseModel):
    status: DriverStatus


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[DriverStatus] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    note: Optional[str] = None
    base_salary: Optional[float] = None
    commission_percentage: Optional[float] = None
    vehicle_type: Optional[str] = None
    odometer_km: Optional[float] = None
    vehicle_id: Optional[int] = None


class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class DriverResponse(BaseModel):
    id: int
    name: str
    phone: str
    status: str
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    base_salary: float = 0.0
    commission_percentage: float = 100.0
    vehicle_type: Optional[str] = "cargo_truck"
    odometer_km: Optional[float] = 0.0
    vehicle_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DriverLocationResponse(DriverResponse):
    """Returned by POST /drivers/location — includes geofence arrival signal."""

    near_destination: bool = False
    active_trip_id: Optional[int] = None
    active_trip_destination: Optional[str] = None


class DriverCreateResponse(DriverResponse):
    username: Optional[str] = None
    password: Optional[str] = None


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
    total_distance_km: float
    total_duration_minutes: int
    average_speed_kmh: float
    on_time_rate: float

    model_config = ConfigDict(from_attributes=True)


class DriverPaymentResponse(BaseModel):
    id: int
    driver_id: int
    year: int
    month: int
    base_salary_paid: float
    commission_paid: float
    bonus: float
    deductions: float
    total_paid: float
    status: str
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DriverPaymentCreate(BaseModel):
    driver_id: int
    year: int
    month: int
    base_salary_paid: Optional[float] = None
    commission_paid: Optional[float] = None
    bonus: Optional[float] = 0.0
    deductions: Optional[float] = 0.0
    status: Optional[str] = "pending"
    payment_method: Optional[str] = None
    note: Optional[str] = None


class DriverPaymentUpdate(BaseModel):
    base_salary_paid: Optional[float] = None
    commission_paid: Optional[float] = None
    bonus: Optional[float] = None
    deductions: Optional[float] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None
