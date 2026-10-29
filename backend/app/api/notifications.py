"""Router for in-app user notifications."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models.notification import Notification
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.notification import NotificationRead
from app.services.notification_service import list_notifications, mark_all_read, mark_read

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationRead])
async def get_my_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationRead]:
    """Retrieve in-app notifications for the authenticated user."""
    notifs = await list_notifications(
        session,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return [
        NotificationRead(
            id=n.id,
            user_id=n.user_id,
            alert_id=n.alert_id,
            title=n.title,
            body=n.body,
            message=n.body,
            channel="IN_APP",
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifs
    ]


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Notification:
    """Mark a notification as read."""
    notif = await mark_read(session, notification_id, current_user.id)
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    await session.commit()
    return notif


@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark all notifications as read for current user."""
    count = await mark_all_read(session, current_user.id)
    await session.commit()
    return {"marked_read": count}
