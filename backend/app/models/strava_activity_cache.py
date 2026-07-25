"""Cached Strava activities (15-minute per-user fetch TTL)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class StravaActivityCache(Base):
    __tablename__ = "strava_activity_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    strava_activity_id = Column(BigInteger, nullable=False, unique=True)
    activity_type = Column(String(50), nullable=False)
    distance_meters = Column(Float, nullable=False, default=0)
    moving_time_seconds = Column(Integer, nullable=False, default=0)
    elapsed_time_seconds = Column(Integer, nullable=False, default=0)
    total_elevation_gain = Column(Float, nullable=False, default=0)
    calories = Column(Float, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    name = Column(String(255), nullable=False)
    fetched_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
