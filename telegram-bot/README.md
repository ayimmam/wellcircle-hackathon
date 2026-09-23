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

## Tests

```bash
pip install -r requirements-dev.txt
pytest bot/tests -q
```

CI runs this suite on every PR. `bot/config.py` reads every setting through
`os.getenv` with a default, so the tests need no credentials.

Coverage is currently thin — one test file against ~976 lines. New handlers and
services should arrive with a test; follow the style in `bot/tests/test_nudges.py`.

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
├── render.yaml               # Render (Background Worker)
├── Procfile                  # legacy Railway config, remove once Render migration is confirmed
└── .env.example
```

## How It Communicates With Backend

- Uses `X-Bot-API-Key` header (shared secret)
- `POST /api/bot/register` — register user on /start
- `GET /api/bot/inactive-users` — get users to re-engage

## Deployment (Render)

Migrating from Railway to Render. `render.yaml` declares the service as a
**Background Worker** — the bot has no HTTP server, so a Web Service type will
time out waiting for a `$PORT` bind.

1. In Render, create the service from `telegram-bot/render.yaml` (Blueprint),
   or manually set the service type to **Background Worker**
2. Set root directory to `telegram-bot`
3. Start command: `python -m bot.main`
4. Add env vars from `.env.example`
5. Stop/suspend the Railway service before starting this one — Telegram allows
   only one `getUpdates` poller per bot token; running both at once produces
   `Conflict: terminated by other getUpdates request` errors
6. Once Render is confirmed stable, delete the Railway service and this
   repo's `Procfile`/`railway.json`

## API Contract

See [API_CONTRACT.md](../docs/API_CONTRACT.md) — Bot section (Section 2).
