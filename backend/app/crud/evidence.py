"""Evidence submission CRUD — D2 event participation points.

Provider-designated staff submit photo evidence for an ended event; an admin
reviews it and, on approval, points are minted for every attendee with a
successful booking on that event.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.evidence_submission import EvidenceSubmission
from app.models.provider_event import ProviderEvent
from app.models.booking import Booking
from app.models.provider import Provider
from app.models.user import User


def get_staff_events(db: Session, telegram_id: int) -> List[dict]:
    """Events this Telegram user is the designated staff for, that have ended
    and don't already have a submission from them."""
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        return []

    now = datetime.now(timezone.utc)
    events = (
        db.query(ProviderEvent)
        .filter(
            ProviderEvent.staff_user_id == user.id,
            ProviderEvent.ends_at < now,
            ProviderEvent.is_cancelled == False,
        )
        .order_by(ProviderEvent.ends_at.desc())
        .all()
    )

    already_submitted_ids = {
        s.event_id
        for s in db.query(EvidenceSubmission.event_id)
        .filter(EvidenceSubmission.submitter_user_id == user.id)
        .all()
    }

    items = []
    for e in events:
        if e.id in already_submitted_ids:
            continue
        provider = db.query(Provider).filter(Provider.id == e.provider_id).first()
        items.append({
            "event_id": str(e.id),
            "provider_name": provider.name if provider else None,
            "service_name": e.service_name,
            "starts_at": e.starts_at.isoformat(),
            "ends_at": e.ends_at.isoformat(),
        })
    return items


def create_evidence_submission(
    db: Session,
    telegram_id: int,
    event_id: UUID,
    telegram_file_id: str,
) -> Optional[EvidenceSubmission]:
    """Bot-side: staff submits a photo for an event they're designated for."""
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        return None

    event = db.query(ProviderEvent).filter(ProviderEvent.id == event_id).first()
    if not event or event.staff_user_id != user.id:
        return None

    submission = EvidenceSubmission(
        event_id=event_id,
        submitter_user_id=user.id,
        telegram_file_id=telegram_file_id,
        status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def get_pending_evidence(db: Session) -> List[dict]:
    """Admin queue: pending submissions with event + submitter context."""
    submissions = (
        db.query(EvidenceSubmission)
        .filter(EvidenceSubmission.status == "pending")
        .order_by(EvidenceSubmission.created_at.asc())
        .all()
    )
    items = []
    for s in submissions:
        event = db.query(ProviderEvent).filter(ProviderEvent.id == s.event_id).first()
        submitter = db.query(User).filter(User.id == s.submitter_user_id).first()
        provider = db.query(Provider).filter(Provider.id == event.provider_id).first() if event else None
        attendee_count = (
            db.query(Booking)
            .filter(Booking.event_id == s.event_id, Booking.payment_status == "success")
            .count()
        )
        items.append({
            "id": str(s.id),
            "event_id": str(s.event_id),
            "event_name": event.service_name if event else None,
            "provider_name": provider.name if provider else None,
            "submitter_name": submitter.name or submitter.telegram_handle if submitter else None,
            "attendee_count": attendee_count,
            "created_at": s.created_at.isoformat(),
        })
    return items


def get_evidence_photo_file_id(db: Session, submission_id: UUID) -> Optional[str]:
    submission = db.query(EvidenceSubmission).filter(EvidenceSubmission.id == submission_id).first()
    return submission.telegram_file_id if submission else None


def review_evidence(
    db: Session,
    submission_id: UUID,
    action: str,
    reviewer: User,
    points_per_participant: Optional[int] = None,
) -> dict:
    """Approve or reject a submission. On approval, mints event_participation
    points for every user with a successful booking on the event."""
    from app.services.points import apply_transaction, TXN_EVENT_PARTICIPATION
    from app.services.notification_service import create_notification

    submission = db.query(EvidenceSubmission).filter(EvidenceSubmission.id == submission_id).first()
    if not submission:
        raise ValueError("Submission not found")
    if submission.status != "pending":
        raise ValueError("Submission already reviewed")
    if action not in ("approve", "reject"):
        raise ValueError("Action must be 'approve' or 'reject'")

    submission.reviewed_by = reviewer.id
    submission.reviewed_at = datetime.now(timezone.utc)

    if action == "reject":
        submission.status = "rejected"
        db.commit()
        return {"status": "rejected", "awarded_count": 0}

    if not points_per_participant or points_per_participant <= 0:
        raise ValueError("points_per_participant must be a positive integer to approve")

    submission.status = "approved"
    submission.points_per_participant = points_per_participant

    attendees = (
        db.query(Booking)
        .filter(Booking.event_id == submission.event_id, Booking.payment_status == "success")
        .all()
    )
    event = db.query(ProviderEvent).filter(ProviderEvent.id == submission.event_id).first()

    awarded_count = 0
    seen_user_ids = set()
    for booking in attendees:
        if booking.user_id in seen_user_ids:
            continue
        seen_user_ids.add(booking.user_id)
        attendee = db.query(User).filter(User.id == booking.user_id).first()
        if not attendee:
            continue
        apply_transaction(
            db, attendee, points_per_participant, TXN_EVENT_PARTICIPATION,
            provider_id=event.provider_id if event else None,
            reference_id=submission.id,
            note=f"Event participation: {event.service_name}" if event else "Event participation",
        )
        create_notification(
            db,
            user_id=attendee.id,
            type="event_participation",
            title="Points earned! 🎉",
            body=f"You earned {points_per_participant} pts for attending {event.service_name if event else 'an event'}.",
            action_url="/points-history",
        )
        awarded_count += 1

    db.commit()
    return {"status": "approved", "awarded_count": awarded_count}
