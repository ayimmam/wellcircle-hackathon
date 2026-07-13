"""Active provider promotion lookup + presale eligibility."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.provider_promotion import ProviderPromotion

AUDIENCE_ALL = "all"
AUDIENCE_FIRST_TIME = "first_time"


def _promo_dict(promo: ProviderPromotion) -> dict:
    return {
        "id": str(promo.id),
        "headline": promo.headline,
        "discount_pct": promo.discount_pct,
        "valid_until": promo.valid_until,
        "audience": promo.audience or AUDIENCE_ALL,
    }


def _active_promos_query(db: Session, provider_id: UUID):
    return (
        db.query(ProviderPromotion)
        .filter(
            ProviderPromotion.provider_id == provider_id,
            ProviderPromotion.is_active == True,
            ProviderPromotion.valid_until >= datetime.now(timezone.utc),
        )
        .order_by(ProviderPromotion.valid_until.desc())
    )


def get_active_promotion(db: Session, provider_id: UUID) -> Optional[dict]:
    promo = _active_promos_query(db, provider_id).first()
    if not promo:
        return None
    return _promo_dict(promo)


def user_is_first_time(db: Session, provider_id: UUID, user_id: UUID) -> bool:
    """A user is 'first-time' at a provider until they have a paid booking there."""
    from app.models.booking import Booking

    paid = (
        db.query(Booking.id)
        .filter(
            Booking.provider_id == provider_id,
            Booking.user_id == user_id,
            Booking.payment_status == "success",
        )
        .first()
    )
    return paid is None


def get_eligible_promotion(db: Session, provider_id: UUID, user_id: UUID) -> Optional[dict]:
    """The active promotion this specific user can redeem, or None.

    audience='all' promos apply to everyone; audience='first_time' (presale)
    promos apply only while the user has no successful booking at the provider.
    """
    promos = _active_promos_query(db, provider_id).all()
    if not promos:
        return None
    first_time = None  # lazily computed — most providers have 0-1 promos
    for promo in promos:
        if (promo.audience or AUDIENCE_ALL) == AUDIENCE_FIRST_TIME:
            if first_time is None:
                first_time = user_is_first_time(db, provider_id, user_id)
            if not first_time:
                continue
        return _promo_dict(promo)
    return None


def compute_discount_etb(amount_etb: int, discount_pct: Optional[int]) -> int:
    """Flat % off the booking total, never discounting below zero."""
    if not discount_pct or discount_pct <= 0 or amount_etb <= 0:
        return 0
    return min(round(amount_etb * discount_pct / 100), amount_etb)


def get_reengagement_promos(db: Session, users: List) -> Dict[int, dict]:
    """Batched promo lookup for the bot's re-entry nudge.

    For each user, picks the soonest-expiring active discount promotion they
    are still eligible for, so the nudge can say "use your X% off before it
    expires". Returns {telegram_id: {provider_id, provider_name, headline,
    discount_pct, valid_until}}. Batch queries only — this runs over every
    inactive user at once (see SPRINT_TEAM_HANDOFF scaling note).
    """
    from app.models.booking import Booking
    from app.models.provider import Provider

    if not users:
        return {}

    now = datetime.now(timezone.utc)
    promo_rows = (
        db.query(ProviderPromotion, Provider.name)
        .join(Provider, ProviderPromotion.provider_id == Provider.id)
        .filter(
            ProviderPromotion.is_active == True,
            ProviderPromotion.valid_until >= now,
            ProviderPromotion.discount_pct.isnot(None),
            ProviderPromotion.discount_pct > 0,
        )
        .order_by(ProviderPromotion.valid_until.asc())
        .all()
    )
    if not promo_rows:
        return {}

    user_ids = [u.id for u in users]
    provider_ids = {promo.provider_id for promo, _ in promo_rows}
    paid_pairs = set(
        db.query(Booking.user_id, Booking.provider_id)
        .filter(
            Booking.user_id.in_(user_ids),
            Booking.provider_id.in_(provider_ids),
            Booking.payment_status == "success",
        )
        .all()
    )

    result: Dict[int, dict] = {}
    for user in users:
        for promo, provider_name in promo_rows:  # soonest-expiring first
            if (promo.audience or AUDIENCE_ALL) == AUDIENCE_FIRST_TIME and (
                user.id, promo.provider_id
            ) in paid_pairs:
                continue
            result[user.telegram_id] = {
                "provider_id": str(promo.provider_id),
                "provider_name": provider_name,
                "headline": promo.headline,
                "discount_pct": promo.discount_pct,
                "valid_until": promo.valid_until.isoformat() if promo.valid_until else None,
            }
            break
    return result
