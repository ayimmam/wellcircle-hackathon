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
    join_circle_by_code, get_circle_social_proof, get_circle_detail,
    set_circle_banner,
)
from app.crud.circle_story import (
    create_story, delete_story, get_circle_stories, get_story_rail, mark_story_viewed,
)
from app.crud.circle_subscription import (
    apply_for_paid_circle, creator_review_subscription, get_circle_revenue,
    get_pending_subscriptions, get_user_active_subscription, subscribe_to_circle,
)
from app.schemas.circle_subscription import (
    CircleSubscribeRequest, PaidCircleApplyRequest, SubscriptionApprovalRequest,
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

class CircleBannerUpdate(BaseModel):
    """Nulls clear the banner. The client uploads to /api/uploads first and
    sends the resulting pair back here."""
    banner_url: Optional[str] = None
    banner_public_id: Optional[str] = None

class StoryCreate(BaseModel):
    image_url: str
    image_public_id: str

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

@router.get("/{circle_id}")
def api_get_circle_detail(circle_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Circle detail for the preview + Join CTA flow. Private circles the
    caller hasn't joined 404 rather than leak that they exist."""
    detail = get_circle_detail(db, UUID(circle_id), user.id)
    if not detail:
        raise HTTPException(status_code=404, detail="Circle not found")
    return detail


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
    from app.crud.circle_subscription import has_circle_access
    if not has_circle_access(db, UUID(circle_id), user.id):
        raise HTTPException(status_code=403, detail="Paid circle access required")
    leaderboard = get_circle_leaderboard(db, UUID(circle_id))
    return {"leaderboard": leaderboard}


@router.post("/{circle_id}/apply-paid")
def api_apply_paid(
    circle_id: UUID, body: PaidCircleApplyRequest,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        circle = apply_for_paid_circle(db, circle_id, user.id, body.price_etb)
        return {"id": str(circle.id), "paid_circle_status": circle.paid_circle_status,
                "price_etb": circle.price_etb}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{circle_id}/subscribe", status_code=201)
def api_subscribe(
    circle_id: UUID, body: CircleSubscribeRequest,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        row = subscribe_to_circle(db, circle_id, user.id, body.receipt_url, body.receipt_public_id)
        return {"id": str(row.id), "status": row.status, "period_start": row.period_start,
                "period_end": row.period_end, "amount_etb": row.amount_etb}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/{circle_id}/subscriptions/pending")
def api_pending_subscriptions(
    circle_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        rows = get_pending_subscriptions(db, circle_id, user.id)
        return {"items": [
            {"id": str(x.id), "user_id": str(x.user_id), "amount_etb": x.amount_etb,
             "receipt_url": x.receipt_url, "created_at": x.created_at}
            for x in rows
        ]}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.post("/subscriptions/{subscription_id}/review")
def api_review_subscription(
    subscription_id: UUID, body: SubscriptionApprovalRequest,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        row = creator_review_subscription(db, subscription_id, user.id, body.action)
        return {"id": str(row.id), "status": row.status,
                "creator_approved_at": row.creator_approved_at}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/{circle_id}/revenue")
def api_revenue(
    circle_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        return get_circle_revenue(db, circle_id, user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.get("/{circle_id}/subscription-status")
def api_subscription_status(
    circle_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    row = get_user_active_subscription(db, circle_id, user.id)
    if not row:
        from app.models.circle_subscription import CircleSubscription
        row = db.query(CircleSubscription).filter_by(
            circle_id=circle_id, user_id=user.id
        ).order_by(CircleSubscription.created_at.desc()).first()
    return {"subscription": None if not row else {
        "id": str(row.id), "status": row.status, "period_start": row.period_start,
        "period_end": row.period_end, "amount_etb": row.amount_etb,
    }}


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


# ── Stories: 72-hour ephemeral photos ─────────────────────────────────────
#
# All of these live under /api/circles because a story always belongs to one
# circle — membership in that circle is the only thing that grants access.
# Note the path shapes: /stories/... never collides with the one-segment
# GET /{circle_id}, so declaration order here is not load-bearing.


@router.get("/stories/feed")
def api_story_rail(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The For You rail — active stories across every circle the user is in,
    grouped by author, unseen first."""
    return {"groups": get_story_rail(db, user.id)}


@router.get("/{circle_id}/stories")
def api_circle_stories(
    circle_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        return {"stories": get_circle_stories(db, circle_id, user.id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{circle_id}/stories", status_code=201)
def api_create_story(
    circle_id: UUID, body: StoryCreate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        story = create_story(db, circle_id, user.id, body.image_url, body.image_public_id)
        return {"id": str(story.id), "image_url": story.image_url,
                "created_at": story.created_at, "expires_at": story.expires_at}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc))


@router.post("/stories/{story_id}/view")
def api_view_story(
    story_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        return {"view_count": mark_story_viewed(db, story_id, user.id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/stories/{story_id}")
def api_delete_story(
    story_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    # Returns a body rather than 204: the frontend's request() helper always
    # parses JSON, and an empty response would throw on the happy path.
    try:
        delete_story(db, story_id, user.id)
        return {"deleted": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ── Circle banner ─────────────────────────────────────────────────────────


@router.put("/{circle_id}/banner")
def api_set_banner(
    circle_id: UUID, body: CircleBannerUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        circle = set_circle_banner(db, circle_id, user.id, body.banner_url, body.banner_public_id)
        return {"id": str(circle.id), "banner_url": circle.banner_url}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
