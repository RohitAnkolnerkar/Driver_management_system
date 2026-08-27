import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches persisted notifications for the current user.
    Admins/dispatchers receive all targeted and global system notifications.
    Drivers only receive notifications explicitly targeted to them.
    """
    query = db.query(Notification)

    if current_user.role in {"admin", "dispatcher"}:
        query = query.filter(
            (Notification.user_id == current_user.id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.filter(Notification.user_id == current_user.id)

    return query.order_by(Notification.created_at.desc()).limit(100).all()


@router.post(
    "", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED
)
def create_notification(
    notification_in: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Allows admins or dispatchers to trigger custom manual alerts / broadcasts.
    Also used internally by other endpoints.
    """
    if current_user.role not in {"admin", "dispatcher"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dispatchers or administrators can dispatch custom system alerts.",
        )

    db_obj = Notification(
        user_id=notification_in.user_id,
        title=notification_in.title,
        message=notification_in.message,
        severity=notification_in.severity,
        category=notification_in.category,
        link_id=notification_in.link_id,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)

    try:
        from app.api.ws import broadcast_update

        broadcast_update(
            {
                "type": "new_alert",
                "alert": {
                    "id": db_obj.id,
                    "title": db_obj.title,
                    "message": db_obj.message,
                    "severity": db_obj.severity,
                    "category": db_obj.category,
                    "created_at": db_obj.created_at.isoformat(),
                },
            }
        )
    except Exception as e:
        logger.warning(f"Could not broadcast WS alert: {e}")

    return db_obj


@router.patch("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: int,
    notification_in: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a specific notification as read.
    """
    db_obj = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Notification not found")

    if db_obj.user_id and db_obj.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to edit this notification"
        )

    db_obj.is_read = notification_in.is_read
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.post("/mark-all-read")
def mark_all_my_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark all unread notifications for the current user as read.
    """
    query = db.query(Notification).filter(~Notification.is_read)

    if current_user.role in {"admin", "dispatcher"}:
        query = query.filter(
            (Notification.user_id == current_user.id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.filter(Notification.user_id == current_user.id)

    unread_alerts = query.all()
    for alert in unread_alerts:
        alert.is_read = True
    db.commit()

    return {"message": f"Successfully marked {len(unread_alerts)} alerts as read."}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dismiss or delete an alert from database history.
    """
    db_obj = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Notification not found")

    if db_obj.user_id and db_obj.user_id != current_user.id:
        if current_user.role not in {"admin", "dispatcher"}:
            raise HTTPException(
                status_code=403, detail="Not authorized to dismiss this notification"
            )

    db.delete(db_obj)
    db.commit()
