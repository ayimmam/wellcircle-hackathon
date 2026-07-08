"""Evidence submission model — event participation proof (D2).

Providers' designated staff submit photos as participation evidence.
Admin reviews and approves/rejects, triggering point minting for attendees.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class EvidenceSubmission(Base):
    __tablename__ = "evidence_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("provider_events.id"), nullable=False, index=True)
    submitter_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Photo stays on Telegram's servers — no Supabase storage cost
    telegram_file_id = Column(String(500), nullable=False)

    # Review workflow
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Points awarded per participant on approval
    points_per_participant = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
