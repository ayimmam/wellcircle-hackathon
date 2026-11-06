"""CRUD operations for AuthIdentity — lookup and creation of identity rows."""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth_identity import AuthIdentity
from app.models.user import User

logger = logging.getLogger(__name__)


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


def resolve_user_by_telegram(db: Session, telegram_id: object) -> Optional[User]:
    """Resolve a *verified* Telegram id to its canonical user.

    The legacy ``users.telegram_id`` column is checked first so accounts that
    existed before the identity table keep resolving exactly as before (and a
    pre-existing duplicate user is never silently swapped for the identity
    owner). Accounts that linked Telegram from another provider set that column
    during confirmation; the identity row is the authoritative fallback when a
    verified identity exists without the column (e.g. an imported/reconciled
    account). In a consistent database both lookups agree.
    """
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if user is not None:
        return user
    return get_user_by_identity(db, "telegram", str(telegram_id))


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


def ensure_telegram_identity(
    db: Session,
    user_id: UUID,
    telegram_id: object,
) -> Optional[AuthIdentity]:
    """Idempotently record a Telegram identity for a user. Never reassigns.

    ``telegram_id`` must come from the server-side Telegram verification
    (initData HMAC or Login Widget hash) — never from a client-supplied field.

    Returns the identity row (existing or newly created), or ``None`` when the
    (provider, subject) pair already belongs to a different user — that row is
    left untouched and the conflict is logged here. Concurrent insert races
    resolve by re-reading: whichever transaction wins the unique constraint
    determines the owner, so two requests for the same verified user cannot
    produce duplicate identities.
    """
    subject = str(telegram_id)
    identity = get_identity(db, "telegram", subject)
    if identity is not None:
        if identity.user_id != user_id:
            logger.warning(
                "Telegram identity %s is already owned by user %s; leaving it "
                "untouched (user %s will not get a duplicate identity)",
                subject,
                identity.user_id,
                user_id,
            )
            return None
        return identity  # already recorded for this user — idempotent no-op

    identity = AuthIdentity(user_id=user_id, provider="telegram", subject=subject)
    db.add(identity)
    try:
        db.commit()
        db.refresh(identity)
        return identity
    except IntegrityError:
        # A concurrent request inserted the same verified identity first.
        db.rollback()
        identity = get_identity(db, "telegram", subject)
        if identity is not None and identity.user_id == user_id:
            return identity
        logger.warning(
            "Telegram identity %s was created concurrently for another user; "
            "leaving it untouched (user %s will not get a duplicate identity)",
            subject,
            user_id,
        )
        return None
