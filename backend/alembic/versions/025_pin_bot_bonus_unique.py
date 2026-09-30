"""Enforce one pin-bot bonus ledger award per account."""

from alembic import op

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE UNIQUE INDEX uq_point_transactions_pin_bot_bonus "
        "ON point_transactions (user_id) WHERE type = 'pin_bot_bonus'"
    )


def downgrade():
    op.execute("DROP INDEX uq_point_transactions_pin_bot_bonus")
