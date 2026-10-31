# Disposable-database verification procedure — migrations 027–029

Operational procedure prepared for verifying `backend/supabase/migrations/
027_chat_memory_append.sql`, `028_chat_memory_ownership.sql`, and
`029_chat_profile.sql`, plus the settings-related operations that depend on
them. Nothing here has been executed yet; this file documents what to run and
against what.

**Safety tripwire (read-only) — run before every write command.** Refuse to
continue if the target looks like production:

```bash
# FAILS (exit non-zero) when public.users exists — a production marker.
# A freshly created disposable database has no users table.
psql "$DISPOSABLE_DB" -tAc \
  "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN 0 ELSE 1 END"
```

Every write command below must use `$DISPOSABLE_DB` — never `DATABASE_URL`
from `backend/.env`, which points at the shared project.

## Prerequisites

1. A disposable PostgreSQL 14+ target. Either
   `docker run -d --rm --name circler-mig-verify -e POSTGRES_PASSWORD=verify123 -p 55432:5432 postgres:16`
   (`DISPOSABLE_DB=postgresql://postgres:verify123@localhost:55432/postgres`),
   or a brand-new disposable Supabase project (needed for the full
   PostgREST/Supabase-SDK integration path; roles `anon`, `authenticated`,
   `service_role` and the `pgrst` listener exist there).
2. `psql` on PATH, or `docker exec -i circler-mig-verify psql -U postgres ...`
   instead of every `psql` call below.
3. Python with `psycopg2-binary` only if following the repo's `apply_*
   migration.py` pattern instead of `psql` (both are documented; `psql -1` is
   preferred because it runs each file in one transaction).

## Phase 0 — precondition setup (modifies the disposable DB only)

The repository does not contain `public.chat_memory`'s `CREATE TABLE`, so a
disposable run must first reproduce the documented pre-existing shape:

```bash
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.chat_memory (
    session_id text PRIMARY KEY,
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- A pre-028 row, so 028's legacy backfill is actually exercised:
INSERT INTO public.chat_memory (session_id, messages, updated_at)
VALUES ('legacy-session', '[{"role":"user","content":"old"}]'::jsonb, now() - interval '2 hours');
SQL
```

## Phase 1 — migration execution (modifies the disposable DB only)

One file per `psql` invocation, in order. `-1`/`--single-transaction` means a
failing file rolls back completely (`ON_ERROR_STOP=1` stops at the first
error):

```bash
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 \
  -f backend/supabase/migrations/027_chat_memory_append.sql
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 \
  -f backend/supabase/migrations/028_chat_memory_ownership.sql
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 \
  -f backend/supabase/migrations/029_chat_profile.sql
```

`NOTIFY pgrst, 'reload schema'` produces a harmless notice on vanilla
PostgreSQL (no listener) and matters only on real Supabase.

## Phase 2 — schema verification (read-only)

```bash
docker exec circler-mig-verify psql -U postgres <<'SQL'
-- chat_memory shape after 028 (owner columns NOT NULL, check constraint)
\d+ public.chat_memory
\df+ public.append_chat_turn
\d+ public.chat_profile
-- canonical SQL matches what memory.py sends (8 named args, order below)
SELECT proargnames, pronargs FROM pg_proc
 WHERE proname = 'append_chat_turn';
-- grant state
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_name IN ('chat_memory','chat_profile') ORDER BY 1,2;
SELECT proname, grantee FROM information_schema.role_function_grants
 WHERE proname = 'append_chat_turn';
-- RLS on, no permissive policies leak anon/authenticated access
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
 WHERE relname IN ('chat_memory','chat_profile');
SELECT policyname, tablename, roles, cmd FROM pg_policies
 WHERE tablename IN ('chat_memory','chat_profile');
-- legacy row preserved but marked
SELECT session_id, owner_type, owner_id FROM public.chat_memory;
SQL
```

## Phase 3 — behavior verification (modifies the disposable DB only)

Run the isolated statements below with `-v ON_ERROR_STOP=1 -1` so each case
rolls back on failure. `service_role` is not a login group on vanilla
PostgreSQL: for RPC behaviour tests run as the superuser (service role is
superuser-equivalent on Supabase), and cover grants in `information_schema`
queries (Phase 2) instead.

Verify (matching `chatbot/memory.py` / `chatbot/profile.py` exactly):

1. **Atomic append + trim** (`p_max_messages=5`, `p_inactivity_hours=24`):
   five turns → row keeps the newest 5 messages; assistant/user roles paired;
   `updated_at` monotonic (`GREATEST(clock_timestamp(), + 1µs)`).
2. **Expiry reset**: backdate `updated_at` 25 h → call RPC → `reset_applied =
   true`, `messages` contains only the new turn.
3. **Stale-turn flag**: call RPC passing `p_expected_updated_at =
   '2000-01-01T00:00:00+00:00'` while passing a recent known timestamp
   mismatched → `stale_turn = true`.
4. **Ownership & atomicity under concurrency**:
   * mismatched owner on existing row → exception `chat session ownership
     mismatch`, transaction rolled back (row unchanged);
   * two parallel `psql` processes appending the same session concurrently →
     both succeed, no interleaving/duplicate turn, timestamps strictly
     ordered.
5. **`clear_session` delete semantics (028 grants apply):** as service-style
   caller, `DELETE ... WHERE session_id=$1 AND owner_type=$2 AND owner_id=$3`
   leaves foreign and legacy rows intact; unknown id deletes 0 rows.
6. **`chat_profile` (029)**:
   * consented write, then **partial upsert** (`preferences` only, no
     `preferences_consent_at` key) → consent timestamp preserved;
   * **withdrawal upsert** with explicit
     `"preferences_consent_at": null` → column becomes NULL (this is the
     exact wire behavior `chatbot/profile.py::clear_preferences` relies on);
   * check constraints fire: `owner_type='legacy'` rejected, non-object
     `preferences` rejected, `display_name` of 61 chars rejected;
   * concurrent upserts of the same `(owner_type, owner_id)` — last-write
     wins, no duplicate row (PK).
7. **Identity isolation at SQL level**: with a fresh `anon`-role session,
   `SELECT` from either table fails (grants revoked, RLS on) — matching the
   "browsers never touch these tables directly" contract.

## Phase 4 — rollback / recovery drill (modifies the disposable DB only)

Alembic `env.py`/`alembic.ini` are placeholders in this checkout, so the
downgrade path is verified by executing the revisions' downgrade SQL
manually (copied verbatim from `backend/alembic/versions/031_*.py` and
`032_*.py`):

```bash
# 032 downgrade (Alembic renumbering; SQL file remains 029)
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 \
  -c "DROP TABLE IF EXISTS public.chat_profile"   # then the NOTIFY
# 031 downgrade (Alembic renumbering; SQL file remains 028)
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 -c "
  DROP FUNCTION IF EXISTS public.append_chat_turn(
      text, text, text, text, text, timestamptz, integer, double precision);
  ALTER TABLE public.chat_memory
      DROP COLUMN IF EXISTS owner_id,
      DROP COLUMN IF EXISTS owner_type;"
# 031 downgrade re-executes the canonical Phase-1 SQL file to rebuild the RPC:
docker exec -i circler-mig-verify psql -U postgres -v ON_ERROR_STOP=1 -1 \
  -f backend/supabase/migrations/027_chat_memory_append.sql
```

Note the deliberate behavior: 031's downgrade **keeps RLS and revoked table
grants** (hardening is sticky); verify that in Phase-2-style read-only
queries. Then re-apply 027/028/029 (SQL files, Alembic 030/031/032) from the top
against the recovered schema
to prove the whole chain is safely re-runnable.

Clean up entirely with: `docker rm -f circler-mig-verify` (or delete the
disposable Supabase project).

## Phase 5 — full integration path (disposable Supabase project only)

Only a real Supabase project exercises the actual Supabase-SDK code path
(`chatbot/memory.py` RPC calls, `chatbot/profile.py` upserts, PostgREST
filters used by `clear_session`):

1. Create a brand-new disposable Supabase project; note URL, service key,
   DB URL (transaction pooler).
2. Apply the tripwire check, then Phases 1–4 with psql against that project.
3. Point the chatbot at it (process-local env only):
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... JWT_SECRET=local-verify-secret \
     python -m uvicorn main:app --port 8011 --reload   # from chatbot/
   ```
   Then `curl` through the documented flows: bootstrap `GET` `/session`,
   `POST` `/ai/concierge`, `PATCH`/`GET` `/profile`,
   `DELETE` `/preferences` and `/personalization`, `DELETE` `/history`,
   re-opening `GET` `/session` with the fresh id, checking responses and row
   states with read-only SQL.
4. Re-run `python chatbot/migration_check.py` (read-only) and the chatbot
   pytest suite (in-process fakes; no DB usage).

Nothing in Phase 5 needs dependency installation if the existing Group-2 + docurag venv path is used (supabase SDK importable there); otherwise installing pinned deps requires permission.
