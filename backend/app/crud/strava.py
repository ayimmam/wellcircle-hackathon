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
    check_strava_challenges(db, user_id)
    return saved


def check_strava_challenges(db: Session, user_id):
    from app.models.community_challenge import CommunityChallenge, ChallengeAward
    from app.models.user import User
    from app.services.points import apply_transaction, TXN_CHALLENGE
    from app.services.notification_service import create_notification
    from sqlalchemy import func
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
        
    active_challenges = db.query(CommunityChallenge).filter(
        CommunityChallenge.challenge_type == "strava_distance",
        CommunityChallenge.is_active == True,
        CommunityChallenge.starts_at <= datetime.now(timezone.utc),
        CommunityChallenge.ends_at >= datetime.now(timezone.utc)
    ).all()
    
    for challenge in active_challenges:
        if not challenge.target_value:
            continue
            
        distance_meters = db.query(func.coalesce(func.sum(StravaActivityCache.distance_meters), 0)).filter(
            StravaActivityCache.user_id == user_id,
            StravaActivityCache.start_date >= challenge.starts_at,
            StravaActivityCache.start_date <= challenge.ends_at
        ).scalar()
        
        strava_distance = distance_meters / 1000.0
        if strava_distance >= challenge.target_value:
            already_awarded = db.query(ChallengeAward).filter(
                ChallengeAward.challenge_id == challenge.id,
                ChallengeAward.user_id == user_id
            ).first()
            
            if not already_awarded:
                apply_transaction(db, user, challenge.reward_points, TXN_CHALLENGE,
                                  reference_id=challenge.id,
                                  note=f"Challenge: {challenge.title}")
                db.add(ChallengeAward(
                    challenge_id=challenge.id,
                    user_id=user_id,
                    points_given=challenge.reward_points
                ))
                create_notification(
                    db,
                    user_id=str(user.id),
                    type="challenge_completed",
                    title="Challenge Completed! 🏃",
                    body=f"You completed '{challenge.title}' and earned {challenge.reward_points} pts!",
                    action_url=f"/community/{challenge.community_id}"
                )
    db.commit()


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
