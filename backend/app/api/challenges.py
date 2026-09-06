"""Community Challenges API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.community_challenge import CommunityChallenge
from app.models.community import Community, CommunityFeedEvent
from app.models.provider import Provider
from app.schemas.challenge import ChallengeCreate, ChallengeResponse, ChallengeListResponse
from app.dependencies import get_current_user, get_current_provider

router = APIRouter()


@router.get("/communities/{community_id}/challenges", response_model=ChallengeListResponse)
def list_challenges(
    community_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List active challenges for a community, including user progress."""
    challenges = db.query(CommunityChallenge).filter(
        CommunityChallenge.community_id == community_id,
        CommunityChallenge.is_active == True,
        CommunityChallenge.ends_at >= datetime.now(timezone.utc)
    ).order_by(CommunityChallenge.starts_at.desc()).all()
    
    results = []
    for c in challenges:
        # compute user progress
        checkins = 0
        strava_distance = None
        completed = False
        
        if c.challenge_type == "checkin":
            checkins = db.query(CommunityFeedEvent).filter(
                CommunityFeedEvent.user_id == current_user.id,
                CommunityFeedEvent.community_id == community_id,
                CommunityFeedEvent.event_type == "checkin",
                CommunityFeedEvent.created_at >= c.starts_at,
                CommunityFeedEvent.created_at <= c.ends_at
            ).count()
            completed = checkins >= c.target_checkins
        elif c.challenge_type == "strava_distance":
            from app.models.strava_activity_cache import StravaActivityCache
            distance_meters = db.query(func.coalesce(func.sum(StravaActivityCache.distance_meters), 0)).filter(
                StravaActivityCache.user_id == current_user.id,
                StravaActivityCache.start_date >= c.starts_at,
                StravaActivityCache.start_date <= c.ends_at
            ).scalar()
            strava_distance = distance_meters / 1000.0
            completed = strava_distance >= c.target_value if c.target_value else False
        
        c_dict = {
            "id": str(c.id),
            "community_id": str(c.community_id),
            "title": c.title,
            "description": c.description,
            "challenge_type": c.challenge_type,
            "target_checkins": c.target_checkins,
            "target_value": c.target_value,
            "reward_points": c.reward_points,
            "starts_at": c.starts_at,
            "ends_at": c.ends_at,
            "is_active": c.is_active,
            "user_progress": {
                "checkins_this_period": checkins,
                "strava_distance": strava_distance,
                "completed": completed
            }
        }
        results.append(c_dict)
        
    return {"challenges": results, "count": len(results)}


@router.post("/providers/me/communities/{community_id}/challenges", response_model=ChallengeResponse)
def create_challenge(
    community_id: str,
    challenge_in: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_provider)
):
    """Create a new community challenge (provider only)."""
    provider = db.query(Provider).filter(Provider.owner_user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Not a provider")
        
    community = db.query(Community).filter(Community.id == community_id, Community.provider_id == provider.id).first()
    if not community:
        raise HTTPException(status_code=403, detail="Community not owned by provider")
        
    new_challenge = CommunityChallenge(
        community_id=community.id,
        title=challenge_in.title,
        description=challenge_in.description,
        challenge_type=challenge_in.challenge_type,
        target_checkins=challenge_in.target_checkins,
        target_value=challenge_in.target_value,
        reward_points=challenge_in.reward_points,
        starts_at=challenge_in.starts_at,
        ends_at=challenge_in.ends_at
    )
    db.add(new_challenge)
    db.commit()
    db.refresh(new_challenge)
    
    return {
        "id": str(new_challenge.id),
        "community_id": str(new_challenge.community_id),
        "title": new_challenge.title,
        "description": new_challenge.description,
        "challenge_type": new_challenge.challenge_type,
        "target_checkins": new_challenge.target_checkins,
        "target_value": new_challenge.target_value,
        "reward_points": new_challenge.reward_points,
        "starts_at": new_challenge.starts_at,
        "ends_at": new_challenge.ends_at,
        "is_active": new_challenge.is_active,
        "user_progress": {
            "checkins_this_period": 0,
            "completed": False
        }
    }
