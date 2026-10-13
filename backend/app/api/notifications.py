"""Notifications API."""

from datetime import datetime, timedelta, timezone
from jose import jwt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database import get_db
from app.config import settings
from app.models.user_notification import UserNotification
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/users/me/notifications/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"unread_count": db.query(func.count(UserNotification.id)).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read == False,
    ).scalar() or 0}


@router.get("/users/me/notifications/realtime")
def notification_realtime_credentials(
    current_user: User = Depends(get_current_user),
):
    """Issue a short-lived, user-scoped credential for private Realtime."""
    if not all((settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY,
                settings.SUPABASE_JWT_SECRET)):
        return {"enabled": False}
    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    token = jwt.encode({
        "sub": str(current_user.id), "role": "authenticated",
        "aud": "authenticated", "exp": expiry,
    }, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    return {
        "enabled": True,
        "url": settings.SUPABASE_URL.rstrip("/"),
        "anon_key": settings.SUPABASE_ANON_KEY,
        "token": token,
    }


@router.get("/users/me/notifications", response_model=NotificationListResponse)
def get_my_notifications(
    unread: bool = False,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(UserNotification).filter(UserNotification.user_id == current_user.id)
    
    if unread:
        query = query.filter(UserNotification.is_read == False)
        
    query = query.order_by(UserNotification.created_at.desc())
    
    total = query.count()
    unread_count = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read == False
    ).count()
    
    results = query.offset(offset).limit(limit).all()
    
    return {
        "notifications": results,
        "unread_count": unread_count,
        "count": total
    }


@router.post("/users/me/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(UserNotification).filter(
        UserNotification.id == notification_id,
        UserNotification.user_id == current_user.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    
    return {"id": str(notif.id), "is_read": True}


@router.post("/users/me/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated_count = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"marked_read": updated_count}
