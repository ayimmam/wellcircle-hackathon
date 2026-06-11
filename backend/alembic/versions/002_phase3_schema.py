"""Phase 3 schema additions

Revision ID: 002
Revises: 001
Create Date: 2026-06-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. provider_events
    op.create_table(
        'provider_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('service_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('capacity', sa.Integer(), server_default='10', nullable=False),
        sa.Column('spots_remaining', sa.Integer(), nullable=False),
        sa.Column('price_etb', sa.Integer(), nullable=False),
        sa.Column('is_cancelled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_boosted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('spots_remaining >= 0 AND spots_remaining <= capacity', name='check_spots_remaining')
    )
    op.create_index('idx_provider_events_provider_id', 'provider_events', ['provider_id'])
    op.create_index('idx_provider_events_starts_at', 'provider_events', ['starts_at'])
    op.create_index('idx_provider_events_boosted', 'provider_events', ['is_boosted'], postgresql_where=sa.text("is_boosted = true"))

    # 2. community_challenges
    op.create_table(
        'community_challenges',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('community_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('communities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('target_checkins', sa.Integer(), nullable=False),
        sa.Column('reward_points', sa.Integer(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('idx_challenges_community_id', 'community_challenges', ['community_id'])
    op.create_index('idx_challenges_active', 'community_challenges', ['is_active', 'ends_at'])

    # 3. challenge_awards
    op.create_table(
        'challenge_awards',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('challenge_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('community_challenges.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('points_given', sa.Integer(), nullable=False),
        sa.Column('awarded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('challenge_id', 'user_id', name='uq_challenge_user')
    )

    # 4. user_notifications
    op.create_table(
        'user_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('action_url', sa.String(length=500), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('idx_user_notifications_user_id', 'user_notifications', ['user_id', 'is_read'])
    op.create_index('idx_user_notifications_created', 'user_notifications', ['created_at'])

    # 5. provider_subscriptions
    op.create_table(
        'provider_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan', sa.String(length=50), nullable=False),
        sa.Column('amount_etb', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='pending', nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('telebirr_trade_no', sa.String(length=255), nullable=True),
        sa.Column('mpesa_checkout_id', sa.String(length=255), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('idx_subscriptions_provider_id', 'provider_subscriptions', ['provider_id'])

    # 6. provider_promotions
    op.create_table(
        'provider_promotions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('headline', sa.String(length=255), nullable=False),
        sa.Column('discount_pct', sa.Integer(), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('idx_promotions_provider_id', 'provider_promotions', ['provider_id'])
    op.create_index('idx_promotions_active', 'provider_promotions', ['is_active', 'valid_until'])

    # 7. event_inventory_log
    op.create_table(
        'event_inventory_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('provider_events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('delta', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=50), nullable=False),
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('bookings.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('idx_inventory_log_event_id', 'event_inventory_log', ['event_id'])

    # 8. Alter existing tables
    op.add_column('bookings', sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('provider_events.id'), nullable=True))
    op.add_column('bookings', sa.Column('reminder_sent', sa.Boolean(), server_default='false', nullable=False))
    
    op.add_column('providers', sa.Column('is_featured', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('providers', sa.Column('subscription_plan', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('providers', 'subscription_plan')
    op.drop_column('providers', 'is_featured')
    
    op.drop_column('bookings', 'reminder_sent')
    op.drop_column('bookings', 'event_id')

    op.drop_index('idx_inventory_log_event_id', table_name='event_inventory_log')
    op.drop_table('event_inventory_log')

    op.drop_index('idx_promotions_active', table_name='provider_promotions')
    op.drop_index('idx_promotions_provider_id', table_name='provider_promotions')
    op.drop_table('provider_promotions')

    op.drop_index('idx_subscriptions_provider_id', table_name='provider_subscriptions')
    op.drop_table('provider_subscriptions')

    op.drop_index('idx_user_notifications_created', table_name='user_notifications')
    op.drop_index('idx_user_notifications_user_id', table_name='user_notifications')
    op.drop_table('user_notifications')

    op.drop_table('challenge_awards')

    op.drop_index('idx_challenges_active', table_name='community_challenges')
    op.drop_index('idx_challenges_community_id', table_name='community_challenges')
    op.drop_table('community_challenges')

    op.drop_index('idx_provider_events_boosted', table_name='provider_events')
    op.drop_index('idx_provider_events_starts_at', table_name='provider_events')
    op.drop_index('idx_provider_events_provider_id', table_name='provider_events')
    op.drop_table('provider_events')
