"""Short-lived, single-use account-linking challenges.

Durable server-side state (like ``OTPChallenge``) so every application instance
sees the same challenge and a restart cannot resurrect a used one. The raw
challenge id is a random bearer value returned exactly once to the authenticated
caller; the database stores the id itself (it is required for lookup) but never
a provider token.
"""

from sqlalchemy import BigInteger, Column, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AccountLinkChallenge(Base):
    __tablename__ = "account_link_challenges"

    id = Column(String(64), primary_key=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'google' | 'telegram'
    provider = Column(String(16), nullable=False)
    # Verified provider subject, only set after the credential check succeeds.
    target_subject = Column(String(255), nullable=True)
    target_email = Column(String(255), nullable=True)
    # pending -> verified -> consumed; or expired/failed
    status = Column(String(16), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False, index=True)
    verified_at = Column(BigInteger, nullable=True)
    consumed_at = Column(BigInteger, nullable=True)

    __table_args__ = (
        Index("ix_link_user_created", "user_id", "created_at"),
    )
