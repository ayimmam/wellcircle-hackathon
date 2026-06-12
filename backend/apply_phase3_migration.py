"""Apply Phase 3 + re-engagement migrations idempotently against Supabase."""

import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

QUERIES = [
    # Phase 3 table alterations (002)
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES provider_events(id)",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50)",
    # Re-engagement (003)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reengagement_at TIMESTAMPTZ",
]


def main() -> None:
    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for query in QUERIES:
        try:
            cur.execute(query)
            print("OK:", query[:80])
        except Exception as exc:
            print("FAIL:", query[:80], "->", exc)

    cur.close()
    conn.close()
    print("Phase 3 migration applied.")


if __name__ == "__main__":
    main()
