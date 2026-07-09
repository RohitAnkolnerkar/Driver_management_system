import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


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

    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)

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


class DriverLocationHistory(Base):
    __tablename__ = "driver_location_history"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    driver = relationship("Driver", backref="location_history")
    trip = relationship("Trip", backref="location_history")
