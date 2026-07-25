"""Strava OAuth and cached activity endpoints."""
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.strava import cache_activities, cache_is_fresh, get_aggregated_stats
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.strava_service import (
    StravaError, disconnect, encrypt_token, exchange_code, get_authorization_url,
    get_recent_activities, refresh_token_if_needed,
)

router = APIRouter()
VALID_STATS = {"distance", "calories", "moving_time", "elevation", "activity_count", "recent_activities"}


class VisibilityUpdate(BaseModel):
    visible_stats: list[str]


def _state_for(user_id):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "nonce": secrets.token_urlsafe(24), "iat": now, "exp": now + timedelta(minutes=10),
         "purpose": "strava_oauth"},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
    )


def _state_user(state):
    try:
        payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("purpose") != "strava_oauth" or not payload.get("nonce"):
            raise JWTError()
        return UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state") from exc


def _visible_stats(user, stats):
    visible = set(user.strava_visible_stats or [])
    return {key: value for key, value in stats.items() if key in visible}


def get_or_refresh_user_stats(db, user):
    if not user.strava_athlete_id:
        return None
    if not cache_is_fresh(db, user.id):
        token = refresh_token_if_needed(db, user)
        activities = get_recent_activities(token, per_page=100)
        cache_activities(db, user.id, activities)
    return _visible_stats(user, get_aggregated_stats(db, user.id))


@router.get("/connect")
def connect(user: User = Depends(get_current_user)):
    if not all((settings.STRAVA_CLIENT_ID, settings.STRAVA_CLIENT_SECRET, settings.STRAVA_REDIRECT_URI)):
        raise HTTPException(status_code=503, detail="Strava is not configured")
    return {"authorization_url": get_authorization_url(_state_for(user.id))}


@router.get("/callback")
def callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == _state_user(state)).first()
    if not user:
        raise HTTPException(status_code=400, detail="OAuth user no longer exists")
    try:
        payload = exchange_code(code)
        athlete = payload.get("athlete") or {}
        user.strava_athlete_id = athlete.get("id")
        user.strava_access_token = encrypt_token(payload["access_token"])
        user.strava_refresh_token = encrypt_token(payload["refresh_token"])
        user.strava_token_expires_at = datetime.fromtimestamp(payload["expires_at"], tz=timezone.utc)
        user.strava_visible_stats = user.strava_visible_stats or [
            "distance", "moving_time", "elevation", "activity_count", "recent_activities"
        ]
        user.health_app_connected = True
        db.commit()
    except (KeyError, StravaError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/profile?{urlencode({'strava': 'connected'})}")


@router.post("/disconnect")
def disconnect_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    disconnect(db, user)
    return {"connected": False}


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return {"connected": bool(user.strava_athlete_id), "stats": get_or_refresh_user_stats(db, user)}
    except StravaError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.patch("/visibility")
def visibility(
    body: VisibilityUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(body.visible_stats) != len(set(body.visible_stats)) or not set(body.visible_stats) <= VALID_STATS:
        raise HTTPException(status_code=422, detail="Invalid or duplicate Strava stat key")
    user.strava_visible_stats = body.visible_stats
    db.commit()
    return {"visible_stats": user.strava_visible_stats}
