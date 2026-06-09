"""Admin routes — super admin only: analytics, user management, provider onboarding."""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.dependencies import get_super_admin
from app.models.user import User
from app.models.provider import Provider
from app.models.community import Community
from app.models.booking import Booking
from app.crud.user import get_all_users, get_user_by_telegram_id
from app.crud.provider import (
    create_provider, update_provider, delete_provider,
    get_pending_providers, approve_provider, reject_provider,
    promote_user_to_provider, user_has_active_provider, get_admin_providers,
)
from app.crud.product import admin_list_products, update_product_stock, update_redemption_status
from app.crud.admin_notification import get_admin_notifications
from app.services.telegram_notify import (
    send_telegram_message, build_approval_message, build_rejection_message,
)
from app.schemas.provider import ProviderCreate, ProviderUpdate
from app.schemas.admin import PlatformAnalytics, AdminUserListResponse, AdminUserItem
from app.schemas.provider_onboarding import (
    PendingProvidersResponse, ProviderApproveRequest, ProviderApproveResponse,
    ProviderRejectRequest, ProviderRejectResponse,
    PromoteUserRequest, PromoteUserResponse,
    AdminNotificationsResponse, AdminProviderListResponse,
)
from app.schemas.product import (
    AdminProductListResponse, StockUpdateRequest, StockUpdateResponse,
    RedemptionStatusUpdateRequest, RedemptionStatusUpdateResponse,
)

router = APIRouter()


@router.get("/analytics", response_model=PlatformAnalytics)
async def platform_analytics(
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_users = db.query(User).count()
    onboarded = db.query(User).filter(User.is_onboarded == True).count()
    total_providers = db.query(Provider).count()
    total_communities = db.query(Community).count()
    total_bookings = db.query(Booking).count()
    successful = db.query(Booking).filter(Booking.payment_status == "success").count()
    revenue = db.query(func.coalesce(func.sum(Booking.amount_etb), 0)).filter(
        Booking.payment_status == "success"
    ).scalar()
    active_7d = db.query(User).filter(User.last_activity_at >= week_ago).count()
    new_today = db.query(User).filter(User.created_at >= today_start).count()

    # Top categories
    cats = (
        db.query(User.interest_category, func.count(User.id))
        .filter(User.interest_category.isnot(None))
        .group_by(User.interest_category)
        .order_by(func.count(User.id).desc())
        .limit(6)
        .all()
    )

    return PlatformAnalytics(
        total_users=total_users, onboarded_users=onboarded,
        total_providers=total_providers, total_communities=total_communities,
        total_bookings=total_bookings, successful_payments=successful,
        total_revenue_etb=revenue or 0, active_users_7d=active_7d,
        new_users_today=new_today,
        top_categories=[{"category": c, "count": n} for c, n in cats],
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_onboarded: Optional[bool] = Query(None),
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    users, total = get_all_users(db, page, per_page, search, is_onboarded)
    return AdminUserListResponse(
        users=[AdminUserItem.model_validate(u) for u in users],
        total=total, page=page, per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 1,
    )


@router.get("/users/{telegram_id}")
async def get_user_by_tg_id(
    telegram_id: int,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    user = get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserItem.model_validate(user)


@router.post("/providers", status_code=201)
async def create_new_provider(
    request: ProviderCreate,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    data = request.model_dump()
    provider, community = create_provider(db, **data)
    return {
        "provider": {
            "id": str(provider.id), "name": provider.name,
            "category": provider.category,
        },
        "community": {
            "id": str(community.id), "name": community.name,
        } if community else None,
    }


@router.put("/providers/{provider_id}")
async def update_existing_provider(
    provider_id: str,
    request: ProviderUpdate,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    data = request.model_dump(exclude_unset=True)
    provider = update_provider(db, UUID(provider_id), **data)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"id": str(provider.id), "name": provider.name, "updated": True}


@router.delete("/providers/{provider_id}")
async def delete_existing_provider(
    provider_id: str,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    deleted = delete_provider(db, UUID(provider_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"deleted": True, "provider_id": provider_id}


@router.get("/providers", response_model=AdminProviderListResponse)
async def list_all_providers(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    providers = get_admin_providers(db, status=status, search=search)
    return AdminProviderListResponse(providers=providers, total=len(providers))


@router.get("/providers/pending", response_model=PendingProvidersResponse)
async def list_pending_providers(
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    pending = get_pending_providers(db)
    return PendingProvidersResponse(pending_providers=pending, count=len(pending))


@router.post("/providers/{provider_id}/approve", response_model=ProviderApproveResponse)
async def approve_provider_application(
    provider_id: str,
    request: ProviderApproveRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    provider = approve_provider(db, UUID(provider_id), notes=request.notes)
    if not provider:
        raise HTTPException(status_code=404, detail="Pending provider not found")

    if provider.owner_user_id:
        owner = db.query(User).filter(User.id == provider.owner_user_id).first()
        if owner and owner.telegram_id:
            await send_telegram_message(
                owner.telegram_id,
                build_approval_message(provider.name),
            )

    return ProviderApproveResponse(
        provider_id=str(provider.id),
        status=provider.status,
        owner_user_id=str(provider.owner_user_id),
        message="Provider approved. Auto-community created.",
    )


@router.post("/providers/{provider_id}/reject", response_model=ProviderRejectResponse)
async def reject_provider_application(
    provider_id: str,
    request: ProviderRejectRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    provider = reject_provider(db, UUID(provider_id), request.rejection_reason)
    if not provider:
        raise HTTPException(status_code=404, detail="Pending provider not found")

    if provider.owner_user_id:
        owner = db.query(User).filter(User.id == provider.owner_user_id).first()
        if owner and owner.telegram_id:
            await send_telegram_message(
                owner.telegram_id,
                build_rejection_message(provider.name, request.rejection_reason),
            )

    return ProviderRejectResponse(
        provider_id=str(provider.id),
        status=provider.status,
        message="Provider rejected. Owner notified.",
    )


@router.put("/providers/promote-user", response_model=PromoteUserResponse, status_code=201)
async def promote_user(
    request: PromoteUserRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    user = get_user_by_telegram_id(db, request.user_telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_has_active_provider(db, user.id):
        raise HTTPException(status_code=409, detail="User already has an active provider account")

    provider = promote_user_to_provider(db, user, request.provider_data.model_dump())
    if user.telegram_id:
        await send_telegram_message(user.telegram_id, build_approval_message(provider.name))

    return PromoteUserResponse(
        provider_id=str(provider.id),
        status=provider.status,
        user_id=str(user.id),
        message="User promoted to provider directly.",
    )


@router.get("/notifications", response_model=AdminNotificationsResponse)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    items, unread = get_admin_notifications(db, admin.id, limit=limit, offset=offset)
    return AdminNotificationsResponse(
        notifications=[
            {
                "id": str(n.id),
                "event_type": n.event_type,
                "message": n.message,
                "related_provider_id": str(n.related_provider_id) if n.related_provider_id else None,
                "related_user_id": str(n.related_user_id) if n.related_user_id else None,
                "created_at": n.created_at,
                "is_read": n.is_read,
            }
            for n in items
        ],
        unread_count=unread,
    )


@router.get("/products", response_model=AdminProductListResponse)
async def list_admin_products(
    provider_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    pid = UUID(provider_id) if provider_id else None
    items, total = admin_list_products(
        db, provider_id=pid, status=status, search=search, page=page, per_page=per_page
    )
    return AdminProductListResponse(products=items, total=total)


@router.post("/products/{product_id}/update-stock", response_model=StockUpdateResponse)
async def update_stock(
    product_id: str,
    request: StockUpdateRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    product = update_product_stock(db, UUID(product_id), request.quantity)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return StockUpdateResponse(
        product_id=str(product.id),
        quantity_in_stock=product.quantity_in_stock,
        updated=True,
    )


@router.post("/redemptions/{redemption_id}/update-status", response_model=RedemptionStatusUpdateResponse)
async def update_redemption_delivery(
    redemption_id: str,
    request: RedemptionStatusUpdateRequest,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    redemption = update_redemption_status(
        db, UUID(redemption_id), request.status, notes=request.notes
    )
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    return RedemptionStatusUpdateResponse(
        redemption_id=str(redemption.id),
        delivery_status=redemption.delivery_status,
        provider_notes=redemption.provider_notes,
    )
