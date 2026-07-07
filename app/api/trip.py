from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.api.driver import record_driver_status_change
from app.db import get_db
from app.models.driver import Driver
from app.models.trip import Trip, TripHistory
from app.schemas.trip import (
    AssignDriver,
    BulkTripAssignmentRequest,
    BulkTripAssignmentResponse,
    BulkTripCancelRequest,
    BulkTripCancelResponse,
    TripCancelRequest,
    TripCreate,
    TripResponse,
    TripUpdate,
    TripSummaryCreate,
    TripSummaryResponse,
    TripHistoryResponse,
    TripStatsResponse,
    TripFareEstimateRequest,
    TripFareEstimateResponse,
)

router = APIRouter(prefix="/trips", tags=["Trips"])


def record_trip_status_change(db: Session, trip_id: int, status: str, note: Optional[str] = None):
    history_entry = TripHistory(trip_id=trip_id, status=status, note=note)
    db.add(history_entry)
    return history_entry


def calculate_estimated_fare(distance_km: float, duration_minutes: Optional[int] = None) -> float:
    base_fare = 40.0          # ₹40 base fare
    per_km = 12.0             # ₹12 per km
    per_minute = 1.5          # ₹1.5 per minute

    estimated_fare = base_fare + distance_km * per_km

    if duration_minutes is not None:
        estimated_fare += duration_minutes * per_minute

    return round(estimated_fare, 2)


@router.post("/", response_model=TripResponse)
def create_trip(trip: TripCreate, db: Session = Depends(get_db), current_user=Depends(require_roles('admin','dispatcher'))):
    trip_data = trip.dict()
    if trip.scheduled_date is not None:
        scheduled = trip.scheduled_date
        now = datetime.now(timezone.utc)
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        if scheduled < now:
            raise HTTPException(status_code=422, detail="scheduled_date cannot be in the past")

    if trip.distance_km is not None:
        if trip.distance_km <= 0:
            raise HTTPException(status_code=422, detail="distance_km must be greater than 0")
        if trip.duration_minutes is not None and trip.duration_minutes < 0:
            raise HTTPException(status_code=422, detail="duration_minutes must be non-negative")
        trip_data["estimated_fare"] = calculate_estimated_fare(trip.distance_km, trip.duration_minutes)
    else:
        if trip.duration_minutes is not None and trip.duration_minutes < 0:
            raise HTTPException(status_code=422, detail="duration_minutes must be non-negative")
        trip_data["estimated_fare"] = calculate_estimated_fare(0.0, trip.duration_minutes)

    db_trip = Trip(**trip_data)
    db.add(db_trip)
    db.flush()
    record_trip_status_change(db, db_trip.id, db_trip.status, "trip created")
    db.commit()
    db.refresh(db_trip)
    return db_trip


@router.post("/estimate-fare", response_model=TripFareEstimateResponse)
def estimate_trip_fare(
    fare_request: TripFareEstimateRequest,
    current_user=Depends(get_current_user),
):
    base_fare = 40.0
    if fare_request.distance_km <= 0:
        raise HTTPException(status_code=422, detail="distance_km must be greater than 0")

    estimated_fare = calculate_estimated_fare(fare_request.distance_km, fare_request.duration_minutes)

    return {
        "base_fare": base_fare,
        "base_fare_currency": "INR",
        "distance_km": fare_request.distance_km,
        "duration_minutes": fare_request.duration_minutes,
        "estimated_fare": round(estimated_fare, 2),
        "estimated_fare_currency": "INR",
    }


@router.get("/", response_model=list[TripResponse])
def list_trips(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    driver_id: Optional[int] = None,
    source_company: Optional[str] = None,
    q: Optional[str] = None,
    scheduled_on: Optional[date] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200

    query = db.query(Trip).options(selectinload(Trip.driver))

    
    if current_user.role == "driver":
        query = query.filter(Trip.driver_id == current_user.driver_profile.id)

    if status:
        query = query.filter(Trip.status == status)

    if driver_id is not None and current_user.role != "driver":
        query = query.filter(Trip.driver_id == driver_id)

    if q:
        query = query.filter(
            or_(
                Trip.source.ilike(f"%{q}%"),
                Trip.destination.ilike(f"%{q}%"),
                Trip.source_company.ilike(f"%{q}%"),
                Trip.destination_company.ilike(f"%{q}%"),
            )
        )

    if source_company:
        query = query.filter(Trip.source_company.ilike(f"%{source_company}%"))

    if created_after:
        query = query.filter(Trip.created_at >= created_after)

    if created_before:
        query = query.filter(Trip.created_at <= created_before)

    if scheduled_on:
        weekday = scheduled_on.weekday()
        if weekday == 6:
            query = query.filter(func.date(Trip.scheduled_date) == scheduled_on.isoformat())
        else:
            query = query.filter(
                or_(
                    func.date(Trip.scheduled_date) == scheduled_on.isoformat(),
                    and_(
                        Trip.is_regular == True,
                        func.date(Trip.scheduled_date) <= scheduled_on.isoformat(),
                    ),
                )
            )

    query = query.order_by(Trip.created_at.desc())
    return query.offset(offset).limit(limit).all()


@router.get("/stats", response_model=TripStatsResponse)
def get_trip_stats(
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    base_query = db.query(Trip)
    if current_user.role == "driver":
        base_query = base_query.filter(Trip.driver_id == current_user.driver_profile.id)

    filters = []
    if created_after:
        filters.append(Trip.created_at >= created_after)
    if created_before:
        filters.append(Trip.created_at <= created_before)

    total_trips = base_query.filter(*filters).count()
    created_trips = base_query.filter(Trip.status == "created", *filters).count()
    assigned_trips = base_query.filter(Trip.status == "assigned", *filters).count()
    started_trips = base_query.filter(Trip.status == "started", *filters).count()
    completed_trips = base_query.filter(Trip.status == "completed", *filters).count()
    cancelled_trips = base_query.filter(Trip.status == "cancelled", *filters).count()

    fare_stats = base_query.filter(Trip.estimated_fare.isnot(None), *filters).with_entities(
        func.coalesce(func.sum(Trip.estimated_fare), 0.0),
        func.coalesce(func.avg(Trip.estimated_fare), 0.0),
    ).one()

    total_estimated_fare, average_estimated_fare = fare_stats

    return {
        "total_trips": int(total_trips),
        "created_trips": int(created_trips),
        "assigned_trips": int(assigned_trips),
        "started_trips": int(started_trips),
        "completed_trips": int(completed_trips),
        "cancelled_trips": int(cancelled_trips),
        "total_estimated_fare": float(total_estimated_fare),
        "average_estimated_fare": round(float(average_estimated_fare), 2),
    }


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(trip_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    trip = db.query(Trip).options(selectinload(Trip.driver)).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.patch("/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_update: TripUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status in {"started", "completed", "cancelled"}:
        raise HTTPException(400, "Trip cannot be updated once started or finished")

    if trip_update.source is not None:
        trip.source = trip_update.source
    if trip_update.destination is not None:
        trip.destination = trip_update.destination
    if trip_update.source_company is not None:
        trip.source_company = trip_update.source_company
    if trip_update.destination_company is not None:
        trip.destination_company = trip_update.destination_company
    if trip_update.distance_km is not None:
        if trip_update.distance_km <= 0:
            raise HTTPException(status_code=422, detail="distance_km must be greater than 0")
        trip.distance_km = trip_update.distance_km
    if trip_update.duration_minutes is not None:
        if trip_update.duration_minutes < 0:
            raise HTTPException(status_code=422, detail="duration_minutes must be non-negative")
        trip.duration_minutes = trip_update.duration_minutes

    if trip.distance_km is not None:
        trip.estimated_fare = calculate_estimated_fare(trip.distance_km, trip.duration_minutes)

    db.commit()
    db.refresh(trip)
    return trip


@router.post("/bulk-assign", response_model=BulkTripAssignmentResponse)
def bulk_assign_trips(
    data: BulkTripAssignmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    if not data.trip_ids:
        raise HTTPException(400, "At least one trip id is required")

    driver = db.query(Driver).filter(Driver.id == data.driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    if driver.status != "available":
        raise HTTPException(400, "Driver is not available")

    trip_ids = list(dict.fromkeys(data.trip_ids))
    trips = db.query(Trip).filter(Trip.id.in_(trip_ids)).all()

    if len(trips) != len(trip_ids):
        raise HTTPException(404, "One or more trips not found")

    for trip in trips:
        if trip.status != "created":
            raise HTTPException(400, "Only created trips can be bulk assigned")

        trip.driver_id = driver.id
        trip.status = "assigned"

    driver.status = "on_trip"
    record_driver_status_change(db, driver.id, driver.status, "bulk assigned to trips")
    db.commit()

    return {
        "assigned_count": len(trips),
        "driver_id": driver.id,
        "trip_ids": [trip.id for trip in trips],
    }


@router.patch("/{trip_id}/assign")
def assign_driver(
    trip_id: int,
    data: AssignDriver,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    driver = db.query(Driver).filter(Driver.id == data.driver_id).first()

    if not trip:
        raise HTTPException(404, "Trip not found")

    if not driver:
        raise HTTPException(404, "Driver not found")

    if driver.status != "available":
        raise HTTPException(400, "Driver is not available")

    trip.driver_id = driver.id
    trip.status = "assigned"

    driver.status = "on_trip"
    record_driver_status_change(db, driver.id, driver.status, "assigned to trip")
    record_trip_status_change(db, trip.id, trip.status, "driver assigned")

    db.commit()

    return {"message": "Driver assigned successfully"}


@router.patch("/{trip_id}/reassign")
def reassign_driver(
    trip_id: int,
    data: AssignDriver,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Trip not found")

    new_driver = db.query(Driver).filter(Driver.id == data.driver_id).first()
    if not new_driver:
        raise HTTPException(404, "Driver not found")

    if new_driver.status != "available":
        raise HTTPException(400, "Driver is not available")

    if trip.status != "assigned":
        raise HTTPException(400, "Trip can only be reassigned while assigned")

    if trip.driver_id:
        old_driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
        if old_driver:
            old_driver.status = "available"
            record_driver_status_change(db, old_driver.id, old_driver.status, "reassigned to another trip")

    trip.driver_id = new_driver.id
    trip.status = "assigned"
    new_driver.status = "on_trip"
    record_driver_status_change(db, new_driver.id, new_driver.status, "reassigned to trip")

    db.commit()

    return {"message": "Driver reassigned successfully"}


@router.patch("/{trip_id}/start")
def start_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()

    if not trip:
        raise HTTPException(404, "Trip not found")

    if trip.status != "assigned":
        raise HTTPException(400, "Trip must be assigned first")

    if current_user.role == "driver":
        if not trip.driver or trip.driver.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned driver may start this trip")

    trip.status = "started"
    trip.start_time = datetime.utcnow()
    record_trip_status_change(db, trip.id, trip.status, "trip started")

    db.commit()

    return {"message": "Trip started"}


@router.patch("/{trip_id}/complete")
def complete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()

    if not trip:
        raise HTTPException(404, "Trip not found")

    if trip.status != "started":
        raise HTTPException(400, "Trip not started")

    if current_user.role == "driver":
        if not trip.driver or trip.driver.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the assigned driver may complete this trip")

    trip.status = "completed"
    trip.end_time = datetime.utcnow()
    record_trip_status_change(db, trip.id, trip.status, "trip completed")

    if trip.driver_id:
        driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
        if driver:
            driver.status = "available"

    db.commit()

    return {"message": "Trip completed"}


@router.patch("/{trip_id}/summary", response_model=TripSummaryResponse)
def update_trip_summary(
    trip_id: int,
    summary: TripSummaryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Trip not found")

    if summary.distance_km <= 0:
        raise HTTPException(status_code=422, detail="distance_km must be greater than 0")

    if summary.duration_minutes is not None and summary.duration_minutes < 0:
        raise HTTPException(status_code=422, detail="duration_minutes must be non-negative")

    trip.distance_km = summary.distance_km
    trip.duration_minutes = summary.duration_minutes
    trip.estimated_fare = calculate_estimated_fare(summary.distance_km, summary.duration_minutes)

    db.commit()
    db.refresh(trip)

    return {
        "trip_id": trip.id,
        "distance_km": trip.distance_km,
        "duration_minutes": trip.duration_minutes,
        "estimated_fare": trip.estimated_fare,
        "status": trip.status,
    }


@router.get("/{trip_id}/summary", response_model=TripSummaryResponse)
def get_trip_summary(trip_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.role == "driver":
        if not trip.driver or trip.driver.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this trip summary",
            )
          
    if trip.distance_km is None or trip.estimated_fare is None:
        raise HTTPException(status_code=404, detail="Trip summary not found")

    return {
        "trip_id": trip.id,
        "distance_km": trip.distance_km,
        "duration_minutes": trip.duration_minutes,
        "estimated_fare": trip.estimated_fare,
        "status": trip.status,
    }


@router.post("/bulk-cancel", response_model=BulkTripCancelResponse)
def bulk_cancel_trips(
    data: BulkTripCancelRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    if not data.trip_ids:
        raise HTTPException(400, "At least one trip id is required")

    trip_ids = list(dict.fromkeys(data.trip_ids))
    trips = db.query(Trip).filter(Trip.id.in_(trip_ids)).all()

    if len(trips) != len(trip_ids):
        raise HTTPException(404, "One or more trips not found")

    for trip in trips:
        if trip.status not in {"created", "assigned"}:
            raise HTTPException(400, "Only created or assigned trips can be bulk cancelled")

        if trip.driver_id:
            driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
            if driver:
                driver.status = "available"

        trip.status = "cancelled"
        trip.cancel_reason = data.reason

    db.commit()

    return {
        "cancelled_count": len(trips),
        "trip_ids": [trip.id for trip in trips],
    }


@router.patch("/{trip_id}/cancel")
def cancel_trip(
    trip_id: int,
    cancel_data: Optional[TripCancelRequest] = Body(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()

    if not trip:
        raise HTTPException(404, "Trip not found")

    if trip.status not in {"created", "assigned"}:
        raise HTTPException(400, "Trip cannot be cancelled")

    if trip.driver_id:
        driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
        if driver:
            driver.status = "available"
            record_driver_status_change(db, driver.id, driver.status, "trip cancelled")

    trip.status = "cancelled"
    trip.cancel_reason = cancel_data.reason if cancel_data else None
    record_trip_status_change(db, trip.id, trip.status, "trip cancelled")
    db.commit()

    return {"message": "Trip cancelled"}


@router.get("/{trip_id}/history", response_model=list[TripHistoryResponse])
def get_trip_history(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    history = (
        db.query(TripHistory)
        .filter(TripHistory.trip_id == trip_id)
        .order_by(TripHistory.changed_at.asc())
        .all()
    )
    return history


@router.patch("/{trip_id}/discard")
def discard_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles('admin','dispatcher')),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()

    if not trip:
        raise HTTPException(404, "Trip not found")

    if trip.status not in {"created", "assigned"}:
        raise HTTPException(400, "Trip cannot be discarded after it has started or completed")

    trip.status = "cancelled"
    trip.cancel_reason = "discarded"
    record_trip_status_change(db, trip.id, trip.status, "trip discarded")

    if trip.driver_id:
        driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
        if driver:
            driver.status = "available"

    db.commit()

    return {"message": "Trip discarded"}
