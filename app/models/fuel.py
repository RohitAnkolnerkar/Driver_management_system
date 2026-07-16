from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    liters_refueled = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    odometer = Column(Float, nullable=False)
    is_flagged_fraud = Column(Boolean, default=False, nullable=False)
    fraud_reason = Column(String, nullable=True)
    is_personal_two_wheeler = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=get_now_ist_naive, nullable=False)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)

    driver = relationship("Driver", backref="fuel_logs")
    trip = relationship("Trip", backref="fuel_logs")
