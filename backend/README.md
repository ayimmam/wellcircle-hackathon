# Well Circle — Backend (FastAPI)

## Quick Start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Edit with your credentials
python -m app.db.seed   # Seed test users
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

**Python 3.10+ is required** — `app/` uses `X | None` annotations at runtime,
which raise `TypeError` on 3.9. CI runs 3.11.

## Booking and reminder deployment migration

Before deploying code that uses the booking lifecycle or proactive reminders,
apply Alembic revision 024. For existing databases maintained with the repository's
idempotent scripts, run this equivalent repair against the target `DATABASE_URL`:

```bash
cd backend
python apply_booking_lifecycle_migration.py
```

The script adds the three reminder fields on `users`, booking status and
idempotency fields on `bookings`, the idempotency constraint, and the booking
status audit table/index with row level security. It preserves existing data,
runs in one transaction, fails on an error, and can be rerun safely. It does
not stamp Alembic's revision history; use one migration mechanism consistently.

Startup also includes these repairs and isolates individual SQL failures with
savepoints. Apply the explicit migration before deployment: serverless startup
is not a reliable migration gate. Verify a real login and authenticated Home
and bookings requests afterward; `/health` only checks that the API is running.

Production settings should include `ENVIRONMENT=production` and a `BOT_API_KEY`
matching the bot worker's `BOT_API_KEY`. A missing bot key causes the engagement
digest to return 403 independently of database schema failures.

## Tests

```bash
pytest app/tests -q                    # the suite CI runs (21 tests)
python -m app.tests.test_integration   # the same integration test standalone, with a narrative trace
```

Settings are validated at import, so the suite needs `DATABASE_URL`,
`TELEGRAM_BOT_TOKEN` and `JWT_SECRET` set — dummy values are fine, and SQLite
keeps it self-contained. See `.github/workflows/ci.yml` for exactly what CI uses.

`test_api.py` and `test_auth.py` at the top of this directory are manual
scripts that POST to a running server. They are not part of the suite and CI
does not run them.

## Project Structure

```
backend/
├── app/
│   ├── main.py            # FastAPI entry point + lifespan
│   ├── config.py          # Pydantic settings from .env
│   ├── database.py        # SQLAlchemy engine + session
│   ├── dependencies.py    # Auth (JWT), role checks, bot API key
│   ├── api/               # Route handlers
│   │   ├── auth.py        # POST /api/auth/telegram
│   │   ├── users.py       # GET/PATCH /api/users/me, onboarding
│   │   ├── providers.py   # GET /api/providers
│   │   ├── communities.py # Join, leave, checkin, feed
│   │   ├── bookings.py    # POST /api/bookings
│   │   ├── payments.py    # Telebirr + M-Pesa
│   │   ├── admin.py       # Super admin CRUD
│   │   └── bot.py         # Bot registration + re-engagement
│   ├── models/            # SQLAlchemy ORM models
│   ├── schemas/           # Pydantic request/response
│   ├── crud/              # Database operations
│   ├── services/          # Business logic (auth, payments, scheduler)
│   └── db/seed.py         # Test data seeder
├── requirements.txt
├── Procfile               # Render deployment
└── .env.example
```

## Deployment (Render)

1. Push to GitHub
2. Create new Web Service on Render
3. Set root directory to `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add all env vars from `.env.example`

## API Contract

See [API_CONTRACT.md](../docs/API_CONTRACT.md) for the full endpoint specification.
