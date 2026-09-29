"""Terra-backed Walk Score.

Revision ID: 023
Revises: 022
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("walk_score", sa.BigInteger(), nullable=False, server_default="0"))
    op.create_table(
        "user_wearables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("terra_user_id", sa.String(128), nullable=False, unique=True),
        sa.Column("reference_id", sa.String(128), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_sync_timestamp", sa.DateTime(timezone=True)),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_wearables_user_id", "user_wearables", ["user_id"])
    op.create_table(
        "wearable_daily_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wearable_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_wearables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=False),
        sa.UniqueConstraint("wearable_id", "activity_date"),
        sa.CheckConstraint("steps >= 0 AND steps <= 100000", name="ck_wearable_daily_steps_range"),
    )
    op.create_table(
        "walk_score_days",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("activity_date", sa.Date(), primary_key=True),
        sa.Column("steps", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("steps >= 0 AND steps <= 100000", name="ck_walk_score_days_range"),
    )
    op.execute("ALTER TABLE user_wearables ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE wearable_daily_steps ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE walk_score_days ENABLE ROW LEVEL SECURITY")
    op.execute("""CREATE OR REPLACE FUNCTION protect_walk_score() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
            IF current_user IN ('anon', 'authenticated') THEN
                IF TG_OP = 'INSERT' AND COALESCE(NEW.walk_score, 0) <> 0 THEN
                    RAISE EXCEPTION 'walk_score is server managed';
                ELSIF TG_OP = 'UPDATE' AND NEW.walk_score IS DISTINCT FROM OLD.walk_score THEN
                    RAISE EXCEPTION 'walk_score is server managed';
                END IF;
            END IF;
            RETURN NEW;
        END; $$""")
    op.execute("""CREATE TRIGGER trg_protect_walk_score
        BEFORE INSERT OR UPDATE ON users FOR EACH ROW
        EXECUTE FUNCTION protect_walk_score()""")


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_protect_walk_score ON users")
    op.execute("DROP FUNCTION IF EXISTS protect_walk_score()")
    op.drop_table("walk_score_days")
    op.drop_table("wearable_daily_steps")
    op.drop_index("ix_user_wearables_user_id", table_name="user_wearables")
    op.drop_table("user_wearables")
    op.drop_column("users", "walk_score")
