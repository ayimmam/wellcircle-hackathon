"""Booking & payment request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class BookingCreate(BaseModel):
    """Create a booking."""
    provider_id: str
    service_name: str
    slot_datetime: datetime
    amount_etb: int = Field(..., gt=0)
    payment_method: str = Field(..., pattern="^(telebirr|mpesa)$")
    phone_number: Optional[str] = None


class BookingResponse(BaseModel):
    """Booking detail."""
    id: str
    provider_id: str
    service_name: str
    slot_datetime: datetime
    amount_etb: int
    payment_method: str
    payment_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TelebirrInitiateRequest(BaseModel):
    booking_id: str


class TelebirrInitiateResponse(BaseModel):
    booking_id: str
    to_pay_url: str
    trade_no: str


class MpesaInitiateRequest(BaseModel):
    booking_id: str
    phone_number: str = Field(..., pattern=r"^254\d{9}$")


class MpesaInitiateResponse(BaseModel):
    booking_id: str
    checkout_request_id: str
    message: str = "STK Push sent. Check your phone."


class PaymentStatusResponse(BaseModel):
    booking_id: str
    payment_status: str  # pending | success | failed
    payment_method: str
    amount_etb: int
    reference_number: Optional[str] = None
