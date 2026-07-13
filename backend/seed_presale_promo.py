"""Pilot presale promo: seed a first-time-visitor discount on the Kuriftu
provider so the presale + re-entry loop is demoable in test.

Idempotent — updates the existing presale promo row if one is already active
instead of inserting a duplicate. Usage: DATABASE_URL=... python seed_presale_promo.py
Requires apply_presale_migration.py (or alembic 005) to have run first.
"""
import os

import psycopg2

HEADLINE = "Presale: 20% off your first visit"
DISCOUNT_PCT = 20
VALID_DAYS = 14

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
    cur.execute(
        """SELECT id FROM provider_promotions
           WHERE provider_id = %s AND audience = 'first_time' AND is_active = TRUE""",
        (str(provider_id),),
    )
    existing = cur.fetchone()
    if existing:
        cur.execute(
            """UPDATE provider_promotions
               SET headline = %s, discount_pct = %s,
                   valid_until = NOW() + make_interval(days => %s)
               WHERE id = %s RETURNING id""",
            (HEADLINE, DISCOUNT_PCT, VALID_DAYS, existing[0]),
        )
        print(f"Updated presale promo {existing[0]} on {name}")
    else:
        cur.execute(
            """INSERT INTO provider_promotions
               (id, provider_id, headline, discount_pct, valid_until, is_active, audience, created_at)
               VALUES (gen_random_uuid(), %s, %s, %s, NOW() + make_interval(days => %s), TRUE, 'first_time', NOW())
               RETURNING id""",
            (str(provider_id), HEADLINE, DISCOUNT_PCT, VALID_DAYS),
        )
        print(f"Created presale promo {cur.fetchone()[0]} on {name}")

conn.commit()
cur.close()
conn.close()
print("Done.")
