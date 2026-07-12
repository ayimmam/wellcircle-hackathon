"""One-time placeholder seed for the Kuriftu pilot-partner provider.

This is a STAND-IN until Bezi's Tue Jul 14 service-list audit lands (see
docs/USER_FLOW_AUDIT.md). Once the real Kuriftu service list is seeded,
either edit this provider's services/description in place or replace it
entirely — this script only inserts when no "kuriftu" provider exists yet,
so it is a safe no-op to leave lying around after the real data lands.

After running this, `mark_kuriftu_featured.py` becomes a no-op re-run
(is_featured is already set here) — keep using it once Kuriftu events exist.

Usage: DATABASE_URL=... python seed_kuriftu_placeholder.py
"""
import json
import os
import uuid

import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

cur.execute("SELECT id FROM providers WHERE name ILIKE %s", ("%kuriftu%",))
existing = cur.fetchone()

if existing:
    print(f"A Kuriftu provider already exists ({existing[0]}) — skipping placeholder insert.")
else:
    services = [
        {"name": "Spa & Wellness Package", "price": 3500, "duration": "90 min"},
        {"name": "Resort Day Pass (Pool + Lounge)", "price": 1800, "duration": "1 day"},
        {"name": "Couples Massage", "price": 4200, "duration": "60 min"},
    ]
    provider_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO providers
            (id, name, category, description, location_text, price_range,
             rating, cover_photo_url, services, status, is_featured,
             created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', TRUE, now(), now())
        """,
        (
            provider_id,
            "Kuriftu Resort & Spa",
            "spa",
            "[Placeholder — replace with Bezi's Tue Jul 14 service audit] "
            "Pilot partner resort offering spa, pool, and wellness experiences.",
            "Bishoftu, Ethiopia",
            "ETB 1,800 – 4,200",
            4.9,
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
            json.dumps(services),
        ),
    )
    print(f"Inserted placeholder Kuriftu Resort & Spa provider ({provider_id}), is_featured=TRUE.")

cur.close()
conn.close()
