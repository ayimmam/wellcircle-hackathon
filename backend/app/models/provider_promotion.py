"""Provider Promotion ORM model."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class ProviderPromotion(Base):
    __tablename__ = "provider_promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    headline = Column(String(255), nullable=False)
    discount_pct = Column(Integer, nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    # Who the promo applies to: 'all' (any visitor) or 'first_time'
    # (presale — only users with no prior successful booking at this provider).
    audience = Column(String(20), nullable=False, default="all")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
