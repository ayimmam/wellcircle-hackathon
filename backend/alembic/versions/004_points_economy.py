"""Points economy: transaction ledger, evidence submissions, streaks, referrals

Revision ID: 004
Revises: 003
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # B1: point_transactions ledger
    op.create_table(
        'point_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('providers.id'), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('reversed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('point_transactions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_point_transactions_user_id', 'point_transactions', ['user_id'])
    op.create_index('idx_point_transactions_type', 'point_transactions', ['type'])
    op.create_index('idx_point_transactions_provider_id', 'point_transactions', ['provider_id'])
    op.create_index('idx_point_transactions_created_at', 'point_transactions', ['created_at'])
    # Supports decay eligibility + provider cap queries (Part D3/decay)
    op.create_index('idx_point_transactions_user_created', 'point_transactions', ['user_id', 'created_at'])
    op.create_index('idx_point_transactions_provider_created', 'point_transactions', ['provider_id', 'created_at'])

    # D2: evidence_submissions
    op.create_table(
        'evidence_submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('provider_events.id'), nullable=False),
        sa.Column('submitter_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('telegram_file_id', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('points_per_participant', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_evidence_submissions_event_id', 'evidence_submissions', ['event_id'])
    op.create_index('idx_evidence_submissions_status', 'evidence_submissions', ['status'])

    # D2: designated staff per event
    op.add_column('provider_events', sa.Column('staff_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True))

    # C2: streak tracking
    op.add_column('users', sa.Column('current_streak', sa.Integer(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('freeze_count', sa.Integer(), server_default='0', nullable=True))

    # E1: referral attribution
    op.add_column('users', sa.Column('referred_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'referred_by')
    op.drop_column('users', 'freeze_count')
    op.drop_column('users', 'current_streak')

    op.drop_column('provider_events', 'staff_user_id')

    op.drop_index('idx_evidence_submissions_status', table_name='evidence_submissions')
    op.drop_index('idx_evidence_submissions_event_id', table_name='evidence_submissions')
    op.drop_table('evidence_submissions')

    op.drop_index('idx_point_transactions_provider_created', table_name='point_transactions')
    op.drop_index('idx_point_transactions_user_created', table_name='point_transactions')
    op.drop_index('idx_point_transactions_created_at', table_name='point_transactions')
    op.drop_index('idx_point_transactions_provider_id', table_name='point_transactions')
    op.drop_index('idx_point_transactions_type', table_name='point_transactions')
    op.drop_index('idx_point_transactions_user_id', table_name='point_transactions')
    op.drop_table('point_transactions')
