-- Atomic append for chatbot conversation memory.
--
-- Canonical DDL for Alembic revision 027. The Alembic revision executes this
-- file directly so the SQL-editor and Alembic paths cannot drift.
--
-- Apply once to the Supabase project *before* deploying chatbot code that calls
-- append_chat_turn. Test in a disposable database first; never run this
-- migration against a shared/production project as part of a deploy script.
--
-- Prerequisite (already created outside this repository):
--   public.chat_memory(
--       session_id text primary key,
--       messages jsonb not null default '[]'::jsonb,
--       updated_at timestamptz not null default now()
--   )
--
-- Security prerequisite (verify in the target project; not asserted here):
-- this migration restricts the RPC, but public.chat_memory must also be
-- protected from direct PostgREST access. Confirm RLS is enabled and that
-- anon/authenticated cannot read or write the table directly. This repository
-- does not contain the CREATE TABLE definition, so its exact column types,
-- key, RLS state, and grants cannot be verified locally.
--
-- The function appends exactly one validated user/assistant turn, resets
-- expired conversations, trims the stored messages, and writes database
-- timestamps that never move backwards. Concurrent writes for the same session
-- are serialized by the row lock; expiry is checked only after that lock is
-- acquired. A stale_turn flag reports that the caller generated its reply from
-- history that another request changed in the meantime. Stale turns are still
-- appended so no content is lost, but they are not reordered (the existing
-- protocol has no server-side turn sequence).

CREATE OR REPLACE FUNCTION public.append_chat_turn(
    p_session_id text,
    p_user_content text,
    p_assistant_content text,
    p_expected_updated_at timestamptz,
    p_max_messages integer,
    p_inactivity_hours double precision
)
RETURNS TABLE (
    messages jsonb,
    updated_at timestamptz,
    reset_applied boolean,
    stale_turn boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_messages jsonb;
    v_updated_at timestamptz;
    v_now timestamptz;
    v_inserted_rows integer := 0;
    v_reset boolean := false;
    v_stale boolean := false;
    v_turn jsonb;
BEGIN
    IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
        RAISE EXCEPTION 'p_session_id must not be empty';
    END IF;
    IF p_user_content IS NULL OR p_assistant_content IS NULL THEN
        RAISE EXCEPTION 'turn content must not be null';
    END IF;
    IF p_max_messages IS NULL OR p_max_messages < 2 THEN
        RAISE EXCEPTION 'p_max_messages must be at least 2';
    END IF;
    IF p_inactivity_hours IS NULL OR p_inactivity_hours <= 0 THEN
        RAISE EXCEPTION 'p_inactivity_hours must be positive';
    END IF;

    -- Create the row if needed. ON CONFLICT makes concurrent first turns safe:
    -- the losing insert waits for the winning transaction, then locks its row.
    INSERT INTO public.chat_memory (session_id, messages, updated_at)
    VALUES (p_session_id, '[]'::jsonb, clock_timestamp())
    ON CONFLICT (session_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

    -- Lock the session row for the rest of this transaction. The expiry check
    -- happens after the lock, so a concurrent turn cannot slip between the read
    -- and the write.
    SELECT cm.messages, cm.updated_at
      INTO v_messages, v_updated_at
      FROM public.chat_memory AS cm
     WHERE cm.session_id = p_session_id
     FOR UPDATE;

    v_now := clock_timestamp();

    IF v_updated_at IS NULL
       OR v_now - v_updated_at >= (interval '1 hour' * p_inactivity_hours) THEN
        v_reset := true;
        v_messages := '[]'::jsonb;
    END IF;

    -- Detect that the caller replied using history that has since changed.
    -- A freshly inserted row is expected when the caller passed NULL. An
    -- existing row is expected to match the timestamp the caller read.
    IF NOT v_reset THEN
        v_stale :=
            (p_expected_updated_at IS NULL AND v_inserted_rows = 0)
            OR (
                p_expected_updated_at IS NOT NULL
                AND (
                    v_inserted_rows = 1
                    OR v_updated_at IS DISTINCT FROM p_expected_updated_at
                )
            );
    END IF;

    v_turn := jsonb_build_array(
        jsonb_build_object('role', 'user', 'content', p_user_content),
        jsonb_build_object('role', 'assistant', 'content', p_assistant_content)
    );

    v_messages := COALESCE(v_messages, '[]'::jsonb) || v_turn;

    -- Keep only the newest p_max_messages entries.
    IF jsonb_array_length(v_messages) > p_max_messages THEN
        SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb)
          INTO v_messages
          FROM jsonb_array_elements(v_messages) WITH ORDINALITY AS t(item, ord)
         WHERE ord > jsonb_array_length(v_messages) - p_max_messages;
    END IF;

    UPDATE public.chat_memory AS cm
       SET messages = v_messages,
           -- GREATEST also keeps timestamps monotonic if the database clock
           -- moves backwards between two writes.
           updated_at = GREATEST(
               clock_timestamp(),
               v_updated_at + interval '1 microsecond'
           )
     WHERE cm.session_id = p_session_id
    RETURNING cm.messages, cm.updated_at
         INTO v_messages, v_updated_at;

    RETURN QUERY SELECT v_messages, v_updated_at, v_reset, v_stale;
END;
$$;

-- The chatbot uses the service-role key. Do not expose this write primitive to
-- anonymous or authenticated browser sessions.
REVOKE ALL ON FUNCTION public.append_chat_turn(
    text, text, text, timestamptz, integer, double precision
) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.append_chat_turn(
            text, text, text, timestamptz, integer, double precision
        ) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.append_chat_turn(
            text, text, text, timestamptz, integer, double precision
        ) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.append_chat_turn(
            text, text, text, timestamptz, integer, double precision
        ) TO service_role;
    END IF;
END;
$$;

-- Make PostgREST expose the new RPC without waiting for a schema-cache reload.
NOTIFY pgrst, 'reload schema';
