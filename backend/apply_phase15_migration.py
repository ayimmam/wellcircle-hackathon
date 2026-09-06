"""Idempotent production migration mirroring Alembic revision 012."""
import os

import psycopg2
from dotenv import load_dotenv


STATEMENTS = [
    """ALTER TABLE users
       ADD COLUMN IF NOT EXISTS bio TEXT,
       ADD COLUMN IF NOT EXISTS profile_privacy VARCHAR(20) NOT NULL DEFAULT 'public',
       ADD COLUMN IF NOT EXISTS is_verified_trainer BOOLEAN NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS verified_trainer_expires_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT,
       ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
       ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
       ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS strava_visible_stats JSONB""",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_users_strava_athlete_id
       ON users(strava_athlete_id) WHERE strava_athlete_id IS NOT NULL""",
    """ALTER TABLE circles
       ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS price_etb INTEGER,
       ADD COLUMN IF NOT EXISTS paid_circle_status VARCHAR(20) NOT NULL DEFAULT 'free',
       ADD COLUMN IF NOT EXISTS paid_circle_applied_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS total_revenue_etb INTEGER NOT NULL DEFAULT 0""",
    """CREATE TABLE IF NOT EXISTS followers (
       follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
       following_id UUID REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (follower_id, following_id),
       CONSTRAINT ck_followers_not_self CHECK (follower_id <> following_id))""",
    """CREATE INDEX IF NOT EXISTS ix_followers_following_created ON followers(following_id, created_at)""",
    """CREATE INDEX IF NOT EXISTS ix_followers_follower_created ON followers(follower_id, created_at)""",
    """CREATE TABLE IF NOT EXISTS trainer_verifications (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
       certificate_url TEXT NOT NULL, certificate_public_id TEXT,
       status VARCHAR(20) NOT NULL DEFAULT 'pending', rejection_reason TEXT,
       payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
       payment_receipt_url TEXT, payment_receipt_public_id TEXT,
       reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMPTZ)""",
    """CREATE TABLE IF NOT EXISTS circle_subscriptions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       circle_id UUID REFERENCES circles(id) NOT NULL,
       user_id UUID REFERENCES users(id) NOT NULL,
       period_start TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL,
       amount_etb INTEGER NOT NULL, status VARCHAR(20) NOT NULL,
       receipt_url TEXT, receipt_public_id TEXT, creator_approved_at TIMESTAMPTZ,
       escalated_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT uq_circle_subscription_period UNIQUE(circle_id, user_id, period_start))""",
    """ALTER TABLE circle_subscriptions ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ""",
    """CREATE INDEX IF NOT EXISTS ix_circle_subscriptions_circle_id ON circle_subscriptions(circle_id)""",
    """CREATE INDEX IF NOT EXISTS ix_circle_subscriptions_user_id ON circle_subscriptions(user_id)""",
    """CREATE TABLE IF NOT EXISTS circle_revenue_ledger (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       circle_id UUID REFERENCES circles(id) NOT NULL,
       subscription_id UUID REFERENCES circle_subscriptions(id) NOT NULL UNIQUE,
       total_amount_etb INTEGER NOT NULL, creator_amount_etb INTEGER NOT NULL,
       platform_fee_etb INTEGER NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT ck_revenue_split_sums
       CHECK (creator_amount_etb + platform_fee_etb = total_amount_etb))""",
    """CREATE INDEX IF NOT EXISTS ix_circle_revenue_ledger_circle_id ON circle_revenue_ledger(circle_id)""",
    """CREATE TABLE IF NOT EXISTS strava_activity_cache (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
       strava_activity_id BIGINT NOT NULL UNIQUE, activity_type VARCHAR(50) NOT NULL,
       distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
       moving_time_seconds INTEGER NOT NULL DEFAULT 0,
       elapsed_time_seconds INTEGER NOT NULL DEFAULT 0,
       total_elevation_gain DOUBLE PRECISION NOT NULL DEFAULT 0,
       calories DOUBLE PRECISION, start_date TIMESTAMPTZ NOT NULL,
       name VARCHAR(255) NOT NULL,
       fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE INDEX IF NOT EXISTS ix_strava_activity_cache_user_id ON strava_activity_cache(user_id)""",
]


def run_migration():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not found")
    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            for statement in STATEMENTS:
                cursor.execute(statement)
    print("Phase 15 migration applied successfully.")


if __name__ == "__main__":
    run_migration()
