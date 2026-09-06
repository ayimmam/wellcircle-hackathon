"""Follow graph and privacy-aware public profiles."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.strava import get_or_refresh_user_stats
from app.crud.follower import (
    follow_user, get_follower_count, get_followers, get_following,
    get_following_count, get_counts_for_users, is_following, unfollow_user,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models.circle import Circle
from app.models.user import User
from app.services.strava_service import StravaError

router = APIRouter()


def _user_item(db, item, counts=None):
    follower_counts, following_counts = counts or ({}, {})
    return {
        "id": str(item.id), "name": item.name,
        "telegram_handle": item.telegram_handle, "photo_url": item.photo_url,
        "bio": item.bio, "is_verified_trainer": item.is_verified_trainer,
        "follower_count": follower_counts.get(item.id, 0) if counts else get_follower_count(db, item.id),
        "following_count": following_counts.get(item.id, 0) if counts else get_following_count(db, item.id),
    }


@router.post("/{user_id}/follow")
def follow(user_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        follow_user(db, user.id, user_id)
        return {"following": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{user_id}/follow")
def unfollow(user_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"following": False, "removed": unfollow_user(db, user.id, user_id)}


def _list(kind, user_id, page, per_page, db):
    if not db.query(User.id).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    getter = get_followers if kind == "followers" else get_following
    rows, total = getter(db, user_id, page, per_page)
    counts = get_counts_for_users(db, [row.id for row in rows])
    return {"items": [_user_item(db, row, counts) for row in rows], "total": total, "page": page, "per_page": per_page}


@router.get("/{user_id}/followers")
def followers(
    user_id: UUID, page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return _list("followers", user_id, page, per_page, db)


@router.get("/{user_id}/following")
def following(
    user_id: UUID, page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return _list("following", user_id, page, per_page, db)


@router.get("/{user_id}/profile")
def public_profile(
    user_id: UUID, viewer: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    viewer_follows = is_following(db, viewer.id, target.id)
    can_view_stats = (
        viewer.id == target.id
        or target.profile_privacy == "public"
        or (target.profile_privacy == "followers" and viewer_follows)
    )
    stats = None
    if can_view_stats and target.strava_athlete_id:
        try:
            stats = get_or_refresh_user_stats(db, target)
        except StravaError:
            # Public profiles remain available when Strava is unavailable.
            stats = None
    created = db.query(Circle).filter(Circle.owner_id == target.id).order_by(Circle.created_at.desc()).all()
    return {
        **_user_item(db, target),
        "profile_privacy": target.profile_privacy,
        "is_following": viewer_follows,
        "strava_stats": stats,
        "circles": [
            {"id": str(c.id), "name": c.name, "description": c.description,
             "is_paid": c.is_paid, "price_etb": c.price_etb}
            for c in created
        ] if can_view_stats else [],
    }
