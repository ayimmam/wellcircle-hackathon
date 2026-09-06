"""Pilot partner: mark Kuriftu provider(s) as featured and boost their events
so they lead the Home hero, featured carousel, Explore list, and events carousel.

Idempotent — safe to re-run. Usage: DATABASE_URL=... python mark_kuriftu_featured.py
"""
import os

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    from dotenv import load_dotenv
    load_dotenv()
    DATABASE_URL = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute(
    "UPDATE providers SET is_featured = TRUE WHERE name ILIKE %s OR name ILIKE %s RETURNING id, name",
    ("%kuriftu%", "%boston day spa%"),
)
providers = cur.fetchall()
for pid, name in providers:
    print(f"featured provider: {name} ({pid})")

if providers:
    cur.execute(
        "UPDATE provider_events SET is_boosted = TRUE WHERE provider_id = ANY(%s::uuid[]) RETURNING id, service_name",
        ([str(pid) for pid, _ in providers],),
    )
    for eid, title in cur.fetchall():
        print(f"boosted event: {title} ({eid})")
else:
    print("No provider matching 'kuriftu' or 'boston day spa' found — seed it first.")

conn.commit()
cur.close()
conn.close()
print("Done.")
