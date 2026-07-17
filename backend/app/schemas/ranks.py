"""Ranks (weekly leaderboard) schemas."""

from pydantic import BaseModel
from typing import List, Optional


class CommunityRank(BaseModel):
    community_id: str
    name: str
    member_count: int
    weekly_points: int
    rank: int


class UserRank(BaseModel):
    user_id: str
    name: str
    photo_url: Optional[str] = None
    weekly_points: int
    rank: int


class MyRank(BaseModel):
    rank: Optional[int] = None
    weekly_points: int


class RanksResponse(BaseModel):
    communities: List[CommunityRank]
    users: List[UserRank]
    me: MyRank
