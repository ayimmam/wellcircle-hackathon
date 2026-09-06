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
        "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_privacy VARCHAR(20) DEFAULT 'public';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_trainer BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_trainer_expires_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_access_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_visible_stats JSONB;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;",
        # Trainer Verifications table
        "ALTER TABLE trainer_verifications ADD COLUMN IF NOT EXISTS certificate_public_id VARCHAR(255);",
        "ALTER TABLE trainer_verifications ADD COLUMN IF NOT EXISTS payment_receipt_public_id VARCHAR(255);",
        # Auth Identities table (WEB_APP_PLAN Phase 1)
        """CREATE TABLE IF NOT EXISTS auth_identities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(20) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            email VARCHAR(255) NULL,
            verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_auth_identity_provider_subject UNIQUE (provider, subject)
        );""",
        "CREATE INDEX IF NOT EXISTS ix_auth_identities_user_id ON auth_identities(user_id);",
        """INSERT INTO auth_identities (id, user_id, provider, subject, verified_at, created_at)
        SELECT gen_random_uuid(), id, 'telegram', telegram_id::text, COALESCE(created_at, NOW()), COALESCE(created_at, NOW())
        FROM users WHERE telegram_id IS NOT NULL
        ON CONFLICT (provider, subject) DO NOTHING;""",
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
