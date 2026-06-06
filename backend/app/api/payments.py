"""Payment routes — Telebirr, M-Pesa, status polling, callbacks."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.booking import get_booking_by_id, update_booking_payment
from app.services.telebirr_payment import initiate_telebirr_payment, verify_telebirr_callback
from app.services.mpesa_payment import initiate_stk_push, verify_mpesa_callback
from app.schemas.booking import (
    TelebirrInitiateRequest, TelebirrInitiateResponse,
    MpesaInitiateRequest, MpesaInitiateResponse,
    PaymentStatusResponse,
)

router = APIRouter()


@router.post("/telebirr/initiate", response_model=TelebirrInitiateResponse)
async def telebirr_initiate(
    request: TelebirrInitiateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, UUID(request.booking_id))
    if not booking or str(booking.user_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Booking not found")

    result = await initiate_telebirr_payment(
        amount_etb=booking.amount_etb,
        subject=f"Well Circle - {booking.service_name}",
        return_url="https://t.me",  # Returns to Telegram
    )

    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    # Store trade_no on booking
    update_booking_payment(db, booking.id, "pending", trade_no=result["trade_no"])

    return TelebirrInitiateResponse(
        booking_id=str(booking.id),
        to_pay_url=result["to_pay_url"],
        trade_no=result["trade_no"],
    )


@router.post("/telebirr/callback")
async def telebirr_callback(request: Request, db: Session = Depends(get_db)):
    """Telebirr async webhook — no auth required."""
    payload = await request.json()
    data = verify_telebirr_callback(payload)
    if not data:
        return {"status": "ignored"}

    from app.models.booking import Booking
    booking = (
        db.query(Booking)
        .filter(Booking.telebirr_trade_no == data["trade_no"])
        .first()
    )
    if booking:
        status = "success" if data["result_code"] == "0" else "failed"
        update_booking_payment(db, booking.id, status)

    return {"status": "ok"}


@router.post("/mpesa/initiate", response_model=MpesaInitiateResponse)
async def mpesa_initiate(
    request: MpesaInitiateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = get_booking_by_id(db, UUID(request.booking_id))
    if not booking or str(booking.user_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Booking not found")

    result = await initiate_stk_push(
        phone_number=request.phone_number,
        amount=booking.amount_etb,
        account_ref=str(booking.id)[:12],
    )

    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    update_booking_payment(
        db, booking.id, "pending",
        checkout_id=result["checkout_request_id"],
    )

    return MpesaInitiateResponse(
        booking_id=str(booking.id),
        checkout_request_id=result["checkout_request_id"],
    )


@router.post("/mpesa/callback")
async def mpesa_callback(request: Request, db: Session = Depends(get_db)):
    """M-Pesa Daraja webhook — no auth required."""
    payload = await request.json()
    data = verify_mpesa_callback(payload)

    from app.models.booking import Booking
    booking = (
        db.query(Booking)
        .filter(Booking.mpesa_checkout_id == data.get("checkout_request_id"))
        .first()
    )
    if booking:
        status = "success" if data.get("result_code") == 0 else "failed"
        update_booking_payment(db, booking.id, status)

    return {"status": "ok"}


@router.get("/{booking_id}/status", response_model=PaymentStatusResponse)
async def payment_status(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll payment status. Frontend calls every 3 seconds."""
    booking = get_booking_by_id(db, UUID(booking_id))
    if not booking or str(booking.user_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Booking not found")

    ref = booking.telebirr_trade_no or booking.mpesa_checkout_id
    return PaymentStatusResponse(
        booking_id=str(booking.id),
        payment_status=booking.payment_status,
        payment_method=booking.payment_method,
        amount_etb=booking.amount_etb,
        reference_number=ref if booking.payment_status == "success" else None,
    )
