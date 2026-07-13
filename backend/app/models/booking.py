"""Booking ORM model - service reservations and payment tracking."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False, index=True)
    service_name = Column(String(255), nullable=False)
    slot_datetime = Column(DateTime(timezone=True), nullable=False)
    amount_etb = Column(Integer, nullable=False)  # Amount in Ethiopian Birr
    payment_method = Column(String(50), nullable=False)  # telebirr|mpesa
    payment_status = Column(String(50), default="pending")  # pending|success|failed
    telebirr_trade_no = Column(String(255), nullable=True, unique=True)
    mpesa_checkout_id = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)  # Payment phone number
    event_id = Column(UUID(as_uuid=True), ForeignKey("provider_events.id"), nullable=True)
    # Presale promo applied at creation (server-side): promo row + ETB knocked off amount_etb
    promotion_id = Column(UUID(as_uuid=True), ForeignKey("provider_promotions.id"), nullable=True)
    discount_etb = Column(Integer, nullable=True)
    reminder_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
