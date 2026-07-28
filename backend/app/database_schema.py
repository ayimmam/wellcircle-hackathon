"""Database schema migration utility to ensure PostgreSQL tables have all required columns."""

from sqlalchemy import text
from app.utils.logger import get_logger

logger = get_logger("wellcircle.schema")


def ensure_db_schema(engine):
    """Safely executes ALTER TABLE ADD COLUMN IF NOT EXISTS for PostgreSQL database."""
    if "sqlite" in str(engine.url):
        return

    statements = [
        # Posts table
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS circle_id UUID;",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_system_event BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS activity_type VARCHAR(30);",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6, 2);",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_min INTEGER;",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);",
        # Users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_privacy VARCHAR(20) DEFAULT 'public';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_trainer BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_trainer_expires_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_access_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_visible_stats JSONB;",
        # Trainer Verifications table
        "ALTER TABLE trainer_verifications ADD COLUMN IF NOT EXISTS certificate_public_id VARCHAR(255);",
        "ALTER TABLE trainer_verifications ADD COLUMN IF NOT EXISTS payment_receipt_public_id VARCHAR(255);",
    ]

    try:
        with engine.begin() as conn:
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                except Exception as stmt_err:
                    logger.warning("Migration statement skipped: %s (err: %s)", stmt, stmt_err)
        logger.info("Database schema columns checked and ensured successfully.")
    except Exception as exc:
        logger.exception("Failed to run schema migration check: %s", exc)
