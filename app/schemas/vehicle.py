from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class VehicleBase(BaseModel):
    make: str
    model: str
    year: int
    license_plate: str
    odometer_km: float = 0.0
    status: str = "active"
    fasttag_balance: float = 1000.0


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    odometer_km: Optional[float] = None
    status: Optional[str] = None
    fasttag_balance: Optional[float] = None


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
    completed_at: Optional[datetime] = None
    next_service_due_odometer: Optional[float] = None


class MaintenanceLogCreate(BaseModel):
    service_type: str
    description: Optional[str] = None
    cost: Optional[float] = 0.0
    odometer_at_service: float
    service_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_service_due_odometer: Optional[float] = None


class MaintenanceLogComplete(BaseModel):
    cost: float
    description: Optional[str] = None
    next_service_due_odometer: Optional[float] = None


class MaintenanceLogResponse(MaintenanceLogBase):
    id: int
    vehicle_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictiveMaintenanceResponse(BaseModel):
    vehicle_id: int
    license_plate: str
    make: str
    model: str
    health_score: float  # 0 to 100
    urgency_status: str  # CRITICAL, WARNING, GOOD
    is_service_overdue: bool
    odometer_km: float
    next_service_due_odometer: float
    km_remaining: float
    avg_daily_km_30d: float
    estimated_days_remaining: Optional[float] = None
    failed_inspections_count: int = 0
    recommendations: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class VehicleTCOResponse(BaseModel):
    vehicle_id: int
    license_plate: str
    make: str
    model: str
    year: int
    total_km_driven: float
    fuel_cost: float
    maintenance_cost: float
    operational_revenue: float
    total_operating_cost: float
    net_profit_loss: float
    cost_per_km: float
    profit_per_km: float
    efficiency_rating: str  # EFFICIENT, AVERAGE, HIGH_COST_MONEY_DRAINER

    model_config = ConfigDict(from_attributes=True)


class FleetTCOSummaryResponse(BaseModel):
    total_vehicles: int
    fleet_total_km: float
    fleet_fuel_cost: float
    fleet_maintenance_cost: float
    fleet_total_cost: float
    fleet_total_revenue: float
    fleet_net_profit: float
    fleet_avg_cost_per_km: float
    vehicles_tco: List[VehicleTCOResponse]

    model_config = ConfigDict(from_attributes=True)
