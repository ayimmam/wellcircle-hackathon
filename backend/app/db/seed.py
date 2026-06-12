"""
Seed script — populates test users, providers, and communities for development.
Run: python -m app.db.seed
"""
import uuid
from datetime import datetime, timezone, timedelta

from app.database import SessionLocal, engine, Base
from app.models import User, Provider, Community, Circle, CircleMember, Post, Reaction


def seed():
    """Seed the database with test data."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Using db.merge to append/upsert without deleting existing data

        print("🌱 Seeding Users...")
        
        existing_handles = {u.telegram_handle: u for u in db.query(User).all() if u.telegram_handle}
        existing_tids = {u.telegram_id: u for u in db.query(User).all() if u.telegram_id}
        
        def get_or_new(handle, default_id, default_tid):
            if handle in existing_handles:
                return existing_handles[handle].id, existing_handles[handle].telegram_id
            if default_tid in existing_tids:
                return existing_tids[default_tid].id, default_tid
            return default_id, default_tid

        u1_id, t1 = get_or_new("meron_fitness", uuid.UUID('00000000-0000-0000-0000-000000000001'), 100000001)
        u2_id, t2 = get_or_new("dawit_gym", uuid.UUID('00000000-0000-0000-0000-000000000002'), 100000004) # Preserving the old 100000004
        u3_id, t3 = get_or_new("sara_runner", uuid.UUID('00000000-0000-0000-0000-000000000003'), 100000003)
        u4_id, t4 = get_or_new("abel_strong", uuid.UUID('00000000-0000-0000-0000-000000000004'), 100000005)
        u5_id, t5 = get_or_new("hana_zen", uuid.UUID('00000000-0000-0000-0000-000000000005'), 100000006)
        u6_id, t6 = get_or_new("yonas_fit", uuid.UUID('00000000-0000-0000-0000-000000000006'), 100000007)
        
        users_to_seed = [
            User(id=u1_id, telegram_id=t1, telegram_handle="meron_fitness", name="Meron Tadesse", goal="Lose weight and stay consistent", interest_category="yoga", exercise_frequency="sometimes", points_balance=120, is_onboarded=True, last_activity_at=datetime.now(timezone.utc) - timedelta(hours=2)),
            User(id=u2_id, telegram_id=t2, telegram_handle="dawit_gym", name="Dawit", goal="Build muscle mass", interest_category="gym", exercise_frequency="daily", points_balance=720, is_onboarded=True, is_provider=True, last_activity_at=datetime.now(timezone.utc)),
            User(id=u3_id, telegram_id=t3, telegram_handle="sara_runner", name="Sara", goal="Run a marathon", interest_category="running", exercise_frequency="regular", points_balance=310, is_onboarded=True, last_activity_at=datetime.now(timezone.utc)),
            User(id=u4_id, telegram_id=t4, telegram_handle="abel_strong", name="Abel", goal="Get stronger", interest_category="gym", exercise_frequency="regular", points_balance=280, is_onboarded=True, last_activity_at=datetime.now(timezone.utc)),
            User(id=u5_id, telegram_id=t5, telegram_handle="hana_zen", name="Hana", goal="Flexibility and mindfulness", interest_category="yoga", exercise_frequency="daily", points_balance=190, is_onboarded=True, last_activity_at=datetime.now(timezone.utc)),
            User(id=u6_id, telegram_id=t6, telegram_handle="yonas_fit", name="Yonas", goal="General fitness", interest_category="gym", exercise_frequency="sometimes", points_balance=150, is_onboarded=True, last_activity_at=datetime.now(timezone.utc)),
        ]
        for user in users_to_seed:
            db.merge(user)
        db.commit()
        
        users = [db.query(User).get(u1_id), db.query(User).get(u2_id)]

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
        for provider in providers:
            db.merge(provider)

        p5_id = uuid.UUID('11111111-0000-0000-0000-000000000005')
        p6_id = uuid.UUID('11111111-0000-0000-0000-000000000006')
        p7_id = uuid.UUID('11111111-0000-0000-0000-000000000007')
        p8_id = uuid.UUID('11111111-0000-0000-0000-000000000008')
        p9_id = uuid.UUID('11111111-0000-0000-0000-000000000009')
        p10_id = uuid.UUID('11111111-0000-0000-0000-000000000010')

        extra_providers = [
            Provider(
                id=p5_id,
                name="Nourish Ethiopia",
                category="nutrition",
                description="Registered dietitians specialising in Ethiopian food culture and modern sports nutrition. Meal plans that work with injera, not against it.",
                location_text="Sarbet, Nifas Silk-Lafto Sub-City, Addis Ababa",
                lat=8.9812, lng=38.7654,
                price_range="ETB 1,200 – 8,000",
                rating=4.8,
                cover_photo_url="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
                owner_user_id=users[0].id
            ),
            Provider(
                id=p6_id,
                name="Green Plate Kitchen",
                category="nutrition",
                description="Meal prep subscription and nutrition coaching service in Megenagna. Weekly healthy Ethiopian and Mediterranean meal boxes.",
                location_text="Megenagna, Yeka Sub-City, Addis Ababa",
                lat=9.0315, lng=38.7934,
                price_range="ETB 2,000 – 6,000",
                rating=4.4,
                cover_photo_url="https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
                owner_user_id=users[1].id
            ),
            Provider(
                id=p7_id,
                name="Haile Spa & Wellness",
                category="spa",
                description="Luxury urban spa in Bole offering full-body massages, traditional Ethiopian coffee scrubs, hammam rituals, and facial treatments.",
                location_text="Bole Atlas, Bole Sub-City, Addis Ababa",
                lat=9.0089, lng=38.7912,
                price_range="ETB 1,500 – 6,500",
                rating=4.8,
                cover_photo_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
                owner_user_id=users[0].id
            ),
            Provider(
                id=p8_id,
                name="Piassa Heritage Hammam",
                category="spa",
                description="Authentic steam and hammam experience in the historic Piassa neighbourhood. Traditional Ethiopian and North African bathing rituals.",
                location_text="Piassa (Arada), Arada Sub-City, Addis Ababa",
                lat=9.0379, lng=38.7542,
                price_range="ETB 400 – 3,000",
                rating=4.5,
                cover_photo_url="https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800",
                owner_user_id=users[1].id
            ),
            Provider(
                id=p9_id,
                name="Biruh Mind Wellness",
                category="therapy",
                description="Addis Ababa's first Telegram-native mental wellness clinic. Licensed psychotherapists and counsellors. Bilingual: Amharic & English.",
                location_text="Kazanchis, Kirkos Sub-City, Addis Ababa",
                lat=9.0201, lng=38.7598,
                price_range="ETB 1,500 – 5,000",
                rating=4.9,
                cover_photo_url="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800",
                owner_user_id=users[0].id
            ),
            Provider(
                id=p10_id,
                name="MoveMind Running Club",
                category="gym",
                description="Community-first running club training at altitude (2,355m). Weekly group runs around Entoto and the ring road.",
                location_text="Addis Ababa Stadium, Kirkos Sub-City",
                lat=9.0261, lng=38.7505,
                price_range="ETB 300 – 1,500",
                rating=4.7,
                cover_photo_url="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800",
                owner_user_id=users[1].id
            )
        ]

        for provider in extra_providers:
            db.merge(provider)

        db.flush()

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
        for community in communities:
            db.merge(community)

        extra_communities = [
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000005'),
                provider_id=p5_id,
                name="Nourish Community",
                description="Registered dietitians specialising in Ethiopian food culture and modern sports nutrition. Meal plans that work with injera, not against it.",
                category="nutrition",
                member_count=61
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000006'),
                provider_id=p6_id,
                name="Green Plate Members",
                description="Meal prep subscription and nutrition coaching service in Megenagna. Weekly healthy Ethiopian and Mediterranean meal boxes.",
                category="nutrition",
                member_count=22
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000007'),
                provider_id=p7_id,
                name="Haile Spa Circle",
                description="Luxury urban spa in Bole offering full-body massages, traditional Ethiopian coffee scrubs, hammam rituals, and facial treatments.",
                category="spa",
                member_count=54
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000008'),
                provider_id=p8_id,
                name="Piassa Hammam Club",
                description="Authentic steam and hammam experience in the historic Piassa neighbourhood. Traditional Ethiopian and North African bathing rituals.",
                category="spa",
                member_count=18
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000009'),
                provider_id=p9_id,
                name="Biruh Mind Space",
                description="Addis Ababa's first Telegram-native mental wellness clinic. Licensed psychotherapists and counsellors. Bilingual: Amharic & English.",
                category="therapy",
                member_count=96
            ),
            Community(
                id=uuid.UUID('22222222-0000-0000-0000-000000000010'),
                provider_id=p10_id,
                name="MoveMind Runners",
                description="Community-first running club training at altitude (2,355m). Weekly group runs around Entoto and the ring road.",
                category="gym",
                member_count=142
            )
        ]
        
        for community in extra_communities:
            db.merge(community)

        
        db.flush()

        print("🌱 Seeding Circles & Leaderboards...")
        circle1_id = uuid.UUID('33333333-0000-0000-0000-000000000001')
        circle1 = Circle(
            id=circle1_id,
            name="Addis Morning Runners",
            description="We run every morning at 6 AM around Meskel Square.",
            owner_id=u2_id
        )
        circle2_id = uuid.UUID('33333333-0000-0000-0000-000000000002')
        circle2 = Circle(
            id=circle2_id,
            name="Zen Seekers",
            description="Mindfulness, yoga, and finding peace in the chaotic city.",
            owner_id=u1_id
        )
        db.merge(circle1)
        db.merge(circle2)
        db.flush()

        circle_members = [
            CircleMember(circle_id=circle1_id, user_id=u2_id, weekly_points=120),
            CircleMember(circle_id=circle1_id, user_id=u1_id, weekly_points=85),
            CircleMember(circle_id=circle1_id, user_id=u3_id, weekly_points=70),
            CircleMember(circle_id=circle1_id, user_id=u4_id, weekly_points=55),
            CircleMember(circle_id=circle2_id, user_id=u5_id, weekly_points=40),
            CircleMember(circle_id=circle1_id, user_id=u6_id, weekly_points=30),
        ]
        for member in circle_members:
            db.merge(member)
        db.flush()

        print("🌱 Seeding Posts & Reactions...")
        posts = [
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000001'),
                circle_id=circle1_id,
                user_id=u1_id,
                content="Just finished a 5K run! Feeling great! 🏃‍♀️",
                created_at=datetime.now(timezone.utc) - timedelta(hours=1)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000003'),
                circle_id=circle1_id,
                user_id=u2_id,
                content="Dawit checked in for their workout today! 💪 Earned 10 Legacy Points.",
                created_at=datetime.now(timezone.utc) - timedelta(hours=2)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000002'),
                circle_id=circle2_id,
                user_id=u2_id,
                content="Anyone up for a group yoga session tomorrow at 7 AM?",
                created_at=datetime.now(timezone.utc) - timedelta(hours=4)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000004'),
                circle_id=circle1_id,
                user_id=u3_id,
                content="Sara completed the '30-Day Step Challenge'! 🏆 Phenomenal effort!",
                created_at=datetime.now(timezone.utc) - timedelta(hours=12)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000005'),
                circle_id=circle2_id,
                user_id=u4_id,
                content="Abel high-fived Meron! 🙌 Keep up the momentum!",
                created_at=datetime.now(timezone.utc) - timedelta(hours=18)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000006'),
                circle_id=circle2_id,
                user_id=u5_id,
                content="I finally managed to hold a handstand for 10 seconds today! So happy with the progress.",
                created_at=datetime.now(timezone.utc) - timedelta(hours=24)
            ),
            Post(
                id=uuid.UUID('44444444-0000-0000-0000-000000000007'),
                circle_id=circle1_id,
                user_id=u6_id,
                content="Yonas just joined the circle! Say hello! 👋",
                created_at=datetime.now(timezone.utc) - timedelta(hours=48)
            )
        ]
        for post in posts:
            db.merge(post)
        db.flush()

        reactions = [
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000001'), user_id=u2_id, emoji="🔥", points_gifted=0),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000001'), user_id=u2_id, emoji="🔥", points_gifted=0),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000001'), user_id=u3_id, emoji="👏", points_gifted=5),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000003'), user_id=u1_id, emoji="🔥", points_gifted=0),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000003'), user_id=u4_id, emoji="🙌", points_gifted=10),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000002'), user_id=u1_id, emoji="🔥", points_gifted=0),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000004'), user_id=u2_id, emoji="🎉", points_gifted=50),
            Reaction(post_id=uuid.UUID('44444444-0000-0000-0000-000000000006'), user_id=u1_id, emoji="🔥", points_gifted=15),
        ]
        for reaction in reactions:
            db.merge(reaction)

        db.commit()
        print(f"✅ Seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
