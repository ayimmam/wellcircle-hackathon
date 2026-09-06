"""Paid-circle subscriptions and immutable revenue ledger."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CircleSubscription(Base):
    __tablename__ = "circle_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    amount_etb = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending_approval")
    receipt_url = Column(Text, nullable=True)
    receipt_public_id = Column(Text, nullable=True)
    creator_approved_at = Column(DateTime(timezone=True), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("circle_id", "user_id", "period_start", name="uq_circle_subscription_period"),
    )


class CircleRevenueLedger(Base):
    __tablename__ = "circle_revenue_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id"), nullable=False, index=True)
    subscription_id = Column(
        UUID(as_uuid=True), ForeignKey("circle_subscriptions.id"), nullable=False, unique=True
    )
    total_amount_etb = Column(Integer, nullable=False)
    creator_amount_etb = Column(Integer, nullable=False)
    platform_fee_etb = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
