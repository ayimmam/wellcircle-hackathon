"""User feedback — bug reports, health-app requests, general suggestions."""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from app.database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(30), nullable=False)      # 'bug' | 'health_app_request' | 'suggestion'
    message = Column(Text, nullable=False)
    context = Column(JSONB, nullable=True)          # { route, error, app_version, user_agent }
    status = Column(String(20), nullable=False, default="new")  # new | reviewed | resolved
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
