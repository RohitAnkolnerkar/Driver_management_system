"""
Razorpay Payment Gateway API
Handles order creation, payment verification, and FASTag wallet top-up.

Flow:
  1. POST /razorpay/create-order  → create Razorpay order, return order_id to frontend
  2. Frontend opens Razorpay Checkout with order_id
  3. POST /razorpay/verify-payment → verify HMAC signature, top up fasttag balance
"""

import hashlib
import hmac
import logging
from typing import Optional

import razorpay
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.config import settings
from app.models.vehicle import Vehicle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/razorpay", tags=["razorpay"])


def _get_razorpay_client() -> razorpay.Client:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.",
        )
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


# ─────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────


class CreateOrderRequest(BaseModel):
    amount: float  # Amount in ₹ (we convert to paise)
    currency: str = "INR"
    vehicle_id: Optional[int] = None  # Which vehicle's FASTag to top up
    notes: Optional[dict] = None


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int  # In paise
    currency: str
    key_id: str  # Sent to frontend to open checkout


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    vehicle_id: Optional[int] = None  # If set, top up the vehicle's FASTag
    amount: Optional[float] = None  # Original amount in ₹


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    new_fasttag_balance: Optional[float] = None
    payment_id: str


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────


@router.post("/create-order", response_model=CreateOrderResponse)
def create_razorpay_order(
    body: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    """
    Step 1 of the payment flow.
    Creates a Razorpay order and returns the order_id for the frontend checkout.
    Amount is expected in ₹; Razorpay works in paise (multiply by 100).
    """
    if body.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be a positive value.",
        )

    client = _get_razorpay_client()

    # Razorpay amounts are in paise (1 ₹ = 100 paise)
    amount_paise = int(round(body.amount * 100))

    notes = body.notes or {}
    if body.vehicle_id:
        notes["vehicle_id"] = str(body.vehicle_id)
        notes["purpose"] = "fasttag_recharge"

    try:
        order = client.order.create(
            {
                "amount": amount_paise,
                "currency": body.currency,
                "payment_capture": 1,  # Auto-capture on payment
                "notes": notes,
            }
        )
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create Razorpay order: {str(exc)}",
        )

    return CreateOrderResponse(
        order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.RAZORPAY_KEY_ID,
    )


@router.post("/verify-payment", response_model=VerifyPaymentResponse)
def verify_razorpay_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    """
    Step 3 of the payment flow.
    Verifies the Razorpay HMAC-SHA256 signature.
    On success, tops up the vehicle's FASTag balance (if vehicle_id is provided).
    """
    # ── 1. Verify signature ──────────────────────────────────────────────────
    expected_sig = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg=f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, body.razorpay_signature):
        logger.warning(
            "Invalid Razorpay signature for order %s / payment %s",
            body.razorpay_order_id,
            body.razorpay_payment_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed: invalid signature. Do not trust this payment.",
        )

    # ── 2. Apply business action: top up FASTag balance ─────────────────────
    new_balance = None
    if body.vehicle_id and body.amount and body.amount > 0:
        vehicle = db.query(Vehicle).filter(Vehicle.id == body.vehicle_id).first()
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vehicle {body.vehicle_id} not found.",
            )
        vehicle.fasttag_balance += body.amount
        db.commit()
        db.refresh(vehicle)
        new_balance = vehicle.fasttag_balance
        logger.info(
            "FASTag recharged for vehicle %s: +₹%.2f → new balance ₹%.2f",
            vehicle.license_plate,
            body.amount,
            new_balance,
        )

    return VerifyPaymentResponse(
        success=True,
        message=(
            f"Payment ₹{body.amount:.2f} verified and FASTag wallet recharged successfully."
            if new_balance is not None
            else "Payment verified successfully."
        ),
        new_fasttag_balance=new_balance,
        payment_id=body.razorpay_payment_id,
    )


@router.get("/config")
def get_razorpay_config(
    current_user=Depends(require_roles("admin", "dispatcher")),
):
    """Returns the Razorpay Key ID (public) for the frontend to use in checkout."""
    if not settings.RAZORPAY_KEY_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured on this server.",
        )
    return {"key_id": settings.RAZORPAY_KEY_ID}
