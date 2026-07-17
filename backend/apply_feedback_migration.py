"""Idempotent feedback-table migration (mirror of alembic 011) for Supabase.

Run: cd backend && python apply_feedback_migration.py
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
        ("feedback table",
         """CREATE TABLE IF NOT EXISTS feedback (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) NOT NULL,
                type VARCHAR(30) NOT NULL,
                message TEXT NOT NULL,
                context JSONB,
                status VARCHAR(20) NOT NULL DEFAULT 'new',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )"""),
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
