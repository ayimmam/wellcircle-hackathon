"""Paid circles, trainer verification, profiles and Strava.

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("profile_privacy", sa.String(20), nullable=False, server_default="public"))
    op.add_column("users", sa.Column("is_verified_trainer", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("verified_trainer_expires_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("strava_athlete_id", sa.BigInteger()))
    op.add_column("users", sa.Column("strava_access_token", sa.Text()))
    op.add_column("users", sa.Column("strava_refresh_token", sa.Text()))
    op.add_column("users", sa.Column("strava_token_expires_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("strava_visible_stats", postgresql.JSONB()))
    op.create_unique_constraint("uq_users_strava_athlete_id", "users", ["strava_athlete_id"])
    op.create_check_constraint(
        "ck_users_profile_privacy", "users", "profile_privacy IN ('public','followers','private')"
    )

    op.add_column("circles", sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("circles", sa.Column("price_etb", sa.Integer()))
    op.add_column("circles", sa.Column("paid_circle_status", sa.String(20), nullable=False, server_default="free"))
    op.add_column("circles", sa.Column("paid_circle_applied_at", sa.DateTime(timezone=True)))
    op.add_column("circles", sa.Column("total_revenue_etb", sa.Integer(), nullable=False, server_default="0"))

    op.create_table(
        "followers",
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("following_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("follower_id <> following_id", name="ck_followers_not_self"),
    )
    op.create_index("ix_followers_following_created", "followers", ["following_id", "created_at"])
    op.create_index("ix_followers_follower_created", "followers", ["follower_id", "created_at"])

    op.create_table(
        "trainer_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("certificate_url", sa.Text(), nullable=False),
        sa.Column("certificate_public_id", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("payment_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_receipt_url", sa.Text()),
        sa.Column("payment_receipt_public_id", sa.Text()),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "circle_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("circles.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount_etb", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("receipt_url", sa.Text()),
        sa.Column("receipt_public_id", sa.Text()),
        sa.Column("creator_approved_at", sa.DateTime(timezone=True)),
        sa.Column("escalated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("circle_id", "user_id", "period_start", name="uq_circle_subscription_period"),
    )
    op.create_index("ix_circle_subscriptions_circle_id", "circle_subscriptions", ["circle_id"])
    op.create_index("ix_circle_subscriptions_user_id", "circle_subscriptions", ["user_id"])

    op.create_table(
        "circle_revenue_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("circles.id"), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("circle_subscriptions.id"), nullable=False, unique=True),
        sa.Column("total_amount_etb", sa.Integer(), nullable=False),
        sa.Column("creator_amount_etb", sa.Integer(), nullable=False),
        sa.Column("platform_fee_etb", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("creator_amount_etb + platform_fee_etb = total_amount_etb", name="ck_revenue_split_sums"),
    )
    op.create_index("ix_circle_revenue_ledger_circle_id", "circle_revenue_ledger", ["circle_id"])

    op.create_table(
        "strava_activity_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strava_activity_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("activity_type", sa.String(50), nullable=False),
        sa.Column("distance_meters", sa.Float(), nullable=False),
        sa.Column("moving_time_seconds", sa.Integer(), nullable=False),
        sa.Column("elapsed_time_seconds", sa.Integer(), nullable=False),
        sa.Column("total_elevation_gain", sa.Float(), nullable=False),
        sa.Column("calories", sa.Float()),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_strava_activity_cache_user_id", "strava_activity_cache", ["user_id"])


def downgrade():
    op.drop_table("strava_activity_cache")
    op.drop_table("circle_revenue_ledger")
    op.drop_table("circle_subscriptions")
    op.drop_table("trainer_verifications")
    op.drop_table("followers")
    for column in ("total_revenue_etb", "paid_circle_applied_at", "paid_circle_status", "price_etb", "is_paid"):
        op.drop_column("circles", column)
    op.drop_constraint("ck_users_profile_privacy", "users", type_="check")
    op.drop_constraint("uq_users_strava_athlete_id", "users", type_="unique")
    for column in (
        "strava_visible_stats", "strava_token_expires_at", "strava_refresh_token",
        "strava_access_token", "strava_athlete_id", "verified_trainer_expires_at",
        "is_verified_trainer", "profile_privacy", "bio",
    ):
        op.drop_column("users", column)
