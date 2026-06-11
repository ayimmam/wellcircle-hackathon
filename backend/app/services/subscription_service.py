"""Provider subscription plans and activation logic."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.provider import Provider
from app.models.provider_subscription import ProviderSubscription
from app.models.user import User
from app.services.notification_service import create_notification

SUBSCRIPTION_PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "price_etb": 500,
        "billing": "monthly",
        "features": [
            "1 community space",
            "Basic dashboard (members, check-ins)",
            "Up to 5 events per month",
        ],
    },
    {
        "id": "growth",
        "name": "Growth",
        "price_etb": 1500,
        "billing": "monthly",
        "features": [
            "3 community spaces",
            "Full dashboard + analytics",
            "Unlimited events",
            "Products store access",
            "Community challenges",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_etb": 3000,
        "billing": "monthly",
        "features": [
            "Unlimited community spaces",
            "Featured placement in Explore",
            "Event boost credits (3/month)",
            "All Growth features",
            "Priority admin support",
        ],
    },
]


def get_plan(plan_id: str) -> Optional[dict]:
    return next((p for p in SUBSCRIPTION_PLANS if p["id"] == plan_id), None)


def get_subscription_by_trade_no(db: Session, trade_no: str) -> Optional[ProviderSubscription]:
    return db.query(ProviderSubscription).filter(
        ProviderSubscription.telebirr_trade_no == trade_no
    ).first()


def get_subscription_by_checkout_id(db: Session, checkout_id: str) -> Optional[ProviderSubscription]:
    return db.query(ProviderSubscription).filter(
        ProviderSubscription.mpesa_checkout_id == checkout_id
    ).first()


def activate_subscription(db: Session, subscription: ProviderSubscription, success: bool = True) -> None:
    """Apply payment result to subscription and provider profile."""
    provider = db.query(Provider).filter(Provider.id == subscription.provider_id).first()
    if not provider:
        return

    if not success:
        subscription.status = "failed"
        db.commit()
        return

    now = datetime.now(timezone.utc)
    subscription.status = "active"
    subscription.paid_at = now
    subscription.expires_at = now + timedelta(days=30)
    provider.subscription_plan = subscription.plan

    if subscription.plan == "pro":
        provider.is_featured = True

    if provider.status == "pending_approval":
        provider.status = "active"

    owner = db.query(User).filter(User.id == provider.owner_user_id).first()
    if owner:
        owner.is_provider = True
        create_notification(
            db,
            user_id=owner.id,
            type="provider_approved",
            title="Your provider account is live",
            body="Welcome to Well Circle! Your listing is now visible to users.",
            action_url="/provider-dashboard",
        )

    db.commit()
