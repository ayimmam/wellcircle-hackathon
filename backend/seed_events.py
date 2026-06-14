import os
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.provider_event import ProviderEvent
from app.models.provider import Provider

def seed_events():
    db = SessionLocal()
    
    # Check if there are any providers
    provider = db.query(Provider).first()
    if not provider:
        print("No providers found to attach events to.")
        return

    # Delete existing events just in case
    db.query(ProviderEvent).delete()

    now = datetime.now(timezone.utc)
    events = [
        ProviderEvent(
            provider_id=provider.id,
            service_name="Wellness Hackathon at Kuriftu",
            description="Join us for a 3-day immersive wellness hackathon at Kuriftu Resort. Build, connect, and recharge.",
            starts_at=now + timedelta(days=5),
            ends_at=now + timedelta(days=7),
            capacity=100,
            spots_remaining=100,
            price_etb=1500,
            is_boosted=True
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Sunrise Yoga Session",
            description="Start your day with an energizing sunrise yoga session focusing on breath and movement.",
            starts_at=now + timedelta(days=1, hours=8),
            ends_at=now + timedelta(days=1, hours=9),
            capacity=20,
            spots_remaining=15,
            price_etb=300
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="HIIT Bootcamp",
            description="Intense 45-minute full body workout to push your limits.",
            starts_at=now + timedelta(days=2, hours=18),
            ends_at=now + timedelta(days=2, hours=19),
            capacity=25,
            spots_remaining=5,
            price_etb=400
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Mindfulness & Meditation Workshop",
            description="Learn techniques to stay grounded and manage daily stress.",
            starts_at=now + timedelta(days=3, hours=10),
            ends_at=now + timedelta(days=3, hours=12),
            capacity=15,
            spots_remaining=15,
            price_etb=600
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Nutrition Masterclass: Local Superfoods",
            description="Discover how to incorporate Ethiopian superfoods like Teff and Moringa into your diet.",
            starts_at=now + timedelta(days=4, hours=14),
            ends_at=now + timedelta(days=4, hours=15),
            capacity=30,
            spots_remaining=28,
            price_etb=500
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Couples Spa Retreat",
            description="A guided relaxation experience for partners.",
            starts_at=now + timedelta(days=6, hours=16),
            ends_at=now + timedelta(days=6, hours=18),
            capacity=10,
            spots_remaining=2,
            price_etb=2500
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Evening Pilates Core Focus",
            description="Strengthen your core and improve posture in this evening class.",
            starts_at=now + timedelta(days=2, hours=19),
            ends_at=now + timedelta(days=2, hours=20),
            capacity=20,
            spots_remaining=10,
            price_etb=350
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Corporate Wellness Seminar",
            description="Tips and strategies for maintaining health in a busy work environment.",
            starts_at=now + timedelta(days=8, hours=9),
            ends_at=now + timedelta(days=8, hours=11),
            capacity=50,
            spots_remaining=45,
            price_etb=1000
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Outdoor Running Club - Entoto",
            description="Join our weekend running group at Entoto Park.",
            starts_at=now + timedelta(days=7, hours=7),
            ends_at=now + timedelta(days=7, hours=9),
            capacity=40,
            spots_remaining=30,
            price_etb=150
        ),
        ProviderEvent(
            provider_id=provider.id,
            service_name="Sound Bath Therapy",
            description="Deep relaxation using crystal bowls and traditional instruments.",
            starts_at=now + timedelta(days=9, hours=18),
            ends_at=now + timedelta(days=9, hours=19),
            capacity=12,
            spots_remaining=0,
            price_etb=800
        )
    ]

    db.bulk_save_objects(events)
    db.commit()
    print(f"Successfully seeded {len(events)} events!")
    db.close()

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    seed_events()
