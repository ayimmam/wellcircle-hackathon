"""APScheduler jobs — points decay and re-engagement tracking."""

from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.user import User
from app.services.points_engine import POINTS_DECAY_PER_DAY, DECAY_AFTER_DAYS


def decay_points_job():
    """Decay points for users inactive for 3+ consecutive days. Runs daily."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=DECAY_AFTER_DAYS)
        inactive_users = (
            db.query(User)
            .filter(
                User.points_balance > 0,
                (User.last_checkin_at < cutoff) | (User.last_checkin_at.is_(None)),
            )
            .all()
        )
        for user in inactive_users:
            user.points_balance = max(0, user.points_balance - POINTS_DECAY_PER_DAY)
        db.commit()
        print(f"[Scheduler] Decayed points for {len(inactive_users)} users")
    except Exception as e:
        print(f"[Scheduler] Decay error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    scheduler = BackgroundScheduler()
    # Run decay daily at midnight UTC
    scheduler.add_job(decay_points_job, "cron", hour=0, minute=0, id="points_decay")
    scheduler.start()
    print("[Scheduler] Started — points decay job scheduled daily at 00:00 UTC")
    return scheduler
