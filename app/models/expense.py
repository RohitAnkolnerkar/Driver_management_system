from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)

    category = Column(
        String, nullable=False
    )  # toll, food_allowance, lodging, fuel_out_of_pocket, maintenance_emergency, other
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    receipt_number = Column(String, nullable=True)

    status = Column(
        String, default="pending", nullable=False
    )  # pending, approved, rejected, settled
    reviewed_by = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=get_now_ist_naive, nullable=False)
    updated_at = Column(
        DateTime,
        default=get_now_ist_naive,
        onupdate=get_now_ist_naive,
        nullable=False,
    )

    driver = relationship("Driver", backref="expenses")
    trip = relationship("Trip", backref="expenses")
