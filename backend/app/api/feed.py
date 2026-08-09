"""For You feed — discovery feed replacing Home (Phase 4/5 of the For You /
Boston Day Spa pilot plan). The first page ships inside GET /api/home/bootstrap
(see app/api/home.py); this endpoint serves subsequent pages on scroll."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.feed_service import build_for_you_feed

router = APIRouter()


@router.get("/for-you")
async def get_for_you_feed(
    limit: int = Query(10, ge=1, le=30),
    before: Optional[datetime] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_for_you_feed(db, limit=limit, before=before)
