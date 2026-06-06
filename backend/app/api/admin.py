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
from app.crud.provider import create_provider, update_provider, delete_provider
from app.schemas.provider import ProviderCreate, ProviderUpdate
from app.schemas.admin import PlatformAnalytics, AdminUserListResponse, AdminUserItem

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
