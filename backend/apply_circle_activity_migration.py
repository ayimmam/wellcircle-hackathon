"""Idempotent circle-activity migration (mirror of alembic 009) for Supabase.

Run: cd backend && python apply_circle_activity_migration.py
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
        ("posts.activity_type",
         "ALTER TABLE posts ADD COLUMN IF NOT EXISTS activity_type VARCHAR(30);"),
        ("posts.distance_km",
         "ALTER TABLE posts ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2);"),
        ("posts.duration_min",
         "ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_min INTEGER;"),
        ("posts.photo_url",
         "ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);"),
        ("post_comments.parent_comment_id",
         "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES post_comments(id);"),
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
