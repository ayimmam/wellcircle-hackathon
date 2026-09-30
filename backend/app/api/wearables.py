"""Terra Web OAuth and signed webhook entry points."""
import json
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.wearable import UserWearable
from app.services.walk_score import process_event, verify_signature

router = APIRouter()
TERRA_WIDGET_ENDPOINT = "https://api.tryterra.co/v2/auth/generateWidgetSession"


@router.get("/connect")
async def connect(user: User = Depends(get_current_user)):
    if not settings.TERRA_DEV_ID or not settings.TERRA_API_KEY or not settings.TERRA_WEBHOOK_SECRET:
        raise HTTPException(503, "Fitness tracker connection is unavailable")
    payload = {"reference_id": str(user.id), "providers": settings.TERRA_PROVIDERS, "language": "en"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                TERRA_WIDGET_ENDPOINT,
                headers={"dev-id": settings.TERRA_DEV_ID, "x-api-key": settings.TERRA_API_KEY},
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Could not start tracker connection") from exc
    url = result.get("url")
    parsed = urlparse(url) if isinstance(url, str) else None
    if result.get("status") != "success" or not parsed or parsed.scheme != "https" or parsed.hostname != "widget.tryterra.co":
        raise HTTPException(502, "Invalid tracker connection response")
    return {"url": url, "expires_in": result.get("expires_in")}


@router.get("/status")
def status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connections = db.query(UserWearable).filter_by(user_id=user.id, active=True).all()
    return {
        "connected": bool(connections),
        "providers": sorted({item.provider for item in connections}),
        "walk_score": user.walk_score or 0,
    }


@router.post("/webhook")
async def webhook(
    request: Request,
    terra_signature: str | None = Header(None, alias="terra-signature"),
    db: Session = Depends(get_db),
):
    if not settings.TERRA_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook is unavailable")
    raw = await request.body()
    if len(raw) > 4_000_000:
        raise HTTPException(413, "Webhook body is too large")
    if not verify_signature(raw, terra_signature, settings.TERRA_WEBHOOK_SECRET):
        raise HTTPException(401, "Invalid Terra signature")
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Webhook body must be an object")
        return process_event(db, data)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(503, str(exc)) from exc
    except (ValueError, TypeError) as exc:
        db.rollback()
        raise HTTPException(400, str(exc)) from exc
