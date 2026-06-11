"""Active provider promotion lookup."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.provider_promotion import ProviderPromotion


def get_active_promotion(db: Session, provider_id: UUID) -> Optional[dict]:
    promo = (
        db.query(ProviderPromotion)
        .filter(
            ProviderPromotion.provider_id == provider_id,
            ProviderPromotion.is_active == True,
            ProviderPromotion.valid_until >= datetime.now(timezone.utc),
        )
        .order_by(ProviderPromotion.valid_until.desc())
        .first()
    )
    if not promo:
        return None
    return {
        "headline": promo.headline,
        "discount_pct": promo.discount_pct,
        "valid_until": promo.valid_until,
    }
