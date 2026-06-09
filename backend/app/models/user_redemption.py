"""User product redemptions using Legacy Points."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class UserRedemption(Base):
    __tablename__ = "user_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    points_spent = Column(Integer, nullable=False)
    redemption_code = Column(String(50), nullable=True)
    delivery_status = Column(String(50), default="pending", index=True)
    delivery_address = Column(Text, nullable=True)
    delivery_notes = Column(Text, nullable=True)
    provider_notes = Column(Text, nullable=True)
    redeemed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
