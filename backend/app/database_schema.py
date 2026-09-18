"""Database schema migration utility to ensure PostgreSQL tables have all required columns."""

from sqlalchemy import text, inspect
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
        # Circles table — banner (alembic 018 never ran in production; the
        # circle_stories/circle_story_views tables below are the actual fix
        # for the "story posted but never visible" bug: create_story() wrote
        # to Cloudinary fine, then 500'd on the INSERT because these tables
        # never existed outside a local dev DB that had run `create_all`.
        "ALTER TABLE circles ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);",
        "ALTER TABLE circles ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255);",
        """CREATE TABLE IF NOT EXISTS circle_stories (
            id UUID PRIMARY KEY,
            circle_id UUID NOT NULL REFERENCES circles(id),
            user_id UUID NOT NULL REFERENCES users(id),
            image_url VARCHAR(500) NOT NULL,
            image_public_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            deleted_at TIMESTAMPTZ NULL
        );""",
        "CREATE INDEX IF NOT EXISTS ix_circle_stories_active ON circle_stories(circle_id, expires_at, deleted_at);",
        "CREATE INDEX IF NOT EXISTS ix_circle_stories_user ON circle_stories(user_id, created_at);",
        """CREATE TABLE IF NOT EXISTS circle_story_views (
            story_id UUID NOT NULL REFERENCES circle_stories(id),
            user_id UUID NOT NULL REFERENCES users(id),
            viewed_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (story_id, user_id)
        );""",
        # Public, user-level stories (WS1 — alembic 019). Same self-heal
        # rationale as circle_stories above.
        """CREATE TABLE IF NOT EXISTS stories (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id),
            image_url VARCHAR(500) NOT NULL,
            image_public_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            deleted_at TIMESTAMPTZ NULL
        );""",
        "CREATE INDEX IF NOT EXISTS ix_stories_active ON stories(expires_at, deleted_at);",
        "CREATE INDEX IF NOT EXISTS ix_stories_user ON stories(user_id, created_at);",
        """CREATE TABLE IF NOT EXISTS story_views (
            story_id UUID NOT NULL REFERENCES stories(id),
            user_id UUID NOT NULL REFERENCES users(id),
            viewed_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (story_id, user_id)
        );""",
        """INSERT INTO stories (id, user_id, image_url, image_public_id, created_at, expires_at, deleted_at)
        SELECT id, user_id, image_url, image_public_id, created_at, expires_at, deleted_at
        FROM circle_stories
        ON CONFLICT (id) DO NOTHING;""",
        """INSERT INTO story_views (story_id, user_id, viewed_at)
        SELECT story_id, user_id, viewed_at
        FROM circle_story_views
        ON CONFLICT (story_id, user_id) DO NOTHING;""",
        # Circle soft delete (WS8 — alembic 020).
        "ALTER TABLE circles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
        "CREATE INDEX IF NOT EXISTS ix_circles_deleted_at ON circles(deleted_at);",
        # Custom avatar (WS9 — alembic 021).
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_is_custom BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_public_id VARCHAR(255);",
        # Story likes (WS11b — Phase 24).
        """CREATE TABLE IF NOT EXISTS story_likes (
            story_id UUID NOT NULL REFERENCES stories(id),
            user_id UUID NOT NULL REFERENCES users(id),
            liked_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (story_id, user_id)
        );""",
        # Purchasable Well Circle reaction (WS15 — Phase 24).
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_wellcircle_reaction BOOLEAN NOT NULL DEFAULT FALSE;",
        # Engagement push tracking (WS14 — Phase 24).
        "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_push_sent BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS actor_user_id UUID;",
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

    report = schema_drift(engine)
    if report:
        logger.error("SCHEMA DRIFT detected — live schema is missing objects "
                      "the ORM expects: %s", report)


def schema_drift(engine) -> dict:
    """Compare the ORM's declared tables/columns against what actually
    exists on `engine`. Returns {} when nothing is missing.

    This is a read-only diagnostic, not a migration — it exists so a
    missing table (the class of bug `ensure_db_schema` above patches one
    incident at a time) shows up as one greppable ERROR log line on boot
    instead of a 500 on whichever endpoint happens to touch it first.
    Never raises: a failed introspection is logged and treated as "no
    drift detected" rather than blocking startup.
    """
    from app.database import Base

    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
    except Exception:
        logger.exception("schema_drift: failed to introspect database")
        return {}

    missing_tables = []
    missing_columns = {}

    for table in Base.metadata.tables.values():
        if table.name not in existing_tables:
            missing_tables.append(table.name)
            continue
        try:
            existing_columns = {c["name"] for c in inspector.get_columns(table.name)}
        except Exception:
            logger.exception("schema_drift: failed to inspect columns for %s", table.name)
            continue
        missing = [c.name for c in table.columns if c.name not in existing_columns]
        if missing:
            missing_columns[table.name] = missing

    report = {}
    if missing_tables:
        report["missing_tables"] = sorted(missing_tables)
    if missing_columns:
        report["missing_columns"] = missing_columns
    return report
