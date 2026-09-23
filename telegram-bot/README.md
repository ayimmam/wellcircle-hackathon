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
├── Procfile                 # worker process declaration
└── .env.example
```

## How It Communicates With Backend

- Uses `X-Bot-API-Key` header (shared secret)
- `POST /api/bot/register` — register user on /start
- `GET /api/bot/inactive-users` — get users to re-engage

## Deployment (Render)

The bot is declared in the repo-root `render.yaml` as a **Background Worker**
named `wellcircle-bot`. It long-polls `getUpdates` and binds no port, so it must
not be a Web Service — a free Web Service spins down when idle and polling would
stop.

1. Render → New → Blueprint → connect this repo, branch `main`.
2. Render reads `render.yaml` and prompts for every `sync: false` value. Fill
   them from `.env.example`. `BOT_API_KEY` must be byte-identical to the
   backend's — it is the shared secret behind `X-Bot-API-Key`.
3. Deploy. A healthy start logs `🟢 Well Circle Bot started` followed by the
   scheduled jobs (re-engagement, weekly digest, streak nudge, engagement push,
   keep-warm).

**One instance, always.** Telegram permits a single `getUpdates` consumer per
token; a second one produces `Conflict` errors and dropped updates. `render.yaml`
pins `numInstances: 1` — never raise it, and never run a second copy anywhere
else against the same token. `error_handler` in `bot/main.py` downgrades a
`Conflict` to a warning so a brief deploy overlap is survivable, but a sustained
one is not.

## API Contract

See [API_CONTRACT.md](../docs/API_CONTRACT.md) — Bot section (Section 2).
