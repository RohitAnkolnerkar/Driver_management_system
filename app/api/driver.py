from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_dispatcher_or_admin
from app.db import get_db
from app.models.driver import Driver
from app.models.trip import Trip
from app.schemas.driver import (
    DriverCreate,
    DriverResponse,
    DriverStatus,
    DriverStatusUpdate,
    DriverSummaryResponse,
    DriverEarningsResponse,
    DriverLeaderboardResponse,
    DriverUpdate,
)
from app.schemas.trip import TripResponse

router = APIRouter(prefix="/drivers", tags=["Drivers"])


@router.post("/", response_model=DriverResponse)
def create_driver(driver: DriverCreate, db: Session = Depends(get_db), current_user=Depends(require_dispatcher_or_admin)):
    db_driver = Driver(**driver.dict())
    db.add(db_driver)
    try:
        db.commit()
        db.refresh(db_driver)
        return db_driver
    except IntegrityError as e:
        db.rollback()
        err = str(e.orig).lower() if getattr(e, "orig", None) else str(e).lower()
        if "duplicate" in err or "unique" in err or "already exists" in err:
            raise HTTPException(status_code=400, detail="Driver with this phone already exists")
        raise HTTPException(status_code=400, detail="Database integrity error")


@router.get("/", response_model=list[DriverResponse])
def get_drivers(
    limit: int = 50,
    offset: int = 0,
    status: Optional[DriverStatus] = None,
    q: Optional[str] = None,
    license_expiry_before: Optional[datetime] = None,
    license_expiry_after: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List drivers with pagination and optional filtering.

    - `limit` default 50, max 200
    - `offset` for paging
    - `status` filter by driver status
    - `q` simple name/phone search (case-insensitive)
    - `license_expiry_before` and `license_expiry_after` range filtering
    """
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200

    query = db.query(Driver)

    if status:
        query = query.filter(Driver.status == status.value)

    if q:
        query = query.filter(
            or_(
                Driver.name.ilike(f"%{q}%"),
                Driver.phone.ilike(f"%{q}%"),
            )
        )

    if license_expiry_before:
        query = query.filter(Driver.license_expiry <= license_expiry_before)

    if license_expiry_after:
        query = query.filter(Driver.license_expiry >= license_expiry_after)

    query = query.order_by(Driver.created_at.desc())
    return query.offset(offset).limit(limit).all()


@router.get("/leaderboard", response_model=list[DriverLeaderboardResponse])
def get_driver_leaderboard(
    completed_after: Optional[datetime] = None,
    completed_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(
        Driver.id.label("driver_id"),
        Driver.name,
        Driver.phone,
        func.count(Trip.id).label("completed_trips"),
        func.coalesce(func.sum(Trip.estimated_fare), 0.0).label("total_earnings"),
        func.coalesce(func.avg(Trip.estimated_fare), 0.0).label("average_fare"),
    ).join(Trip, Trip.driver_id == Driver.id).filter(Trip.status == "completed")

    if completed_after:
        query = query.filter(Trip.end_time >= completed_after)
    if completed_before:
        query = query.filter(Trip.end_time <= completed_before)

    query = query.group_by(Driver.id).order_by(func.coalesce(func.sum(Trip.estimated_fare), 0.0).desc())
    rows = query.all()
    return [
        {
            "driver_id": row.driver_id,
            "name": row.name,
            "phone": row.phone,
            "completed_trips": int(row.completed_trips),
            "total_earnings": float(row.total_earnings),
            "average_fare": round(float(row.average_fare), 2),
        }
        for row in rows
    ]


@router.get("/dashboard/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total_drivers = db.query(Driver).count()
    available_drivers = db.query(Driver).filter(Driver.status == "available").count()
    on_trip_drivers = db.query(Driver).filter(Driver.status == "on_trip").count()
    inactive_drivers = db.query(Driver).filter(Driver.status == "inactive").count()

    active_trips = db.query(Trip).filter(Trip.status.in_(["assigned", "started"])).count()
    completed_trips = db.query(Trip).filter(Trip.status == "completed").count()
    cancelled_trips = db.query(Trip).filter(Trip.status == "cancelled").count()

    return {
        "total_drivers": total_drivers,
        "available_drivers": available_drivers,
        "on_trip_drivers": on_trip_drivers,
        "inactive_drivers": inactive_drivers,
        "active_trips": active_trips,
        "completed_trips": completed_trips,
        "cancelled_trips": cancelled_trips,
    }


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(driver_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.get("/{driver_id}/summary", response_model=DriverSummaryResponse)
def get_driver_summary(driver_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    total_trips = db.query(Trip).filter(Trip.driver_id == driver_id).count()
    completed_trips = db.query(Trip).filter(Trip.driver_id == driver_id, Trip.status == "completed").count()
    assigned_trips = db.query(Trip).filter(Trip.driver_id == driver_id, Trip.status == "assigned").count()
    started_trips = db.query(Trip).filter(Trip.driver_id == driver_id, Trip.status == "started").count()
    cancelled_trips = db.query(Trip).filter(Trip.driver_id == driver_id, Trip.status == "cancelled").count()

    return {
        "total_trips": total_trips,
        "completed_trips": completed_trips,
        "assigned_trips": assigned_trips,
        "started_trips": started_trips,
        "cancelled_trips": cancelled_trips,
    }


@router.get("/{driver_id}/earnings", response_model=DriverEarningsResponse)
def get_driver_earnings(
    driver_id: int,
    completed_after: Optional[datetime] = None,
    completed_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    earnings_query = db.query(
        func.count(Trip.id),
        func.coalesce(func.sum(Trip.estimated_fare), 0.0),
    ).filter(Trip.driver_id == driver_id, Trip.status == "completed")

    if completed_after:
        earnings_query = earnings_query.filter(Trip.end_time >= completed_after)
    if completed_before:
        earnings_query = earnings_query.filter(Trip.end_time <= completed_before)

    completed_trips, total_earnings = earnings_query.one()
    average_fare = float(total_earnings) / completed_trips if completed_trips else 0.0

    return {
        "completed_trips": int(completed_trips),
        "total_earnings": float(total_earnings),
        "average_fare": round(average_fare, 2),
    }


@router.get("/leaderboard", response_model=list[DriverLeaderboardResponse])
def get_driver_leaderboard(
    completed_after: Optional[datetime] = None,
    completed_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(
        Driver.id.label("driver_id"),
        Driver.name,
        Driver.phone,
        func.count(Trip.id).label("completed_trips"),
        func.coalesce(func.sum(Trip.estimated_fare), 0.0).label("total_earnings"),
        func.coalesce(func.avg(Trip.estimated_fare), 0.0).label("average_fare"),
    ).join(Trip, Trip.driver_id == Driver.id).filter(Trip.status == "completed")

    if completed_after:
        query = query.filter(Trip.end_time >= completed_after)
    if completed_before:
        query = query.filter(Trip.end_time <= completed_before)

    query = query.group_by(Driver.id).order_by(func.coalesce(func.sum(Trip.estimated_fare), 0.0).desc())
    rows = query.all()
    return [
        {
            "driver_id": row.driver_id,
            "name": row.name,
            "phone": row.phone,
            "completed_trips": int(row.completed_trips),
            "total_earnings": float(row.total_earnings),
            "average_fare": round(float(row.average_fare), 2),
        }
        for row in rows
    ]


@router.patch("/{driver_id}", response_model=DriverResponse)
def update_driver(driver_id: int, driver_update: DriverUpdate, db: Session = Depends(get_db), current_user=Depends(require_dispatcher_or_admin)):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if driver_update.name is not None:
        driver.name = driver_update.name
    if driver_update.phone is not None:
        driver.phone = driver_update.phone
    if driver_update.status is not None:
        driver.status = driver_update.status.value
    if driver_update.license_number is not None:
        driver.license_number = driver_update.license_number
    if driver_update.license_expiry is not None:
        driver.license_expiry = driver_update.license_expiry

    try:
        db.commit()
        db.refresh(driver)
        return driver
    except IntegrityError as e:
        db.rollback()
        err = str(e.orig).lower() if getattr(e, "orig", None) else str(e).lower()
        if "duplicate" in err or "unique" in err or "already exists" in err:
            raise HTTPException(status_code=400, detail="Driver with this phone already exists")
        raise HTTPException(status_code=400, detail="Database integrity error")


@router.get("/{driver_id}/trips", response_model=list[TripResponse])
def get_driver_trip_history(
    driver_id: int,
    status: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    query = db.query(Trip).options(selectinload(Trip.driver)).filter(Trip.driver_id == driver_id)

    if status:
        query = query.filter(Trip.status == status)
    if created_after:
        query = query.filter(Trip.created_at >= created_after)
    if created_before:
        query = query.filter(Trip.created_at <= created_before)

    trips = query.order_by(Trip.created_at.desc()).all()
    return trips
