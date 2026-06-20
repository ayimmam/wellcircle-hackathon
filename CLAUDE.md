# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Well Circle is a Telegram Mini App for wellness providers and communities in Ethiopia. It is a **monorepo of three independently-deployed services** that communicate over HTTP:

- `backend/` — FastAPI + SQLAlchemy + Supabase (PostgreSQL). Deployed to **Vercel** (serverless via `api/index.py`) and configured for Render (`render.yaml`, `Procfile`).
- `frontend/` — React 18 + Vite + react-router. The Mini App + super-admin UI. Deployed to **Vercel**.
- `telegram-bot/` — python-telegram-bot worker (polling). Deployed to **Railway** (1 replica only — duplicates cause `getUpdates` Conflict errors).

The `API_CONTRACT.md` at the repo root is the source-of-truth interface between all three teams. When changing request/response shapes, update it. `PRD.md`, `BACKEND_REFERENCE.md`, and the `*_HANDOFF.md` files are design docs.

## Commands

### Backend (`cd backend`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                  # set DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET, BOT_API_KEY
uvicorn app.main:app --reload         # docs at http://localhost:8000/docs
python -m app.db.seed                 # seed test users/providers
python -m app.tests.test_integration  # full integration test (in-memory SQLite, run as a script not via pytest)
```

### Frontend (`cd frontend`)
```bash
npm install
npm run dev                          # http://localhost:5173, proxies /api → backend (see vite.config.js)
npm run build
npm test                             # Vitest + RTL (happy-dom), runs once
npm run test:watch                   # Vitest watch mode
npx vitest run src/test/Header.test.jsx   # single test file
```
Tests run the API client in **mock mode** (`test.env` sets `VITE_USE_MOCK=true` in
`vite.config.js`), so screens render against `src/data/mock.js` with no network.
`src/test/routes.smoke.test.jsx` mounts every reachable route and fails if any
trips the ErrorBoundary — add new routes there.

### Telegram bot (`cd telegram-bot`)
```bash
pip install -r requirements.txt
cp .env.example .env   # BOT_TOKEN, BACKEND_URL, BOT_API_KEY, MINI_APP_URL
python -m bot.main
```

## Backend architecture

Layered, with one module per domain entity. A request flows:
`app/api/<entity>.py` (route + auth deps) → `app/crud/<entity>.py` (DB queries) → `app/models/<entity>.py` (SQLAlchemy ORM), with `app/schemas/` for Pydantic validation and `app/services/` for cross-cutting business logic.

- **Entry point** `app/main.py` registers every router, calls `register_error_handling(app)`, and starts the APScheduler background job (`app/services/scheduler.py`) on lifespan startup — but **only off serverless** (the job is skipped when the `VERCEL` env var is set, since frozen threads make it unreliable there; run decay via cron/Render instead). In `ENVIRONMENT=development` it auto-creates tables via `Base.metadata.create_all`; in production it does not — schema changes go through migrations.
- **Error handling & logging** `app/utils/error_handlers.py` registers global handlers + a request-timing middleware. The golden rule: **users get short, generic messages; operators get full detail.** Unhandled exceptions are logged with a traceback and a `request_id`, and the client receives only a generic message tagged with that same id (never a stack trace). Intentional `HTTPException` `detail` strings are written for users and pass through as-is. Use `app/utils/logger.py`'s `get_logger(name)` for logging — avoid bare `print()`.
- **Config** `app/config.py` — a single Pydantic `Settings` instance (`from app.config import settings`). Super-admin access is by Telegram ID via `SUPER_ADMIN_TELEGRAM_IDS` (comma-separated env var, exposed as `settings.super_admin_ids`).
- **Auth** is JWT bearer. `app/dependencies.py` provides `get_current_user`, `get_current_provider`, `get_super_admin` — use these as FastAPI deps for authz. `get_current_user` also bumps `last_activity_at` on every call (drives bot re-engagement). The bot itself authenticates with the shared `BOT_API_KEY` via the `X-Bot-API-Key` header, not JWT.
- **Telegram login** `app/services/telegram_auth.py` validates Mini App `initData` with HMAC-SHA256 derived from the bot token. `POST /api/auth/telegram` exchanges valid initData for a JWT.
- **Models** use UUID primary keys and JSONB columns — the integration test defines `SQLiteUUID`/`SQLiteJSONB` TypeDecorators so it can run on SQLite; keep that in mind when adding columns.

### Database migrations
Two parallel mechanisms exist — match what you're touching:
- **Alembic** lives in `backend/alembic/versions/` (`001_phase2`, `002_phase3`, `003_...`).
- **Ad-hoc psycopg2 scripts** in `backend/` (`apply_migration.py`, `apply_phase3_migration.py`, `apply_circle_migration.py`, `apply_rls.py`) run idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` against `DATABASE_URL`. The numerous `check_*.py`, `fix_*.py`, `patch_*.py`, `make_super_admin.py`, `seed_*.py` files at the backend root are one-off operational scripts, not part of the app.

## Frontend architecture

- `src/api/client.js` is the single API layer. It supports a **mock mode** (`VITE_USE_MOCK=true`, backed by `src/data/mock.js`) so the UI runs without a backend. `resolveApiBase()` returns same-origin `/api` in production (a Vercel proxy that avoids CORS in the Telegram WebView) and `http://localhost:8000/api` in dev.
- `src/context/AuthContext.jsx` drives login: it reads `window.Telegram.WebApp.initData`, calls `POST /api/auth/telegram`, and persists the JWT in `localStorage` (`wc_token`). Outside Telegram it falls back to a saved token or `'mock-init-data'`. Auth runs on **every** entry route, not just `/`, because Telegram can deep-link straight to `/admin`.
- `src/App.jsx` is the full route table. Every screen is **lazy-loaded** (`React.lazy` + `Suspense`) to keep the initial bundle small for free-tier/Telegram networks — only `SplashScreen` is eager. The chrome + routes live in the exported `AppShell` (router-agnostic, so tests mount it under a `MemoryRouter`); the default `App` wraps it with `BrowserRouter`/`ThemeProvider`/`AuthProvider`. Routes are wrapped in `components/ErrorBoundary` so one crashing screen shows a reload card, not a white page. Admin routes are gated by `components/AdminGuard`. `i18next` (`src/i18n.js`) provides localization; `ThemeContext` provides theming.
- **Polling** uses `src/hooks/usePolling.js`, which pauses while the app/tab is backgrounded (`document.hidden`) and refreshes on return — important so cold serverless functions aren't woken needlessly. Use it for any new interval polling instead of a raw `setInterval`.

## Cross-service contract

These env vars **must match** across services: `TELEGRAM_BOT_TOKEN` (backend + bot), `BOT_API_KEY` (backend + bot), and the URLs `FRONTEND_URL`/`BACKEND_URL`/`MINI_APP_URL`. The bot calls `POST /api/bot/register` (on `/start`) and `GET /api/bot/inactive-users` (re-engagement), both authenticated with `X-Bot-API-Key`.
