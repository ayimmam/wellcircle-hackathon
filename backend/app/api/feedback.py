"""User-facing feedback API — bug reports, health-app requests, suggestions."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.crud.feedback import create_feedback
from app.schemas.feedback import FeedbackCreate, FeedbackCreateResponse

router = APIRouter()


@router.post("/feedback", response_model=FeedbackCreateResponse, status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fb = create_feedback(db, current_user.id, payload.type, payload.message, payload.context)
    return {"id": str(fb.id)}
