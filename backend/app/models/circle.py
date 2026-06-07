"""Circle ORM models - user-created micro-communities and leaderboards."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base

class Circle(Base):
    __tablename__ = "circles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class CircleMember(Base):
    __tablename__ = "circle_members"

    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    weekly_points = Column(Integer, default=0) # Tracked for weekly leaderboard
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
