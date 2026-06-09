"""Provider self-onboarding and admin management schemas."""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field

from app.schemas.provider import ServiceItem


class SelfOnboardRequest(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(..., pattern="^(gym|yoga|nutrition|spa|therapy|running)$")
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: Optional[str] = None
    services: Optional[List[ServiceItem]] = None
    provider_invite_code: str
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None


class SelfOnboardResponse(BaseModel):
    provider_id: str
    name: str
    status: str
    message: str


class InviteCodeGenerateRequest(BaseModel):
    expires_in_days: int = Field(30, ge=1, le=90)


class InviteCodeGenerateResponse(BaseModel):
    invite_code: str
    expires_at: datetime
    created_at: datetime


class ProviderDashboardStats(BaseModel):
    total_members: int = 0
    new_members_today: int = 0
    total_products: int = 0
    active_products: int = 0


class ProviderMeResponse(BaseModel):
    id: str
    name: str
    category: str
    status: str
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    services: Optional[List[ServiceItem]] = None
    theme_primary_color: Optional[str] = None
    theme_accent_color: Optional[str] = None
    dashboard_stats: ProviderDashboardStats


class ProviderMeUpdate(BaseModel):
    description: Optional[str] = None
    price_range: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    services: Optional[List[ServiceItem]] = None
    theme_primary_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    theme_accent_color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")


class PendingProviderItem(BaseModel):
    id: str
    name: str
    category: str
    status: str
    owner_user_id: str
    owner_name: Optional[str] = None
    owner_telegram_handle: Optional[str] = None
    submitted_at: Optional[datetime] = None
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: Optional[str] = None
    services: Optional[List[ServiceItem]] = None
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None


class PendingProvidersResponse(BaseModel):
    pending_providers: List[PendingProviderItem]
    count: int


class ProviderApproveRequest(BaseModel):
    notes: Optional[str] = None


class ProviderApproveResponse(BaseModel):
    provider_id: str
    status: str
    owner_user_id: str
    message: str


class ProviderRejectRequest(BaseModel):
    rejection_reason: str


class ProviderRejectResponse(BaseModel):
    provider_id: str
    status: str
    message: str


class PromoteProviderData(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(..., pattern="^(gym|yoga|nutrition|spa|therapy|running)$")
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: Optional[str] = None
    price_range: Optional[str] = None
    services: Optional[List[ServiceItem]] = None
    cover_photo_url: Optional[str] = None
    photos: Optional[List[str]] = None


class PromoteUserRequest(BaseModel):
    user_telegram_id: int
    provider_data: PromoteProviderData


class PromoteUserResponse(BaseModel):
    provider_id: str
    status: str
    user_id: str
    message: str


class AdminNotificationItem(BaseModel):
    id: str
    event_type: Optional[str] = None
    message: Optional[str] = None
    related_provider_id: Optional[str] = None
    related_user_id: Optional[str] = None
    created_at: datetime
    is_read: bool


class AdminNotificationsResponse(BaseModel):
    notifications: List[AdminNotificationItem]
    unread_count: int


class AdminProviderListItem(BaseModel):
    id: str
    name: str
    category: str
    status: str
    location_text: Optional[str] = None
    owner_user_id: Optional[str] = None
    owner_name: Optional[str] = None
    member_count: int = 0
    onboarded_by_admin: bool = False
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None


class AdminProviderListResponse(BaseModel):
    providers: List[AdminProviderListItem]
    total: int
