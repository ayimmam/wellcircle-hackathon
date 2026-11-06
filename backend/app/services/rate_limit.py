"""Durable rate limiting for expensive authenticated read operations.

The reconciliation dry run verifies a fresh Google/Telegram credential on every
request. A small per-user/action counter window is needed even though the
reconciliation itself is read-only. This writes only an ephemeral counter row;
it never touches either account, Circler data or any business record.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.api_rate_limit import ApiRateLimit

RECONCILIATION_DRY_RUN = "reconciliation_dry_run"
RECONCILIATION_ADMIN_DRY_RUN = "reconciliation_admin_dry_run"
RECONCILIATION_DRY_RUN_LIMIT = 10       # per canonical user per window
RECONCILIATION_ADMIN_LIMIT = 30         # per super admin per window
RATE_LIMIT_WINDOW_SECONDS = 60


class RateLimitExceeded(Exception):
    """A caller exceeded the action's short-window allowance."""

    def __init__(self, retry_after: int):
        self.retry_after = max(1, int(retry_after))
        super().__init__("Too many requests. Please wait and try again.")


def _advisory_lock(db: Session, user_id: UUID, action: str) -> None:
    """Serialize counter reservations for PostgreSQL (pooler-safe)."""
    if db.get_bind().dialect.name != "postgresql":
        return
    digest = hmac.new(
        settings.JWT_SECRET.encode(),
        f"rate:{action}:{user_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    lock_id = int.from_bytes(bytes.fromhex(digest)[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})


def enforce_rate_limit(
    db: Session,
    user_id: UUID,
    action: str,
    *,
    limit: int,
    window_seconds: int = RATE_LIMIT_WINDOW_SECONDS,
) -> None:
    """Reserve one attempt or raise :class:`RateLimitExceeded`.

    The reservation is committed before the expensive provider proof check, so
    parallel serverless workers cannot bypass the limit. Target data remains
    untouched; only this counter row is written.
    """
    now = int(time.time())
    _advisory_lock(db, user_id, action)
    # Housekeeping: stale counters for this actor/action are no longer needed.
    db.query(ApiRateLimit).filter(
        ApiRateLimit.user_id == user_id,
        ApiRateLimit.action == action,
        ApiRateLimit.created_at < now - window_seconds,
    ).delete(synchronize_session=False)

    recent = (
        db.query(ApiRateLimit)
        .filter(
            ApiRateLimit.user_id == user_id,
            ApiRateLimit.action == action,
            ApiRateLimit.created_at >= now - window_seconds,
        )
        .order_by(ApiRateLimit.created_at.asc())
        .all()
    )
    if len(recent) >= limit:
        oldest = recent[0].created_at
        db.rollback()
        raise RateLimitExceeded(window_seconds - (now - oldest))

    db.add(
        ApiRateLimit(
            id=secrets.token_urlsafe(24),
            user_id=user_id,
            action=action,
            created_at=now,
        )
    )
    db.commit()
