import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

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
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    driver = relationship("Driver", backref="fuel_logs")
