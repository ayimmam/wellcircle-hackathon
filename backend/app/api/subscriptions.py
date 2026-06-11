"""Subscriptions API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.provider_subscription import ProviderSubscription
from app.models.provider import Provider
from app.schemas.subscription import SubscriptionInitiateRequest, SubscriptionInitiateResponse, SubscriptionStatusResponse
from app.dependencies import get_current_provider
from app.services.telebirr_payment import initiate_telebirr_payment
from app.services.mpesa_payment import initiate_stk_push

router = APIRouter()

PLANS = [
    {
        "plan_id": "pro_monthly",
        "name": "Pro Monthly",
        "amount_etb": 1000,
        "features": ["Unlimited events", "Featured placement", "Advanced analytics"]
    },
    {
        "plan_id": "pro_yearly",
        "name": "Pro Yearly",
        "amount_etb": 10000,
        "features": ["Unlimited events", "Featured placement", "Advanced analytics", "2 months free"]
    }
]


@router.get("/subscriptions/plans")
def get_plans():
    return {"plans": PLANS}


@router.post("/providers/me/subscriptions/initiate", response_model=SubscriptionInitiateResponse)
async def initiate_subscription(
    request: SubscriptionInitiateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_provider)
):
    provider = db.query(Provider).filter(Provider.owner_user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Not linked to a provider")
        
    selected_plan = next((p for p in PLANS if p["plan_id"] == request.plan), None)
    if not selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
        
    subscription = ProviderSubscription(
        provider_id=provider.id,
        plan=request.plan,
        amount_etb=selected_plan["amount_etb"],
        payment_method=request.payment_method
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    
    if request.payment_method == "telebirr":
        result = await initiate_telebirr_payment(
            amount_etb=selected_plan["amount_etb"],
            subject=f"Well Circle Subscription - {selected_plan['name']}",
            return_url="https://t.me",
        )
        if "error" in result:
            raise HTTPException(status_code=502, detail=result["error"])
            
        subscription.telebirr_trade_no = result["trade_no"]
        db.commit()
        
        # mock success
        if result.get("mock"):
            subscription.status = "success"
            subscription.paid_at = datetime.now(timezone.utc)
            subscription.expires_at = datetime.now(timezone.utc) + timedelta(days=365 if "yearly" in request.plan else 30)
            provider.subscription_plan = request.plan
            db.commit()
            
        return SubscriptionInitiateResponse(
            subscription_id=str(subscription.id),
            plan=request.plan,
            amount_etb=selected_plan["amount_etb"],
            payment_method=request.payment_method,
            to_pay_url=result.get("to_pay_url"),
            trade_no=result.get("trade_no")
        )
        
    elif request.payment_method == "mpesa":
        if not request.phone_number:
            raise HTTPException(status_code=400, detail="Phone number required for mpesa")
            
        result = await initiate_stk_push(
            phone_number=request.phone_number,
            amount=selected_plan["amount_etb"],
            account_ref=str(subscription.id)[:12],
        )
        if "error" in result:
            raise HTTPException(status_code=502, detail=result["error"])
            
        subscription.mpesa_checkout_id = result["checkout_request_id"]
        db.commit()
        
        if result.get("mock"):
            subscription.status = "success"
            subscription.paid_at = datetime.now(timezone.utc)
            subscription.expires_at = datetime.now(timezone.utc) + timedelta(days=365 if "yearly" in request.plan else 30)
            provider.subscription_plan = request.plan
            db.commit()
            
        return SubscriptionInitiateResponse(
            subscription_id=str(subscription.id),
            plan=request.plan,
            amount_etb=selected_plan["amount_etb"],
            payment_method=request.payment_method,
            checkout_request_id=result.get("checkout_request_id")
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")
