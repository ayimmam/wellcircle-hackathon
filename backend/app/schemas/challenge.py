"""Community Challenge schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_checkins: int
    reward_points: int
    starts_at: datetime
    ends_at: datetime


class ChallengeProgress(BaseModel):
    checkins_this_period: int
    completed: bool


class ChallengeResponse(BaseModel):
    id: str
    community_id: str
    title: str
    description: Optional[str] = None
    target_checkins: int
    reward_points: int
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    
    user_progress: Optional[ChallengeProgress] = None

    class Config:
        from_attributes = True


class ChallengeListResponse(BaseModel):
    challenges: List[ChallengeResponse]
    count: int
