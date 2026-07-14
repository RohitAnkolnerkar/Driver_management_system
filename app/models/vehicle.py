import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String, nullable=False)
    model = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    license_plate = Column(String, unique=True, nullable=False, index=True)
    odometer_km = Column(Float, default=0.0, nullable=False)
    status = Column(
        String, default="active", nullable=False
    )  # active, maintenance, inactive
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    assigned_driver = relationship(
        "Driver",
        back_populates="vehicle",
        uselist=False,
        primaryjoin="Driver.vehicle_id == Vehicle.id",
        foreign_keys="[Driver.vehicle_id]",
    )


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(
        Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False
    )
    service_type = Column(
        String, nullable=False
    )  # oil_change, tire_rotation, brakes, engine, repair, inspection, other
    description = Column(String, nullable=True)
    cost = Column(Float, default=0.0, nullable=False)
    odometer_at_service = Column(Float, nullable=False)
    service_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    next_service_due_odometer = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    vehicle = relationship("Vehicle", back_populates="maintenance_logs")


# Inject maintenance_logs into Vehicle to avoid circular imports if
# needed, or simply declare it in the class.
# We will define relationship in Vehicle model now:
Vehicle.maintenance_logs = relationship(
    "MaintenanceLog",
    back_populates="vehicle",
    cascade="all, delete-orphan",
    order_by="MaintenanceLog.service_date.desc()",
)
