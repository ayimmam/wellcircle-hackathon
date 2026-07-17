"""Feedback CRUD — bug reports, health-app requests, and suggestions."""

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.feedback import Feedback
from app.models.user import User

PAGE_SIZE = 20


def create_feedback(db: Session, user_id: UUID, type: str, message: str, context: Optional[dict] = None) -> Feedback:
    fb = Feedback(user_id=user_id, type=type, message=message, context=context)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


def list_feedback(db: Session, type: Optional[str] = None, status: Optional[str] = None, page: int = 1):
    """Paginated, newest-first, with submitter name/handle joined in a single query (no N+1)."""
    query = db.query(Feedback, User).join(User, Feedback.user_id == User.id)
    if type:
        query = query.filter(Feedback.type == type)
    if status:
        query = query.filter(Feedback.status == status)

    total = query.count()
    rows = (
        query.order_by(Feedback.created_at.desc())
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .all()
    )

    items = []
    for fb, user in rows:
        items.append({
            "id": str(fb.id),
            "user_id": str(fb.user_id),
            "user_name": user.name,
            "user_handle": user.telegram_handle,
            "type": fb.type,
            "message": fb.message,
            "context": fb.context,
            "status": fb.status,
            "created_at": fb.created_at,
        })
    return items, total


def update_feedback_status(db: Session, feedback_id: UUID, status: str) -> Optional[Feedback]:
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        return None
    fb.status = status
    db.commit()
    db.refresh(fb)
    return fb
