from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class PreTripInspection(Base):
    __tablename__ = "pre_trip_inspections"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(
        Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_id = Column(
        Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False
    )

    brakes_passed = Column(Boolean, default=True, nullable=False)
    tires_passed = Column(Boolean, default=True, nullable=False)
    lights_passed = Column(Boolean, default=True, nullable=False)
    steering_passed = Column(Boolean, default=True, nullable=False)
    fluids_passed = Column(Boolean, default=True, nullable=False)
    is_safe = Column(Boolean, default=True, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=get_now_ist_naive, nullable=False)

    trip = relationship("Trip", back_populates="pre_trip_inspection")
    driver = relationship("Driver")
    vehicle = relationship("Vehicle")
