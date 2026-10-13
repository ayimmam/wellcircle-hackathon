"""Broadcast committed inbox changes to each user's private Realtime channel."""

from alembic import op

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE POLICY notification_broadcast_read ON realtime.messages
        FOR SELECT TO authenticated
        USING (
            realtime.messages.extension = 'broadcast'
            AND realtime.topic() = 'user-notifications:' || (SELECT auth.uid())::text
        )
    """)
    op.execute("""
        CREATE FUNCTION public.broadcast_user_notification() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
        DECLARE
            recipient_id uuid;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                recipient_id := OLD.user_id;
            ELSE
                recipient_id := NEW.user_id;
            END IF;
            PERFORM realtime.broadcast_changes(
                'user-notifications:' || recipient_id::text,
                TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
            );
            RETURN NULL;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER broadcast_user_notification_change
        AFTER INSERT OR UPDATE OF is_read OR DELETE ON public.user_notifications
        FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_notification()
    """)


def downgrade():
    op.execute("DROP TRIGGER broadcast_user_notification_change ON public.user_notifications")
    op.execute("DROP FUNCTION public.broadcast_user_notification()")
    op.execute("DROP POLICY notification_broadcast_read ON realtime.messages")
