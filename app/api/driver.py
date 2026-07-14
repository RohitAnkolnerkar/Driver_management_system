import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.db import get_db
from app.models.driver import (
    Driver,
    DriverAvailabilityHistory,
    DriverLocationHistory,
    DriverPayment,
)
from app.models.trip import Trip
from app.schemas.driver import (
    DispatcherWorkloadSummaryResponse,
    DriverAvailabilityAnalyticsResponse,
    DriverAvailabilityHistoryResponse,
    DriverCreate,
    DriverCreateResponse,
    DriverDailyAvailabilityAnalyticsResponse,
    DriverEarningsResponse,
    DriverLeaderboardResponse,
    DriverLocationResponse,
    DriverLocationUpdate,
    DriverPaymentResponse,
    DriverPaymentUpdate,
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


def validate_indian_license(license_num: str) -> str:
    cleaned = license_num.strip().upper()
    pattern = r"^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$"
    if not re.match(pattern, cleaned):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid Indian driving license format. "
                "Must be in format SS-RR-YYYY-NNNNNNN "
                "(e.g., MH-12-2018-0004567 or MH1220180004567)."
            ),
        )
    return cleaned


@router.post("/location", response_model=DriverLocationResponse)
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

    near_destination = False
    active_trip_id = None
    active_trip_destination = None

    if active_trip:
        history_entry.trip_id = active_trip.id

        # Geofencing arrival check
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

            # Within 100 metres: signal the driver instead of auto-completing
            if dist < 0.1:
                near_destination = True
                active_trip_id = active_trip.id
                active_trip_destination = active_trip.destination

    db.commit()
    db.refresh(driver)

    # Trigger WebSocket real-time update broadcast
    from app.api.ws import broadcast_update

    broadcast_update(
        {
            "type": "location_update",
            "driver_id": driver.id,
            "driver_name": driver.name,
            "latitude": driver.current_latitude,
            "longitude": driver.current_longitude,
            "status": driver.status,
            "active_trip_id": active_trip_id,
            "near_destination": near_destination,
        }
    )

    # Build response with arrival signal
    response_data = DriverLocationResponse.model_validate(driver)
    response_data.near_destination = near_destination
    response_data.active_trip_id = active_trip_id
    response_data.active_trip_destination = active_trip_destination
    return response_data


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

    license_num = driver.license_number
    if license_num:
        license_num = validate_indian_license(license_num)

    driver_data = {
        "name": driver.name,
        "phone": driver.phone,
        "license_number": license_num,
        "license_expiry": driver.license_expiry,
        "user_id": user_id,
        "base_salary": driver.base_salary,
        "commission_percentage": driver.commission_percentage,
        "vehicle_type": driver.vehicle_type,
        "odometer_km": driver.odometer_km,
        "vehicle_id": driver.vehicle_id,
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
            "base_salary": db_driver.base_salary,
            "commission_percentage": db_driver.commission_percentage,
            "vehicle_type": db_driver.vehicle_type,
            "odometer_km": db_driver.odometer_km,
            "vehicle_id": db_driver.vehicle_id,
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
            func.coalesce(func.sum(Trip.distance_km), 0.0).label("total_distance_km"),
            func.coalesce(func.sum(Trip.duration_minutes), 0).label(
                "total_duration_minutes"
            ),
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

    results = []
    for row in rows:
        trips_list = db.query(Trip).filter(
            Trip.driver_id == row.driver_id, Trip.status == "completed"
        )
        if completed_after:
            trips_list = trips_list.filter(Trip.end_time >= completed_after)
        if completed_before:
            trips_list = trips_list.filter(Trip.end_time <= completed_before)

        completed_trips_data = trips_list.all()

        speed_violations_or_delays = 0
        for t in completed_trips_data:
            dist = t.distance_km or 0.0
            dur = t.duration_minutes or 0
            if dist > 0.0 and dur > 0:
                speed_kmh = dist / (dur / 60.0)
                # Flag speed under 20km/h (excessive traffic delay) or
                # over 100km/h (speeding violation)
                if speed_kmh < 20.0 or speed_kmh > 100.0:
                    speed_violations_or_delays += 1

        total_trips_count = len(completed_trips_data)
        if total_trips_count > 0:
            on_time_rate = max(
                60.0, 100.0 - (speed_violations_or_delays / total_trips_count) * 40.0
            )
            average_speed_kmh = (
                row.total_distance_km / (row.total_duration_minutes / 60.0)
                if row.total_duration_minutes > 0
                else 0.0
            )
        else:
            on_time_rate = 100.0
            average_speed_kmh = 0.0

        results.append(
            {
                "driver_id": row.driver_id,
                "name": row.name,
                "phone": row.phone,
                "completed_trips": int(row.completed_trips),
                "total_earnings": float(row.total_earnings),
                "average_fare": round(float(row.average_fare), 2),
                "total_distance_km": round(float(row.total_distance_km), 2),
                "total_duration_minutes": int(row.total_duration_minutes),
                "average_speed_kmh": round(float(average_speed_kmh), 2),
                "on_time_rate": round(float(on_time_rate), 2),
            }
        )
    return results


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


@router.get("/payments", response_model=list[DriverPaymentResponse])
def list_payments(
    driver_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    query = db.query(DriverPayment)
    if driver_id is not None:
        query = query.filter(DriverPayment.driver_id == driver_id)
    if year is not None:
        query = query.filter(DriverPayment.year == year)
    if month is not None:
        query = query.filter(DriverPayment.month == month)
    if status is not None:
        query = query.filter(DriverPayment.status == status)
    return query.order_by(DriverPayment.year.desc(), DriverPayment.month.desc()).all()


@router.get("/{driver_id}/payments", response_model=list[DriverPaymentResponse])
def get_driver_payments(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if current_user.role == "driver" and (
        not current_user.driver_profile or current_user.driver_profile.id != driver_id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view payments for this driver"
        )

    return (
        db.query(DriverPayment)
        .filter(DriverPayment.driver_id == driver_id)
        .order_by(DriverPayment.year.desc(), DriverPayment.month.desc())
        .all()
    )


@router.post("/{driver_id}/payments/generate", response_model=DriverPaymentResponse)
def generate_driver_payment(
    driver_id: int,
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    existing_payment = (
        db.query(DriverPayment)
        .filter(
            DriverPayment.driver_id == driver_id,
            DriverPayment.year == year,
            DriverPayment.month == month,
        )
        .first()
    )
    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment record for driver {driver.name} "
                f"for {year}-{month:02d} already exists"
            ),
        )

    import calendar

    start_date = datetime(year, month, 1, 0, 0, 0)
    _, last_day = calendar.monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59, 999999)

    trips_query = db.query(Trip).filter(
        Trip.driver_id == driver_id,
        Trip.status == "completed",
        Trip.end_time >= start_date,
        Trip.end_time <= end_date,
    )
    completed_trips = trips_query.all()
    total_fares = sum(float(t.estimated_fare or 0.0) for t in completed_trips)

    commission = total_fares * (driver.commission_percentage / 100.0)
    base_salary_payout = driver.base_salary
    total_paid = base_salary_payout + commission

    db_payment = DriverPayment(
        driver_id=driver_id,
        year=year,
        month=month,
        base_salary_paid=base_salary_payout,
        commission_paid=commission,
        bonus=0.0,
        deductions=0.0,
        total_paid=total_paid,
        status="pending",
    )
    db.add(db_payment)
    try:
        db.commit()
        db.refresh(db_payment)
        return db_payment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Database integrity error during payment generation"
        )


@router.patch("/payments/{payment_id}", response_model=DriverPaymentResponse)
def update_driver_payment(
    payment_id: int,
    payment_update: DriverPaymentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    payment = db.query(DriverPayment).filter(DriverPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if payment_update.base_salary_paid is not None:
        payment.base_salary_paid = payment_update.base_salary_paid
    if payment_update.commission_paid is not None:
        payment.commission_paid = payment_update.commission_paid
    if payment_update.bonus is not None:
        payment.bonus = payment_update.bonus
    if payment_update.deductions is not None:
        payment.deductions = payment_update.deductions
    if payment_update.status is not None:
        payment.status = payment_update.status
        if payment_update.status == "paid":
            payment.paid_at = datetime.utcnow()
    if payment_update.payment_method is not None:
        payment.payment_method = payment_update.payment_method
    if payment_update.note is not None:
        payment.note = payment_update.note

    # Recalculate total_paid
    payment.total_paid = (
        payment.base_salary_paid
        + payment.commission_paid
        + payment.bonus
        - payment.deductions
    )

    try:
        db.commit()
        db.refresh(payment)
        return payment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Database integrity error during payment update"
        )


@router.delete("/payments/{payment_id}")
def delete_driver_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    payment = db.query(DriverPayment).filter(DriverPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if payment.status == "paid":
        raise HTTPException(
            status_code=400, detail="Cannot delete a paid payment record"
        )

    db.delete(payment)
    db.commit()
    return {"message": "Payment record deleted successfully"}


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
        driver.license_number = validate_indian_license(driver_update.license_number)
    if driver_update.license_expiry is not None:
        driver.license_expiry = driver_update.license_expiry
    if driver_update.base_salary is not None:
        driver.base_salary = driver_update.base_salary
    if driver_update.commission_percentage is not None:
        driver.commission_percentage = driver_update.commission_percentage
    if driver_update.vehicle_type is not None:
        driver.vehicle_type = driver_update.vehicle_type
    if driver_update.odometer_km is not None:
        driver.odometer_km = driver_update.odometer_km
    if "vehicle_id" in driver_update.model_fields_set:
        driver.vehicle_id = driver_update.vehicle_id

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


@router.get("/payments/export")
def export_driver_payments(
    driver_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    query = db.query(DriverPayment)
    if driver_id is not None:
        query = query.filter(DriverPayment.driver_id == driver_id)
    if year is not None:
        query = query.filter(DriverPayment.year == year)
    if month is not None:
        query = query.filter(DriverPayment.month == month)
    if status is not None and status.strip():
        query = query.filter(DriverPayment.status == status)

    payments = query.order_by(
        DriverPayment.year.desc(), DriverPayment.month.desc()
    ).all()

    import csv
    import io

    from fastapi.responses import StreamingResponse

    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(
        [
            "Payment ID",
            "Driver ID",
            "Driver Name",
            "Driver Phone",
            "Year",
            "Month",
            "Base Salary Paid",
            "Commission Paid",
            "Bonus",
            "Deductions",
            "Total Paid",
            "Status",
            "Processed At",
            "Payment Method",
            "Notes",
        ]
    )

    for p in payments:
        driver = db.query(Driver).filter(Driver.id == p.driver_id).first()
        driver_name = driver.name if driver else "Unknown"
        driver_phone = driver.phone if driver else "Unknown"
        writer.writerow(
            [
                p.id,
                p.driver_id,
                driver_name,
                driver_phone,
                p.year,
                p.month,
                p.base_salary_paid,
                p.commission_paid,
                p.bonus,
                p.deductions,
                p.total_paid,
                p.status,
                p.paid_at.isoformat() if p.paid_at else "N/A",
                p.payment_method or "N/A",
                p.note or "",
            ]
        )

    output.seek(0)

    headers = {"Content-Disposition": "attachment; filename=driver_payments_export.csv"}
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers=headers,
    )


@router.get("/payments/{payment_id}/invoice")
def get_payment_invoice(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    payment = db.query(DriverPayment).filter(DriverPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # Authorize: admin, dispatcher, or the specific driver who owns the payment profile
    if current_user.role == "driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
        if not driver or payment.driver_id != driver.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view invoice for this payment",
            )
    else:
        # admins and dispatchers can see everything, let's load the driver info
        driver = db.query(Driver).filter(Driver.id == payment.driver_id).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Associated driver not found")

    from fastapi.responses import StreamingResponse

    from app.core.pdf import generate_payout_pdf

    pdf_buffer = generate_payout_pdf(payment, driver)

    headers = {"Content-Disposition": f"attachment; filename=invoice_{payment_id}.pdf"}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
