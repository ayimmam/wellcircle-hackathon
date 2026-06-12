"""Booking routes."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.booking import create_booking
from app.schemas.booking import BookingCreate, BookingResponse

router = APIRouter()


from sqlalchemy import select, update
from fastapi import BackgroundTasks
from app.models.provider_event import ProviderEvent
from app.models.event_inventory_log import EventInventoryLog
from app.models.user_notification import UserNotification

def trigger_booking_notification(db_session: Session, user_id: UUID, service_name: str, datetime_str: str):
    msg = f"Your booking for {service_name} on {datetime_str} is confirmed!"
    db_session.add(UserNotification(user_id=user_id, message=msg, is_read=False))
    db_session.commit()

@router.post("", response_model=BookingResponse, status_code=201)
async def create_new_booking(
    request: BookingCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
            amount_etb=request.amount_etb,
            payment_method=request.payment_method,
            phone_number=request.phone_number,
            event_id=event_uuid,
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
            amount_etb=request.amount_etb,
            payment_method=request.payment_method,
            phone_number=request.phone_number,
        )

    # 4. Trigger Instant Notification
    background_tasks.add_task(
        trigger_booking_notification, 
        db, 
        user.id, 
        request.service_name, 
        str(request.slot_datetime)
    )
        
    return BookingResponse(
        id=str(booking.id), provider_id=str(booking.provider_id),
        service_name=booking.service_name,
        slot_datetime=booking.slot_datetime,
        amount_etb=booking.amount_etb,
        payment_method=booking.payment_method,
        payment_status=booking.payment_status,
        event_id=str(booking.event_id) if booking.event_id else None,
        created_at=booking.created_at,
    )
