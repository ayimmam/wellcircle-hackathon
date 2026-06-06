"""Booking CRUD operations."""

from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.community import CommunityFeedEvent, Community
from app.models.user import User


def create_booking(db: Session, user_id: UUID, **kwargs) -> Booking:
    """Create a new booking record."""
    booking = Booking(user_id=user_id, **kwargs)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def get_booking_by_id(db: Session, booking_id: UUID) -> Optional[Booking]:
    return db.query(Booking).filter(Booking.id == booking_id).first()


def update_booking_payment(
    db: Session, booking_id: UUID,
    payment_status: str,
    trade_no: Optional[str] = None,
    checkout_id: Optional[str] = None,
) -> Optional[Booking]:
    """Update booking payment status and refs."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return None
    booking.payment_status = payment_status
    if trade_no:
        booking.telebirr_trade_no = trade_no
    if checkout_id:
        booking.mpesa_checkout_id = checkout_id

    # On success, create feed event in provider's community
    if payment_status == "success":
        community = (
            db.query(Community)
            .filter(Community.provider_id == booking.provider_id)
            .first()
        )
        if community:
            event = CommunityFeedEvent(
                community_id=community.id,
                user_id=booking.user_id,
                event_type="booking",
                event_metadata={
                    "service_name": booking.service_name,
                    "amount": booking.amount_etb,
                },
            )
            db.add(event)

    db.commit()
    db.refresh(booking)
    return booking
