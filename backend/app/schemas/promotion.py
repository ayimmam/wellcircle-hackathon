"""Provider promotion schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PromotionCreate(BaseModel):
    headline: str = Field(..., min_length=1, max_length=255)
    discount_pct: Optional[int] = Field(None, ge=0, le=100)
    valid_until: datetime


class PromotionResponse(BaseModel):
    id: str
    headline: str
    discount_pct: Optional[int] = None
    valid_until: datetime
    is_active: bool = True

    class Config:
        from_attributes = True
