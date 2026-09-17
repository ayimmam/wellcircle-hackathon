"""Public story routes (WS1 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

Posting a story is one request, not the old upload-then-create two-step:
the bytes go to Cloudinary and the row is written in the same call, so a
failed DB insert can destroy the asset it orphaned instead of leaving a
photo nobody can ever see or clean up (see WS0's diagnosis of the original
"story never visible" bug).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.story import create_story, delete_story, get_story_rail, mark_story_viewed
from app.services.cloudinary_service import delete_file, upload_file
from app.services.points import POINTS_STORY, STORY_POINTS_DAILY_CAP, TXN_STORY, award_capped

router = APIRouter()


@router.get("/stories/feed")
def api_story_rail(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The For You rail — active stories from every user."""
    return {"groups": get_story_rail(db, user.id)}


@router.post("/stories", status_code=201)
async def api_create_story(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        asset = upload_file(await file.read(), "stories", file.content_type or "")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    try:
        story = create_story(db, user, asset["url"], asset["public_id"])
    except ValueError as exc:
        # Active-story cap — the upload already landed in Cloudinary, so
        # clean it up rather than leaving an orphaned asset behind.
        delete_file(asset["public_id"], resource_type="image")
        raise HTTPException(status_code=429, detail=str(exc))
    except Exception:
        delete_file(asset["public_id"], resource_type="image")
        raise

    points_awarded = award_capped(db, user, TXN_STORY, POINTS_STORY, STORY_POINTS_DAILY_CAP, reference_id=story.id)
    db.commit()
    db.refresh(user)

    return {
        "id": str(story.id),
        "image_url": story.image_url,
        "created_at": story.created_at,
        "expires_at": story.expires_at,
        "points_awarded": points_awarded,
        "points_balance": user.points_balance,
    }


@router.post("/stories/{story_id}/view")
def api_view_story(
    story_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    try:
        return {"view_count": mark_story_viewed(db, story_id, user.id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/stories/{story_id}")
def api_delete_story(
    story_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    # A body, not 204: the frontend's request() helper always parses JSON,
    # and an empty response would throw on the happy path (same convention
    # as the old circle-scoped endpoint this replaces).
    try:
        delete_story(db, story_id, user.id)
        return {"deleted": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
