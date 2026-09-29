"""Terra webhook verification and idempotent Walk Score accounting."""
import hashlib
import hmac
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wearable import UserWearable, WearableDailySteps, WalkScoreDay

MAX_DAILY_STEPS = 100_000
SIGNATURE_TOLERANCE_SECONDS = 600


def verify_signature(raw: bytes, header: str | None, secret: str, now: int | None = None) -> bool:
    if not secret or not header:
        return False
    parts = [part.strip().split("=", 1) for part in header.split(",") if "=" in part]
    timestamps = [value for key, value in parts if key == "t"]
    signatures = [value for key, value in parts if key == "v1"]
    if len(timestamps) != 1 or not signatures or not timestamps[0].isdigit():
        return False
    timestamp = int(timestamps[0])
    current = now if now is not None else int(datetime.now(timezone.utc).timestamp())
    if abs(current - timestamp) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    digest = hmac.new(secret.encode(), timestamps[0].encode() + b"." + raw, hashlib.sha256).hexdigest()
    return any(len(sig) == 64 and hmac.compare_digest(digest, sig) for sig in signatures)


def _terra_identity(data: dict) -> tuple[str, UUID, str, str]:
    terra_user = data.get("user") or {}
    terra_id = terra_user.get("user_id")
    reference = data.get("reference_id") or terra_user.get("reference_id")
    provider = terra_user.get("provider")
    if not all(isinstance(value, str) and value for value in (terra_id, reference, provider)):
        raise ValueError("Terra user identity is incomplete")
    if terra_user.get("reference_id") and terra_user["reference_id"] != reference:
        raise ValueError("Terra reference ID mismatch")
    try:
        user_id = UUID(reference)
    except ValueError as exc:
        raise ValueError("Invalid Terra reference ID") from exc
    return terra_id, user_id, reference, provider


def _day_and_steps(record: dict) -> tuple[date, int] | None:
    metadata = record.get("metadata") or {}
    start = metadata.get("start_time")
    distance = record.get("distance_data") or {}
    summary = distance.get("summary") or distance
    steps = summary.get("steps")
    if steps is None:
        return None
    if not isinstance(start, str) or len(start) < 10 or type(steps) is not int:
        raise ValueError("Invalid daily step record")
    try:
        day = date.fromisoformat(start[:10])
    except ValueError as exc:
        raise ValueError("Invalid daily activity date") from exc
    if not 0 <= steps <= MAX_DAILY_STEPS:
        raise ValueError("Daily steps outside accepted range")
    if day > datetime.now(timezone.utc).date():
        raise ValueError("Future daily activity date")
    return day, steps


def process_event(db: Session, data: dict) -> dict:
    """Serialize per user, then update provider/day and user/day watermarks atomically.

    The timestamp is observability metadata, never a dedupe key: Terra can
    resend or revise an older day after newer days have synced.
    """
    kind = data.get("type")
    if kind == "healthcheck":
        return {"status": "ok"}
    if kind not in {"auth", "user_reauth", "deauth", "access_revoked", "daily"}:
        return {"status": "ignored"}
    if kind in {"auth", "user_reauth"} and data.get("status") != "success":
        return {"status": "ignored"}

    if kind == "user_reauth":
        identity = {"user": data.get("new_user") or {}}
        # Re-auth sends a separate auth event too. This event ensures the old
        # Terra ID cannot later credit data after replacement.
        terra_id, user_id, reference, provider = _terra_identity(identity)
    else:
        terra_id, user_id, reference, provider = _terra_identity(data)

    # The user row lock serializes all webhooks for this account, including
    # distinct providers and distinct days, across serverless instances.
    user = db.query(User).filter(User.id == user_id).with_for_update().one_or_none()
    if user is None:
        raise ValueError("Terra reference does not match a user")
    wearable = db.query(UserWearable).filter(UserWearable.terra_user_id == terra_id).one_or_none()
    if wearable and (wearable.user_id != user_id or wearable.provider != provider):
        raise ValueError("Terra connection identity changed")

    if kind in {"auth", "user_reauth"}:
        if kind == "user_reauth":
            old_id = (data.get("old_user") or {}).get("user_id")
            if old_id:
                old = db.query(UserWearable).filter(UserWearable.terra_user_id == old_id,
                                                    UserWearable.user_id == user_id).one_or_none()
                if old:
                    old.active = False
        if wearable is None:
            wearable = UserWearable(user_id=user_id, terra_user_id=terra_id,
                                    reference_id=reference, provider=provider)
            db.add(wearable)
        wearable.active = True
        db.commit()
        return {"status": "connected"}

    if wearable is None:
        # Do not silently lose a daily event that arrives before auth.
        # Terra retries non-2xx webhooks after the auth event is processed.
        if kind == "daily":
            raise LookupError("Waiting for Terra auth event")
        return {"status": "ignored"}

    if kind in {"deauth", "access_revoked"}:
        wearable.active = False
        db.commit()
        return {"status": "disconnected"}

    if not wearable.active:
        return {"status": "ignored"}
    records = data.get("data")
    if not isinstance(records, list):
        raise ValueError("Daily payload must contain a data list")

    # Collapse duplicate dates inside one delivery before touching the DB.
    days: dict[date, int] = {}
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Invalid daily record")
        parsed = _day_and_steps(record)
        if parsed:
            day, steps = parsed
            days[day] = max(days.get(day, 0), steps)

    added = 0
    source_days = {
        row.activity_date: row for row in db.query(WearableDailySteps)
        .filter(WearableDailySteps.wearable_id == wearable.id,
                WearableDailySteps.activity_date.in_(days)).all()
    } if days else {}
    score_days = {
        row.activity_date: row for row in db.query(WalkScoreDay)
        .filter(WalkScoreDay.user_id == user_id, WalkScoreDay.activity_date.in_(days)).all()
    } if days else {}
    for day, steps in days.items():
        source = source_days.get(day)
        if source is None:
            source = WearableDailySteps(wearable_id=wearable.id, activity_date=day, steps=steps)
            db.add(source)
        else:
            source.steps = max(source.steps, steps)

        score_day = score_days.get(day)
        previous = score_day.steps if score_day else 0
        if score_day is None:
            db.add(WalkScoreDay(user_id=user_id, activity_date=day, steps=steps))
        elif steps > previous:
            score_day.steps = steps
        added += max(0, steps - previous)

    user.walk_score = (user.walk_score or 0) + added
    wearable.last_sync_timestamp = datetime.now(timezone.utc)
    db.commit()
    return {"status": "processed", "steps_added": added}
