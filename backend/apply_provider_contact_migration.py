"""Idempotent provider contact-info migration (mirror of alembic 006) for
Supabase. Run: cd backend && python apply_provider_contact_migration.py
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
        ("providers.contact_phone",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30);"),
        ("providers.contact_email",
         "ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);"),
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
