"""Booking & payment request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BookingCreate(BaseModel):
    """Create a booking. `slot_datetime` is the first/primary day.

    `additional_slot_datetimes`: same service, same time-of-day, on more days
    (multi-day booking) — each becomes its own Booking row sharing the
    primary's `booking_group_id`, charged at the plain per-day rate (any
    promotion discount applies to the primary day only). Not supported for
    event bookings (an event already has one fixed date).
    """
    provider_id: str
    service_name: str
    slot_datetime: datetime
    amount_etb: int = Field(..., gt=0)  # per-day amount, undiscounted
    # `pay_on_site` — no in-app payment gateway; the booking stays `pending`
    # after creation (see api/bookings.py) and our team calls the guest on
    # `phone_number` to confirm the slot — payment is collected then, not
    # through the app. For Kuriftu, the booking is also synced to the
    # staff-facing Google Sheet at creation (see services/sheets.py).
    payment_method: str = Field(..., pattern="^(telebirr|mpesa|pay_on_site)$")
    phone_number: Optional[str] = None
    event_id: Optional[str] = None
    additional_slot_datetimes: Optional[List[datetime]] = None

class AppliedPromotion(BaseModel):
    """Promotion the backend auto-applied to a booking (presale loop)."""
    id: str
    headline: str
    discount_pct: int
    discount_etb: int


class BookingResponse(BaseModel):
    """Booking detail — the primary/first day's booking."""
    id: str
    provider_id: str
    service_name: str
    slot_datetime: datetime
    amount_etb: int  # final charged amount for THIS day, after any promotion discount
    payment_method: str
    payment_status: str
    event_id: Optional[str] = None
    promotion: Optional[AppliedPromotion] = None
    created_at: datetime
    # Multi-day booking: ids of the sibling bookings created for the other
    # selected days (empty for a single-day booking), and the combined total
    # across the whole group (== amount_etb when there are no siblings).
    additional_booking_ids: List[str] = Field(default_factory=list)
    total_amount_etb: int = 0

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
