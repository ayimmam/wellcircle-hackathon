"""Idempotent migration for circle stories + circle banners.

Same shape as apply_circle_migration.py: safe to re-run against a live
DATABASE_URL, so it can be applied to Supabase without an Alembic history.
Mirrors alembic/versions/018_circle_stories_and_banner.py.
"""
import os

import psycopg2
from dotenv import load_dotenv

STATEMENTS = [
    ("circles.banner_url",
     "ALTER TABLE circles ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);"),
    ("circles.banner_public_id",
     "ALTER TABLE circles ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255);"),
    ("circle_stories", """
        CREATE TABLE IF NOT EXISTS circle_stories (
            id UUID PRIMARY KEY,
            circle_id UUID NOT NULL REFERENCES circles(id),
            user_id UUID NOT NULL REFERENCES users(id),
            image_url VARCHAR(500) NOT NULL,
            image_public_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            deleted_at TIMESTAMPTZ
        );
    """),
    ("ix_circle_stories_active", """
        CREATE INDEX IF NOT EXISTS ix_circle_stories_active
        ON circle_stories (circle_id, expires_at, deleted_at);
    """),
    ("ix_circle_stories_user", """
        CREATE INDEX IF NOT EXISTS ix_circle_stories_user
        ON circle_stories (user_id, created_at);
    """),
    ("circle_story_views", """
        CREATE TABLE IF NOT EXISTS circle_story_views (
            story_id UUID NOT NULL REFERENCES circle_stories(id),
            user_id UUID NOT NULL REFERENCES users(id),
            viewed_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (story_id, user_id)
        );
    """),
]


def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for label, sql in STATEMENTS:
        try:
            cur.execute(sql)
            print(f"Applied: {label}")
        except Exception as exc:
            print(f"Skipped {label}: {exc}")

    cur.close()
    conn.close()
    print("Stories + banner migration complete.")


if __name__ == "__main__":
    run_migration()
