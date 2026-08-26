"""Provider ORM model - wellness service providers."""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from app.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)     # gym|yoga|nutrition|spa|therapy|running
    description = Column(Text, nullable=True)
    location_text = Column(String(255), nullable=True)  # e.g. "Bole, Addis Ababa"
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    price_range = Column(String(100), nullable=True)    # e.g. "ETB 500-5000"
    rating = Column(Float, nullable=True)
    cover_photo_url = Column(String(500), nullable=True)
    photos = Column(JSONB, nullable=True)                # Array of photo URLs (max 5)
    services = Column(JSONB, nullable=True)              # [{name, price, duration, booking_method}]
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # --- Direct-contact booking (Kuriftu gap analysis, Jul 15) ---
    # Some providers/services aren't booked online at all — the guest calls
    # or emails directly and pays on-site after the service. Nullable
    # because most providers still use the in-app flow.
    contact_phone = Column(String(30), nullable=True)
    contact_email = Column(String(255), nullable=True)

    # --- Lifecycle (Phase 2) ---
    status = Column(String(50), default="active")  # draft|pending_approval|active|inactive|rejected
    onboarded_by_admin = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # --- Phase 3 Additions ---
    is_featured = Column(Boolean, nullable=False, default=False)
    subscription_plan = Column(String(50), nullable=True)

    # --- Theme customization for provider dashboard ---
    theme_primary_color = Column(String(7), nullable=True, default="#10B981")   # Hex color
    theme_accent_color = Column(String(7), nullable=True, default="#F59E0B")

    # --- Provider launch state (For You / Boston Day Spa pilot) ---
    # A newly self-onboarded provider is browsable but not bookable until an
    # admin flips this — the gate is presentation plus a booking block, not a
    # listing filter.
    is_coming_soon = Column(Boolean, nullable=False, default=True)
    sheets_export_enabled = Column(Boolean, nullable=False, default=False)
    facilities = Column(JSONB, nullable=True)          # ["Massage room", ...]
    # Direct Google Maps link — used for "Open in Maps" when we have a shared
    # place link but no coordinates (short links carry no lat/lng).
    map_url = Column(String(500), nullable=True)
    navigation_tips = Column(JSONB, nullable=True)     # [{"title", "detail"}] — Phase 8

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
