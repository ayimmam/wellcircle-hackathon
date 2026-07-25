"""Trainer verification user/admin endpoints."""
import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.trainer_verification import (
    apply_for_verification, get_pending_verifications, get_verification_status,
    review_verification,
)
from app.database import get_db
from app.dependencies import get_current_user, get_super_admin
from app.models.user import User
from app.schemas.trainer_verification import (
    AdminTrainerReviewRequest, TrainerVerificationApply,
)

router = APIRouter()


def _response(row):
    return {
        "id": str(row.id), "user_id": str(row.user_id), "status": row.status,
        "payment_status": row.payment_status, "rejection_reason": row.rejection_reason,
        "certificate_url": row.certificate_url,
        "payment_receipt_url": row.payment_receipt_url,
        "created_at": row.created_at, "expires_at": row.expires_at,
    }


@router.post("/trainer/apply", status_code=201)
def apply(
    body: TrainerVerificationApply,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return _response(apply_for_verification(db, user.id, **body.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/trainer/status")
def status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = get_verification_status(db, user.id)
    return {"application": _response(row) if row else None}


@router.get("/admin/trainer-verifications")
def admin_list(
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    status: str = Query("pending", pattern=r"^(pending|approved|rejected|all)$"),
    admin: User = Depends(get_super_admin), db: Session = Depends(get_db),
):
    rows, total = get_pending_verifications(db, page, per_page, None if status == "all" else status)
    return {"items": [_response(x) for x in rows], "total": total, "page": page,
            "pages": math.ceil(total / per_page) if total else 1}


@router.post("/admin/trainer-verifications/{verification_id}/review")
def admin_review(
    verification_id: UUID, body: AdminTrainerReviewRequest,
    admin: User = Depends(get_super_admin), db: Session = Depends(get_db),
):
    try:
        return _response(review_verification(
            db, verification_id, admin.id, body.action, body.rejection_reason
        ))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
