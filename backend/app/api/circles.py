"""Circle routes - user created groups and leaderboards."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.circle import (
    create_circle, join_circle, get_circles, get_circle_leaderboard,
    join_circle_by_code, get_circle_social_proof,
)

router = APIRouter()

class CircleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = False
    join_code: Optional[str] = None

class CircleJoin(BaseModel):
    join_code: Optional[str] = None

class CircleJoinByCode(BaseModel):
    join_code: str

@router.post("")
def api_create_circle(circle_in: CircleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    circle = create_circle(
        db,
        name=circle_in.name,
        description=circle_in.description,
        owner_id=user.id,
        is_private=circle_in.is_private,
        join_code=circle_in.join_code
    )
    return {
        "id": str(circle.id), "name": circle.name, "join_code": circle.join_code,
        "message": "Circle created successfully",
    }

@router.get("")
def api_get_circles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    circles = get_circles(db, user_id=user.id)
    return {"circles": circles}

@router.post("/{circle_id}/join")
def api_join_circle(circle_id: str, join_data: CircleJoin = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    join_code = join_data.join_code if join_data else None
    circle = join_circle(db, UUID(circle_id), user.id, join_code=join_code)
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    return {
        "id": str(circle.id), "name": circle.name, "join_code": circle.join_code,
        "message": "Joined circle successfully",
    }

@router.get("/{circle_id}/leaderboard")
def api_get_leaderboard(circle_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    leaderboard = get_circle_leaderboard(db, UUID(circle_id))
    return {"leaderboard": leaderboard}


# ── E1: Invite deep-link join ─────────────────────────────────────────────

@router.post("/join-by-code")
def api_join_circle_by_code(body: CircleJoinByCode, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Resolve + join a circle from a `?startapp=circle_{code}` deep link."""
    circle = join_circle_by_code(db, body.join_code, user.id)
    if not circle:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return {"id": str(circle.id), "name": circle.name, "message": "Joined circle successfully"}


# ── E2: Social proof ──────────────────────────────────────────────────────

@router.get("/social-proof/today")
def api_circle_social_proof(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """How many of the user's circle-mates checked in today, across all their circles."""
    return get_circle_social_proof(db, user.id)
