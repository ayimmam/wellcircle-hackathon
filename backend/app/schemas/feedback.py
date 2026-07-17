"""Feedback (bug reports / health-app requests / suggestions) schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict


class FeedbackCreate(BaseModel):
    type: str = Field(..., pattern=r"^(bug|health_app_request|suggestion)$")
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[Dict[str, Any]] = None


class FeedbackCreateResponse(BaseModel):
    id: str


class FeedbackItem(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_handle: Optional[str] = None
    type: str
    message: str
    context: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackListResponse(BaseModel):
    items: List[FeedbackItem]
    total: int
    page: int


class FeedbackStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(new|reviewed|resolved)$")
