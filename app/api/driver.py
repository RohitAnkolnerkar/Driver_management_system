from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.db import get_db
from app.models.driver import Driver, DriverAvailabilityHistory, DriverLocationHistory
from app.models.trip import Trip, TripHistory
from app.schemas.driver import (
    DispatcherWorkloadSummaryResponse,
    DriverAvailabilityAnalyticsResponse,
    DriverAvailabilityHistoryResponse,
    DriverCreate,
    DriverCreateResponse,
    DriverDailyAvailabilityAnalyticsResponse,
    DriverEarningsResponse,
    DriverLeaderboardResponse,
    DriverLocationUpdate,
    DriverPerformanceResponse,
    DriverResponse,
    DriverStatus,
    DriverUpdate,
)
from app.schemas.trip import TripResponse

router = APIRouter(prefix="/drivers", tags=["Drivers"])


def record_driver_status_change(
    db: Session, driver_id: int, status: str, note: Optional[str] = None
):
    history_entry = DriverAvailabilityHistory(
        driver_id=driver_id, status=status, note=note
    )
    db.add(history_entry)
    return history_entry


@router.post("/location", response_model=DriverResponse)
def update_driver_location(
    location_update: DriverLocationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import math

    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver.current_latitude = location_update.latitude
    driver.current_longitude = location_update.longitude
    driver.last_location_update = datetime.utcnow()

    # Log to location history
    history_entry = DriverLocationHistory(
        driver_id=driver.id,
        latitude=location_update.latitude,
        longitude=location_update.longitude,
        recorded_at=datetime.utcnow(),
    )
    db.add(history_entry)

    # Check for active trip
    active_trip = (
        db.query(Trip)
        .filter(Trip.driver_id == driver.id, Trip.status == "started")
        .first()
    )

    if active_trip:
        history_entry.trip_id = active_trip.id

        # Geofencing completion check
        dest_lat = active_trip.destination_latitude
        dest_lng = active_trip.destination_longitude
        if dest_lat is not None and dest_lng is not None:
            # Haversine distance
            lat1 = math.radians(location_update.latitude)
            lon1 = math.radians(location_update.longitude)
            lat2 = math.radians(dest_lat)
            lon2 = math.radians(dest_lng)

            dlat = lat2 - lat1
            dlon = lon2 - lon1

            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            )
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist = 6371.0 * c  # distance in km

            # If driver is within 100 meters (0.1 km) of destination, auto-complete trip
            if dist < 0.1:
                active_trip.status = "completed"
                active_trip.end_time = datetime.utcnow()
                driver.status = "available"

                # Create availability history entry
                status_history = DriverAvailabilityHistory(
                    driver_id=driver.id,
                    status="available",
                    note="Auto-changed to available due to trip completion.",
                )
                db.add(status_history)

                # Create trip history entry
                trip_history = TripHistory(
                    trip_id=active_trip.id,
                    status="completed",
                    note="Auto-completed via GPS Geofence arrival.",
                )
                db.add(trip_history)

    db.commit()
    db.refresh(driver)
    return driver


@router.post("/", response_model=DriverCreateResponse)
def create_driver(
    driver: DriverCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    from app.core.security import hash_password
    from app.models.user import User

    user_id = driver.user_id

    # If credentials are provided, create corresponding user first
    if driver.username and driver.password:
        existing_user = db.query(User).filter(User.username == driver.username).first()
        if existing_user:
            raise HTTPException(
                status_code=400, detail="Username is already registered"
            )

        email = driver.email or f"{driver.username}@example.com"
        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email is already registered")

        db_user = User(
            username=driver.username,
            email=email,
            hashed_password=hash_password(driver.password),
            role="driver",
            is_active=True,
        )
        db.add(db_user)
        try:
            db.flush()
            user_id = db_user.id
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400, detail="Username or email already registered"
            )

    driver_data = {
        "name": driver.name,
        "phone": driver.phone,
        "license_number": driver.license_number,
        "license_expiry": driver.license_expiry,
        "user_id": user_id,
    }

    db_driver = Driver(**driver_data)
    db.add(db_driver)
    try:
        db.flush()
        record_driver_status_change(
            db, db_driver.id, db_driver.status, "driver created"
        )
        db.commit()
        db.refresh(db_driver)
        return {
            "id": db_driver.id,
            "name": db_driver.name,
            "phone": db_driver.phone,
            "status": db_driver.status,
            "license_number": db_driver.license_number,
            "license_expiry": db_driver.license_expiry,
            "user_id": db_driver.user_id,
            "created_at": db_driver.created_at,
            "username": (
                driver.username if (driver.username and driver.password) else None
            ),
            "password": (
                driver.password if (driver.username and driver.password) else None
            ),
        }
    except IntegrityError as e:
        db.rollback()
        err = str(e.orig).lower() if getattr(e, "orig", None) else str(e).lower()
        if "duplicate" in err or "unique" in err or "already exists" in err:
            raise HTTPException(
                status_code=400, detail="Driver with this phone already exists"
            )
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
    current_user=Depends(require_roles("admin", "dispatcher")),
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


@router.get("/dashboard/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total_drivers = db.query(Driver).count()
    available_drivers = db.query(Driver).filter(Driver.status == "available").count()
    on_trip_drivers = db.query(Driver).filter(Driver.status == "on_trip").count()
    inactive_drivers = db.query(Driver).filter(Driver.status == "inactive").count()

    active_trips = (
        db.query(Trip).filter(Trip.status.in_(["assigned", "started"])).count()
    )
    completed_trips = db.query(Trip).filter(Trip.status == "completed").count()
    cancelled_trips = db.query(Trip).filter(Trip.status == "cancelled").count()
    today = datetime.utcnow().date()
    total_trips_today = (
        db.query(Trip).filter(func.date(Trip.created_at) == today).count()
    )

    return {
        "total_drivers": total_drivers,
        "available_drivers": available_drivers,
        "on_trip_drivers": on_trip_drivers,
        "inactive_drivers": inactive_drivers,
        "active_trips": active_trips,
        "completed_trips": completed_trips,
        "cancelled_trips": cancelled_trips,
        "total_trips_today": total_trips_today,
    }


@router.get("/leaderboard", response_model=list[DriverLeaderboardResponse])
def get_driver_leaderboard(
    completed_after: Optional[datetime] = None,
    completed_before: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        db.query(
            Driver.id.label("driver_id"),
            Driver.name,
            Driver.phone,
            func.count(Trip.id).label("completed_trips"),
            func.coalesce(func.sum(Trip.estimated_fare), 0.0).label("total_earnings"),
            func.coalesce(func.avg(Trip.estimated_fare), 0.0).label("average_fare"),
        )
        .join(Trip, Trip.driver_id == Driver.id)
        .filter(Trip.status == "completed")
    )

    if completed_after:
        query = query.filter(Trip.end_time >= completed_after)
    if completed_before:
        query = query.filter(Trip.end_time <= completed_before)

    query = query.group_by(Driver.id).order_by(
        func.coalesce(func.sum(Trip.estimated_fare), 0.0).desc()
    )
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


@router.get(
    "/dashboard/workload-summary",
    response_model=DispatcherWorkloadSummaryResponse,
)
def get_dispatcher_workload_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    today = datetime.utcnow().date()

    # Driver statistics (1 query)
    driver_stats = db.query(
        func.count(Driver.id).label("total_drivers"),
        func.sum(case((Driver.status == "available", 1), else_=0)).label(
            "available_drivers"
        ),
        func.sum(case((Driver.status == "on_trip", 1), else_=0)).label(
            "on_trip_drivers"
        ),
        func.sum(case((Driver.status == "inactive", 1), else_=0)).label(
            "inactive_drivers"
        ),
    ).one()

    # Trip statistics (1 query)
    trip_stats = db.query(
        func.sum(case((Trip.status == "assigned", 1), else_=0)).label("assigned_trips"),
        func.sum(case((Trip.status == "started", 1), else_=0)).label("started_trips"),
        func.sum(case((Trip.status == "completed", 1), else_=0)).label(
            "completed_trips"
        ),
        func.sum(case((Trip.status == "cancelled", 1), else_=0)).label(
            "cancelled_trips"
        ),
        func.sum(case((Trip.status.in_(["created", "assigned"]), 1), else_=0)).label(
            "pending_trips"
        ),
        func.sum(case((func.date(Trip.created_at) == today, 1), else_=0)).label(
            "total_trips_today"
        ),
    ).one()

    assigned_trips = trip_stats.assigned_trips or 0
    started_trips = trip_stats.started_trips or 0

    return {
        "total_drivers": driver_stats.total_drivers or 0,
        "available_drivers": driver_stats.available_drivers or 0,
        "on_trip_drivers": driver_stats.on_trip_drivers or 0,
        "inactive_drivers": driver_stats.inactive_drivers or 0,
        "active_trips": assigned_trips + started_trips,
        "assigned_trips": assigned_trips,
        "started_trips": started_trips,
        "completed_trips": trip_stats.completed_trips or 0,
        "cancelled_trips": trip_stats.cancelled_trips or 0,
        "pending_trips": trip_stats.pending_trips or 0,
        "total_trips_today": trip_stats.total_trips_today or 0,
    }


@router.get("/alerts/expired", response_model=list[DriverResponse])
def get_expired_or_expiring_drivers(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    from datetime import timedelta

    thirty_days_later = datetime.utcnow() + timedelta(days=30)

    drivers = (
        db.query(Driver)
        .filter(
            Driver.license_expiry.isnot(None),
            Driver.license_expiry <= thirty_days_later,
        )
        .order_by(Driver.license_expiry.asc())
        .all()
    )
    return drivers


@router.get("/profile/me", response_model=DriverResponse)
def get_my_driver_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "driver":
        raise HTTPException(status_code=400, detail="User is not a driver")

    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    return driver


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.get("/{driver_id}/summary")
def get_driver_summary(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # 🔐 Restrict driver access
    if current_user.role == "driver":
        if (
            not current_user.driver_profile
            or current_user.driver_profile.id != driver_id
        ):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this driver summary",
            )

    # ⚡ Optimized single query
    stats = (
        db.query(
            func.count(Trip.id).label("total"),
            func.sum(case((Trip.status == "completed", 1), else_=0)).label("completed"),
            func.sum(case((Trip.status == "assigned", 1), else_=0)).label("assigned"),
            func.sum(case((Trip.status == "started", 1), else_=0)).label("started"),
            func.sum(case((Trip.status == "cancelled", 1), else_=0)).label("cancelled"),
        )
        .filter(Trip.driver_id == driver_id)
        .one()
    )

    return {
        "total_trips": stats.total or 0,
        "completed_trips": stats.completed or 0,
        "assigned_trips": stats.assigned or 0,
        "started_trips": stats.started or 0,
        "cancelled_trips": stats.cancelled or 0,
    }


@router.get("/{driver_id}/performance", response_model=DriverPerformanceResponse)
def get_driver_performance(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if (
        current_user.role == "driver"
        and current_user.driver_profile
        and current_user.driver_profile.id != driver_id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this driver performance"
        )

    stats = (
        db.query(
            func.count(Trip.id).label("total_trips"),
            func.sum(case((Trip.status == "completed", 1), else_=0)).label(
                "completed_trips"
            ),
            func.sum(case((Trip.status == "cancelled", 1), else_=0)).label(
                "cancelled_trips"
            ),
            func.sum(case((Trip.status == "assigned", 1), else_=0)).label(
                "assigned_trips"
            ),
            func.sum(case((Trip.status == "started", 1), else_=0)).label(
                "started_trips"
            ),
            func.coalesce(func.sum(Trip.estimated_fare), 0.0).label("total_earnings"),
        )
        .filter(Trip.driver_id == driver_id)
        .one()
    )

    total_trips = int(stats.total_trips or 0)
    completed_trips = int(stats.completed_trips or 0)
    cancelled_trips = int(stats.cancelled_trips or 0)
    completion_rate = (
        round((completed_trips / total_trips) * 100, 2) if total_trips else 0.0
    )
    cancellation_rate = (
        round((cancelled_trips / total_trips) * 100, 2) if total_trips else 0.0
    )
    average_fare = (
        float(stats.total_earnings) / completed_trips if completed_trips else 0.0
    )

    return {
        "driver_id": driver.id,
        "total_trips": total_trips,
        "completed_trips": completed_trips,
        "cancelled_trips": cancelled_trips,
        "assigned_trips": int(stats.assigned_trips or 0),
        "started_trips": int(stats.started_trips or 0),
        "completion_rate": completion_rate,
        "cancellation_rate": cancellation_rate,
        "total_earnings": float(stats.total_earnings or 0.0),
        "average_fare": round(average_fare, 2),
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


@router.patch("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: int,
    driver_update: DriverUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if driver_update.name is not None:
        driver.name = driver_update.name
    if driver_update.phone is not None:
        driver.phone = driver_update.phone
    if driver_update.status is not None:
        driver.status = driver_update.status.value
        note = driver_update.note if driver_update.note else "status updated"
        record_driver_status_change(db, driver.id, driver.status, note)
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
            raise HTTPException(
                status_code=400, detail="Driver with this phone already exists"
            )
        raise HTTPException(status_code=400, detail="Database integrity error")


@router.delete("/{driver_id}")
def delete_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if driver.status == "on_trip":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a driver who is currently on a trip",
        )

    db.query(Trip).filter(Trip.driver_id == driver.id).update({Trip.driver_id: None})

    db.delete(driver)
    db.commit()

    return {"message": "Driver deleted successfully"}


@router.get(
    "/{driver_id}/availability-history",
    response_model=list[DriverAvailabilityHistoryResponse],
)
def get_driver_availability_history(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if (
        current_user.role == "driver"
        and current_user.driver_profile
        and current_user.driver_profile.id != driver_id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this driver history"
        )

    history = (
        db.query(DriverAvailabilityHistory)
        .filter(DriverAvailabilityHistory.driver_id == driver_id)
        .order_by(DriverAvailabilityHistory.changed_at.desc())
        .all()
    )
    return history


@router.get(
    "/{driver_id}/availability-analytics",
    response_model=DriverAvailabilityAnalyticsResponse,
)
def get_driver_availability_analytics(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if (
        current_user.role == "driver"
        and current_user.driver_profile
        and current_user.driver_profile.id != driver_id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this driver analytics"
        )

    history = (
        db.query(DriverAvailabilityHistory)
        .filter(DriverAvailabilityHistory.driver_id == driver_id)
        .order_by(DriverAvailabilityHistory.changed_at.asc())
        .all()
    )

    if not history:
        return {
            "driver_id": driver.id,
            "driver_name": driver.name,
            "available_minutes": 0,
            "on_trip_minutes": 0,
            "inactive_minutes": 0,
            "total_observed_minutes": 0,
        }

    available_minutes = 0
    on_trip_minutes = 0
    inactive_minutes = 0
    now = datetime.utcnow()

    for index, entry in enumerate(history):
        if index == len(history) - 1:
            end_time = now
        else:
            end_time = history[index + 1].changed_at

        if end_time <= entry.changed_at:
            continue

        duration_minutes = int((end_time - entry.changed_at).total_seconds() // 60)
        if entry.status == "available":
            available_minutes += duration_minutes
        elif entry.status == "on_trip":
            on_trip_minutes += duration_minutes
        elif entry.status == "inactive":
            inactive_minutes += duration_minutes

    return {
        "driver_id": driver.id,
        "driver_name": driver.name,
        "available_minutes": available_minutes,
        "on_trip_minutes": on_trip_minutes,
        "inactive_minutes": inactive_minutes,
        "total_observed_minutes": available_minutes
        + on_trip_minutes
        + inactive_minutes,
    }


@router.get(
    "/{driver_id}/daily-availability-analytics",
    response_model=list[DriverDailyAvailabilityAnalyticsResponse],
)
def get_driver_daily_availability_analytics(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if (
        current_user.role == "driver"
        and current_user.driver_profile
        and current_user.driver_profile.id != driver_id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this driver analytics"
        )

    history = (
        db.query(DriverAvailabilityHistory)
        .filter(DriverAvailabilityHistory.driver_id == driver_id)
        .order_by(DriverAvailabilityHistory.changed_at.asc())
        .all()
    )

    daily_groups = {}
    now = datetime.utcnow()

    for index, entry in enumerate(history):
        if index == len(history) - 1:
            end_time = now
        else:
            end_time = history[index + 1].changed_at

        if end_time <= entry.changed_at:
            continue

        duration_minutes = int((end_time - entry.changed_at).total_seconds() // 60)
        day_key = entry.changed_at.date().isoformat()

        if day_key not in daily_groups:
            daily_groups[day_key] = {
                "date": day_key,
                "available_minutes": 0,
                "on_trip_minutes": 0,
                "inactive_minutes": 0,
            }

        if entry.status == "available":
            daily_groups[day_key]["available_minutes"] += duration_minutes
        elif entry.status == "on_trip":
            daily_groups[day_key]["on_trip_minutes"] += duration_minutes
        elif entry.status == "inactive":
            daily_groups[day_key]["inactive_minutes"] += duration_minutes

    result = []
    for day_key in sorted(daily_groups):
        item = daily_groups[day_key]
        item["total_observed_minutes"] = (
            item["available_minutes"]
            + item["on_trip_minutes"]
            + item["inactive_minutes"]
        )
        result.append(item)

    return result


@router.get("/{driver_id}/trips", response_model=List[TripResponse])
def get_driver_trip_history(
    driver_id: int,
    status: Optional[str] = Query(None, description="Filter by trip status"),
    created_after: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    query = (
        db.query(Trip)
        .options(selectinload(Trip.driver))
        .filter(Trip.driver_id == driver_id)
    )

    valid_statuses = {"assigned", "started", "completed", "cancelled"}
    if status:
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Trip.status == status)

    if created_after and created_before:
        query = query.filter(
            and_(Trip.created_at >= created_after, Trip.created_at <= created_before)
        )
    elif created_after:
        query = query.filter(Trip.created_at >= created_after)
    elif created_before:
        query = query.filter(Trip.created_at <= created_before)

    trips = query.order_by(Trip.created_at.desc()).offset(offset).limit(limit).all()

    return trips
