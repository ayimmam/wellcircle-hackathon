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


class TelegramWidgetLoginRequest(BaseModel):
    """Telegram Login Widget callback payload (provider website login)."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class ProviderPasswordLoginRequest(BaseModel):
    """Provider portal username/password login (alt to the Telegram widget)."""
    username: str
    password: str


class WhatsAppStartRequest(BaseModel):
    """Start WhatsApp OTP flow — sends a 6-digit code via WhatsApp (BSP) or SMS."""
    phone: str = Field(..., pattern=r"^\+?[0-9]{6,15}$", description="E.164 phone number")


class WhatsAppVerifyRequest(BaseModel):
    """Verify the OTP code from a WhatsApp/SMS delivery."""
    request_id: str
    code: str = Field(..., min_length=6, max_length=6)


class GoogleAuthRequest(BaseModel):
    """Google Identity Services — ID token from the Sign In With Google flow."""
    credential: str = Field(..., description="Google ID token (JWT)")


class WhatsAppStartResponse(BaseModel):
    """Response after starting the OTP flow."""
    request_id: str
    expires_in: int = 600  # seconds


class BotRegisterRequest(BaseModel):
    """Bot /start registration - minimal user creation."""
    telegram_id: int
    telegram_handle: Optional[str] = None
    photo_url: Optional[str] = None


class UserOnboardingRequest(BaseModel):
    """Mini App onboarding - complete user profile."""
    name: str = Field(..., min_length=1, max_length=255)
    goal: Optional[str] = Field(None, max_length=500)
    interest_categories: List[InterestCategory] = Field(..., min_length=1)
    exercise_frequency: ExerciseFrequency
    suggested_circle_ids: Optional[List[str]] = None  # UUIDs of circles to auto-join


class UserProfileUpdate(BaseModel):
    """Profile update - personalization fields."""
    name: Optional[str] = Field(None, max_length=255)
    goal: Optional[str] = Field(None, max_length=500)
    location_neighborhood: Optional[str] = None
    health_app_connected: Optional[bool] = None
    # V2 UX: stored in E.164; frontend owns format/UX validation, backend just
    # refuses garbage (max length + loose digit pattern).
    phone_number: Optional[str] = Field(None, max_length=20, pattern=r"^\+?[0-9]{6,15}$")
    time_format: Optional[str] = Field(None, pattern=r"^(12h|24h)$")
    bio: Optional[str] = Field(None, max_length=300)
    profile_privacy: Optional[str] = Field(None, pattern=r"^(public|followers|private)$")


# --- Response schemas ---
class UserResponse(BaseModel):
    """Full user profile response."""
    id: str
    telegram_id: Optional[int] = None
    telegram_handle: Optional[str] = None
    name: Optional[str] = None
    photo_url: Optional[str] = None
    goal: Optional[str] = None
    interest_categories: List[str] = []
    exercise_frequency: Optional[str] = None
    points_balance: int = 0
    tier: str = "seed"
    tier_emoji: str = "🌱"
    current_streak: int = 0
    freeze_count: int = 0
    longest_streak: int = 0
    is_onboarded: bool = False
    is_provider: bool = False
    is_super_admin: bool = False
    location_neighborhood: Optional[str] = None
    health_app_connected: bool = False
    phone_number: Optional[str] = None
    time_format: Optional[str] = None
    bio: Optional[str] = None
    profile_privacy: str = "public"
    is_verified_trainer: bool = False
    follower_count: int = 0
    following_count: int = 0
    strava_stats: Optional[dict] = None
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
