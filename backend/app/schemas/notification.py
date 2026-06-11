"""User Notification schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: Optional[str] = None
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    count: int
