"""Booking routes."""

import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.booking import create_booking, create_sibling_bookings
from app.schemas.booking import BookingCreate, BookingResponse, AppliedPromotion
from app.services.promotion_service import get_eligible_promotion, compute_discount_etb
from app.services.sheets import export_booking_to_sheets
from app.models.provider import Provider

router = APIRouter()


from sqlalchemy import select, update
from fastapi import BackgroundTasks
from app.models.provider_event import ProviderEvent
from app.models.event_inventory_log import EventInventoryLog
from app.models.user_notification import UserNotification

def trigger_booking_notification(db_session: Session, user_id: UUID, service_name: str, datetime_str: str):
    # Pre-existing bug fix: this previously passed `message=` to a model with
    # no such column and a non-nullable `title`, so it crashed silently on
    # every booking (a background task's exception never reaches the client).
    # Fires for every booking regardless of payment_method — none of them are
    # auto-confirmed at creation anymore. `pay_on_site` bookings stay
    # `pending` until our team calls to confirm (and, for Kuriftu, the
    # booking is also on the staff Google Sheet — see create_new_booking).
    # telebirr/mpesa bookings still separately get a real "confirmed"
    # notification once their gateway payment actually succeeds.
    db_session.add(UserNotification(
        user_id=user_id,
        type="booking_received",
        title="Booking request received",
        body=f"Your booking for {service_name} on {datetime_str} is on its way to confirmation — we'll contact you shortly.",
        action_url="/my-bookings",
        is_read=False,
    ))
    db_session.commit()

@router.post("", response_model=BookingResponse, status_code=201)
async def create_new_booking(
    request: BookingCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Presale loop: the backend, not the client, decides whether a promotion
    # applies — clients always send the undiscounted amount. Eligibility is
    # checked before the booking row exists so this booking can't disqualify
    # itself from a first-time promo.
    if request.additional_slot_datetimes and request.event_id:
        raise HTTPException(
            status_code=422,
            detail="Multi-day booking isn't supported for event bookings — an event already has one fixed date",
        )

    promo = get_eligible_promotion(db, UUID(request.provider_id), user.id)
    discount_etb = compute_discount_etb(request.amount_etb, promo["discount_pct"]) if promo else 0
    charged_etb = request.amount_etb - discount_etb
    # Multi-day booking: every booking (primary + siblings) shares one group
    # id so a single payment can cascade to all of them. Assigned even for a
    # single-day booking for consistency (harmless — group of one).
    group_id = uuid.uuid4()
    primary_fields = {"booking_group_id": group_id}
    if discount_etb > 0:
        primary_fields["promotion_id"] = UUID(promo["id"])
        primary_fields["discount_etb"] = discount_etb

    if request.event_id:
        event_uuid = UUID(request.event_id)

        # 1. Lock the row explicitly for this transaction
        stmt = select(ProviderEvent).where(ProviderEvent.id == event_uuid).with_for_update()
        event = db.execute(stmt).scalar_one_or_none()

        if not event or event.is_cancelled or event.spots_remaining <= 0:
            db.rollback()
            raise HTTPException(status_code=409, detail="No spots remaining or event cancelled")

        # 2. Safely decrement
        event.spots_remaining -= 1

        booking = create_booking(
            db, user_id=user.id,
            provider_id=UUID(request.provider_id),
            service_name=request.service_name,
            slot_datetime=request.slot_datetime,
            amount_etb=charged_etb,
            payment_method=request.payment_method,
            phone_number=request.phone_number,
            event_id=event_uuid,
            **primary_fields,
        )
        db.add(EventInventoryLog(
            event_id=event_uuid,
            delta=-1,
            reason="booking_confirmed",
            booking_id=booking.id
        ))
        db.commit()
    else:
        booking = create_booking(
            db, user_id=user.id,
            provider_id=UUID(request.provider_id),
            service_name=request.service_name,
            slot_datetime=request.slot_datetime,
            amount_etb=charged_etb,
            payment_method=request.payment_method,
            phone_number=request.phone_number,
            **primary_fields,
        )

    # Multi-day booking: create one sibling booking per additional date, same
    # service/time/payment method, plain per-day amount (the promo discount
    # above only applied to the primary/first day).
    sibling_bookings = []
    if request.additional_slot_datetimes:
        sibling_bookings = create_sibling_bookings(
            db, user_id=user.id, group_id=group_id,
            extra_dates=request.additional_slot_datetimes,
            provider_id=UUID(request.provider_id),
            service_name=request.service_name,
            amount_etb=request.amount_etb,
            payment_method=request.payment_method,
            phone_number=request.phone_number,
        )

    # 4. Trigger Instant Notification — an ack only, for every payment
    # method. Nothing is auto-confirmed at creation: telebirr/mpesa wait on
    # their gateway callback (see payments.py), and pay_on_site waits on our
    # team calling the guest to confirm (phone_number below) and collecting
    # payment in person — never flipped to "success" automatically here.
    background_tasks.add_task(
        trigger_booking_notification,
        db,
        user.id,
        request.service_name,
        str(request.slot_datetime)
    )

    # 5. Sync to Google Sheets for Kuriftu
    provider = db.query(Provider).filter(Provider.id == UUID(request.provider_id)).first()
    if provider and "kuriftu" in provider.name.lower():
        # Service type is Event if event_id is present, otherwise Service
        service_type = "Event" if request.event_id else "Service"
        user_name = user.name or user.telegram_handle or "Unknown User"
        
        # Run the Google Sheets sync synchronously to ensure it completes before Vercel freezes the function
        try:
            await export_booking_to_sheets(
                name=user_name,
                phone_number=request.phone_number,
                datetime_str=str(request.slot_datetime),
                service_type=service_type,
                service_name=request.service_name
            )
        except Exception as e:
            # Catch exceptions here so a sheets failure doesn't ruin the user's booking response
            pass

    return BookingResponse(
        id=str(booking.id), provider_id=str(booking.provider_id),
        service_name=booking.service_name,
        slot_datetime=booking.slot_datetime,
        amount_etb=booking.amount_etb,
        payment_method=booking.payment_method,
        payment_status=booking.payment_status,
        event_id=str(booking.event_id) if booking.event_id else None,
        promotion=AppliedPromotion(
            id=promo["id"],
            headline=promo["headline"],
            discount_pct=promo["discount_pct"],
            discount_etb=discount_etb,
        ) if discount_etb > 0 else None,
        created_at=booking.created_at,
        additional_booking_ids=[str(s.id) for s in sibling_bookings],
        total_amount_etb=booking.amount_etb + sum(s.amount_etb for s in sibling_bookings),
    )
