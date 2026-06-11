"""Provider Subscription ORM model."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class ProviderSubscription(Base):
    __tablename__ = "provider_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    plan = Column(String(50), nullable=False)
    amount_etb = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    payment_method = Column(String(50), nullable=True)
    telebirr_trade_no = Column(String(255), nullable=True)
    mpesa_checkout_id = Column(String(255), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
