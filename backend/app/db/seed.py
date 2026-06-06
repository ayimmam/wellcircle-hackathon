"""
Seed script — populates test users for development.
Run: python -m app.db.seed
"""
import uuid
from datetime import datetime, timezone, timedelta

from app.database import SessionLocal, engine, Base
from app.models import User


def seed():
    """Seed the database with test users."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(User).count() > 0:
            print("⚠️  Database already has users. Skipping seed.")
            return

        users = [
            User(
                id=uuid.uuid4(),
                telegram_id=100000001,
                telegram_handle="meron_fitness",
                name="Meron Tadesse",
                goal="Lose weight and stay consistent",
                interest_category="yoga",
                exercise_frequency="sometimes",
                photo_url=None,
                points_balance=120,
                is_onboarded=True,
                last_activity_at=datetime.now(timezone.utc) - timedelta(hours=2),
            ),
            User(
                id=uuid.uuid4(),
                telegram_id=100000002,
                telegram_handle="abel_run",
                name="Abel Kebede",
                goal="Train for Addis marathon",
                interest_category="running",
                exercise_frequency="regular",
                photo_url=None,
                points_balance=340,
                is_onboarded=True,
                last_activity_at=datetime.now(timezone.utc) - timedelta(days=1),
            ),
            User(
                id=uuid.uuid4(),
                telegram_id=100000003,
                telegram_handle="sara_wellness",
                name="Sara Alemayehu",
                goal=None,
                interest_category="nutrition",
                exercise_frequency="rarely",
                photo_url=None,
                points_balance=45,
                is_onboarded=True,
                last_activity_at=datetime.now(timezone.utc) - timedelta(days=10),
            ),
            User(
                id=uuid.uuid4(),
                telegram_id=100000004,
                telegram_handle="dawit_gym",
                name="Dawit Hailu",
                goal="Build muscle mass",
                interest_category="gym",
                exercise_frequency="daily",
                photo_url=None,
                points_balance=720,
                is_onboarded=True,
                is_provider=True,
                last_activity_at=datetime.now(timezone.utc),
            ),
            User(
                id=uuid.uuid4(),
                telegram_id=100000005,
                telegram_handle="hana_spa",
                name="Hana Girma",
                goal="Better work-life balance",
                interest_category="spa",
                exercise_frequency="sometimes",
                photo_url=None,
                points_balance=210,
                is_onboarded=True,
                last_activity_at=datetime.now(timezone.utc) - timedelta(days=3),
            ),
            # Unonboarded user — simulates someone who started bot but didn't finish
            User(
                id=uuid.uuid4(),
                telegram_id=100000006,
                telegram_handle="new_user_test",
                name=None,
                is_onboarded=False,
                last_activity_at=datetime.now(timezone.utc) - timedelta(days=8),
            ),
        ]

        db.add_all(users)
        db.commit()
        print(f"✅ Seeded {len(users)} test users")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
