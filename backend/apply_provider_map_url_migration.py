"""Idempotent provider map_url migration (mirror of alembic 017) for Supabase.
Run: cd backend && python apply_provider_map_url_migration.py
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
        cur.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS map_url VARCHAR(500) NULL;")
        print("Applied: providers.map_url")
    except Exception as e:
        print(f"Skipped providers.map_url: {e}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
