import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.invoice import InvoiceLineItem, TripInvoiceResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["invoicing"])


@router.get(
    "/{trip_id}/invoice",
    response_model=TripInvoiceResponse,
)
def get_trip_invoice(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        logger.warning(f"Get trip invoice failed: Trip {trip_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
        )

    base_fare = 500.0
    dist_km = trip.distance_km or 10.0
    dist_charge = round(dist_km * 25.0, 2)
    line_items = [
        InvoiceLineItem(
            description=(
                f"Base Freight Dispatch Fee ({trip.source} ➔ {trip.destination})"
            ),
            amount=base_fare,
        ),
        InvoiceLineItem(
            description=f"Distance Tariff ({dist_km:.1f} km @ ₹25/km)",
            amount=dist_charge,
        ),
    ]

    cargo_w = trip.cargo_weight_kg or 1000.0
    if cargo_w > 1000.0:
        weight_surcharge = round(((cargo_w - 1000.0) / 100.0) * 2.0, 2)
        line_items.append(
            InvoiceLineItem(
                description=f"Excess Cargo Weight Surcharge ({cargo_w:.0f} kg)",
                amount=weight_surcharge,
            )
        )

    if trip.detention_charge and trip.detention_charge > 0:
        b_hrs = trip.detention_billable_hours or 0.0
        rate = trip.detention_hourly_rate or 500.0
        desc = f"Warehouse Detention Fee ({b_hrs} hrs @ ₹{rate:.0f}/hr)"
        line_items.append(
            InvoiceLineItem(
                description=desc,
                amount=trip.detention_charge,
            )
        )

    subtotal = sum(item.amount for item in line_items)
    if trip.estimated_fare and trip.estimated_fare > 0:
        base_calc = trip.estimated_fare
        if trip.detention_charge and trip.detention_charge > 0:
            subtotal = base_calc + trip.detention_charge
        else:
            subtotal = base_calc

    tax_rate = 18.0
    tax_amount = round((subtotal * tax_rate) / 100.0, 2)
    total_amount = round(subtotal + tax_amount, 2)

    inv_num = f"INV-TRIP-{trip.id:05d}"
    issue_dt = trip.created_at.strftime("%Y-%m-%d") if trip.created_at else "2026-07-20"

    client_n = (
        trip.destination_company or trip.source_company or f"Client Dispatch #{trip.id}"
    )

    return TripInvoiceResponse(
        invoice_number=inv_num,
        issue_date=issue_dt,
        trip_id=trip.id,
        source=trip.source,
        destination=trip.destination,
        client_name=client_n,
        vehicle_type=trip.vehicle.vehicle_type if trip.vehicle else None,
        driver_name=trip.driver.name if trip.driver else None,
        distance_km=dist_km,
        line_items=line_items,
        subtotal=round(subtotal, 2),
        tax_rate_percent=tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        payment_status="paid" if trip.status == "completed" else "pending",
    )
