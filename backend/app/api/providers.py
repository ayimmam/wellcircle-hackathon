"""Provider routes — browse, detail, dashboard stats."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_provider
from app.models.user import User
from app.crud.provider import get_all_providers, get_provider_detail, get_provider_stats

router = APIRouter()


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
