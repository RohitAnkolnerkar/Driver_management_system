from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    status = Column(String, default="available")  # available, on_trip, inactive
    license_number = Column(String, unique=True, nullable=True)
    license_expiry = Column(DateTime)
    created_at = Column(DateTime, default=get_now_ist_naive)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)

    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)

    base_salary = Column(Float, default=0.0, nullable=False)
    commission_percentage = Column(Float, default=0.0, nullable=False)
    licensed_vehicle_class = Column(
        String, default="HMV", nullable=False
    )  # HMV, LMV, Transport
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    @property
    def odometer_km(self) -> float:
        return self.vehicle.odometer_km if self.vehicle else 0.0

    @odometer_km.setter
    def odometer_km(self, value: float):
        if self.vehicle:
            self.vehicle.odometer_km = value

    @property
    def vehicle_type(self) -> str:
        return self.vehicle.vehicle_type if self.vehicle else "cargo_truck"

    @vehicle_type.setter
    def vehicle_type(self, value: str):
        if self.vehicle:
            self.vehicle.vehicle_type = value

    user = relationship(
        "User",
        back_populates="driver_profile",
        primaryjoin="Driver.user_id == User.id",
        foreign_keys="[Driver.user_id]",
    )
    vehicle = relationship(
        "Vehicle", back_populates="assigned_driver", foreign_keys="[Driver.vehicle_id]"
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
    changed_at = Column(DateTime, default=get_now_ist_naive, nullable=False)
    note = Column(String, nullable=True)

    driver = relationship("Driver", back_populates="availability_history")


class DriverLocationHistory(Base):
    __tablename__ = "driver_location_history"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=get_now_ist_naive, nullable=False)

    driver = relationship("Driver", backref="location_history")
    trip = relationship("Trip", backref="location_history")


class DriverPayment(Base):
    __tablename__ = "driver_payments"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    base_salary_paid = Column(Float, nullable=False, default=0.0)
    commission_paid = Column(Float, nullable=False, default=0.0)
    bonus = Column(Float, nullable=False, default=0.0)
    deductions = Column(Float, nullable=False, default=0.0)
    advance_payment = Column(Float, nullable=False, default=0.0)
    personal_fuel_expense = Column(Float, nullable=False, default=0.0)
    total_paid = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="pending")  # pending, paid
    paid_at = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=get_now_ist_naive)

    driver = relationship("Driver", backref="payments")

    __table_args__ = (
        UniqueConstraint(
            "driver_id", "year", "month", name="uq_driver_payment_month_year"
        ),
    )
