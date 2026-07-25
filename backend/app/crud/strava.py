"""Strava activity cache operations."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.strava_activity_cache import StravaActivityCache

CACHE_TTL = timedelta(minutes=15)


def cache_is_fresh(db: Session, user_id):
    latest = db.query(func.max(StravaActivityCache.fetched_at)).filter(
        StravaActivityCache.user_id == user_id
    ).scalar()
    if latest and latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    return bool(latest and latest > datetime.now(timezone.utc) - CACHE_TTL)


def cache_activities(db: Session, user_id, activities):
    fetched_at = datetime.now(timezone.utc)
    saved = []
    for item in activities:
        activity_id = item.get("id")
        if activity_id is None:
            continue
        row = db.query(StravaActivityCache).filter(
            StravaActivityCache.strava_activity_id == activity_id
        ).first()
        if not row:
            row = StravaActivityCache(user_id=user_id, strava_activity_id=activity_id)
            db.add(row)
        row.activity_type = item.get("type") or item.get("sport_type") or "Activity"
        row.distance_meters = item.get("distance") or 0
        row.moving_time_seconds = item.get("moving_time") or 0
        row.elapsed_time_seconds = item.get("elapsed_time") or 0
        row.total_elevation_gain = item.get("total_elevation_gain") or 0
        row.calories = item.get("calories")
        start = item.get("start_date")
        row.start_date = (
            datetime.fromisoformat(start.replace("Z", "+00:00")) if isinstance(start, str) else start
        ) or fetched_at
        row.name = item.get("name") or "Activity"
        row.fetched_at = fetched_at
        saved.append(row)
    db.commit()
    return saved


def get_cached_activities(db: Session, user_id, limit=10):
    return db.query(StravaActivityCache).filter(
        StravaActivityCache.user_id == user_id
    ).order_by(StravaActivityCache.start_date.desc()).limit(limit).all()


def get_aggregated_stats(db: Session, user_id):
    rows = get_cached_activities(db, user_id, limit=1000)
    return {
        "distance": round(sum(x.distance_meters or 0 for x in rows) / 1000, 2),
        "calories": round(sum(x.calories or 0 for x in rows), 2),
        "moving_time": sum(x.moving_time_seconds or 0 for x in rows),
        "elevation": round(sum(x.total_elevation_gain or 0 for x in rows), 2),
        "activity_count": len(rows),
        "recent_activities": [
            {
                "id": x.strava_activity_id, "name": x.name, "type": x.activity_type,
                "distance": round((x.distance_meters or 0) / 1000, 2),
                "moving_time": x.moving_time_seconds, "start_date": x.start_date,
            }
            for x in rows[:5]
        ],
    }


def clear_user_cache(db: Session, user_id):
    count = db.query(StravaActivityCache).filter(
        StravaActivityCache.user_id == user_id
    ).delete(synchronize_session=False)
    db.commit()
    return count
