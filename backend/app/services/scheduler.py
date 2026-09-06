"""APScheduler jobs — points decay, booking reminders, challenge expiry."""

from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.booking import Booking
from app.models.community_challenge import CommunityChallenge
from app.models.community import Community, CommunityMember
from app.services.notification_service import create_notification
from app.utils.logger import get_logger

logger = get_logger(__name__)


def decay_points_job():
    """Decay points for users inactive for 3+ consecutive days.

    Runs daily. Activity is now measured by the last positive-amount ledger
    transaction (any type), NOT just last_checkin_at. This prevents punishing
    users who earn through bookings/events/awards but skip community check-ins.
    """
    from app.services.points import (
        apply_transaction, get_last_positive_transaction_at,
        POINTS_DECAY_PER_DAY, DECAY_AFTER_DAYS, TXN_DECAY,
    )

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=DECAY_AFTER_DAYS)
        candidates = (
            db.query(User)
            .filter(User.points_balance > 0)
            .all()
        )
        decayed_count = 0
        for user in candidates:
            last_positive = get_last_positive_transaction_at(db, user.id)
            # Fall back to last_checkin_at for users who existed before the ledger
            effective_last_active = last_positive or user.last_checkin_at
            if effective_last_active is None or effective_last_active < cutoff:
                apply_transaction(db, user, -POINTS_DECAY_PER_DAY, TXN_DECAY,
                                  note="Daily inactivity decay")
                decayed_count += 1
        db.commit()
        print(f"[Scheduler] Decayed points for {decayed_count} users")
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


def phase15_maintenance_job():
    """Expire trainer/subscription access, escalate stale receipts, and purge
    the Cloudinary assets behind stories past their 72 hours."""
    from app.crud.circle_story import purge_expired_stories
    from app.crud.circle_subscription import check_expired_subscriptions, escalate_stale_receipts
    from app.crud.trainer_verification import check_expired_verifications

    db: Session = SessionLocal()
    try:
        result = {
            "expired_verifications": check_expired_verifications(db),
            "expired_subscriptions": check_expired_subscriptions(db),
            "escalated_receipts": escalate_stale_receipts(db, hours=72),
            # Stories stop being served the instant expires_at passes; this is
            # only about not keeping the bytes. Anything Cloudinary refuses
            # keeps deleted_at NULL and is retried tomorrow.
            "purged_stories": purge_expired_stories(db),
        }
        logger.info("Phase 15 maintenance completed: %s", result)
        return result
    except Exception:
        db.rollback()
        logger.exception("Phase 15 maintenance failed")
        raise
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    scheduler = BackgroundScheduler()
    scheduler.add_job(decay_points_job, "cron", hour=0, minute=0, id="points_decay")
    scheduler.add_job(booking_reminder_job, "cron", hour="*", minute=0, id="booking_reminders")
    scheduler.add_job(challenge_expiry_job, "cron", hour=0, minute=5, id="challenge_expiry")
    scheduler.add_job(phase15_maintenance_job, "cron", hour=0, minute=15, id="phase15_maintenance")
    scheduler.start()
    print("[Scheduler] Started — decay, booking reminders, challenge expiry")
    return scheduler
