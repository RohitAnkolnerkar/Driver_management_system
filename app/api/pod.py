import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.time_utils import get_now_ist_naive
from app.db import get_db
from app.models.driver import Driver
from app.models.notification import Notification
from app.models.pod import ProofOfDelivery
from app.models.trip import Trip, TripHistory
from app.models.vehicle import Vehicle
from app.schemas.pod import PODCreate, PODResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["proof-of-delivery"])


@router.post(
    "/{trip_id}/pod", response_model=PODResponse, status_code=status.HTTP_201_CREATED
)
def submit_proof_of_delivery(
    trip_id: int,
    pod_in: PODCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    """
    Submits Electronic Proof of Delivery (e-POD) with Base64 customer signature.
    Auto-completes the trip, sets end_time, releases driver and vehicle statuses,
    and logs a persistent verification notification.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status == "completed":
        # Check if POD already exists
        existing_pod = (
            db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
        )
        if existing_pod:
            return existing_pod
        raise HTTPException(status_code=400, detail="Trip is already completed.")

    if trip.status in ("cancelled",):
        raise HTTPException(
            status_code=400, detail="Cannot submit POD for a cancelled trip."
        )

    # Driver verification
    driver = None
    if current_user.role == "driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
        if not driver or trip.driver_id != driver.id:
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to submit POD for this trip.",
            )
    else:
        if trip.driver_id:
            driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()

    driver_id_val = driver.id if driver else trip.driver_id
    if not driver_id_val:
        first_d = db.query(Driver).first()
        if first_d:
            driver_id_val = first_d.id
    now = get_now_ist_naive()

    # Create Proof of Delivery
    pod = ProofOfDelivery(
        trip_id=trip.id,
        driver_id=driver_id_val,
        recipient_name=pod_in.recipient_name,
        recipient_phone=pod_in.recipient_phone,
        signature_data=pod_in.signature_data,
        delivery_photo_url=pod_in.delivery_photo_url,
        delivery_notes=pod_in.delivery_notes,
        delivered_at=now,
        latitude=pod_in.latitude or trip.destination_latitude,
        longitude=pod_in.longitude or trip.destination_longitude,
        verification_status="verified",
    )
    db.add(pod)

    # Auto-complete Trip
    trip.status = "completed"
    if not trip.end_time:
        trip.end_time = now

    # Record Trip History
    db.add(
        TripHistory(
            trip_id=trip.id,
            status="completed",
            note=f"e-POD verified & submitted by recipient '{pod_in.recipient_name}'",
        )
    )

    # Release Driver Status
    if driver:
        driver.status = "available"

    # Release Vehicle Status
    if trip.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
        if v and v.status != "maintenance":
            v.status = "active"

    # Log Notification
    notif_msg = f"e-POD verified for Trip #{trip.id} ({trip.source} → {trip.destination}). Recipient: {pod_in.recipient_name}."
    db.add(
        Notification(
            title=f"Proof of Delivery Verified - Trip #{trip.id}",
            message=notif_msg,
            category="compliance",
            severity="info",
            is_read=False,
            created_at=now,
        )
    )

    db.commit()
    db.refresh(pod)
    logger.info(
        f"e-POD successfully submitted for Trip #{trip.id} by {pod_in.recipient_name}"
    )
    return pod


@router.get("/{trip_id}/pod", response_model=PODResponse)
def get_proof_of_delivery(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    """
    Retrieves submitted Electronic Proof of Delivery (e-POD) for a trip.
    """
    pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    if not pod:
        raise HTTPException(
            status_code=404, detail="Proof of Delivery not found for this trip."
        )
    return pod
