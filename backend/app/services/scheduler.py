"""APScheduler jobs — points decay, booking reminders, challenge expiry."""

from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.booking import Booking
from app.models.community_challenge import CommunityChallenge
from app.models.community import Community, CommunityMember
from app.services.points_engine import POINTS_DECAY_PER_DAY, DECAY_AFTER_DAYS
from app.services.notification_service import create_notification


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


def booking_reminder_job():
    """Send reminders for bookings starting in 20–28 hours."""
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window_start = now + timedelta(hours=20)
        window_end = now + timedelta(hours=28)
        bookings = (
            db.query(Booking)
            .filter(
                Booking.payment_status == "success",
                Booking.reminder_sent == False,
                Booking.slot_datetime >= window_start,
                Booking.slot_datetime <= window_end,
            )
            .all()
        )
        for booking in bookings:
            create_notification(
                db,
                user_id=booking.user_id,
                type="booking_reminder",
                title="Upcoming session reminder",
                body=f"Your {booking.service_name} booking is coming up soon.",
                action_url="/my-bookings",
            )
            booking.reminder_sent = True
        db.commit()
        if bookings:
            print(f"[Scheduler] Sent {len(bookings)} booking reminders")
    except Exception as e:
        print(f"[Scheduler] Booking reminder error: {e}")
        db.rollback()
    finally:
        db.close()


def challenge_expiry_job():
    """Mark expired challenges inactive and notify community members."""
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired = (
            db.query(CommunityChallenge)
            .filter(
                CommunityChallenge.is_active == True,
                CommunityChallenge.ends_at < now,
            )
            .all()
        )
        for challenge in expired:
            challenge.is_active = False
            members = (
                db.query(CommunityMember)
                .filter(CommunityMember.community_id == challenge.community_id)
                .all()
            )
            community = db.query(Community).filter(Community.id == challenge.community_id).first()
            name = community.name if community else "your community"
            for member in members:
                create_notification(
                    db,
                    user_id=member.user_id,
                    type="challenge_ended",
                    title="Challenge ended",
                    body=f"The challenge '{challenge.title}' in {name} has ended.",
                    action_url=f"/community/{challenge.community_id}",
                )
        db.commit()
        if expired:
            print(f"[Scheduler] Expired {len(expired)} challenges")
    except Exception as e:
        print(f"[Scheduler] Challenge expiry error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    scheduler = BackgroundScheduler()
    scheduler.add_job(decay_points_job, "cron", hour=0, minute=0, id="points_decay")
    scheduler.add_job(booking_reminder_job, "cron", hour="*", minute=0, id="booking_reminders")
    scheduler.add_job(challenge_expiry_job, "cron", hour=0, minute=5, id="challenge_expiry")
    scheduler.start()
    print("[Scheduler] Started — decay, booking reminders, challenge expiry")
    return scheduler
