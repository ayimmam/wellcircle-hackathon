"""Phase D read-only duplicate-account reconciliation (user-facing dry run).

The caller must be signed in as the canonical account. The source account is
discovered from a fresh provider credential verified by the same verifiers used
by login/linking; the client never supplies a source user id or subject.

This endpoint only reads. A destructive merge is intentionally not exposed
until the unresolved business rules documented in
``docs/ACCOUNT_RECONCILIATION.md`` are approved.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.auth_identity import get_user_by_identity, resolve_user_by_telegram
from app.database import get_db
from app.dependencies import get_current_user_readonly
from app.models.user import User
from app.schemas.account_reconciliation import (
    ReconciliationDryRunRequest,
    ReconciliationDryRunResponse,
)
from app.services.account_linking import (
    LinkingError,
    verify_provider_proof,
)
from app.services.account_reconciliation import (
    ReconciliationError,
    build_reconciliation_plan,
)
from app.services.rate_limit import (
    RECONCILIATION_DRY_RUN,
    RECONCILIATION_DRY_RUN_LIMIT,
    RateLimitExceeded,
    enforce_rate_limit,
)

router = APIRouter()


def _resolve_source_user(db: Session, payload: ReconciliationDryRunRequest) -> User:
    proof = {
        "google_id_token": payload.google_id_token,
        "telegram_init_data": payload.telegram_init_data,
        "telegram_login": payload.telegram_login,
    }
    try:
        identity = verify_provider_proof(payload.source_provider, proof)
    except LinkingError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error.detail,
            headers={"Retry-After": "60"} if error.status_code == 429 else None,
        ) from error

    if payload.source_provider == "google":
        user = get_user_by_identity(db, "google", identity["subject"])
    else:
        try:
            telegram_id = int(identity["subject"])
        except (TypeError, ValueError):
            telegram_id = identity["subject"]
        user = resolve_user_by_telegram(db, telegram_id)

    # Same response for "no account" and "identity not linked" so this endpoint
    # cannot be used to enumerate accounts or provider subjects.
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Well Circle account is linked to that sign-in method.",
        )
    return user


@router.post("/dry-run", response_model=ReconciliationDryRunResponse)
def account_reconciliation_dry_run(
    payload: ReconciliationDryRunRequest,
    current_user: User = Depends(get_current_user_readonly),
    db: Session = Depends(get_db),
):
    """Return a read-only plan for the signed-in canonical account.

    The canonical id always comes from the JWT. The source id always comes from
    the server-verified provider proof. No merge is performed.
    """
    try:
        enforce_rate_limit(
            db,
            current_user.id,
            RECONCILIATION_DRY_RUN,
            limit=RECONCILIATION_DRY_RUN_LIMIT,
        )
    except RateLimitExceeded as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reconciliation checks. Please wait and try again.",
            headers={"Retry-After": str(error.retry_after)},
        ) from error

    source = _resolve_source_user(db, payload)
    try:
        return build_reconciliation_plan(db, current_user.id, source.id)
    except ReconciliationError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": error.message},
        ) from error
