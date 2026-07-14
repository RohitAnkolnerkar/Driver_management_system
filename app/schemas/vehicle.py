from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class VehicleBase(BaseModel):
    make: str
    model: str
    year: int
    license_plate: str
    odometer_km: float = 0.0
    status: str = "active"


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    odometer_km: Optional[float] = None
    status: Optional[str] = None


class VehicleResponse(VehicleBase):
    id: int
    created_at: datetime
    assigned_driver_id: Optional[int] = None
    assigned_driver_name: Optional[str] = None
    is_service_overdue: bool = False
    next_service_due_odometer: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class MaintenanceLogBase(BaseModel):
    service_type: str
    description: Optional[str] = None
    cost: float = 0.0
    odometer_at_service: float
    service_date: datetime
    next_service_due_odometer: Optional[float] = None


class MaintenanceLogCreate(BaseModel):
    service_type: str
    description: Optional[str] = None
    cost: Optional[float] = 0.0
    odometer_at_service: float
    service_date: Optional[datetime] = None
    next_service_due_odometer: Optional[float] = None


class MaintenanceLogResponse(MaintenanceLogBase):
    id: int
    vehicle_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
