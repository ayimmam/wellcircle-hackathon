# Well Circle Concierge

The AI wellness concierge for **Well Circle** — a FastAPI microservice that turns a user's goal, budget, or neighbourhood into grounded provider recommendations for Addis Ababa. Powered by Groq (Llama) with Supabase as the live provider source.

The companion chat UI lives in [`index.html`](./index.html); the deployed service runs on Render.

---

## Design priorities

This service is built around two non-negotiables:

### Low hallucination
The model is treated as untrusted and its output is always grounded against real data:

- **No invented providers** — a recommendation is kept only if its `provider_id` exists in the live/fallback dataset; unknown ids are dropped.
- **Authoritative names** — `provider_name` is always looked up from our own record by id, never taken from the model (so a real id + wrong name is corrected, not surfaced).
- **Allow-listed prompt** — only a fixed set of provider fields is sent to the model, keeping internal columns out of the prompt and the payload small.
- **Strict decoding** — JSON-only response format, low temperature (0.2), null-like values normalised, and empty replies replaced with a safe fallback.

### Fast response
- **Provider TTL cache** — provider data is cached in-memory (default 60s) instead of hitting Supabase on every chat turn.
- **Bounded generation** — `max_tokens` cap, a request timeout, and `max_retries=1` so a slow/failed upstream fails fast into the graceful fallback.
- **Compact prompt** — only the fields the model needs are serialised, reducing tokens (and latency).

Any model/Supabase failure degrades to a friendly reply with HTTP 200 — the user never sees a stack trace, while full detail is logged server-side.

---

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # or export the vars below
uvicorn main:app --reload     # http://localhost:8000  (health: GET /)
```

### Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GROQ_API_KEY` | yes | — | Groq API key |
| `SUPABASE_URL` | yes | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | yes | — | Supabase service key |
| `GROQ_MODEL` | no | `llama-3.1-8b-instant` | Groq model id |
| `GROQ_MAX_TOKENS` | no | `320` | Generation cap |
| `GROQ_TIMEOUT_SECONDS` | no | `20` | Upstream timeout |
| `PROVIDER_CACHE_TTL_SECONDS` | no | `60` | Provider cache lifetime |
| `PORT` | no | `8000` | Server port |

Without valid Supabase credentials the service runs in degraded mode on a built-in fallback provider dataset, so it always responds.

---

## API

`POST /ai/concierge`

```jsonc
// request
{ "message": "Affordable gym near Bole", "is_first_message": false, "history": [] }

// response
{ "intro": "", "reply": "…", "provider_id": "fb-001 | null",
  "provider_name": "… | null", "data_source": "live | fallback | n/a" }
```

`is_first_message: true` returns an empty reply (the frontend renders its own welcome) without calling the model.

---

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

The suite mocks Groq and Supabase, so it runs offline and fast. It focuses on the anti-hallucination guards (unknown ids dropped, names canonicalised, no field leakage) and graceful degradation (model/JSON errors → friendly reply, never a 500).
