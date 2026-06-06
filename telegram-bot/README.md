# Well Circle — Telegram Bot

## What It Does

1. **`/start`** — Captures `telegram_id` + handle, registers user via backend API, shows "Open Well Circle" Mini App button
2. **Re-engagement** — Daily job checks for users inactive 7+ days, sends push notification via Telegram

## Quick Start

```bash
cd telegram-bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Edit with your credentials
python -m bot.main
```

## Structure

```
telegram-bot/
├── bot/
│   ├── main.py              # Entry point + job scheduling
│   ├── config.py            # Environment config
│   ├── handlers/
│   │   └── start.py         # /start command
│   ├── services/
│   │   ├── api_client.py    # Calls backend API
│   │   └── reengagement.py  # Inactive user notifications
│   └── utils/
│       ├── keyboards.py     # Telegram button layouts
│       └── messages.py      # Message templates
├── requirements.txt
├── Procfile                 # Railway (worker)
└── .env.example
```

## How It Communicates With Backend

- Uses `X-Bot-API-Key` header (shared secret)
- `POST /api/bot/register` — register user on /start
- `GET /api/bot/inactive-users` — get users to re-engage

## Deployment (Railway)

1. Create new service on Railway
2. Set root directory to `telegram-bot`
3. Set start command: `python -m bot.main`
4. Add env vars from `.env.example`
5. Deploy as **worker** (not web service — no port needed)

## API Contract

See [API_CONTRACT.md](../API_CONTRACT.md) — Bot section (Section 2).
