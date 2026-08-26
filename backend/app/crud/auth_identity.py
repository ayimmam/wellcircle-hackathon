"""CRUD operations for AuthIdentity — lookup and creation of identity rows."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.auth_identity import AuthIdentity
from app.models.user import User


def get_identity(db: Session, provider: str, subject: str) -> Optional[AuthIdentity]:
    """Find an identity row by (provider, subject)."""
    return (
        db.query(AuthIdentity)
        .filter(AuthIdentity.provider == provider, AuthIdentity.subject == subject)
        .first()
    )


def get_user_by_identity(db: Session, provider: str, subject: str) -> Optional[User]:
    """Find the user behind a (provider, subject) pair."""
    identity = get_identity(db, provider, subject)
    if not identity:
        return None
    return db.query(User).filter(User.id == identity.user_id).first()


def create_identity(
    db: Session,
    user_id: UUID,
    provider: str,
    subject: str,
    email: Optional[str] = None,
) -> AuthIdentity:
    """Create a new identity row for an existing user."""
    identity = AuthIdentity(
        user_id=user_id,
        provider=provider,
        subject=subject,
        email=email,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(identity)
    db.commit()
    db.refresh(identity)
    return identity


def get_user_identities(db: Session, user_id: UUID) -> list:
    """All identity rows for a user (for the profile / account-linking UI)."""
    return (
        db.query(AuthIdentity)
        .filter(AuthIdentity.user_id == user_id)
        .order_by(AuthIdentity.created_at)
        .all()
    )


def find_user_by_phone(db: Session, phone_e164: str) -> Optional[User]:
    """Find a user whose phone_number matches (for WhatsApp account linking).

    The plan says phone number is the join key — a WhatsApp sign-in supplies a
    verified phone by construction, so we look up users.phone_number first.
    """
    return db.query(User).filter(User.phone_number == phone_e164).first()
