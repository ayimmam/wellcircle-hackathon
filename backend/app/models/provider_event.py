"""Provider Event ORM model - scheduled sessions/classes."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class ProviderEvent(Base):
    __tablename__ = "provider_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    capacity = Column(Integer, nullable=False, default=10)
    spots_remaining = Column(Integer, nullable=False)
    price_etb = Column(Integer, nullable=False)
    is_cancelled = Column(Boolean, nullable=False, default=False)
    is_boosted = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint('spots_remaining >= 0 AND spots_remaining <= capacity', name='check_spots_remaining'),
    )
