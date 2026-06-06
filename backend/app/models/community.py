"""Community ORM models - spaces, members, and feed events."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from app.database import Base


class Community(Base):
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # yoga|gym|nutrition|spa|therapy|running
    member_count = Column(Integer, default=0)      # Denormalized for fast reads
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CommunityMember(Base):
    __tablename__ = "community_members"

    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CommunityFeedEvent(Base):
    __tablename__ = "community_feed_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # join|checkin|booking
    event_metadata = Column(JSONB, nullable=True)     # {service_name, amount} for bookings
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
