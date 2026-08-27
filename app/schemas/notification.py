from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class NotificationBase(BaseModel):
    title: str = Field(..., description="Notification headline")
    message: str = Field(..., description="Detailed alert message")
    severity: str = Field("info", description="Severity level: info, warning, critical")
    category: str = Field(
        "general",
        description="Category: fuel_theft, low_balance, maintenance, inspection, dispatch, general",
    )
    link_id: Optional[str] = Field(None, description="Optional entity link ID")


class NotificationCreate(NotificationBase):
    user_id: Optional[int] = Field(None, description="Optional target user ID")


class NotificationUpdate(BaseModel):
    is_read: bool = Field(True, description="Mark as read/unread")


class NotificationResponse(NotificationBase):
    id: int
    user_id: Optional[int]
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
