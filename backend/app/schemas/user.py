"""User request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


# --- Enums ---
class InterestCategory(str, Enum):
    YOGA = "yoga"
    GYM = "gym"
    NUTRITION = "nutrition"
    SPA = "spa"
    THERAPY = "therapy"
    RUNNING = "running"


class ExerciseFrequency(str, Enum):
    NEVER = "never"
    RARELY = "rarely"           # 1-2x/month
    SOMETIMES = "sometimes"     # 1-2x/week
    REGULAR = "regular"         # 3-4x/week
    DAILY = "daily"


class PointsTier(str, Enum):
    SEED = "seed"       # 0-99     🌱
    SPROUT = "sprout"   # 100-299  🌿
    GROVE = "grove"     # 300-699  🌳
    FOREST = "forest"   # 700+     🌲


# --- Request schemas ---
class TelegramAuthRequest(BaseModel):
    """Telegram Mini App auth - initData from Telegram.WebApp."""
    init_data: str = Field(..., description="Raw initData string from Telegram.WebApp")


class BotRegisterRequest(BaseModel):
    """Bot /start registration - minimal user creation."""
    telegram_id: int
    telegram_handle: Optional[str] = None
    photo_url: Optional[str] = None


class UserOnboardingRequest(BaseModel):
    """Mini App onboarding - complete user profile."""
    name: str = Field(..., min_length=1, max_length=255)
    goal: Optional[str] = Field(None, max_length=500)
    interest_category: InterestCategory
    exercise_frequency: ExerciseFrequency
    suggested_circle_ids: Optional[List[str]] = None  # UUIDs of circles to auto-join


class UserProfileUpdate(BaseModel):
    """Profile update - personalization fields."""
    name: Optional[str] = Field(None, max_length=255)
    goal: Optional[str] = Field(None, max_length=500)
    location_neighborhood: Optional[str] = None
    health_app_connected: Optional[bool] = None


# --- Response schemas ---
class UserResponse(BaseModel):
    """Full user profile response."""
    id: str
    telegram_id: int
    telegram_handle: Optional[str] = None
    name: Optional[str] = None
    photo_url: Optional[str] = None
    goal: Optional[str] = None
    interest_category: Optional[str] = None
    exercise_frequency: Optional[str] = None
    points_balance: int = 0
    tier: str = "seed"
    tier_emoji: str = "🌱"
    is_onboarded: bool = False
    is_provider: bool = False
    is_super_admin: bool = False
    location_neighborhood: Optional[str] = None
    health_app_connected: bool = False
    joined_communities: List[str] = []  # Community IDs
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Authentication response with JWT token."""
    token: str
    user: UserResponse
    is_new_user: bool = False


class PointsHistoryItem(BaseModel):
    """Single points transaction."""
    action: str
    points: int
    community_name: Optional[str] = None
    created_at: datetime


class PointsHistoryResponse(BaseModel):
    """Points history response."""
    items: List[PointsHistoryItem]
    current_balance: int
    tier: str
    tier_emoji: str
