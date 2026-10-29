"""Notification service — manage in-app notifications/inbox."""

from __future__ import annotations

import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.notification import Notification


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    alert_id: uuid.UUID | None = None,
) -> Notification:
    """Create an in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        alert_id=alert_id,
        is_read=False,
    )
    session.add(notif)
    await session.flush()
    return notif


async def mark_read(
    session: AsyncSession,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Notification | None:
    """Mark a notification as read if it belongs to the user."""
    stmt = (
        select(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    res = await session.execute(stmt)
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await session.flush()
    return notif


async def mark_all_read(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    """Mark all unread notifications as read for a user."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    res = await session.execute(stmt)
    await session.flush()
    return res.rowcount or 0


async def list_notifications(
    session: AsyncSession,
    user_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[Notification]:
    """List in-app notifications for a user."""
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    res = await session.execute(query)
    return list(res.scalars().all())
