-- Persistent Circler profile data, independent of expiring chat history.
--
-- Canonical DDL for Alembic revision 029. The profile stores a display name
-- and explicitly consented preference data keyed by the same owner identity as
-- chat_memory. Conversation history can expire; this profile does not.
--
-- Apply after revision 028. The chatbot uses the service-role key and accesses
-- this table only from the server. Browsers must never read or write it
-- directly.

CREATE TABLE IF NOT EXISTS public.chat_profile (
    owner_type text NOT NULL,
    owner_id text NOT NULL,
    display_name text,
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    preferences_consent_at timestamptz,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_type, owner_id),
    CONSTRAINT chat_profile_owner_type_check
        CHECK (owner_type IN ('user', 'anonymous')),
    CONSTRAINT chat_profile_display_name_length_check
        CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 60),
    CONSTRAINT chat_profile_preferences_object_check
        CHECK (jsonb_typeof(preferences) = 'object')
);

-- The chatbot may discover a signed-in user's name from public.users when no
-- chat_profile row exists. Index the anonymous side for future cleanup jobs.
CREATE INDEX IF NOT EXISTS chat_profile_last_seen_at_idx
    ON public.chat_profile (last_seen_at);

ALTER TABLE public.chat_profile ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_profile FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE public.chat_profile FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE public.chat_profile FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON TABLE public.chat_profile
            TO service_role;
    END IF;
END;
$$;

-- Make PostgREST expose the new table without waiting for a schema-cache reload.
NOTIFY pgrst, 'reload schema';
