"""Persist OTP challenges and rate limits across serverless instances."""
from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade():
    # Allows the targeted pre-deploy application on installations whose older
    # schema updates were applied manually before adopting Alembic consistently.
    if sa.inspect(op.get_bind()).has_table("whatsapp_otp_challenges"):
        required = {"id", "phone_e164", "phone_hash", "ip_hash", "code_hash", "provider", "provider_request_id", "status", "attempts", "created_at", "expires_at"}
        present = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("whatsapp_otp_challenges")}
        if not required.issubset(present):
            raise RuntimeError("Existing OTP table does not match migration 027")
        if op.get_bind().dialect.name == "postgresql":
            op.execute("ALTER TABLE whatsapp_otp_challenges ENABLE ROW LEVEL SECURITY")
        return
    op.create_table(
        "whatsapp_otp_challenges",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("phone_e164", sa.String(20), nullable=True),
        sa.Column("phone_hash", sa.String(64), nullable=False),
        sa.Column("ip_hash", sa.String(64), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=True),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("provider_request_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_otp_phone_created", "whatsapp_otp_challenges", ["phone_hash", "created_at"])
    op.create_index("ix_otp_ip_created", "whatsapp_otp_challenges", ["ip_hash", "created_at"])
    op.create_index("ix_whatsapp_otp_challenges_expires_at", "whatsapp_otp_challenges", ["expires_at"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE whatsapp_otp_challenges ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("whatsapp_otp_challenges")
