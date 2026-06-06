"""Admin dashboard request/response schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class CategoryCount(BaseModel):
    category: str
    count: int


class PlatformAnalytics(BaseModel):
    """Platform-wide analytics for super admin."""
    total_users: int = 0
    onboarded_users: int = 0
    total_providers: int = 0
    total_communities: int = 0
    total_bookings: int = 0
    successful_payments: int = 0
    total_revenue_etb: int = 0
    active_users_7d: int = 0
    new_users_today: int = 0
    top_categories: List[CategoryCount] = []


class AdminUserItem(BaseModel):
    """User item in admin list view."""
    id: str
    telegram_id: int
    telegram_handle: Optional[str] = None
    name: Optional[str] = None
    interest_category: Optional[str] = None
    exercise_frequency: Optional[str] = None
    points_balance: int = 0
    is_onboarded: bool = False
    is_provider: bool = False
    last_activity_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    users: List[AdminUserItem]
    total: int
    page: int
    per_page: int
    pages: int


class AdminProviderCreateResponse(BaseModel):
    provider: dict
    community: Optional[dict] = None
