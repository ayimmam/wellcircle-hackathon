"""Add the provider community-channel columns used by the event RSVP screen.

Mirrors alembic/versions/022_provider_community_channels.py for the ad-hoc
path the other apply_*.py scripts use. Idempotent — ADD COLUMN IF NOT EXISTS,
so a second run is a no-op.

Usage:
    cd backend && DATABASE_URL=... python apply_community_channels_migration.py
"""
import os

import psycopg2
from dotenv import load_dotenv

COLUMNS = (
    ("contact_telegram", "VARCHAR(100)"),
    ("contact_instagram", "VARCHAR(100)"),
    ("contact_website", "VARCHAR(255)"),
)


def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for name, coltype in COLUMNS:
        cur.execute(f"ALTER TABLE providers ADD COLUMN IF NOT EXISTS {name} {coltype};")
        print(f"providers.{name} present.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
