"""AuthIdentity ORM model — one row per external identity (Telegram, WhatsApp, Google).

Introduced by the web app plan to decouple identity from the `users.telegram_id`
column, so WhatsApp and Google users can exist without a synthetic Telegram ID.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AuthIdentity(Base):
    __tablename__ = "auth_identities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'telegram' | 'whatsapp' | 'google' | 'password'
    provider = Column(String(20), nullable=False)
    # Telegram ID | E.164 phone | Google 'sub' | username
    subject = Column(String(255), nullable=False)
    # Google only — verified email from the ID token
    email = Column(String(255), nullable=True)
    verified_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),
    )
