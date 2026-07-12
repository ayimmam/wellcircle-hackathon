# Load test — pilot launch capacity check

Validates whether Supabase free tier (+ the `NullPool` fix in
`app/database.py`) holds up under ~200 concurrent pilot users and a
registration-surge spike at launch, before deciding whether the MongoDB
migration is actually necessary.

## Baseline, before running anything

Pulled from Supabase → Observability → Database on `ayimmam's Project`
(free tier), Jul 12 2026, essentially idle (no real users yet):

| Metric | Baseline |
|---|---|
| CPU usage | 2.04% |
| Memory usage / commitment | 408 MB used / 1.04 GB committed (limit ~1.2 GB) |
| Database connections | 9 |
| Database size | 0.03 GB used of 2 GB provisioned |

Re-check this same dashboard page during/after the test — that's the signal
that actually answers "can free tier handle it," not the Locust output alone
(Locust tells you if *requests* failed; Supabase's dashboard tells you *why*,
e.g. connections maxed out vs. CPU pegged vs. plenty of headroom left).

**Before running against the real project:** check
[status.supabase.com](https://status.supabase.com) — the dashboard was
showing an active "investigating a technical issue" banner as of this
writing. Don't run load-test-shaped traffic during an unrelated platform
incident; you won't be able to tell your numbers from theirs.

## Setup

```bash
cd backend/loadtest
pip install -r requirements.txt
```

You need the real bot token so requests carry validly-signed Telegram
`initData` and exercise the actual `validate_init_data()` HMAC path (not the
`ENVIRONMENT=="development"` bypass) — this is the same token as
`backend/.env`'s `TELEGRAM_BOT_TOKEN`. Don't commit it; export it in your
shell for the run instead.

## Run it

**1. Local dev first**, to catch script bugs cheaply — note this still
talks to the real Supabase DB (there's no local Postgres in this repo, see
root CLAUDE.md), so use a small user count:

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload

# terminal 2
cd backend/loadtest
TELEGRAM_BOT_TOKEN=<from .env> LOAD_TEST_USERS=10 LOAD_TEST_SURGE_SECONDS=10 LOAD_TEST_SUSTAIN_SECONDS=30 \
  locust -f locustfile.py --host http://localhost:8000
```

Open http://localhost:8089, hit Start, watch it in the web UI.

**2. Against the deployed pilot backend**, ramping in stages rather than
jumping straight to 200 — watch the Supabase dashboard between each step:

```bash
cd backend/loadtest
TELEGRAM_BOT_TOKEN=<from .env> locust -f locustfile.py \
  --host https://wellcircle-hackathon-backend.vercel.app \
  --headless -u 20 -r 5 --run-time 2m --csv=results-20
# check Supabase dashboard, then:
TELEGRAM_BOT_TOKEN=<from .env> locust -f locustfile.py \
  --host https://wellcircle-hackathon-backend.vercel.app \
  --headless -u 50 -r 10 --run-time 2m --csv=results-50
# check again, then the real target:
TELEGRAM_BOT_TOKEN=<from .env> LOAD_TEST_USERS=200 locust -f locustfile.py \
  --host https://wellcircle-hackathon-backend.vercel.app \
  --headless --run-time 5m --csv=results-200
```

The last command (no `-u`/`-r`) uses `RegistrationSurgeShape` from
`locustfile.py`: a fast ramp to 200 users within 30s (simulating a launch
announcement spike hitting `/api/auth/telegram` + `/api/users/me/onboard`
hardest), then holds at 200 for 4 more minutes to see steady-state behavior
once the surge settles. Override via `LOAD_TEST_USERS` /
`LOAD_TEST_SURGE_SECONDS` / `LOAD_TEST_SUSTAIN_SECONDS`.

## What each simulated user does

Mirrors the actual frontend flows, weighted toward browsing over booking
(10:5:1 — see `docs/USER_FLOW_AUDIT.md`'s funnel):

1. **`on_start`** — signs fresh `initData` for a synthetic Telegram ID
   (globally unique per session, so this genuinely exercises "new user
   registers" every time, not repeated logins) → `POST /api/auth/telegram`
   → `POST /api/users/me/onboard`. This *is* the registration-surge path.
2. **`browse_home`** (weight 10) — `GET /api/providers` + `GET
   /api/communities` in parallel, like `HomeScreen.jsx`.
3. **`view_provider_detail`** (weight 5) — providers list, then one detail
   fetch, like Explore → ProviderDetail.
4. **`full_booking_flow`** (weight 1) — create booking → initiate Telebirr
   payment → poll status twice, like `BookingFlow.jsx`.

## Cleanup

Every run creates real rows: `users` (telegram_id in the
900000000000–999999999999 range, name/username prefixed `LoadTest`/
`loadtest_`), plus `bookings` and `point_transactions` for sessions that hit
`full_booking_flow`. Since there's no real user data yet, easiest cleanup is
a one-off delete before Bezi's real seed data lands:

```sql
delete from bookings where provider_id in (
  select id from providers  -- adjust if load-test bookings need identifying differently
);
delete from users where telegram_handle like 'loadtest_%' or name like 'Load Test User%';
```

Confirm row counts with a `select` first — this isn't scripted on purpose,
it's a one-time manual step against production data.

## Reading the result

- **Failures in the Locust summary** (non-2xx / timeouts) — read the error
  message; a spike of `auth failed` specifically during the first
  `SURGE_SECONDS` window points at the registration-surge path, not general
  capacity.
- **P95/P99 latency climbing with concurrency** but no failures — still
  working, just slow; fine for a soft-launch pilot, worth watching.
- **Supabase dashboard "Database Connections" pinned near its ceiling**
  during the run — the `NullPool` fix isn't enough alone, worth a follow-up
  before trusting free tier through launch.
- **Supabase CPU pegged near 100%** — this is the one result that would
  argue for Supabase Pro (or reconsidering scale strategy) rather than a
  connection-handling tweak.
