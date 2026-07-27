"""Indexes for the read paths the Mini App hits on every screen.

Each index below backs a query that runs on app open or on a poll, and that
was previously a sequential scan. Created CONCURRENTLY so applying this to a
live Supabase database doesn't take a write lock on the table.

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union

from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (name, table, columns) — plain tuples so the same list drives up and down.
INDEXES = [
    # Home/Explore: the upcoming-events window, filtered on is_cancelled and
    # ordered by is_boosted then starts_at.
    ("ix_provider_events_window", "provider_events", "(is_cancelled, starts_at)"),
    ("ix_provider_events_provider_starts", "provider_events", "(provider_id, starts_at)"),

    # Membership lookups: "which communities has this user joined" runs on
    # every Home and Community render.
    ("ix_community_members_user", "community_members", "(user_id)"),

    # Community feed poll + the today's-check-in probe, both of which filter
    # community_id and range-scan created_at.
    ("ix_community_feed_events_community_created", "community_feed_events",
     "(community_id, created_at DESC)"),
    ("ix_community_feed_events_user_type_created", "community_feed_events",
     "(user_id, event_type, created_at DESC)"),

    # Weekly leaderboard sums positive transactions in a trailing 7-day window.
    ("ix_point_transactions_created_amount", "point_transactions", "(created_at, amount)"),
    ("ix_point_transactions_user_created", "point_transactions", "(user_id, created_at)"),

    # Header polls the unread badge; the count filters on both columns.
    ("ix_user_notifications_user_read", "user_notifications", "(user_id, is_read)"),
    ("ix_user_notifications_user_created", "user_notifications", "(user_id, created_at DESC)"),

    # Circle and community post feeds.
    ("ix_posts_circle_created", "posts", "(circle_id, created_at DESC)"),
    ("ix_posts_community_created", "posts", "(community_id, created_at DESC)"),
    ("ix_reactions_post", "reactions", "(post_id)"),
    ("ix_post_comments_post_created", "post_comments", "(post_id, created_at)"),

    # Circle membership and leaderboard.
    ("ix_circle_members_user", "circle_members", "(user_id)"),

    # Provider directory lists active providers only.
    ("ix_providers_status", "providers", "(status)"),
    ("ix_communities_provider", "communities", "(provider_id)"),

    # The bot's re-engagement sweep scans for users idle past a cutoff.
    ("ix_users_last_activity", "users", "(last_activity_at)"),

    # Booking history screens.
    ("ix_bookings_user_slot", "bookings", "(user_id, slot_datetime DESC)"),
    ("ix_bookings_provider_slot", "bookings", "(provider_id, slot_datetime DESC)"),
]


def upgrade():
    # CONCURRENTLY cannot run inside a transaction block, and Alembic wraps
    # migrations in one by default.
    with op.get_context().autocommit_block():
        for name, table, columns in INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} {columns}")


def downgrade():
    with op.get_context().autocommit_block():
        for name, _table, _columns in INDEXES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
