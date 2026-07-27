from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class FuelTheftAlert(Base):
    __tablename__ = "fuel_theft_alerts"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    fuel_log_id = Column(Integer, ForeignKey("fuel_logs.id"), nullable=True)

    alert_type = Column(
        String, nullable=False
    )  # offsite_refuel_fraud, abnormal_consumption_spike, siphoning_detected
    severity = Column(
        String, default="high", nullable=False
    )  # low, medium, high, critical
    detected_loss_liters = Column(Float, default=0.0, nullable=False)
    estimated_financial_loss = Column(Float, default=0.0, nullable=False)
    description = Column(String, nullable=False)
    status = Column(
        String, default="unresolved", nullable=False
    )  # unresolved, confirmed_theft, dismissed
    resolution_notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=get_now_ist_naive, nullable=False)

    driver = relationship("Driver", backref="fuel_theft_alerts")
    vehicle = relationship("Vehicle", backref="fuel_theft_alerts")
    fuel_log = relationship("FuelLog", backref="theft_alerts")
