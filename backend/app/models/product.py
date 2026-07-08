"""Wellness products redeemable with Legacy Points."""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, index=True)  # digital | physical
    points_cost = Column("price_etb", Integer, nullable=False)  # B3: renamed; DB column stays for migration

    @property
    def price_etb(self):
        """Deprecated alias for points_cost — backwards compatibility."""
        return self.points_cost

    @price_etb.setter
    def price_etb(self, value):
        self.points_cost = value
    image_url = Column(String(500), nullable=True)
    images = Column(JSONB, nullable=True)
    quantity_in_stock = Column(Integer, default=0)
    max_redemptions_per_user = Column(Integer, default=1)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    digital_code_template = Column(String(255), nullable=True)
    provider_instructions = Column(Text, nullable=True)
    shipping_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
