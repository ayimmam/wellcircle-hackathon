"""Provider invite code CRUD."""

import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.provider_invite import ProviderInvite


def _generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(chars) for _ in range(9))
    return f"INVITE-{suffix}"


def create_invite(
    db: Session,
    created_by_user_id: UUID,
    expires_in_days: int = 30,
) -> ProviderInvite:
    code = _generate_code()
    while db.query(ProviderInvite).filter(ProviderInvite.invite_code == code).first():
        code = _generate_code()

    now = datetime.now(timezone.utc)
    invite = ProviderInvite(
        invite_code=code,
        created_by_user_id=created_by_user_id,
        expires_at=now + timedelta(days=expires_in_days),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def get_valid_invite(db: Session, invite_code: str) -> Optional[ProviderInvite]:
    now = datetime.now(timezone.utc)
    invite = (
        db.query(ProviderInvite)
        .filter(
            ProviderInvite.invite_code == invite_code,
            ProviderInvite.is_active == True,  # noqa: E712
            ProviderInvite.used_by_user_id.is_(None),
            ProviderInvite.expires_at > now,
        )
        .first()
    )
    return invite


def mark_invite_used(db: Session, invite: ProviderInvite, user_id: UUID) -> None:
    invite.used_by_user_id = user_id
    invite.used_at = datetime.now(timezone.utc)
    invite.is_active = False
    db.commit()
