"""Provider routes — browse, detail, dashboard stats, self-onboarding."""

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
)
from app.crud.provider_invite import get_valid_invite, create_invite
from app.crud.product import get_provider_products, create_product, update_product, get_provider_redemptions
from app.schemas.provider_onboarding import (
    SelfOnboardRequest, SelfOnboardResponse,
    InviteCodeGenerateRequest, InviteCodeGenerateResponse,
    ProviderMeResponse, ProviderMeUpdate,
)
from app.schemas.product import ProviderProductCreate, ProviderProductUpdate
from app.schemas.promotion import PromotionCreate, PromotionResponse
from app.models.provider_promotion import ProviderPromotion

router = APIRouter()


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
        message="Application submitted. Admin will review within 24 hours.",
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

    promo = ProviderPromotion(
        provider_id=provider.id,
        headline=request.headline,
        discount_pct=request.discount_pct,
        valid_until=request.valid_until,
        is_active=True,
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
    )


@router.get("/me/redemptions")
async def list_my_redemptions(
    user: User = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    items = get_provider_redemptions(db, provider.id)
    return {"redemptions": items, "count": len(items)}


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
