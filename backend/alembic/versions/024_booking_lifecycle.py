"""Track booking fulfillment independently from payment."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "bookings",
        sa.Column("booking_status", sa.String(length=32), nullable=False, server_default="requested"),
    )
    op.add_column("bookings", sa.Column("idempotency_key", sa.String(length=100), nullable=True))
    op.create_unique_constraint(
        "uq_bookings_user_idempotency_key", "bookings", ["user_id", "idempotency_key"]
    )
    op.add_column("users", sa.Column("last_proactive_reminder_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("day1_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("proactive_notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table(
        "booking_status_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_booking_status_events_booking_id", "booking_status_events", ["booking_id"])
    op.execute("ALTER TABLE booking_status_events ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_index("ix_booking_status_events_booking_id", table_name="booking_status_events")
    op.drop_table("booking_status_events")
    op.drop_column("users", "day1_reminder_sent_at")
    op.drop_column("users", "proactive_notifications_enabled")
    op.drop_column("users", "last_proactive_reminder_at")
    op.drop_constraint("uq_bookings_user_idempotency_key", "bookings", type_="unique")
    op.drop_column("bookings", "idempotency_key")
    op.drop_column("bookings", "booking_status")
