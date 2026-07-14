from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.driver import Driver
from app.models.vehicle import MaintenanceLog, Vehicle
from app.schemas.vehicle import (
    MaintenanceLogCreate,
    MaintenanceLogResponse,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def make_vehicle_response(vehicle: Vehicle, db: Session) -> VehicleResponse:
    latest_log = (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle.id)
        .order_by(MaintenanceLog.service_date.desc())
        .first()
    )

    next_service = None
    if latest_log:
        next_service = latest_log.next_service_due_odometer
        is_overdue = (next_service is not None) and (
            vehicle.odometer_km >= next_service
        )
    else:
        # Default first service alert at 10,000 km
        next_service = 10000.0
        is_overdue = vehicle.odometer_km >= next_service

    return VehicleResponse(
        id=vehicle.id,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        license_plate=vehicle.license_plate,
        odometer_km=vehicle.odometer_km,
        status=vehicle.status,
        created_at=vehicle.created_at,
        assigned_driver_id=(
            vehicle.assigned_driver.id if vehicle.assigned_driver else None
        ),
        assigned_driver_name=(
            vehicle.assigned_driver.name if vehicle.assigned_driver else None
        ),
        is_service_overdue=is_overdue,
        next_service_due_odometer=next_service,
    )


@router.get("/", response_model=List[VehicleResponse])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicles = db.query(Vehicle).order_by(Vehicle.id.asc()).all()
    return [make_vehicle_response(v, db) for v in vehicles]


@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    existing = (
        db.query(Vehicle)
        .filter(Vehicle.license_plate == vehicle_in.license_plate)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Vehicle with license plate {vehicle_in.license_plate} "
                f"already exists."
            ),
        )

    db_vehicle = Vehicle(
        make=vehicle_in.make,
        model=vehicle_in.model,
        year=vehicle_in.year,
        license_plate=vehicle_in.license_plate,
        odometer_km=vehicle_in.odometer_km,
        status=vehicle_in.status,
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return make_vehicle_response(db_vehicle, db)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return make_vehicle_response(vehicle, db)


@router.patch("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle_in.license_plate and vehicle_in.license_plate != vehicle.license_plate:
        existing = (
            db.query(Vehicle)
            .filter(Vehicle.license_plate == vehicle_in.license_plate)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Vehicle with license plate {vehicle_in.license_plate} "
                    f"already exists."
                ),
            )

    update_data = vehicle_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)
    return make_vehicle_response(vehicle, db)


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Unassign vehicle from any drivers first to prevent foreign key
    # errors if set to cascade,
    # but we set nullable=True, so let's unassign them explicitly.
    drivers = db.query(Driver).filter(Driver.vehicle_id == vehicle_id).all()
    for driver in drivers:
        driver.vehicle_id = None

    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}


@router.get("/{vehicle_id}/maintenance", response_model=List[MaintenanceLogResponse])
def get_maintenance_logs(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    logs = (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.vehicle_id == vehicle_id)
        .order_by(MaintenanceLog.service_date.desc())
        .all()
    )
    return logs


@router.post(
    "/{vehicle_id}/maintenance",
    response_model=MaintenanceLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_maintenance_log(
    vehicle_id: int,
    log_in: MaintenanceLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Auto-adjust vehicle status if it's currently "maintenance" or log changes
    # Ensure vehicle odometer increases if service odometer is higher
    if log_in.odometer_at_service > vehicle.odometer_km:
        vehicle.odometer_km = log_in.odometer_at_service

    # Default service date to now if not provided
    s_date = log_in.service_date or datetime.utcnow()

    db_log = MaintenanceLog(
        vehicle_id=vehicle_id,
        service_type=log_in.service_type,
        description=log_in.description,
        cost=log_in.cost,
        odometer_at_service=log_in.odometer_at_service,
        service_date=s_date,
        next_service_due_odometer=log_in.next_service_due_odometer,
    )

    # If vehicle status was "maintenance", logging a task might mark it back as active
    # (unless it's set as inactive)
    if vehicle.status == "maintenance":
        vehicle.status = "active"

    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
