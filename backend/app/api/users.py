"""User routes — profile, onboarding, points history."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.user import (
    onboard_user, update_user_profile,
    get_user_joined_community_ids,
)
from app.services.points import get_points_tier, POINTS_WELCOME
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
        is_super_admin=user.is_super_admin or user.telegram_id in settings.super_admin_ids,
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
        # Endowed progress: one-time welcome award, reflected in the returned
        # balance so the client's first-reward bar starts part-filled
        "welcome_points": POINTS_WELCOME,
        "points_balance": user.points_balance,
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


@router.get("/me/redemptions")
async def get_my_redemptions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.crud.product import get_user_redemptions
    items = get_user_redemptions(db, user.id)
    return {"redemptions": items, "count": len(items)}


@router.get("/me/bookings")
async def get_my_bookings(
    status: str = "all",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.booking import Booking
    from app.models.provider import Provider
    from datetime import datetime, timezone
    
    query = db.query(Booking, Provider).outerjoin(Provider, Booking.provider_id == Provider.id).filter(
        Booking.user_id == user.id
    )
    
    now = datetime.now(timezone.utc)
    if status == "upcoming":
        query = query.filter(Booking.slot_datetime >= now, Booking.payment_status != "cancelled")
    elif status == "completed":
        query = query.filter(Booking.slot_datetime < now, Booking.payment_status == "success")
    elif status == "cancelled":
        query = query.filter(Booking.payment_status == "cancelled")
        
    query = query.order_by(Booking.slot_datetime.desc())
    results = query.all()
    
    bookings_list = []
    for booking, provider in results:
        bookings_list.append({
            "id": str(booking.id),
            "provider_id": str(booking.provider_id),
            "provider_name": provider.name if provider else None,
            "provider_cover_photo_url": provider.cover_photo_url if provider else None,
            "service_name": booking.service_name,
            "slot_datetime": booking.slot_datetime,
            "amount_etb": booking.amount_etb,
            "payment_method": booking.payment_method,
            "payment_status": booking.payment_status,
            "event_id": str(booking.event_id) if booking.event_id else None,
            "created_at": booking.created_at
        })
        
    return {"bookings": bookings_list, "count": len(bookings_list)}


@router.get("/me/points-history", response_model=PointsHistoryResponse)
async def get_points_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get recent points transactions from the ledger."""
    from app.services.points import get_user_transactions, get_points_tier

    txns = get_user_transactions(db, user.id, limit=30)

    items = []
    for txn in txns:
        items.append({
            "action": txn.type,
            "points": txn.amount,
            "community_name": txn.note,
            "created_at": txn.created_at,
        })

    tier, emoji = get_points_tier(user.points_balance)
    return PointsHistoryResponse(
        items=items,
        current_balance=user.points_balance,
        tier=tier,
        tier_emoji=emoji,
    )


@router.get("/me/notifications")
async def get_user_notifications(
    unread: bool = False,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user_notification import UserNotification
    query = db.query(UserNotification).filter(UserNotification.user_id == user.id)
    if unread:
        query = query.filter(UserNotification.is_read == False)
        
    unread_count = db.query(UserNotification).filter(
        UserNotification.user_id == user.id,
        UserNotification.is_read == False
    ).count()
    
    notifications = query.order_by(UserNotification.created_at.desc()).limit(limit).all()
    
    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "created_at": n.created_at
            }
            for n in notifications
        ],
        "unread_count": unread_count
    }


@router.post("/me/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user_notification import UserNotification
    n = db.query(UserNotification).filter(
        UserNotification.id == notification_id,
        UserNotification.user_id == user.id
    ).first()
    
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    n.is_read = True
    db.commit()
    return {"is_read": True}


@router.post("/me/notifications/read-all")
async def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user_notification import UserNotification
    
    unread = db.query(UserNotification).filter(
        UserNotification.user_id == user.id,
        UserNotification.is_read == False
    ).all()
    
    count = len(unread)
    for n in unread:
        n.is_read = True
        
    db.commit()
    return {"marked_read": count}
