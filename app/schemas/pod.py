from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProofOfDeliveryCreate(BaseModel):
    recipient_name: str = Field(..., min_length=2)
    recipient_signature: Optional[str] = Field(
        default=None, description="Base64 signature representation"
    )
    delivery_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ProofOfDeliveryResponse(BaseModel):
    id: int
    trip_id: int
    recipient_name: str
    recipient_signature: Optional[str] = None
    delivery_notes: Optional[str] = None
    delivered_at: str
    geofence_verified: bool

    model_config = ConfigDict(from_attributes=True)
