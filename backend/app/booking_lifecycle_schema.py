"""Idempotent PostgreSQL repair for Alembic 024's booking/reminder schema.

Shared by the explicit deployment migration and the legacy startup repair.
Existing data is preserved; already-applied objects are left in place.
"""

BOOKING_LIFECYCLE_STATEMENTS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_proactive_reminder_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS day1_reminder_sent_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS proactive_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_status VARCHAR(32) NOT NULL DEFAULT 'requested'",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100)",
    """DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'bookings'::regclass
              AND conname = 'uq_bookings_user_idempotency_key'
        ) THEN
            ALTER TABLE bookings ADD CONSTRAINT uq_bookings_user_idempotency_key
                UNIQUE (user_id, idempotency_key);
        END IF;
    END $$""",
    """CREATE TABLE IF NOT EXISTS booking_status_events (
        id UUID PRIMARY KEY,
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        from_status VARCHAR(32),
        to_status VARCHAR(32) NOT NULL,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_role VARCHAR(16) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_booking_status_events_booking_id ON booking_status_events(booking_id)",
    "ALTER TABLE booking_status_events ENABLE ROW LEVEL SECURITY",
)
