"""Bot integration routes — registration and re-engagement queries."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
import httpx
from sqlalchemy.orm import Session

from uuid import UUID

from app.config import settings
from app.database import get_db
from app.dependencies import verify_bot_api_key
from app.crud.user import get_user_by_telegram_id, create_user_from_bot, get_inactive_users, mark_user_reengagement
from app.crud.evidence import get_staff_events, create_evidence_submission
from app.crud.circle import get_weekly_digest_circles
from app.services.promotion_service import get_reengagement_promos
from app.schemas.user import BotRegisterRequest
from app.schemas.evidence import BotEvidenceSubmitRequest

router = APIRouter()


@router.get("/photo/{file_path:path}")
async def proxy_telegram_photo(file_path: str):
    """Proxy Telegram user profile photo securely so the token is not leaked."""
    if settings.TELEGRAM_BOT_TOKEN == "mock_token" or not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=400, detail="Telegram bot token not configured")
    
    # Restrict path to prevent directory traversal or arbitrary URL requests
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid photo path")

    download_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(download_url, timeout=10.0)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg")
            return Response(content=resp.content, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Could not fetch photo from Telegram")



@router.post("/register")
async def bot_register(
    request: BotRegisterRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Called by Telegram bot on /start. Creates minimal user record. Idempotent."""
    existing = get_user_by_telegram_id(db, request.telegram_id)
    if existing:
        # Update handle / photo if changed
        changed = False
        if request.telegram_handle and request.telegram_handle != existing.telegram_handle:
            existing.telegram_handle = request.telegram_handle
            changed = True
        if request.photo_url and request.photo_url != existing.photo_url:
            existing.photo_url = request.photo_url
            changed = True
        if changed:
            db.commit()
        is_admin = (
            existing.telegram_id in settings.super_admin_ids or existing.is_super_admin
        )
        return {
            "id": str(existing.id),
            "telegram_id": existing.telegram_id,
            "telegram_handle": existing.telegram_handle,
            "is_onboarded": existing.is_onboarded,
            "is_super_admin": is_admin,
            "created": False,
        }

    user = create_user_from_bot(
        db,
        telegram_id=request.telegram_id,
        telegram_handle=request.telegram_handle,
        photo_url=request.photo_url,
    )
    is_admin = user.telegram_id in settings.super_admin_ids or user.is_super_admin
    return {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "telegram_handle": user.telegram_handle,
        "is_onboarded": user.is_onboarded,
        "is_super_admin": is_admin,
        "created": True,
    }


@router.get("/users/{telegram_id}/admin-access")
async def bot_admin_access(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Check if a Telegram user has super-admin access (for /admin bot command)."""
    user = get_user_by_telegram_id(db, telegram_id)
    is_admin = (
        telegram_id in settings.super_admin_ids
        or (user is not None and user.is_super_admin)
    )
    return {
        "telegram_id": telegram_id,
        "is_super_admin": is_admin,
        "user_exists": user is not None,
    }


@router.get("/inactive-users")
async def inactive_users(
    days: int = 7,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Returns users inactive for N+ days (for re-engagement notifications).

    Each user carries `promo` — the soonest-expiring active discount promotion
    they are still eligible for (or null) — so the bot's nudge can reference it
    ("come back and use your discount before it expires").
    """
    users = get_inactive_users(db, days=days)
    promos_by_telegram_id = get_reengagement_promos(db, users)
    now = datetime.now(timezone.utc)
    items = []
    for u in users:
        last = u.last_activity_at
        if last and last.tzinfo is None:  # SQLite (tests) returns naive datetimes
            last = last.replace(tzinfo=timezone.utc)
        days_inactive = (now - last).days if last else 999
        items.append({
            "telegram_id": u.telegram_id,
            "name": u.name or u.telegram_handle or "User",
            "telegram_handle": u.telegram_handle,
            "last_activity_at": last.isoformat() if last else None,
            "days_inactive": days_inactive,
            "promo": promos_by_telegram_id.get(u.telegram_id),
        })
    return {"inactive_users": items, "count": len(items)}


@router.post("/users/{telegram_id}/reengagement-sent")
async def bot_reengagement_sent(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Mark that a re-engagement message was sent to this user."""
    user = mark_user_reengagement(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"telegram_id": telegram_id, "marked": True}


# ── D2: Evidence-based event participation ──────────────────────────────

@router.get("/staff-events")
async def bot_staff_events(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Ended events this Telegram user is designated staff for, awaiting evidence."""
    events = get_staff_events(db, telegram_id)
    return {"events": events, "count": len(events)}


@router.post("/evidence")
async def bot_submit_evidence(
    request: BotEvidenceSubmitRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Staff submits photo evidence for an ended event via the bot's /evidence flow."""
    submission = create_evidence_submission(
        db,
        telegram_id=request.telegram_id,
        event_id=UUID(request.event_id),
        telegram_file_id=request.telegram_file_id,
    )
    if not submission:
        raise HTTPException(
            status_code=400,
            detail="Not the designated staff for this event, or event not found",
        )
    return {"id": str(submission.id), "status": submission.status}


# ── C3: Weekly circle digest ─────────────────────────────────────────────

@router.get("/circle-digests")
async def bot_circle_digests(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_bot_api_key),
):
    """Sunday digest data — per circle, the weekly top scorer and member
    Telegram IDs, for the bot to DM each member."""
    circles = get_weekly_digest_circles(db)
    return {"circles": circles}
