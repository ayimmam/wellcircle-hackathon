"""Idempotent provider launch-state migration (mirror of alembic 014) for
Supabase. Run: cd backend && python apply_provider_launch_migration.py
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

    statements = [
        ("providers.is_coming_soon",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT TRUE;"),
        ("providers.sheets_export_enabled",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS sheets_export_enabled BOOLEAN NOT NULL DEFAULT FALSE;"),
        ("providers.facilities",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS facilities JSONB NULL;"),
        ("providers.navigation_tips",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS navigation_tips JSONB NULL;"),
    ]
    for label, sql in statements:
        try:
            cur.execute(sql)
            print(f"Applied: {label}")
        except Exception as e:
            print(f"Skipped {label}: {e}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
