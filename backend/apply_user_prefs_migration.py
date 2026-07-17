"""Idempotent user-prefs migration (mirror of alembic 010) for Supabase.

Run: cd backend && python apply_user_prefs_migration.py
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
        ("users.phone_number",
         "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);"),
        ("users.time_format",
         "ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format VARCHAR(3);"),
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
