"""Trainer verification workflows."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.trainer_verification import TrainerVerification
from app.models.user import User
from app.services.notification_service import create_notification


def apply_for_verification(db: Session, user_id, **data):
    row = db.query(TrainerVerification).filter(TrainerVerification.user_id == user_id).first()
    if row and row.status == "pending":
        raise ValueError("A verification application is already pending")
    if row and row.status == "approved" and row.expires_at and row.expires_at > datetime.now(timezone.utc):
        raise ValueError("Trainer verification is already active")
    if row:
        for key, value in data.items():
            setattr(row, key, value)
        row.status = "pending"
        row.payment_status = "pending"
        row.rejection_reason = None
        row.reviewed_by = None
        row.reviewed_at = None
        row.created_at = datetime.now(timezone.utc)
        row.expires_at = None
    else:
        row = TrainerVerification(user_id=user_id, **data)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_verification_status(db: Session, user_id):
    return db.query(TrainerVerification).filter(TrainerVerification.user_id == user_id).first()


def get_pending_verifications(db: Session, page=1, per_page=20, status=None):
    query = db.query(TrainerVerification)
    if status:
        query = query.filter(TrainerVerification.status == status)
    total = query.count()
    return (
        query.order_by(TrainerVerification.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page).all(),
        total,
    )


def review_verification(db: Session, verification_id, admin_id, action, reason=None):
    row = db.query(TrainerVerification).filter(TrainerVerification.id == verification_id).first()
    if not row:
        raise LookupError("Verification application not found")
    if row.status != "pending":
        raise ValueError("Verification application has already been reviewed")
    user = db.query(User).filter(User.id == row.user_id).first()
    now = datetime.now(timezone.utc)
    row.reviewed_by, row.reviewed_at = admin_id, now
    if action == "approve":
        row.status = "approved"
        row.payment_status = "paid"
        row.expires_at = now + timedelta(days=365)
        user.is_verified_trainer = True
        user.verified_trainer_expires_at = row.expires_at
        title, body = "Trainer verification approved", "Your verified trainer badge is now active."
    else:
        row.status = "rejected"
        row.rejection_reason = reason
        user.is_verified_trainer = False
        user.verified_trainer_expires_at = None
        title, body = "Trainer verification rejected", reason or "Your application was not approved."
    db.commit()
    create_notification(db, user.id, "trainer_verification", title, body, "/trainer/verify")
    db.refresh(row)
    return row


def check_expired_verifications(db: Session):
    now = datetime.now(timezone.utc)
    users = db.query(User).filter(
        User.is_verified_trainer == True,
        User.verified_trainer_expires_at < now,
    ).all()
    for user in users:
        user.is_verified_trainer = False
        create_notification(
            db, user.id, "trainer_verification_expired", "Trainer verification expired",
            "Renew to keep your verified trainer badge.", "/trainer/verify",
        )
    db.commit()
    return len(users)
