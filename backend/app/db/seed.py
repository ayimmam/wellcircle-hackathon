"""
Seed script — populates test users, providers, and communities for development.
Run: python -m app.db.seed
"""
import uuid
from datetime import datetime, timezone, timedelta

from app.database import SessionLocal, engine, Base
from app.models import User, Provider, Community


def seed():
    """Seed the database with test data."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if already seeded and clear them to re-seed real data
        if db.query(Provider).count() > 0:
            print("⚠️  Database already has providers. Deleting them to re-seed real data...")
            db.query(Community).delete()
            db.query(Provider).delete()
            db.commit()

        users = []
        if db.query(User).count() == 0:
            print("🌱 Seeding Users...")
            users = [
                User(
                    id=uuid.uuid4(),
                    telegram_id=100000001,
                    telegram_handle="meron_fitness",
                    name="Meron Tadesse",
                    goal="Lose weight and stay consistent",
                    interest_category="yoga",
                    exercise_frequency="sometimes",
                    points_balance=120,
                    is_onboarded=True,
                    last_activity_at=datetime.now(timezone.utc) - timedelta(hours=2),
                ),
                User(
                    id=uuid.uuid4(),
                    telegram_id=100000004,
                    telegram_handle="dawit_gym",
                    name="Dawit Hailu",
                    goal="Build muscle mass",
                    interest_category="gym",
                    exercise_frequency="daily",
                    points_balance=720,
                    is_onboarded=True,
                    is_provider=True,
                    last_activity_at=datetime.now(timezone.utc),
                )
            ]
            db.add_all(users)
            db.commit()
        else:
            users = db.query(User).all()

        print("🌱 Seeding Providers...")
        p1_id = uuid.UUID('11111111-0000-0000-0000-000000000001')
        p2_id = uuid.UUID('11111111-0000-0000-0000-000000000002')
        p3_id = uuid.UUID('11111111-0000-0000-0000-000000000003')
        p4_id = uuid.UUID('11111111-0000-0000-0000-000000000004')
        
        providers = [
            Provider(
                id=p1_id,
                name="Signature Studio",
                category="yoga",
                description="Premium wellness space in Bole featuring Pilates, yoga, and HIIT cardio.",
                location_text="Bole, Addis Ababa",
                lat=9.0105, lng=38.7878,
                price_range="ETB 1,000 – 4,500",
                rating=4.8,
                cover_photo_url="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800",
                owner_user_id=users[1].id
            ),
            Provider(
                id=p2_id,
                name="Roots Fitness",
                category="gym",
                description="Modern gym known for its cleanliness, state-of-the-art equipment, and professional atmosphere.",
                location_text="Addis Ababa",
                lat=9.0054, lng=38.7868,
                price_range="ETB 800 – 3,500",
                rating=4.7,
                cover_photo_url="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
                owner_user_id=users[0].id
            ),
            Provider(
                id=p3_id,
                name="Adona Spa Lodge",
                category="spa",
                description="Highly regarded luxury spa offering a sanitary, tranquil environment for ultimate relaxation.",
                location_text="Addis Ababa",
                lat=9.0227, lng=38.7574,
                price_range="ETB 1,500 – 6,000",
                rating=4.9,
                cover_photo_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
                owner_user_id=users[0].id
            ),
            Provider(
                id=p4_id,
                name="Harmony Wellness",
                category="therapy",
                description="Culturally responsive mental health, counseling, and holistic well-being center.",
                location_text="Addis Ababa",
                lat=9.0201, lng=38.7598,
                price_range="ETB 1,200 – 5,000",
                rating=4.6,
                cover_photo_url="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800",
                owner_user_id=users[1].id
            )
        ]
        db.add_all(providers)

        print("🌱 Seeding Communities...")
        communities = [
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000001'),
                provider_id=p1_id,
                name="Signature Flow & HIIT",
                description="Community for Pilates and Yoga enthusiasts at Signature Studio.",
                category="yoga",
                member_count=85
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000002'),
                provider_id=p2_id,
                name="Roots Fit Squad",
                description="Dedicated fitness enthusiasts training at Roots Fitness.",
                category="gym",
                member_count=120
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000003'),
                provider_id=p3_id,
                name="Adona Tranquility Circle",
                description="A space for wellness, self-care routines, and relaxation tips.",
                category="spa",
                member_count=45
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000004'),
                provider_id=p4_id,
                name="Harmony Mental Wealth",
                description="Discussions and support for holistic and culturally responsive mental health.",
                category="therapy",
                member_count=210
            )
        ]
        db.add_all(communities)
        
        db.commit()
        print(f"✅ Seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
