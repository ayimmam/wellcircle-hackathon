"""Phase 2 schema: provider lifecycle, products, redemptions, invites, notifications

Revision ID: 001_phase2
Revises:
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_phase2"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("providers", sa.Column("status", sa.String(50), server_default="active"))
    op.add_column("providers", sa.Column("onboarded_by_admin", sa.Boolean(), server_default="false"))
    op.add_column("providers", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("providers", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE providers SET status = 'active' WHERE status IS NULL")

    op.create_table(
        "provider_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invite_code", sa.String(20), nullable=False, unique=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("used_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_invite_code", "provider_invites", ["invite_code"])
    op.create_index("idx_is_active", "provider_invites", ["is_active"])

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("price_etb", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("images", postgresql.JSONB(), nullable=True),
        sa.Column("quantity_in_stock", sa.Integer(), server_default="0"),
        sa.Column("max_redemptions_per_user", sa.Integer(), server_default="1"),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("digital_code_template", sa.String(255), nullable=True),
        sa.Column("provider_instructions", sa.Text(), nullable=True),
        sa.Column("shipping_required", sa.Boolean(), server_default="false"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_provider_products", "products", ["provider_id"])
    op.create_index("idx_product_type", "products", ["type"])

    op.create_table(
        "user_redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("points_spent", sa.Integer(), nullable=False),
        sa.Column("redemption_code", sa.String(50), nullable=True),
        sa.Column("delivery_status", sa.String(50), server_default="pending"),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_notes", sa.Text(), nullable=True),
        sa.Column("provider_notes", sa.Text(), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_user_redemptions", "user_redemptions", ["user_id"])
    op.create_index("idx_product_redemptions", "user_redemptions", ["product_id"])
    op.create_index("idx_delivery_status", "user_redemptions", ["delivery_status"])

    op.create_table(
        "admin_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=True),
        sa.Column("related_provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=True),
        sa.Column("related_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("bot_message_sent", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_admin_notifications", "admin_notifications", ["admin_user_id", "is_read"])


def downgrade() -> None:
    op.drop_table("admin_notifications")
    op.drop_table("user_redemptions")
    op.drop_table("products")
    op.drop_table("provider_invites")
    op.drop_column("providers", "reviewed_at")
    op.drop_column("providers", "submitted_at")
    op.drop_column("providers", "onboarded_by_admin")
    op.drop_column("providers", "status")
