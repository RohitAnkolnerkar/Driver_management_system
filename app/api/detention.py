import logging
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.time_utils import get_now_ist_naive
from app.models.trip import Trip
from app.models.user import User
from app.schemas.detention import DetentionClockResponse, DetentionClockUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["detention-billing"])


def calculate_detention_metrics(trip: Trip) -> DetentionClockResponse:
    now = get_now_ist_naive()
    start_time = trip.detention_start_time
    end_time = trip.detention_end_time or (now if start_time else None)

    grace_min = trip.detention_grace_minutes or 120
    rate = trip.detention_hourly_rate or 500.0

    if not start_time:
        return DetentionClockResponse(
            trip_id=trip.id,
            detention_start_time=None,
            detention_end_time=None,
            elapsed_minutes=0.0,
            grace_minutes=grace_min,
            is_grace_exceeded=False,
            billable_hours=0.0,
            hourly_rate=rate,
            estimated_detention_charge=0.0,
            status_summary="Not arrived at dock (Clock inactive)",
        )

    elapsed_sec = (end_time - start_time).total_seconds()
    elapsed_min = round(max(0.0, elapsed_sec / 60.0), 1)

    excess_min = max(0.0, elapsed_min - float(grace_min))
    is_exceeded = excess_min > 0.0

    # Billable hours rounded up to nearest 0.5 hour increment
    if excess_min > 0:
        billable_hours = math.ceil((excess_min / 60.0) * 2.0) / 2.0
    else:
        billable_hours = 0.0
    charge = round(billable_hours * rate, 2)

    if trip.detention_end_time:
        status = f"Completed dock stay. {billable_hours} hrs billable (₹{charge})."
    elif is_exceeded:
        exc_m = round(excess_min, 0)
        status = f"⚠️ Grace period exceeded by {exc_m} min. Accruing ₹{charge}."
    else:
        rem_grace = round(grace_min - elapsed_min, 0)
        status = f"Free grace period active ({rem_grace} min remaining)."

    return DetentionClockResponse(
        trip_id=trip.id,
        detention_start_time=start_time.isoformat(),
        detention_end_time=end_time.isoformat() if end_time is not None else None,
        elapsed_minutes=round(elapsed_min, 1),
        grace_minutes=grace_min,
        is_grace_exceeded=is_exceeded,
        billable_hours=billable_hours,
        hourly_rate=rate,
        estimated_detention_charge=charge,
        status_summary=status,
    )


@router.get(
    "/{trip_id}/detention",
    response_model=DetentionClockResponse,
)
def get_detention_status(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Get detention status failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )
    return calculate_detention_metrics(trip)


@router.post(
    "/{trip_id}/detention/clock-in",
    response_model=DetentionClockResponse,
)
def clock_in_detention(
    trip_id: int,
    update_in: Optional[DetentionClockUpdate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Clock-in detention failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    trip.detention_start_time = get_now_ist_naive()
    trip.detention_end_time = None

    if update_in:
        if update_in.grace_minutes is not None:
            trip.detention_grace_minutes = update_in.grace_minutes
        if update_in.hourly_rate is not None:
            trip.detention_hourly_rate = update_in.hourly_rate

    db.commit()
    db.refresh(trip)
    return calculate_detention_metrics(trip)


@router.post(
    "/{trip_id}/detention/clock-out",
    response_model=DetentionClockResponse,
)
def clock_out_detention(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Clock-out detention failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    if not trip.detention_start_time:
        logger.warning(
            f"Clock-out detention failed: Trip {trip_id} has no start time recorded"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot clock out: Detention clock was never started",
        )

    trip.detention_end_time = get_now_ist_naive()
    metrics = calculate_detention_metrics(trip)

    trip.detention_billable_hours = metrics.billable_hours
    trip.detention_charge = metrics.estimated_detention_charge
    db.commit()
    db.refresh(trip)

    return metrics
