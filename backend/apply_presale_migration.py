"""Idempotent presale-promo migration (mirror of alembic 005) for Supabase.

Run: cd backend && python apply_presale_migration.py
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
        ("provider_promotions.audience",
         "ALTER TABLE provider_promotions ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'all';"),
        ("bookings.promotion_id",
         "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES provider_promotions(id);"),
        ("bookings.discount_etb",
         "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_etb INTEGER;"),
        ("idx_bookings_promotion_id",
         "CREATE INDEX IF NOT EXISTS idx_bookings_promotion_id ON bookings (promotion_id);"),
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
