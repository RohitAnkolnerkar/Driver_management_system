from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base
import datetime


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    status = Column(String, default="available")  # available, on_trip, inactive
    license_number = Column(String)
    license_expiry = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship(
        "User",
        back_populates="driver_profile",
        primaryjoin="Driver.user_id == User.id",
        foreign_keys="[Driver.user_id]",
    )
    availability_history = relationship(
        "DriverAvailabilityHistory",
        back_populates="driver",
        cascade="all, delete-orphan",
        order_by="DriverAvailabilityHistory.changed_at.desc()",
    )


class DriverAvailabilityHistory(Base):
    __tablename__ = "driver_availability_history"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    status = Column(String, nullable=False)
    changed_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    note = Column(String, nullable=True)

    driver = relationship("Driver", back_populates="availability_history")
    