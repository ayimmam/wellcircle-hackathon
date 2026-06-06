"""User routes — profile, onboarding, points history."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.user import (
    onboard_user, update_user_profile,
    get_user_joined_community_ids, get_points_tier,
)
from app.crud.community import join_community, get_suggested_communities
from app.schemas.user import (
    UserResponse, UserOnboardingRequest, UserProfileUpdate,
    PointsHistoryResponse,
)

router = APIRouter()


def _build_response(user: User, db: Session) -> UserResponse:
    tier, emoji = get_points_tier(user.points_balance)
    joined = get_user_joined_community_ids(db, user.id)
    return UserResponse(
        id=str(user.id), telegram_id=user.telegram_id,
        telegram_handle=user.telegram_handle, name=user.name,
        photo_url=user.photo_url, goal=user.goal,
        interest_category=user.interest_category,
        exercise_frequency=user.exercise_frequency,
        points_balance=user.points_balance, tier=tier, tier_emoji=emoji,
        is_onboarded=user.is_onboarded, is_provider=user.is_provider,
        is_super_admin=user.is_super_admin,
        location_neighborhood=user.location_neighborhood,
        health_app_connected=user.health_app_connected,
        joined_communities=joined, created_at=user.created_at,
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_response(user, db)


@router.post("/me/onboard")
async def complete_onboarding(
    request: UserOnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete Mini App onboarding flow."""
    if user.is_onboarded:
        raise HTTPException(status_code=400, detail="User already onboarded")

    onboard_user(
        db, user,
        name=request.name,
        interest_category=request.interest_category.value,
        exercise_frequency=request.exercise_frequency.value,
        goal=request.goal,
    )

    # Auto-join suggested circles
    auto_joined = []
    if request.suggested_circle_ids:
        for cid in request.suggested_circle_ids:
            try:
                from uuid import UUID
                result = join_community(db, UUID(cid), user)
                if result and result.get("joined"):
                    auto_joined.append(cid)
            except Exception:
                pass

    # Get suggestions based on interest
    suggestions = get_suggested_communities(
        db, request.interest_category.value, user.id
    )

    return {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "name": user.name,
        "interest_category": user.interest_category,
        "exercise_frequency": user.exercise_frequency,
        "is_onboarded": True,
        "auto_joined_communities": auto_joined,
        "suggested_communities": suggestions,
    }


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    request: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = request.model_dump(exclude_unset=True)
    if update_data:
        update_user_profile(db, user, **update_data)
    return _build_response(user, db)


@router.get("/me/points-history", response_model=PointsHistoryResponse)
async def get_points_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get recent points transactions from feed events."""
    from app.models.community import CommunityFeedEvent, Community

    events = (
        db.query(CommunityFeedEvent)
        .filter(
            CommunityFeedEvent.user_id == user.id,
            CommunityFeedEvent.event_type == "checkin",
        )
        .order_by(CommunityFeedEvent.created_at.desc())
        .limit(20)
        .all()
    )

    items = []
    for e in events:
        comm = db.query(Community).filter(Community.id == e.community_id).first()
        items.append({
            "action": "checkin",
            "points": 10,
            "community_name": comm.name if comm else None,
            "created_at": e.created_at,
        })

    tier, emoji = get_points_tier(user.points_balance)
    return PointsHistoryResponse(
        items=items,
        current_balance=user.points_balance,
        tier=tier,
        tier_emoji=emoji,
    )
