# Well Circle

> **Your tribe, your wellness. Right where you chat.**

A Telegram Mini App connecting individuals and corporate teams to verified wellness providers across Ethiopia — discover providers, join community circles, check in to earn Legacy Points, book sessions, and redeem rewards, all without leaving Telegram.

---

## Features

- **Telegram-native auth** — no separate login; users are authenticated from Telegram `initData`.
- **Provider marketplace** — browse and filter verified wellness providers, view details, and book sessions.
- **Community circles** — join groups, post to the feed, check in daily, and climb leaderboards.
- **Legacy Points** — earn points through engagement and redeem them for products and vouchers.
- **Events & challenges** — providers run boostable events; communities run check-in challenges.
- **Payments** — Telebirr and M-Pesa integration for bookings and provider subscriptions (demo/auto-approve until live credentials are configured).
- **Provider dashboard** — live KPIs, product/event management, and subscriptions.
- **Super-admin dashboard** — provider approvals, inventory, redemptions, and reporting.
- **Localization** — English, Amharic, French, and Italian.

---

## Architecture

Three independently deployed services share a single Supabase PostgreSQL database and communicate over HTTP.

```
┌──────────────┐     /start      ┌──────────────┐
│  Telegram    │ ──────────────► │  Telegram    │
│  User        │                 │  Bot         │
│              │ ◄── WebApp ──── │  (Railway)   │
│              │     button      │              │
└──────┬───────┘                 └──────┬───────┘
       │                                │
       │ Opens Mini App                 │ POST /api/bot/register
       │                                │ GET  /api/bot/inactive-users
       ▼                                │ (X-Bot-API-Key header)
┌──────────────┐                        │
│  Frontend    │                        │
│  Mini App    │ ── JWT auth ──►┌───────▼───────┐
│  (Vercel)    │                │  Backend API  │
│              │ ◄── JSON ───── │   (Vercel /   │
│              │                │    Render)    │
└──────────────┘                │               │
                                │  Supabase DB  │
┌──────────────┐                │  (PostgreSQL) │
│  Super Admin │ ── JWT auth ──►│               │
│  (Mini App)  │                └───────────────┘
└──────────────┘
```

| Service | Stack | Directory | Deploys to |
|---------|-------|-----------|------------|
| Backend API | FastAPI · SQLAlchemy · Supabase | [`backend/`](./backend) | Vercel (serverless) / Render |
| Frontend Mini App | React 18 · Vite · React Router | [`frontend/`](./frontend) | Vercel |
| Telegram Bot | python-telegram-bot | [`telegram-bot/`](./telegram-bot) | Railway |

The AI Concierge is a separate microservice (external repo) reached from the frontend.

---

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET, BOT_API_KEY
python -m app.db.seed      # seed test data
uvicorn app.main:app --reload
# API docs → http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env       # set VITE_API_BASE_URL (or VITE_USE_MOCK=true to run without a backend)
npm run dev                # http://localhost:5173
npm test                   # Vitest + React Testing Library
```

### Telegram Bot
```bash
cd telegram-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in TELEGRAM_BOT_TOKEN, BACKEND_URL, BOT_API_KEY, MINI_APP_URL
python -m bot.main
```

---

## Configuration

These values must match across the services that share them:

| Variable | Used by | Notes |
|----------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | Backend · Bot | From [@BotFather](https://t.me/BotFather) |
| `BOT_API_KEY` | Backend · Bot | Shared secret — `openssl rand -hex 32` |
| `FRONTEND_URL` | Backend | Frontend origin (CORS) |
| `BACKEND_URL` | Bot | Backend origin |
| `MINI_APP_URL` | Bot | Frontend origin (WebApp button) |

See each service's `.env.example` for the full list. **Never commit real secrets** — only the `.env.example` templates are tracked.

---

## User Flow

1. User opens the bot and taps **/start**.
2. The bot registers the user via the backend and shows an **Open Well Circle** WebApp button.
3. The Mini App auto-authenticates via Telegram `initData` and receives a JWT.
4. New users complete onboarding (name → goal → interest → frequency → circles).
5. From Home: browse providers, join communities, check in, and earn points.
6. Book sessions and pay via Telebirr or M-Pesa.
7. Users inactive for 7+ days receive a re-engagement nudge from the bot.

---

## Testing

```bash
cd frontend && npm test                        # navigation, error-boundary, and route smoke tests (Vitest + RTL)
cd backend && python -m app.tests.test_integration  # full integration test, in-memory SQLite — run as a script, not via pytest
```

The frontend suite runs the API client in mock mode, so it needs no backend. The route smoke test
mounts every reachable screen and fails if any crashes. Backend `test_api.py`/`test_auth.py` at
the repo root are manual scripts against a running server, not part of either suite — see
"Repository Layout" below.

---

## Repository Layout

Each service also has its own README with a fuller tour of its internals:
[`backend/README.md`](./backend/README.md), [`frontend/README.md`](./frontend/README.md),
[`telegram-bot/README.md`](./telegram-bot/README.md). This is the map of what lives where at the
top level, including the parts that are easy to mistake for something they're not:

```
wellcirclev2/
├── backend/
│   ├── app/            # the actual application: api/ (routes) → crud/ (queries) → models/ (ORM),
│   │                   # plus schemas/ (Pydantic) and services/ (auth, payments, scheduler)
│   ├── api/index.py    # Vercel serverless entry point (wraps app/main.py via Mangum)
│   ├── alembic/        # schema migrations — the canonical mechanism going forward
│   ├── loadtest/       # Locust load test used to validate Supabase free-tier capacity for the pilot
│   └── *.py            # one-off operational scripts at the backend root (seed_*, check_*, fix_*,
│                       # patch_*, make_super_admin.py, cleanup_loadtest_data.py, apply_*_migration.py,
│                       # test_api.py, test_auth.py) — run manually against a target DB/server,
│                       # not imported by the app and not part of the test suite
├── frontend/
│   └── src/            # api/client.js (backend client + mock mode), context/, pages/, components/,
│                       # hooks/, data/mock.js (mock data matching the API contract), test/
├── telegram-bot/
│   └── bot/             # handlers/ (commands), services/ (api_client, reengagement job), utils/
├── docs/                # design, product, and status docs — see docs/README.md for the full index
├── supabase/            # Supabase CLI config (config.toml) for local Supabase tooling
└── CLAUDE.md            # conventions + architecture notes for anyone (human or AI agent) picking
                          # up work in this repo without prior context — read this first
```

---

## Documentation

Detailed docs live in [`docs/`](./docs) — see [`docs/README.md`](./docs/README.md) for the full,
categorized index. The most load-bearing ones:

- [API_CONTRACT.md](./docs/API_CONTRACT.md) — full endpoint specification and flow diagrams (source of truth across all three services — update it when a request/response shape changes)
- [BACKEND_REFERENCE.md](./docs/BACKEND_REFERENCE.md) — backend internals
- [PRD.md](./docs/PRD.md) — product requirements
- [HANDOFF.md](./docs/HANDOFF.md) — implementation status and change log, by phase

Repository conventions for contributors (and AI coding agents) are in [CLAUDE.md](./CLAUDE.md) —
start there if you're picking up work in this repo cold.
