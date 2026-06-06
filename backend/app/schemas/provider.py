"""Provider request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ServiceItem(BaseModel):
    """A single service offered by a provider."""
    name: str
    price: int  # ETB
    duration: str  # e.g. "60 min"


class ProviderBase(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(..., pattern="^(gym|yoga|nutrition|spa|therapy)$")
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: Optional[str] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    services: Optional[List[ServiceItem]] = None
    theme_primary_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    theme_accent_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")


class ProviderCreate(ProviderBase):
    """Admin creates a provider."""
    owner_telegram_id: Optional[int] = None
    create_community: bool = False
    community_name: Optional[str] = None


class ProviderUpdate(BaseModel):
    """Admin updates a provider — all fields optional."""
    name: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, pattern="^(gym|yoga|nutrition|spa|therapy)$")
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: Optional[str] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    services: Optional[List[ServiceItem]] = None
    theme_primary_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    theme_accent_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")


class CommunityBrief(BaseModel):
    """Abbreviated community info for provider responses."""
    id: str
    name: str
    member_count: int = 0
    user_joined: bool = False


class ProviderListItem(BaseModel):
    """Provider in list view."""
    id: str
    name: str
    category: str
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: Optional[str] = None
    rating: Optional[float] = None
    cover_photo_url: Optional[str] = None
    member_count: int = 0
    community_id: Optional[str] = None

    class Config:
        from_attributes = True


class ProviderDetail(ProviderListItem):
    """Full provider detail."""
    photos: Optional[List[str]] = None
    services: Optional[List[ServiceItem]] = None
    community: Optional[CommunityBrief] = None
    theme_primary_color: Optional[str] = None
    theme_accent_color: Optional[str] = None


class ProviderListResponse(BaseModel):
    providers: List[ProviderListItem]
    count: int


# --- Provider Dashboard ---

class ProviderStats(BaseModel):
    total_members: int = 0
    new_members_today: int = 0
    bookings_this_week: int = 0
    estimated_revenue_etb: int = 0
    checkins_today: int = 0
    engagement_rate: float = 0.0


class CommunityStats(BaseModel):
    id: str
    name: str
    member_count: int = 0
    checkins_today: int = 0
    engagement_rate: float = 0.0


class BookingItem(BaseModel):
    id: str
    user_handle: Optional[str] = None
    service_name: str
    slot_datetime: datetime
    amount_etb: int
    payment_status: str
    created_at: datetime


class FeedItem(BaseModel):
    user_name: Optional[str] = None
    user_photo: Optional[str] = None
    event_type: str
    community_name: Optional[str] = None
    created_at: datetime


class ProviderDashboardResponse(BaseModel):
    provider_id: str
    provider_name: str
    theme_primary_color: Optional[str] = None
    theme_accent_color: Optional[str] = None
    stats: ProviderStats
    communities: List[CommunityStats]
    recent_bookings: List[BookingItem]
    recent_feed: List[FeedItem]
