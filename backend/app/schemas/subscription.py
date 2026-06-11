"""Provider Subscription schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class SubscriptionInitiateRequest(BaseModel):
    plan: str
    payment_method: str
    phone_number: Optional[str] = None
    provider_id: str


class SubscriptionInitiateResponse(BaseModel):
    subscription_id: str
    plan: str
    amount_etb: int
    payment_method: str
    to_pay_url: Optional[str] = None
    trade_no: Optional[str] = None
    checkout_request_id: Optional[str] = None


class SubscriptionStatusResponse(BaseModel):
    subscription_id: str
    plan: str
    status: str
    paid_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True
