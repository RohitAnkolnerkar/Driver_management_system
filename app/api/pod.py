import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.trip import ProofOfDelivery, Trip
from app.models.user import User
from app.schemas.pod import ProofOfDeliveryCreate, ProofOfDeliveryResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["proof-of-delivery"])


@router.post(
    "/{trip_id}/proof-of-delivery",
    response_model=ProofOfDeliveryResponse,
)
def submit_proof_of_delivery(
    trip_id: int,
    pod_in: ProofOfDeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Submit PoD failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    # Check existing PoD
    existing = (
        db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    )
    if existing:
        existing.recipient_name = pod_in.recipient_name
        existing.recipient_signature = (
            pod_in.recipient_signature or existing.recipient_signature
        )
        existing.delivery_notes = pod_in.delivery_notes
        db.commit()
        db.refresh(existing)
        return ProofOfDeliveryResponse(
            id=existing.id,
            trip_id=existing.trip_id,
            recipient_name=existing.recipient_name,
            recipient_signature=existing.recipient_signature,
            delivery_notes=existing.delivery_notes,
            delivered_at=existing.delivered_at.isoformat(),
            geofence_verified=existing.geofence_verified,
        )

    pod = ProofOfDelivery(
        trip_id=trip_id,
        recipient_name=pod_in.recipient_name,
        recipient_signature=pod_in.recipient_signature,
        delivery_notes=pod_in.delivery_notes,
        geofence_verified=True,
    )
    db.add(pod)
    db.commit()
    db.refresh(pod)

    return ProofOfDeliveryResponse(
        id=pod.id,
        trip_id=pod.trip_id,
        recipient_name=pod.recipient_name,
        recipient_signature=pod.recipient_signature,
        delivery_notes=pod.delivery_notes,
        delivered_at=pod.delivered_at.isoformat(),
        geofence_verified=pod.geofence_verified,
    )


@router.get(
    "/{trip_id}/proof-of-delivery",
    response_model=ProofOfDeliveryResponse,
)
def get_proof_of_delivery(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    if not pod:
        logger.warning(
            f"Get PoD failed: Proof of Delivery not found for trip {trip_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proof of Delivery not found for this trip",
        )

    return ProofOfDeliveryResponse(
        id=pod.id,
        trip_id=pod.trip_id,
        recipient_name=pod.recipient_name,
        recipient_signature=pod.recipient_signature,
        delivery_notes=pod.delivery_notes,
        delivered_at=pod.delivered_at.isoformat(),
        geofence_verified=pod.geofence_verified,
    )
