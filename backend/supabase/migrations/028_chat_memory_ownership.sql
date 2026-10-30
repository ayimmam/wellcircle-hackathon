-- Chat session ownership for the Circler concierge.
--
-- Canonical DDL for Alembic revision 028. The Alembic revision executes this
-- file directly so the SQL-editor and Alembic paths cannot drift.
--
-- Apply after revision 027. This migration:
--   1. adds owner_type/owner_id to public.chat_memory;
--   2. marks pre-existing rows as inaccessible 'legacy' rows;
--   3. prevents direct browser/PostgREST table access; and
--   4. replaces append_chat_turn with an owner-aware version that checks the
--      owner again while holding the session row lock.
--
-- Prerequisite (already created outside this repository):
--   public.chat_memory(
--       session_id text primary key,
--       messages jsonb not null default '[]'::jsonb,
--       updated_at timestamptz not null default now()
--   )
--
-- Existing rows cannot be attributed to a user or anonymous identity after the
-- fact, so they become owner_type='legacy', owner_id='legacy' and are never
-- returned by the chatbot. Their data is preserved rather than deleted.
--
-- This file does not contain the CREATE TABLE definition, so the exact legacy
-- column types, existing RLS policies, and key shape must still be verified in
-- the target project before applying. Never run this against a shared or
-- production database as part of an automated deploy.

ALTER TABLE public.chat_memory
    ADD COLUMN IF NOT EXISTS owner_type text;

ALTER TABLE public.chat_memory
    ADD COLUMN IF NOT EXISTS owner_id text;

UPDATE public.chat_memory
   SET owner_type = 'legacy',
       owner_id = 'legacy'
 WHERE owner_type IS NULL
    OR owner_id IS NULL;

ALTER TABLE public.chat_memory
    ALTER COLUMN owner_type SET NOT NULL;

ALTER TABLE public.chat_memory
    ALTER COLUMN owner_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'public.chat_memory'::regclass
           AND conname = 'chat_memory_owner_type_check'
    ) THEN
        ALTER TABLE public.chat_memory
            ADD CONSTRAINT chat_memory_owner_type_check
            CHECK (owner_type IN ('user', 'anonymous', 'legacy'));
    END IF;
END;
$$;

-- The chatbot uses the service-role key, which bypasses RLS. Direct table
-- access is not part of the client contract; revoke it so a browser key cannot
-- read every conversation even if a permissive policy already exists.
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_memory FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE public.chat_memory FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE public.chat_memory FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON TABLE public.chat_memory
            TO service_role;
    END IF;
END;
$$;

-- The Phase 1 RPC has no owner argument and must not remain callable.
DROP FUNCTION IF EXISTS public.append_chat_turn(
    text, text, text, timestamptz, integer, double precision
);

CREATE OR REPLACE FUNCTION public.append_chat_turn(
    p_session_id text,
    p_owner_type text,
    p_owner_id text,
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
    v_owner_type text;
    v_owner_id text;
    v_inserted_rows integer := 0;
    v_reset boolean := false;
    v_stale boolean := false;
    v_turn jsonb;
BEGIN
    IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
        RAISE EXCEPTION 'p_session_id must not be empty';
    END IF;
    IF p_owner_type IS NULL OR p_owner_type NOT IN ('user', 'anonymous') THEN
        RAISE EXCEPTION 'p_owner_type must be user or anonymous';
    END IF;
    IF p_owner_id IS NULL OR btrim(p_owner_id) = '' THEN
        RAISE EXCEPTION 'p_owner_id must not be empty';
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

    -- Create the row if needed. The owner is written only on first insert.
    -- ON CONFLICT makes concurrent first turns safe: the losing insert waits
    -- for the winning transaction, then locks its row.
    INSERT INTO public.chat_memory (
        session_id,
        owner_type,
        owner_id,
        messages,
        updated_at
    )
    VALUES (
        p_session_id,
        p_owner_type,
        p_owner_id,
        '[]'::jsonb,
        clock_timestamp()
    )
    ON CONFLICT (session_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

    -- Lock the session row for the rest of this transaction. Ownership and
    -- expiry are checked only after the lock is acquired.
    SELECT cm.owner_type, cm.owner_id, cm.messages, cm.updated_at
      INTO v_owner_type, v_owner_id, v_messages, v_updated_at
      FROM public.chat_memory AS cm
     WHERE cm.session_id = p_session_id
     FOR UPDATE;

    IF v_owner_type IS DISTINCT FROM p_owner_type
       OR v_owner_id IS DISTINCT FROM p_owner_id THEN
        RAISE EXCEPTION 'chat session ownership mismatch'
            USING ERRCODE = 'P0001';
    END IF;

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
       AND cm.owner_type = p_owner_type
       AND cm.owner_id = p_owner_id
    RETURNING cm.messages, cm.updated_at
         INTO v_messages, v_updated_at;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'chat session disappeared during append'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_messages, v_updated_at, v_reset, v_stale;
END;
$$;

-- The chatbot uses the service-role key. Do not expose this write primitive to
-- anonymous or authenticated browser sessions.
REVOKE ALL ON FUNCTION public.append_chat_turn(
    text, text, text, text, text, timestamptz, integer, double precision
) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.append_chat_turn(
            text, text, text, text, text, timestamptz, integer, double precision
        ) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.append_chat_turn(
            text, text, text, text, text, timestamptz, integer, double precision
        ) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.append_chat_turn(
            text, text, text, text, text, timestamptz, integer, double precision
        ) TO service_role;
    END IF;
END;
$$;

-- Make PostgREST expose the new RPC without waiting for a schema-cache reload.
NOTIFY pgrst, 'reload schema';
