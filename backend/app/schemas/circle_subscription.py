from typing import Optional

from pydantic import BaseModel, Field


class PaidCircleApplyRequest(BaseModel):
    price_etb: int = Field(..., gt=0, le=10000)


class CircleSubscribeRequest(BaseModel):
    receipt_url: str = Field(..., min_length=1)
    receipt_public_id: str = Field(..., min_length=1)


class SubscriptionApprovalRequest(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")


class PaidCircleAdminReviewRequest(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")
    reason: Optional[str] = Field(None, max_length=1000)


class CircleRevenueResponse(BaseModel):
    total_revenue_etb: int
    creator_earnings_etb: int
    platform_fee_etb: int
    active_subscribers: int
    pending_receipts: int
    monthly_trend: list
