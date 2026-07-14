"""Idempotent booking-group migration (mirror of alembic 007) for Supabase.
Run: cd backend && python apply_booking_group_migration.py
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
        ("bookings.booking_group_id",
         "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_group_id UUID;"),
        ("idx_bookings_group_id",
         "CREATE INDEX IF NOT EXISTS idx_bookings_group_id ON bookings (booking_group_id);"),
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
