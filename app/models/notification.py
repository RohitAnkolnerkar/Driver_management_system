from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time_utils import get_now_ist_naive
from app.db import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # Nullable: if null, broadcast to all dispatchers/admins
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, default="info", nullable=False)  # info, warning, critical
    category = Column(
        String, default="general", nullable=False
    )  # fuel_theft, low_balance, maintenance, inspection, dispatch, general
    link_id = Column(String, nullable=True)  # link to a trip, vehicle, or payroll
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=get_now_ist_naive, nullable=False)

    user = relationship("User", backref="notifications")
