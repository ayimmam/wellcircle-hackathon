import os
import sys
import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from datetime import datetime, timezone

# Add the app directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.provider_subscription import ProviderSubscription
from app.models.provider import Provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_expired_subscriptions():
    logger.info("Running check_expired_subscriptions...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Find active subscriptions that have expired
        expired_subs = db.query(ProviderSubscription).filter(
            ProviderSubscription.status == 'active',
            ProviderSubscription.expires_at < now
        ).all()
        
        for sub in expired_subs:
            sub.status = 'expired'
            provider = db.query(Provider).filter(Provider.id == sub.provider_id).first()
            if provider:
                logger.info(f"Subscription expired for provider {provider.name}")
                # Optional: Remove premium badge or reduce visibility
        db.commit()
    except Exception as e:
        logger.error(f"Error checking expired subscriptions: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    scheduler = BlockingScheduler()
    # Run every hour
    scheduler.add_job(check_expired_subscriptions, 'interval', hours=1)
    
    logger.info("Starting background scheduler...")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    main()
