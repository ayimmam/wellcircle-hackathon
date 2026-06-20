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
cd frontend && npm test     # navigation, error-boundary, and route smoke tests (Vitest + RTL)
```

The frontend suite runs the API client in mock mode, so it needs no backend. The route smoke test mounts every reachable screen and fails if any crashes.

---

## Documentation

Detailed docs live in [`docs/`](./docs):

- [API_CONTRACT.md](./docs/API_CONTRACT.md) — full endpoint specification and flow diagrams
- [BACKEND_REFERENCE.md](./docs/BACKEND_REFERENCE.md) — backend internals
- [PRD.md](./docs/PRD.md) — product requirements
- [HANDOFF.md](./docs/HANDOFF.md) — implementation status and change log

Repository conventions for contributors (and AI assistants) are in [CLAUDE.md](./CLAUDE.md).
