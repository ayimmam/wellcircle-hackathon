"""Point transaction ledger — every points mutation recorded as an immutable row.

Part B1 of the Points Economy Plan: replaces scattered `points_balance`
mutations with a centralized, auditable ledger.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Signed integer: positive = mint/receive, negative = spend/decay/gift-out
    amount = Column(Integer, nullable=False)

    # Transaction type enum (enforced at app level, not DB, for flexibility)
    # Values: checkin, booking_bonus, challenge, gift_sent, gift_received,
    #         redemption, decay, event_participation, provider_award,
    #         admin_adjust, referral
    type = Column(String(50), nullable=False, index=True)

    # Optional provider context (set for provider_award, redemption, event_participation)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True, index=True)

    # Optional reference to the triggering entity (booking, challenge, submission, redemption)
    reference_id = Column(UUID(as_uuid=True), nullable=True)

    # Freeform note (e.g. provider award reason)
    note = Column(Text, nullable=True)

    # Reversal support: if non-null, this transaction was reversed by the referenced row
    reversed_by = Column(UUID(as_uuid=True), ForeignKey("point_transactions.id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
