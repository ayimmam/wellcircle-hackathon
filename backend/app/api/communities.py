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


@router.get("/{community_id}/leaderboard")
async def community_leaderboard(
    community_id: str,
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    from datetime import datetime, timezone, timedelta
    from app.models.community import CommunityFeedEvent
    
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    results = (
        db.query(
            CommunityFeedEvent.user_id,
            func.count(CommunityFeedEvent.id).label("checkins")
        )
        .filter(
            CommunityFeedEvent.community_id == community_id,
            CommunityFeedEvent.event_type == "checkin",
            CommunityFeedEvent.created_at >= thirty_days_ago
        )
        .group_by(CommunityFeedEvent.user_id)
        .order_by(func.count(CommunityFeedEvent.id).desc())
        .limit(limit)
        .all()
    )
    
    user_ids = [r.user_id for r in results]
    users_by_id = (
        {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids else {}
    )

    leaderboard = []
    for r in results:
        u = users_by_id.get(r.user_id)
        leaderboard.append({
            "user_id": str(r.user_id),
            "name": (u.name or u.telegram_handle) if u else "Unknown",
            "photo_url": u.photo_url if u else None,
            "checkins_last_30_days": r.checkins
        })

    return {"leaderboard": leaderboard}

from pydantic import BaseModel
from app.models.post import Post

class InteractionCreate(BaseModel):
    target_user_id: str
    action_type: str # "high-five" or "nudge"

@router.post("/{community_id}/interactions", status_code=201)
async def create_interaction(
    community_id: UUID,
    interaction: InteractionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == interaction.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
        
    emoji = "🙌" if interaction.action_type == "high-five" else "👉"
    action_verb = "high-fived" if interaction.action_type == "high-five" else "nudged"
    
    feed_post = Post(
        community_id=community_id,
        user_id=user.id,
        content=f"{emoji} {user.name or user.telegram_handle} just {action_verb} {target_user.name or target_user.telegram_handle} to stay accountable!",
        is_system_event=True
    )
    db.add(feed_post)
    db.commit()
    return {"status": "Interaction logged and pushed to feed"}
