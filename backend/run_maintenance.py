"""
Cron-triggered maintenance tasks for cPanel shared hosting.

cPanel doesn't support long-running background processes, so the APScheduler
in app/main.py (which handles points decay) cannot run. This script is called
by a cPanel Cron Job instead.

Example cron entry (daily at midnight UTC / 3 AM EAT):
    0 0 * * * /home/username/virtualenv/wellcircle_backend/3.10/bin/python \
              /home/username/wellcircle_backend/run_maintenance.py \
              >> /home/username/wellcircle_backend/cron.log 2>&1
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("ENVIRONMENT", "production")

from app.database import SessionLocal
from app.utils.logger import get_logger

logger = get_logger("wellcircle.cron")


def run_points_decay(db):
    """Apply weekly points decay — mirrors the scheduler job."""
    try:
        from app.services.scheduler import decay_points
        decay_points(db)
        logger.info("Points decay completed successfully")
    except ImportError:
        logger.warning("decay_points not found in scheduler module — skipping")
    except Exception as e:
        logger.error("Points decay failed: %s", e)


def run_stale_booking_cleanup(db):
    """Expire pending bookings older than 24h — keeps the bookings table clean."""
    try:
        from app.crud.booking import expire_stale_bookings
        expired = expire_stale_bookings(db)
        if expired:
            logger.info("Expired %d stale bookings", expired)
    except (ImportError, AttributeError):
        # Function may not exist yet — skip gracefully
        pass
    except Exception as e:
        logger.error("Stale booking cleanup failed: %s", e)


if __name__ == "__main__":
    print(f"[{datetime.utcnow().isoformat()}] Running maintenance tasks...")
    db = SessionLocal()
    try:
        run_points_decay(db)
        run_stale_booking_cleanup(db)
        print("Maintenance completed.")
    except Exception as e:
        print(f"Maintenance error: {e}")
        logger.exception("Unhandled maintenance error")
    finally:
        db.close()
