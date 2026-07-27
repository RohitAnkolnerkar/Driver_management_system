from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class InvoiceLineItem(BaseModel):
    description: str
    amount: float


class TripInvoiceResponse(BaseModel):
    invoice_number: str
    issue_date: str
    trip_id: int
    source: str
    destination: str
    client_name: str
    vehicle_type: Optional[str] = None
    driver_name: Optional[str] = None
    distance_km: float
    line_items: List[InvoiceLineItem]
    subtotal: float
    tax_rate_percent: float
    tax_amount: float
    total_amount: float
    payment_status: str

    model_config = ConfigDict(from_attributes=True)
