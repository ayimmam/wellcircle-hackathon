"""Focused Phase 15 backend tests.

Run: python -m app.tests.test_phase15_backend
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test")
os.environ.setdefault("JWT_SECRET", "phase15-test-secret")

from sqlalchemy import String, Text, TypeDecorator, create_engine
from sqlalchemy.orm import sessionmaker


class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value and not isinstance(value, uuid.UUID) else value


class SQLiteJSONB(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        import json
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        import json
        return json.loads(value)


import sqlalchemy.dialects.postgresql as pg


class PatchedUUID(SQLiteUUID):
    def __init__(self, *args, **kwargs):
        super().__init__()


class PatchedJSONB(SQLiteJSONB):
    def __init__(self, *args, **kwargs):
        super().__init__()


pg.UUID = PatchedUUID
pg.JSONB = PatchedJSONB

from app.database import Base
from app.models import *  # noqa: F403,F401 - load all FK targets
from app.models.circle import Circle, CircleMember
from app.models.circle_subscription import CircleRevenueLedger
from app.models.point_transaction import PointTransaction
from app.models.user import User

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)


def make_user(db, telegram_id, name="User"):
    user = User(telegram_id=telegram_id, name=name, is_onboarded=True)
    db.add(user)
    db.flush()
    return user


def run_tests():
    db = Session()
    import app.services.notification_service as notifications
    notifications.send_telegram_notification = lambda *args, **kwargs: None

    from app.crud.follower import (
        follow_user, get_follower_count, get_following_count, is_following, unfollow_user,
    )
    owner = make_user(db, 100, "Owner")
    follower = make_user(db, 101, "Follower")
    follow_user(db, follower.id, owner.id)
    assert is_following(db, follower.id, owner.id)
    assert get_follower_count(db, owner.id) == 1
    assert get_following_count(db, follower.id) == 1
    assert unfollow_user(db, follower.id, owner.id)
    try:
        follow_user(db, owner.id, owner.id)
        raise AssertionError("self-follow should fail")
    except ValueError:
        pass

    from app.crud.trainer_verification import apply_for_verification, review_verification
    application = apply_for_verification(
        db, owner.id, certificate_url="https://example/cert.pdf",
        certificate_public_id="cert", payment_receipt_url="https://example/receipt.png",
        payment_receipt_public_id="receipt",
    )
    admin = make_user(db, 102, "Admin")
    reviewed = review_verification(db, application.id, admin.id, "approve")
    assert reviewed.status == "approved"
    assert owner.is_verified_trainer
    assert owner.verified_trainer_expires_at is not None

    # Eligibility is ledger-derived, excluding reversed and negative rows.
    circle = Circle(name="Paid", owner_id=owner.id)
    db.add(circle)
    db.flush()
    members = [owner, follower] + [make_user(db, 1000 + i) for i in range(98)]
    db.add_all([CircleMember(circle_id=circle.id, user_id=user.id) for user in members])
    db.add(PointTransaction(user_id=owner.id, amount=1000, type="admin_adjust"))
    db.commit()

    from app.crud.circle_subscription import (
        apply_for_paid_circle, creator_review_subscription, has_circle_access,
        review_paid_circle, subscribe_to_circle,
    )
    apply_for_paid_circle(db, circle.id, owner.id, 101)
    review_paid_circle(db, circle.id, "approve")
    assert has_circle_access(db, circle.id, follower.id)  # grandfathered
    subscriber = make_user(db, 9999, "Subscriber")
    db.commit()
    subscription = subscribe_to_circle(db, circle.id, subscriber.id, "https://receipt", "receipt-id")
    creator_review_subscription(db, subscription.id, owner.id, "approve")
    ledger = db.query(CircleRevenueLedger).filter_by(subscription_id=subscription.id).one()
    assert (ledger.creator_amount_etb, ledger.platform_fee_etb) == (96, 5)
    assert ledger.creator_amount_etb + ledger.platform_fee_etb == ledger.total_amount_etb == 101
    assert has_circle_access(db, circle.id, subscriber.id)

    from app.services.strava_service import decrypt_token, encrypt_token
    encrypted = encrypt_token("secret-token")
    assert encrypted != "secret-token"
    assert decrypt_token(encrypted) == "secret-token"

    from app.crud.strava import cache_activities, cache_is_fresh, get_aggregated_stats
    cache_activities(db, subscriber.id, [{
        "id": 77, "type": "Run", "distance": 5000, "moving_time": 1500,
        "elapsed_time": 1600, "total_elevation_gain": 20, "calories": 300,
        "start_date": datetime.now(timezone.utc).isoformat(), "name": "Morning run",
    }])
    assert cache_is_fresh(db, subscriber.id)
    stats = get_aggregated_stats(db, subscriber.id)
    assert stats["distance"] == 5
    assert stats["activity_count"] == 1
    print("Phase 15 backend tests passed (followers, trainer, paid circles, encryption, cache).")
    db.close()


if __name__ == "__main__":
    run_tests()
