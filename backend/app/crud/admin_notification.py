"""Admin notification CRUD."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.admin_notification import AdminNotification
from app.models.user import User


def notify_all_admins(
    db: Session,
    event_type: str,
    message: str,
    related_provider_id: Optional[UUID] = None,
    related_user_id: Optional[UUID] = None,
) -> None:
    admins = db.query(User).filter(User.is_super_admin == True).all()  # noqa: E712
    for admin in admins:
        db.add(AdminNotification(
            admin_user_id=admin.id,
            event_type=event_type,
            message=message,
            related_provider_id=related_provider_id,
            related_user_id=related_user_id,
        ))
    db.commit()


def get_admin_notifications(
    db: Session,
    admin_user_id: UUID,
    limit: int = 20,
    offset: int = 0,
) -> tuple[List[AdminNotification], int]:
    query = db.query(AdminNotification).filter(
        AdminNotification.admin_user_id == admin_user_id
    )
    unread = query.filter(AdminNotification.is_read == False).count()  # noqa: E712
    items = (
        query.order_by(AdminNotification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, unread
