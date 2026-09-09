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
