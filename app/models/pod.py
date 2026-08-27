from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class ProofOfDelivery(Base):
    __tablename__ = "proof_of_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(
        Integer, ForeignKey("trips.id"), unique=True, nullable=False, index=True
    )
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    recipient_name = Column(String, nullable=False)
    recipient_phone = Column(String, nullable=True)
    signature_data = Column(Text, nullable=False)  # Base64 encoded PNG signature string
    delivery_photo_url = Column(String, nullable=True)
    delivery_notes = Column(Text, nullable=True)

    delivered_at = Column(DateTime, default=get_now_ist_naive, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    verification_status = Column(
        String, default="verified", nullable=False
    )  # verified, disputed

    trip = relationship("Trip", backref="proof_of_delivery")
    driver = relationship("Driver", backref="proof_of_deliveries")
