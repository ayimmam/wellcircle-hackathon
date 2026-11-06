"""Ephemeral API rate-limit counters.

Only short-lived, non-content counters live here. No provider proof, token,
challenge secret or chat content is ever stored.
"""

from sqlalchemy import BigInteger, Column, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ApiRateLimit(Base):
    __tablename__ = "api_rate_limits"
    __table_args__ = (
        Index(
            "ix_api_rate_limits_user_action_created",
            "user_id",
            "action",
            "created_at",
        ),
    )

    id = Column(String(64), primary_key=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    action = Column(String(32), nullable=False)
    created_at = Column(BigInteger, nullable=False)
