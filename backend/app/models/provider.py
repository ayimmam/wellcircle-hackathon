"""Provider ORM model - wellness service providers."""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from app.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)     # gym|yoga|nutrition|spa|therapy
    description = Column(Text, nullable=True)
    location_text = Column(String(255), nullable=True)  # e.g. "Bole, Addis Ababa"
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    price_range = Column(String(100), nullable=True)    # e.g. "ETB 500-5000"
    rating = Column(Float, nullable=True)
    cover_photo_url = Column(String(500), nullable=True)
    photos = Column(JSONB, nullable=True)                # Array of photo URLs (max 5)
    services = Column(JSONB, nullable=True)              # [{name, price, duration}]
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # --- Theme customization for provider dashboard ---
    theme_primary_color = Column(String(7), nullable=True, default="#10B981")   # Hex color
    theme_accent_color = Column(String(7), nullable=True, default="#F59E0B")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
