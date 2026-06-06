"""User ORM model - combines bot + Mini App onboarding fields."""

from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # --- From Telegram Bot /start ---
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    telegram_handle = Column(String(255), nullable=True)  # @username from Telegram

    # --- From Mini App Onboarding ---
    name = Column(String(255), nullable=True)                 # Required in onboarding
    goal = Column(Text, nullable=True)                        # Optional
    interest_category = Column(String(50), nullable=True)     # yoga|gym|nutrition|spa|therapy|running
    exercise_frequency = Column(String(50), nullable=True)    # never|rarely|sometimes|regular|daily

    # --- Telegram profile data ---
    photo_url = Column(String(500), nullable=True)

    # --- Gamification ---
    points_balance = Column(Integer, default=0)
    last_checkin_at = Column(DateTime(timezone=True), nullable=True)

    # --- Engagement tracking ---
    last_activity_at = Column(DateTime(timezone=True), nullable=True)  # For re-engagement notifications
    is_onboarded = Column(Boolean, default=False)                      # Mini App onboarding complete?

    # --- Roles ---
    is_provider = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)

    # --- Personalized Engagement (v1.1) ---
    location_neighborhood = Column(String(100), nullable=True)   # Bole, Kazanchis, etc.
    health_app_connected = Column(Boolean, default=False)

    # --- Timestamps ---
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
