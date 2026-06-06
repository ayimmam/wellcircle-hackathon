"""Community routes — list, detail, join, leave, checkin, feed."""

from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.community import (
    get_all_communities, get_community_detail,
    join_community, leave_community,
    checkin_community, get_community_feed,
)

router = APIRouter()


@router.get("")
async def list_communities(
    joined: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    communities = get_all_communities(
        db, user_id=user.id,
        joined_only=joined or False,
        category=category,
    )
    return {"communities": communities, "count": len(communities)}


@router.get("/{community_id}")
async def community_detail(
    community_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    detail = get_community_detail(db, UUID(community_id), user_id=user.id)
    if not detail:
        raise HTTPException(status_code=404, detail="Community not found")
    return detail


@router.post("/{community_id}/join")
async def join(
    community_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = join_community(db, UUID(community_id), user)
    if result is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return result


@router.post("/{community_id}/leave")
async def leave(
    community_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = leave_community(db, UUID(community_id), user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return result


@router.post("/{community_id}/checkin")
async def checkin(
    community_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = checkin_community(db, UUID(community_id), user)
    if result is None:
        raise HTTPException(status_code=404, detail="Community not found")
    if result == "not_member":
        raise HTTPException(status_code=403, detail="Must join community first")
    if result == "already_checked_in":
        raise HTTPException(status_code=409, detail="Already checked in today")
    return result


@router.get("/{community_id}/feed")
async def community_feed(
    community_id: str,
    since: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'since' timestamp")

    events = get_community_feed(db, UUID(community_id), since=since_dt, limit=limit)
    return {"events": events, "count": len(events)}
