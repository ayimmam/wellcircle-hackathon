"""User ORM model - combines bot + Mini App onboarding fields."""

from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
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
    _photo_url = Column("photo_url", String(500), nullable=True)

    @hybrid_property
    def photo_url(self):
        url = self._photo_url
        if isinstance(url, str):
            if "api.telegram.org" in url and "/file/bot" in url:
                try:
                    parts = url.split("/file/bot", 1)
                    if len(parts) == 2:
                        token_and_path = parts[1]
                        subparts = token_and_path.split("/", 1)
                        if len(subparts) == 2:
                            file_path = subparts[1]
                            from app.config import settings
                            backend_base = settings.BACKEND_URL.rstrip("/") if settings.BACKEND_URL else ""
                            return f"{backend_base}/api/bot/photo/{file_path}"
                except Exception:
                    pass
            return url
        return url

    @photo_url.setter
    def photo_url(self, value):
        self._photo_url = value

    # --- Gamification ---
    points_balance = Column(Integer, default=0)
    last_checkin_at = Column(DateTime(timezone=True), nullable=True)
    current_streak = Column(Integer, default=0)          # C2: consecutive check-in days
    freeze_count = Column(Integer, default=0)             # C2: streak freezes earned (1 per 7-day streak)

    # --- Referral (E1) ---
    referred_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # --- Engagement tracking ---
    last_activity_at = Column(DateTime(timezone=True), nullable=True)  # For re-engagement notifications
    last_reengagement_at = Column(DateTime(timezone=True), nullable=True)  # Last bot re-engagement message
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
