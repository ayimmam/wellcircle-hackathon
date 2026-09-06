"""Annual trainer verification application."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TrainerVerification(Base):
    __tablename__ = "trainer_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    certificate_url = Column(Text, nullable=False)
    certificate_public_id = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    rejection_reason = Column(Text, nullable=True)
    payment_status = Column(String(20), nullable=False, default="pending")
    payment_receipt_url = Column(Text, nullable=True)
    payment_receipt_public_id = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
