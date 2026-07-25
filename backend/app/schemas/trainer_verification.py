from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class TrainerVerificationApply(BaseModel):
    certificate_url: str = Field(..., min_length=1)
    certificate_public_id: str = Field(..., min_length=1)
    payment_receipt_url: str = Field(..., min_length=1)
    payment_receipt_public_id: str = Field(..., min_length=1)


class TrainerVerificationResponse(BaseModel):
    id: str
    status: str
    payment_status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None


class AdminTrainerReviewRequest(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")
    rejection_reason: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def reason_required_for_rejection(self):
        if self.action == "reject" and not self.rejection_reason:
            raise ValueError("rejection_reason is required when rejecting")
        return self
