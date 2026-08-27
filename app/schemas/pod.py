from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PODCreate(BaseModel):
    recipient_name: str
    recipient_phone: Optional[str] = None
    signature_data: str  # Base64 PNG signature string
    delivery_photo_url: Optional[str] = None
    delivery_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PODResponse(BaseModel):
    id: int
    trip_id: int
    driver_id: int
    recipient_name: str
    recipient_phone: Optional[str] = None
    signature_data: str
    delivery_photo_url: Optional[str] = None
    delivery_notes: Optional[str] = None
    delivered_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: str

    model_config = ConfigDict(from_attributes=True)
