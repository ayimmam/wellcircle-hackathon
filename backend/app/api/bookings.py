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


@router.post("", response_model=BookingResponse, status_code=201)
async def create_new_booking(
    request: BookingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = create_booking(
        db, user_id=user.id,
        provider_id=UUID(request.provider_id),
        service_name=request.service_name,
        slot_datetime=request.slot_datetime,
        amount_etb=request.amount_etb,
        payment_method=request.payment_method,
        phone_number=request.phone_number,
    )
    return BookingResponse(
        id=str(booking.id), provider_id=str(booking.provider_id),
        service_name=booking.service_name,
        slot_datetime=booking.slot_datetime,
        amount_etb=booking.amount_etb,
        payment_method=booking.payment_method,
        payment_status=booking.payment_status,
        created_at=booking.created_at,
    )
