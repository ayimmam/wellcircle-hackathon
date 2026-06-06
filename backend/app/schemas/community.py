"""Community request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class CommunityCreate(BaseModel):
    """Create a community (via admin provider onboarding)."""
    provider_id: str
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None


class CommunityListItem(BaseModel):
    """Community in list view."""
    id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    member_count: int = 0
    provider_name: Optional[str] = None
    provider_id: Optional[str] = None
    user_joined: bool = False

    class Config:
        from_attributes = True


class ProviderBrief(BaseModel):
    id: str
    name: str
    cover_photo_url: Optional[str] = None


class CommunityDetail(BaseModel):
    """Full community detail."""
    id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    member_count: int = 0
    provider: Optional[ProviderBrief] = None
    user_joined: bool = False
    user_checked_in_today: bool = False
    created_at: datetime


class CommunityListResponse(BaseModel):
    communities: List[CommunityListItem]
    count: int


class FeedEventResponse(BaseModel):
    """Single feed event."""
    id: str
    event_type: str  # join | checkin | booking
    user_name: Optional[str] = None
    user_photo: Optional[str] = None
    event_metadata: Optional[Any] = None
    created_at: datetime


class FeedResponse(BaseModel):
    events: List[FeedEventResponse]
    count: int


class JoinResponse(BaseModel):
    community_id: str
    member_count: int
    joined: bool = True
    feed_event: Optional[FeedEventResponse] = None


class LeaveResponse(BaseModel):
    community_id: str
    member_count: int
    left: bool = True


class CheckinResponse(BaseModel):
    points_earned: int
    new_balance: int
    tier: str
    tier_emoji: str
    feed_event: Optional[FeedEventResponse] = None
