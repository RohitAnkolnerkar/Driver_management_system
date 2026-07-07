import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    source = Column(String, nullable=False)
    destination = Column(String, nullable=False)

    distance_km = Column(Float, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    estimated_fare = Column(Float, nullable=True)
    cancel_reason = Column(String, nullable=True)
    source_company = Column(String, nullable=True)
    destination_company = Column(String, nullable=True)
    is_regular = Column(Boolean, nullable=False, default=False)
    scheduled_date = Column(DateTime, nullable=True)

    status = Column(
        String, default="created"
    )  # created, assigned, started, completed, cancelled

    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    driver = relationship("Driver", backref="trips")
    history = relationship(
        "TripHistory",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripHistory.changed_at.asc()",
    )

    @property
    def driver_name(self):
        return self.driver.name if self.driver else None

    @property
    def driver_phone(self):
        return self.driver.phone if self.driver else None

    @property
    def cost_per_trip(self):
        return float(self.estimated_fare) if self.estimated_fare is not None else None

    @property
    def time_taken_minutes(self):
        if self.duration_minutes is not None:
            return self.duration_minutes
        if self.start_time is not None and self.end_time is not None:
            return int((self.end_time - self.start_time).total_seconds() / 60)
        return None


class TripHistory(Base):
    __tablename__ = "trip_history"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    status = Column(String, nullable=False)
    changed_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    note = Column(String, nullable=True)

    trip = relationship("Trip", back_populates="history")
