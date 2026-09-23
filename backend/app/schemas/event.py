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
    staff_user_id: Optional[str] = None  # D2: designated evidence submitter


class EventUpdate(BaseModel):
    description: Optional[str] = None
    capacity: Optional[int] = None
    spots_remaining: Optional[int] = None
    is_cancelled: Optional[bool] = None
    staff_user_id: Optional[str] = None  # D2: designated evidence submitter


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
    staff_user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    
    # Computed fields for ListResponse (joined from Provider)
    provider_name: Optional[str] = None
    provider_category: Optional[str] = None
    provider_cover_photo_url: Optional[str] = None
    provider_is_coming_soon: Optional[bool] = None
    urgency: Optional[str] = None

    # An event RSVP is a hand-off, not a checkout — WellCircle collects no
    # money for events — so the RSVP screen shows the host's own channels for
    # the guest to arrange payment through. Carried on the event itself so a
    # cold deep link into /event/<id>/rsvp needs no second request.
    provider_contact_phone: Optional[str] = None
    provider_contact_telegram: Optional[str] = None
    provider_contact_instagram: Optional[str] = None
    provider_contact_website: Optional[str] = None

    # Past-event recaps: an event that has already started can't be booked, so
    # the client shows how many people turned up instead of how many spots are
    # left. See GET /events?past=true.
    is_past: Optional[bool] = None
    attendee_count: Optional[int] = None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: List[EventResponse]
    count: int
    page: Optional[int] = 1
