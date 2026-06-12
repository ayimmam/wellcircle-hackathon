"""Provider Event schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class EventCreate(BaseModel):
    service_name: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    capacity: int
    price_etb: int


class EventUpdate(BaseModel):
    description: Optional[str] = None
    capacity: Optional[int] = None
    spots_remaining: Optional[int] = None
    is_cancelled: Optional[bool] = None


class EventResponse(BaseModel):
    id: str
    provider_id: str
    service_name: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    capacity: int
    spots_remaining: int
    price_etb: int
    is_cancelled: bool
    is_boosted: bool
    created_at: datetime
    
    # Computed fields for ListResponse (joined from Provider)
    provider_name: Optional[str] = None
    provider_category: Optional[str] = None
    provider_cover_photo_url: Optional[str] = None
    urgency: Optional[str] = None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: List[EventResponse]
    count: int
    page: Optional[int] = 1
