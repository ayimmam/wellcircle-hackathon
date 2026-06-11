"""Subscriptions API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.provider_subscription import ProviderSubscription
from app.models.provider import Provider
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionInitiateRequest,
    SubscriptionInitiateResponse,
    SubscriptionStatusResponse,
)
from app.dependencies import get_current_user, get_current_provider
from app.services.telebirr_payment import initiate_telebirr_payment
from app.services.mpesa_payment import initiate_stk_push
from app.services.subscription_service import (
    SUBSCRIPTION_PLANS,
    get_plan,
    activate_subscription,
)

router = APIRouter()


@router.get("/subscriptions/plans")
def get_plans():
    return {"plans": SUBSCRIPTION_PLANS}


@router.get("/subscriptions/status/{subscription_id}", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    subscription_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subscription = db.query(ProviderSubscription).filter(
        ProviderSubscription.id == subscription_id
    ).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    provider = db.query(Provider).filter(Provider.id == subscription.provider_id).first()
    if not provider or str(provider.owner_user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return SubscriptionStatusResponse(
        subscription_id=str(subscription.id),
        plan=subscription.plan,
        status=subscription.status,
        paid_at=subscription.paid_at,
        expires_at=subscription.expires_at,
    )


async def _initiate_for_provider(
    request: SubscriptionInitiateRequest,
    db: Session,
    current_user: User,
) -> SubscriptionInitiateResponse:
    if not request.provider_id:
        raise HTTPException(status_code=400, detail="provider_id required")

    provider = db.query(Provider).filter(Provider.id == request.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if str(provider.owner_user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Provider does not belong to you")

    selected_plan = get_plan(request.plan)
    if not selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    subscription = ProviderSubscription(
        provider_id=provider.id,
        plan=request.plan,
        amount_etb=selected_plan["price_etb"],
        payment_method=request.payment_method,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    if request.payment_method == "telebirr":
        result = await initiate_telebirr_payment(
            amount_etb=selected_plan["price_etb"],
            subject=f"Well Circle Subscription - {selected_plan['name']}",
            return_url="https://t.me",
        )
        if "error" in result:
            raise HTTPException(status_code=502, detail=result["error"])

        subscription.telebirr_trade_no = result["trade_no"]
        db.commit()

        if result.get("mock"):
            activate_subscription(db, subscription, success=True)

        return SubscriptionInitiateResponse(
            subscription_id=str(subscription.id),
            plan=request.plan,
            amount_etb=selected_plan["price_etb"],
            payment_method=request.payment_method,
            to_pay_url=result.get("to_pay_url"),
            trade_no=result.get("trade_no"),
        )

    if request.payment_method == "mpesa":
        if not request.phone_number:
            raise HTTPException(status_code=400, detail="Phone number required for mpesa")

        result = await initiate_stk_push(
            phone_number=request.phone_number,
            amount=selected_plan["price_etb"],
            account_ref=str(subscription.id)[:12],
        )
        if "error" in result:
            raise HTTPException(status_code=502, detail=result["error"])

        subscription.mpesa_checkout_id = result["checkout_request_id"]
        db.commit()

        if result.get("mock"):
            activate_subscription(db, subscription, success=True)

        return SubscriptionInitiateResponse(
            subscription_id=str(subscription.id),
            plan=request.plan,
            amount_etb=selected_plan["price_etb"],
            payment_method=request.payment_method,
            checkout_request_id=result.get("checkout_request_id"),
        )

    raise HTTPException(status_code=400, detail="Unsupported payment method")


@router.post("/subscriptions/initiate", response_model=SubscriptionInitiateResponse)
async def initiate_subscription_spec(
    request: SubscriptionInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _initiate_for_provider(request, db, current_user)


@router.post("/providers/me/subscriptions/initiate", response_model=SubscriptionInitiateResponse)
async def initiate_subscription_legacy(
    request: SubscriptionInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_provider),
):
    provider = db.query(Provider).filter(Provider.owner_user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Not linked to a provider")
    payload = request.model_copy(update={"provider_id": str(provider.id)})
    return await _initiate_for_provider(payload, db, current_user)
