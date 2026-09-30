"""Terra connections and monotonic daily step watermarks."""
import uuid

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class UserWearable(Base):
    __tablename__ = "user_wearables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    terra_user_id = Column(String(128), unique=True, nullable=False)
    reference_id = Column(String(128), nullable=False)
    provider = Column(String(64), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    last_sync_timestamp = Column(DateTime(timezone=True), nullable=True)
    connected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class WearableDailySteps(Base):
    __tablename__ = "wearable_daily_steps"
    __table_args__ = (UniqueConstraint("wearable_id", "activity_date"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wearable_id = Column(UUID(as_uuid=True), ForeignKey("user_wearables.id", ondelete="CASCADE"), nullable=False)
    activity_date = Column(Date, nullable=False)
    steps = Column(Integer, nullable=False)


class WalkScoreDay(Base):
    __tablename__ = "walk_score_days"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    activity_date = Column(Date, primary_key=True)
    # The largest verified provider total seen for this day. Never decreases.
    steps = Column(Integer, nullable=False, default=0)
