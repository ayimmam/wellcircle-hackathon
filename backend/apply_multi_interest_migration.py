"""Idempotent multi-interest migration (mirror of alembic 008) for Supabase.
Replaces the single interest_category column with a JSONB array
interest_categories, backfilling existing single values first.

Run: cd backend && python apply_multi_interest_migration.py
"""
import os
import psycopg2
from dotenv import load_dotenv


def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS interest_categories JSONB;")
        print("Applied: users.interest_categories")
    except Exception as e:
        print(f"Skipped users.interest_categories: {e}")

    try:
        cur.execute("""
            UPDATE users SET interest_categories = to_jsonb(ARRAY[interest_category])
            WHERE interest_category IS NOT NULL AND interest_categories IS NULL
        """)
        print(f"Backfilled {cur.rowcount} row(s) from interest_category")
    except Exception as e:
        print(f"Skipped backfill: {e}")

    try:
        cur.execute("ALTER TABLE users DROP COLUMN IF EXISTS interest_category;")
        print("Dropped: users.interest_category")
    except Exception as e:
        print(f"Skipped dropping interest_category: {e}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
