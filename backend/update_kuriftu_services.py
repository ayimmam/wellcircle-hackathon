"""Reseed the Kuriftu pilot-partner provider with confirmed real pricing
from the Wed Jul 15 gap-analysis call (docs/kuriftu-gap-analysis.md).

All of Kuriftu's standalone wellness services (including the two bundled
packages) are booked by phone/email, priced on-site after the service — not
through the app's online 3-step flow. Every service is flagged
`booking_method: "phone"`. `contact_phone` (+251 98 056 5656) and
`contact_email` (booking@kurifturesorts.com) were both confirmed directly by
Kuriftu — nothing here is fabricated.

Edits the existing "kuriftu" provider row in place (per
seed_kuriftu_placeholder.py's own instructions) rather than inserting a
second Kuriftu-named provider. Idempotent — safe to re-run.

Usage: DATABASE_URL=... python update_kuriftu_services.py
Requires apply_provider_contact_migration.py (or alembic 006) to have run
first, so the contact_email column exists.
"""
import json
import os

import psycopg2

CONTACT_EMAIL = "booking@kurifturesorts.com"
CONTACT_PHONE = "+251 98 056 5656"

# Confirmed Wed Jul 15 call with Kuriftu African Village — see
# docs/kuriftu-gap-analysis.md for the source pricing table.
SERVICES = [
    {"name": "Aroma Massage (90 min)", "price": 5500, "duration": "90 min", "booking_method": "phone"},
    {"name": "Aroma Massage (50 min)", "price": 4000, "duration": "50 min", "booking_method": "phone"},
    {"name": "Swedish Massage (90 min)", "price": 4500, "duration": "90 min", "booking_method": "phone"},
    {"name": "Swedish Massage (30 min)", "price": 2000, "duration": "30 min", "booking_method": "phone"},
    {"name": "Deep Tissue Massage (50 min)", "price": 3000, "duration": "50 min", "booking_method": "phone"},
    {"name": "Steam & Sauna", "price": 2500, "duration": "2 hours", "booking_method": "phone"},
    {"name": "Morocco Bath (90 min)", "price": 5000, "duration": "90 min", "booking_method": "phone"},
    {"name": "Pedicure (Normal)", "price": 2000, "duration": "—", "booking_method": "phone"},
    {"name": "Pedicure (Special)", "price": 2600, "duration": "—", "booking_method": "phone"},
    {"name": "Manicure (Normal)", "price": 600, "duration": "—", "booking_method": "phone"},
    {"name": "Manicure (Special)", "price": 800, "duration": "—", "booking_method": "phone"},
    {"name": "Swim + Steam & Sauna (package)", "price": 3600, "duration": "—", "booking_method": "phone"},
    {"name": "Massage + Steam & Sauna (package)", "price": 4950, "duration": "—", "booking_method": "phone"},
]

DESCRIPTION = (
    "Pilot partner resort offering spa, sauna, and wellness experiences. "
    "Wellness services are booked directly with Kuriftu (not paid in-app) — "
    "contact them to schedule; payment is collected on-site after your visit."
)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    from dotenv import load_dotenv
    load_dotenv()
    DATABASE_URL = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT id, name FROM providers WHERE name ILIKE %s", ("%kuriftu%",))
row = cur.fetchone()
if not row:
    print("No provider matching 'kuriftu' found — run seed_kuriftu_placeholder.py first.")
else:
    provider_id, name = row
    prices = [s["price"] for s in SERVICES]
    price_range = f"ETB {min(prices):,} – {max(prices):,}"
    cur.execute(
        """UPDATE providers
           SET services = %s, description = %s, price_range = %s,
               contact_email = %s, contact_phone = %s
           WHERE id = %s""",
        (json.dumps(SERVICES), DESCRIPTION, price_range, CONTACT_EMAIL, CONTACT_PHONE, str(provider_id)),
    )
    print(f"Updated {name} ({provider_id}) with {len(SERVICES)} confirmed phone-booked services.")

conn.commit()
cur.close()
conn.close()
print("Done.")
