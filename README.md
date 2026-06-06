# Well Circle

**Your tribe, your wellness. Right where you chat.**

A Telegram Mini App connecting individuals and corporate teams to verified wellness providers across Ethiopia.

---

## 🏗️ Project Structure

```
wellcircle/
├── backend/              # FastAPI — hosted on Render
│   ├── app/
│   │   ├── main.py           # Entry point
│   │   ├── config.py         # Pydantic settings
│   │   ├── database.py       # SQLAlchemy + Supabase
│   │   ├── dependencies.py   # JWT auth, role checks
│   │   ├── api/              # Route handlers
│   │   │   ├── auth.py       # POST /api/auth/telegram
│   │   │   ├── users.py      # Profile + onboarding
│   │   │   ├── providers.py  # Browse + detail
│   │   │   ├── communities.py # Join, leave, checkin, feed
│   │   │   ├── bookings.py   # Create bookings
│   │   │   ├── payments.py   # Telebirr + M-Pesa
│   │   │   ├── admin.py      # Super admin CRUD
│   │   │   └── bot.py        # Bot registration + re-engagement
│   │   ├── models/           # SQLAlchemy ORM
│   │   ├── schemas/          # Pydantic validation
│   │   ├── crud/             # Database operations
│   │   ├── services/         # Business logic
│   │   └── db/seed.py        # Test data seeder
│   ├── requirements.txt
│   ├── Procfile              # Render deployment
│   └── .env.example
│
├── telegram-bot/         # Telegram Bot — hosted on Railway
│   ├── bot/
│   │   ├── main.py           # Bot entry point
│   │   ├── handlers/start.py # /start command
│   │   ├── services/
│   │   │   ├── api_client.py # Calls backend API
│   │   │   └── reengagement.py # Weekly push notifications
│   │   └── utils/            # Messages + keyboards
│   ├── requirements.txt
│   ├── Procfile              # Railway (worker)
│   └── .env.example
│
├── frontend/             # React + Vite Mini App — hosted on Vercel
│   └── (frontend team builds this using API_CONTRACT.md)
│
├── API_CONTRACT.md       # ⭐ Full endpoint spec for all teams
├── PRD.md                # Product requirements document
└── README.md             # This file
```

---

## 👥 Team Split

| Person | Works On | Directory | Deploys To |
|--------|----------|-----------|------------|
| **You** | Backend API | `backend/` | Render |
| **Teammate 1** | Frontend Mini App | `frontend/` | Vercel |
| **Teammate 2** | Telegram Bot | `telegram-bot/` | Railway |

**Key contract:** [API_CONTRACT.md](./API_CONTRACT.md) — every endpoint, request/response shape, and flow diagram.

---

## 🔄 How The Services Communicate

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
│              │ ◄── JSON ───── │  (Render)     │
└──────────────┘                │               │
                                │  Supabase DB  │
┌──────────────┐                │  (PostgreSQL) │
│  Super Admin │ ── JWT auth ──►│               │
│  (Mini App)  │                └───────────────┘
└──────────────┘
```

---

## ⚡ Quick Start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Edit with your credentials
python -m app.db.seed   # Seed test users
uvicorn app.main:app --reload
# API docs → http://localhost:8000/docs
```

### Telegram Bot
```bash
cd telegram-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Edit with your credentials
python -m bot.main
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env    # Set VITE_API_URL
npm run dev
```

---

## 🔐 Shared Secrets

These env vars must match across services:

| Variable | Used By | Notes |
|----------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | Backend + Bot | From @BotFather |
| `BOT_API_KEY` | Backend + Bot | Generate: `openssl rand -hex 32` |
| `FRONTEND_URL` | Backend | Vercel URL (for CORS) |
| `BACKEND_URL` | Bot | Render URL |
| `MINI_APP_URL` | Bot | Vercel URL (for WebApp button) |

---

## 📊 User Flow

```
1. User opens @WellCircleBot → taps /start
2. Bot captures telegram_id + handle → registers via backend API
3. Bot shows "Open Well Circle" button (WebApp)
4. User opens Mini App → auto-auth via Telegram initData → gets JWT
5. If not onboarded → Onboarding: name → goal → interest → frequency → circles
6. Home screen: browse providers, join communities, check in, earn points
7. Book services → pay via Telebirr or M-Pesa
8. If inactive 7+ days → bot sends re-engagement push notification
```

---

**Well Circle v1.1 | Hackathon Build | June 2026**