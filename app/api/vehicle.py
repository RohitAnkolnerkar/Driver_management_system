from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
from app.models.vehicle import MaintenanceLog, Vehicle
from app.schemas.vehicle import (
    MaintenanceLogComplete,
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


@router.get("/utilization-analytics")
def get_vehicles_utilization_analytics(
    period_days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    from datetime import timedelta

    from app.models.trip import Trip

    now = get_now_ist_naive()
    start_date = now - timedelta(days=period_days)
    total_hours = float(period_days * 24)

    vehicles = db.query(Vehicle).all()
    results = []

    for v in vehicles:
        trips = (
            db.query(Trip)
            .filter(
                Trip.vehicle_id == v.id,
                Trip.status.in_(["started", "completed"]),
                Trip.start_time >= start_date,
            )
            .all()
        )

        active_hours = 0.0
        mileage_accumulated = 0.0

        for trip in trips:
            t_start = trip.start_time
            t_end = trip.end_time or now

            i_start = max(t_start, start_date)  # type: ignore
            i_end = min(t_end, now)  # type: ignore

            if i_start < i_end:
                active_hours += (i_end - i_start).total_seconds() / 3600.0

            if trip.status == "completed" and trip.distance_km:
                mileage_accumulated += float(trip.distance_km)

        m_logs = (
            db.query(MaintenanceLog)
            .filter(
                MaintenanceLog.vehicle_id == v.id,
                MaintenanceLog.service_date >= start_date,
            )
            .all()
        )

        downtime_hours = 0.0
        for log in m_logs:
            l_start = log.service_date
            l_end = log.completed_at or now

            i_start = max(l_start, start_date)  # type: ignore
            i_end = min(l_end, now)  # type: ignore

            if i_start < i_end:
                downtime_hours += (i_end - i_start).total_seconds() / 3600.0

        idle_hours = max(0.0, total_hours - active_hours - downtime_hours)

        utilization_rate = 0.0
        if total_hours > 0:
            utilization_rate = round((active_hours / total_hours) * 100.0, 1)

        high_threshold = 2000.0 * (period_days / 30.0)
        medium_threshold = 800.0 * (period_days / 30.0)

        if mileage_accumulated >= high_threshold:
            wear_level = "high"
        elif mileage_accumulated >= medium_threshold:
            wear_level = "medium"
        else:
            wear_level = "low"

        results.append(
            {
                "vehicle_id": v.id,
                "make": v.make,
                "model": v.model,
                "license_plate": v.license_plate,
                "status": v.status,
                "active_hours": round(active_hours, 1),
                "downtime_hours": round(downtime_hours, 1),
                "idle_hours": round(idle_hours, 1),
                "utilization_rate": utilization_rate,
                "mileage_accumulated": round(mileage_accumulated, 1),
                "wear_alert_level": wear_level,
            }
        )

    return results


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

    if log_in.odometer_at_service > vehicle.odometer_km:
        vehicle.odometer_km = log_in.odometer_at_service

    s_date = log_in.service_date or get_now_ist_naive()
    c_date = log_in.completed_at

    db_log = MaintenanceLog(
        vehicle_id=vehicle_id,
        service_type=log_in.service_type,
        description=log_in.description,
        cost=log_in.cost or 0.0,
        odometer_at_service=log_in.odometer_at_service,
        service_date=s_date,
        completed_at=c_date,
        next_service_due_odometer=log_in.next_service_due_odometer,
    )

    if not c_date:
        vehicle.status = "maintenance"
    else:
        vehicle.status = "active"

    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


@router.patch("/maintenance/{log_id}/complete", response_model=MaintenanceLogResponse)
def complete_maintenance_log(
    log_id: int,
    complete_in: MaintenanceLogComplete,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    log = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    log.completed_at = get_now_ist_naive()
    log.cost = complete_in.cost
    if complete_in.description:
        log.description = complete_in.description
    if complete_in.next_service_due_odometer is not None:
        log.next_service_due_odometer = complete_in.next_service_due_odometer

    vehicle = db.query(Vehicle).filter(Vehicle.id == log.vehicle_id).first()
    if vehicle:
        open_logs = (
            db.query(MaintenanceLog)
            .filter(
                MaintenanceLog.vehicle_id == vehicle.id,
                MaintenanceLog.completed_at.is_(None),
                MaintenanceLog.id != log.id,
            )
            .count()
        )
        if open_logs == 0:
            vehicle.status = "active"

        if log.odometer_at_service > vehicle.odometer_km:
            vehicle.odometer_km = log.odometer_at_service

    db.commit()
    db.refresh(log)
    return log
