"""Provider routes — browse, detail, dashboard stats, self-onboarding."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_provider, get_super_admin
from app.models.user import User
from app.crud.provider import (
    get_all_providers, get_provider_detail, get_provider_stats,
    user_has_active_provider, create_self_onboarded_provider,
    get_provider_me, update_provider_me, get_provider_by_owner,
    get_provider_customers, award_customer_points,
    get_price_suggestion, get_provider_points_analytics,
    get_provider_bookings, get_provider_service_breakdown,
    get_provider_customer_demographics, get_provider_metrics_timeseries,
)
from app.crud.provider_invite import get_valid_invite, create_invite
from app.crud.product import (
    get_provider_products, create_product, update_product,
    get_provider_redemptions, provider_update_redemption_status,
)
from app.schemas.provider_onboarding import (
    SelfOnboardRequest, SelfOnboardResponse,
    InviteCodeGenerateRequest, InviteCodeGenerateResponse,
    ProviderMeResponse, ProviderMeUpdate,
)
from app.schemas.product import (
    ProviderProductCreate, ProviderProductUpdate,
    RedemptionStatusUpdateRequest, RedemptionStatusUpdateResponse,
)
from app.schemas.promotion import PromotionCreate, PromotionResponse
from app.models.provider_promotion import ProviderPromotion

router = APIRouter()

# Custom time-range metrics — cap the range so the timeseries endpoint can't
# be used to force a huge day-by-day scan.
MAX_TIMESERIES_RANGE_DAYS = 366


@router.post("/self-onboard", response_model=SelfOnboardResponse, status_code=201)
async def self_onboard(
    request: SelfOnboardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.is_provider or user_has_active_provider(db, user.id):
        raise HTTPException(status_code=409, detail="User already has an active provider account")

    invite = get_valid_invite(db, request.provider_invite_code)
    if not invite:
        raise HTTPException(status_code=422, detail="Invalid or expired invite code")

    data = request.model_dump(exclude={"provider_invite_code"})
    provider = create_self_onboarded_provider(db, user, invite, **data)
    return SelfOnboardResponse(
        provider_id=str(provider.id),
        name=provider.name,
        status=provider.status,
        message="Application submitted and automatically approved!",
    )


@router.post("/invite-code/generate", response_model=InviteCodeGenerateResponse, status_code=201)
async def generate_invite_code(
    request: InviteCodeGenerateRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    invite = create_invite(db, admin.id, expires_in_days=request.expires_in_days)
    return InviteCodeGenerateResponse(
        invite_code=invite.invite_code,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


@router.get("/me", response_model=ProviderMeResponse)
async def get_my_provider(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    data = get_provider_me(db, user)
    if not data:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return data


@router.patch("/me", response_model=ProviderMeResponse)
async def update_my_provider(
    request: ProviderMeUpdate,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    data = request.model_dump(exclude_unset=True)
    provider = update_provider_me(db, user, **data)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    result = get_provider_me(db, user)
    return result


@router.get("/me/products")
async def list_my_products(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    products = get_provider_products(db, provider.id)
    return {
        "products": [
            {
                "id": str(p.id),
                "name": p.name,
                "type": p.type,
                "price_etb": p.price_etb,
                "quantity_in_stock": p.quantity_in_stock,
                "is_active": p.is_active,
            }
            for p in products
        ],
        "count": len(products),
    }


@router.post("/me/products", status_code=201)
async def create_my_product(
    request: ProviderProductCreate,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    product = create_product(db, provider.id, **request.model_dump())
    return {"id": str(product.id), "name": product.name, "created": True}


@router.patch("/me/products/{product_id}")
async def update_my_product(
    product_id: str,
    request: ProviderProductUpdate,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    product = update_product(
        db, UUID(product_id), provider.id, **request.model_dump(exclude_unset=True)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"id": str(product.id), "name": product.name, "updated": True}


@router.post("/me/promotions", response_model=PromotionResponse, status_code=201)
async def create_my_promotion(
    request: PromotionCreate,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if request.audience == "first_time" and not request.discount_pct:
        raise HTTPException(
            status_code=422,
            detail="A first-time visitor (presale) promotion needs a discount percentage",
        )

    promo = ProviderPromotion(
        provider_id=provider.id,
        headline=request.headline,
        discount_pct=request.discount_pct,
        valid_until=request.valid_until,
        is_active=True,
        audience=request.audience,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return PromotionResponse(
        id=str(promo.id),
        headline=promo.headline,
        discount_pct=promo.discount_pct,
        valid_until=promo.valid_until,
        is_active=promo.is_active,
        audience=promo.audience,
    )


@router.get("/me/redemptions")
async def list_my_redemptions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    items, total = get_provider_redemptions(db, provider.id, page=page, per_page=per_page, status=status)
    return {"redemptions": items, "count": len(items), "total": total, "page": page, "per_page": per_page}


@router.post("/me/redemptions/{redemption_id}/update-status", response_model=RedemptionStatusUpdateResponse)
async def update_my_redemption_status(
    redemption_id: str,
    request: RedemptionStatusUpdateRequest,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Redeem management — providers confirm/ship/deliver redemptions of their own products."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    redemption = provider_update_redemption_status(
        db, provider.id, UUID(redemption_id), request.status, notes=request.notes
    )
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    return RedemptionStatusUpdateResponse(
        redemption_id=str(redemption.id),
        delivery_status=redemption.delivery_status,
        provider_notes=redemption.provider_notes,
    )


@router.get("")
async def list_providers(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    providers = get_all_providers(db, category=category, search=search)
    return {"providers": providers, "count": len(providers)}


@router.get("/{provider_id}")
async def provider_detail(
    provider_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    detail = get_provider_detail(db, UUID(provider_id), user_id=user.id)
    if not detail:
        raise HTTPException(status_code=404, detail="Provider not found")
    return detail


@router.get("/{provider_id}/stats")
async def provider_dashboard_stats(
    provider_id: str,
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Provider dashboard — live stats, bookings, feed. Provider-only access."""
    stats = get_provider_stats(db, UUID(provider_id))
    if not stats:
        raise HTTPException(status_code=404, detail="Provider not found")
    return stats


# ── C1: Provider Customer List ────────────────────────────────────────────

@router.get("/me/customers")
async def list_my_customers(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Get distinct customers who booked or checked in at this provider."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    customers = get_provider_customers(db, provider.id)
    return {"customers": customers, "count": len(customers)}


# ── D3: Provider-Initiated Point Awards ───────────────────────────────────

@router.post("/me/customers/{customer_user_id}/award")
async def award_points_to_customer(
    customer_user_id: str,
    points: int = Query(..., gt=0, le=50),
    note: Optional[str] = Query(None),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Award points to a customer (max 50/award, 1/day/customer, 300/day total)."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        result = award_customer_points(db, provider.id, UUID(customer_user_id), points, note)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── D1: Price Suggestion ─────────────────────────────────────────────────

@router.get("/me/products/price-suggestion")
async def get_product_price_suggestion(
    category: Optional[str] = Query(None),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Get recommended point costs for products based on category peers."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    cat = category or provider.category
    return get_price_suggestion(db, cat)


# ── C5: Provider Points Analytics ────────────────────────────────────────

@router.get("/me/analytics/points")
async def get_my_points_analytics(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Points redeemed at your business — weekly trend for the analytics tab."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return get_provider_points_analytics(db, provider.id)


# ── Provider Website: bookings, service mix, demographics, custom-range metrics ──

@router.get("/me/bookings")
async def list_my_bookings(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    payment_status: Optional[str] = Query(None),
    service_name: Optional[str] = Query(None),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Full paginated booking list — each row includes the customer's
    demographic fields (neighborhood/interests/exercise frequency)."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    items, total = get_provider_bookings(
        db, provider.id, page=page, per_page=per_page,
        start_date=start_date, end_date=end_date,
        payment_status=payment_status, service_name=service_name,
    )
    return {"bookings": items, "total": total, "page": page, "per_page": per_page}


@router.get("/me/analytics/services")
async def get_my_service_breakdown(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Most-booked-service breakdown — bookings + revenue per service name."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    services = get_provider_service_breakdown(db, provider.id, start_date=start_date, end_date=end_date)
    return {"services": services}


@router.get("/me/analytics/demographics")
async def get_my_customer_demographics(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Customer demographics — neighborhood / interest category / exercise frequency breakdowns."""
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return get_provider_customer_demographics(db, provider.id)


@router.get("/me/analytics/timeseries")
async def get_my_metrics_timeseries(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """Custom time-range metrics — daily bookings/revenue/check-ins for a
    provider-chosen date range, for the dashboard's date-range picker."""
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    if (end_date.date() - start_date.date()).days > MAX_TIMESERIES_RANGE_DAYS:
        raise HTTPException(status_code=422, detail=f"Date range cannot exceed {MAX_TIMESERIES_RANGE_DAYS} days")
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return get_provider_metrics_timeseries(db, provider.id, start_date, end_date)
