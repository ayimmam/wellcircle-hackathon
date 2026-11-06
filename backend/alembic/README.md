# Alembic runner (backend)

`alembic.ini` and `env.py` were placeholders in this checkout. They now form a
standard Alembic runner, but the revision chain still has **no fresh-install
baseline**.

## Why a fresh empty database cannot run `upgrade head`

Revisions 001+ assume the pre-existing Well Circle schema (users, providers,
bookings, circles, products, chat tables, …). Revision 001 starts by altering
`providers`; there is no migration that creates the original database. Running
`alembic upgrade head` against an empty database will fail at 001.

## Safe procedure for a database already at 032

Use this only after a backup/snapshot and a read-only schema check.

```bash
cd backend
export DATABASE_URL='postgresql://…/wellcircle'

# 1. Inspect, do not change anything.
alembic current
alembic history -r -5:current

# 2. Verify prerequisites: public.users exists and has the columns 033 reads.
psql "$DATABASE_URL" -c "\d+ users"
psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM users WHERE telegram_id IS NOT NULL"

# 3. If the database has no alembic_version row because the runner was a
#    placeholder, stamp the schema state you have verified. Do not stamp if you
#    cannot confirm the schema is post-032.
alembic stamp 032

# 4. Apply the two release revisions.
alembic upgrade head

# 5. Verify the final revision and schema.
alembic current          # 035 (head)
psql "$DATABASE_URL" -c "\d+ auth_identities"
psql "$DATABASE_URL" -c "\d+ account_link_challenges"
psql "$DATABASE_URL" -c "\d+ api_rate_limits"
```

`033` is idempotent when the out-of-band `auth_identities` table already exists,
but it **fails loudly** on schema drift. `034` and `035` likewise refuse to accept a drifted pre-existing table. None of these revisions deletes
or merges user rows; `033` only backfills Telegram identities and makes
`users.telegram_id` nullable.

## Downgrade

```bash
alembic downgrade 034   # drops only the ephemeral rate-limit counter table
alembic downgrade 033   # drops only the ephemeral challenge table
alembic downgrade 032   # refuses if any non-Telegram identity exists
```

`033` downgrade intentionally refuses when Google/WhatsApp/password identity
rows exist: those credentials cannot be reconstructed. Resolve them manually or
keep the revision applied.

## Fresh disposable verification

The repository tests execute the revision functions directly against a
disposable PostgreSQL database; this is the preferred CI path because the chain
has no baseline:

```bash
DISPOSABLE_DB=postgresql://postgres@127.0.0.1:<port>/phasea_mig \
  pytest app/tests/test_auth_identities_migration.py \
         app/tests/test_account_link_challenges_migration.py \
         app/tests/test_api_rate_limits_migration.py -q
```

Never point `DISPOSABLE_DB`, `DATABASE_URL`, or the runner at a shared or
production database during verification.
