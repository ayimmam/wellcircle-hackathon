# Well Circle Concierge

The AI wellness concierge for **Well Circle** — a FastAPI microservice that turns a user's goal, budget, or neighbourhood into grounded provider recommendations for Addis Ababa. Powered by Groq-hosted models with Supabase as the live provider source.

The companion chat UI lives in [`index.html`](./index.html); the production base URL used by the clients is `https://well-circle-concierge.vercel.app/ai/concierge`.

---

## Design priorities

This service is built around two non-negotiables:

### Low hallucination
The model is treated as untrusted and its output is always grounded against real data:

- **No invented providers** — a recommendation is kept only if its `provider_id` exists in the live/fallback dataset; unknown ids are dropped.
- **Authoritative names** — `provider_name` is always looked up from our own record by id, never taken from the model (so a real id + wrong name is corrected, not surfaced).
- **Grounded prices** — if a provider/event is selected, every explicit ETB amount in the reply must match its listed `price_range`/`price_etb` (the user's own budget is allowed). A mismatched reply is replaced with a deterministic listing-backed answer before it is returned or persisted.
- **Grounded availability** — event `spots_remaining` claims are checked the same way. Providers have no live appointment-slot data, so numeric availability claims without a matched event are rejected. Sold-out is only accepted when `spots_remaining` is `0`, and reservation/booking confirmations are always rejected because the listing cannot prove a place was held. Free/no-cost claims are checked against the selected listing just like numeric ETB amounts.
- **No unverified event prose** — if the model returns an `event_id` that is absent from the current dataset (for example after an event-fetch failure), the whole reply is replaced with a short refusal rather than retaining an event recommendation whose id was dropped.
- **Fresh fallback events** — the demo event fixture is shifted to the next future Saturday/Sunday on every degraded-mode fetch, so the service never recommends a past event when Supabase is unavailable.
- **Allow-listed prompt** — only a fixed set of provider fields is sent to the model, keeping internal columns out of the prompt and the payload small.
- **Validated decoding** — the model's JSON is parsed and checked, low temperature (0.2) is used, null-like values are normalised, and empty replies are replaced with a safe fallback.
- **Data-source isolation** — provider/event fetch exceptions fall back to the local dataset (or no events) instead of turning the chat into a 500.

### Fast response
- **Provider/event TTL cache** — provider and upcoming-event lists are cached in-memory (default 60s) instead of hitting Supabase on every chat turn.
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
| `GROQ_MODEL` | no | `openai/gpt-oss-20b` | Groq model id |
| `GROQ_MAX_TOKENS` | no | `1024` | Generation cap |
| `GROQ_TIMEOUT_SECONDS` | no | `20` | Upstream timeout |
| `PROVIDER_CACHE_TTL_SECONDS` | no | `60` | Provider and upcoming-event cache lifetime |
| `MEMORY_INACTIVITY_HOURS` | no | `24` | Inactivity window before conversation history is ignored |
| `MEMORY_MAX_MESSAGES` | no | `5` | Maximum stored messages per conversation |
| `MEMORY_CACHE_MAX_SESSIONS` | no | `1000` | Bound for the process-local fallback cache |
| `JWT_SECRET` | yes for signed-in chat | — | Must match the main FastAPI backend's user-JWT secret |
| `JWT_ALGORITHM` | no | `HS256` | User-JWT algorithm; only HS256 is supported |
| `ANON_SESSION_SECRET` | no | derived from `JWT_SECRET` | Optional separate signing key for anonymous credentials |
| `ANON_SESSION_TTL_HOURS` | no | `720` | Anonymous credential lifetime (30 days) |
| `PORT` | no | `8000` | Server port |

Without valid Supabase credentials the service runs in degraded mode on a built-in fallback provider dataset, so it always responds.

### Conversation memory

`chat_memory.updated_at` is the authoritative last-activity timestamp. A
conversation is treated as expired once that timestamp is at least
`MEMORY_INACTIVITY_HOURS` old (24 hours by default).

- Every request reads the Supabase row before using history.
- A successful turn is appended with the `append_chat_turn` RPC. PostgreSQL
  locks the session row, checks expiry after the lock, appends only the current
  user/assistant turn, trims the stored messages, and generates `updated_at`
  with `clock_timestamp()`. The timestamp cannot move backwards.
- The RPC response is validated (messages, timestamp, and the current turn)
  before the code treats persistence as successful.
- Expired history is never passed to the model and is reset when the next turn
  is appended. It is not restored from the process cache.
- Client-supplied `history` is accepted for request compatibility but is
  **always ignored**. `session_id` plus the stored row is the only source of
  truth, so an old or unknown id cannot resurrect a conversation.
- `is_first_message` is not used to decide whether server history is valid.
- The process-local cache is bounded, thread-safe, and only used when Supabase
  is not configured; it never overrides a database read.
- If the database read fails, the turn is answered without memory and
  persistence is skipped rather than overwriting an unknown row. If the append
  fails, the user still receives the validated reply.
- The append RPC reports `stale_turn` when the row changed after this request
  read its history. Both turns are preserved, but the existing protocol has no
  server-side turn sequence, so the order of concurrent turns is not rewritten.

### Conversation experience (first visit / returning / expired)

Clients open the chat with `GET /ai/concierge/session`; they do **not** send a
fake `__init__` chat turn. This endpoint is read-only: it never calls the model
or creates/updates a `chat_memory` row.

| Server state | What the client renders |
|---|---|
| New session | Full first-visit intro + four server-owned suggestion cards |
| Active session (< `MEMORY_INACTIVITY_HOURS`) | Stored history, **no greeting**, no cards |
| Expired session (>= `MEMORY_INACTIVITY_HOURS`) | Short fresh welcome + the same four cards, no stale history |

The response contains `experience`, `welcome` (text + cards), `history`,
`session_id`, `profile_name`, and an `anonymous_token` when a new anonymous
identity was issued. Expired or another owner's history is never returned.
Temporary memory outages return `memory_available: false` without repeating the
first-visit onboarding copy.

The Telegram Mini App, public web app, and standalone `index.html` all use this
endpoint. Message responses no longer carry an `intro`; each successful turn
renders exactly one reply bubble. Clearing local chat state does not remove the
anonymous identity, so a remembered name survives.

### Persistent profile and consented preferences

Migration `029` adds `public.chat_profile`, keyed by the same
`(owner_type, owner_id)` identity as chat memory. It stores:

- `display_name` — remembered independently of short-term history, so an expired
  conversation still greets the user by name. Signed-in users may also fall back
  to `users.name` when no chat profile row exists.
- `preferences` — only when the client sends `consent: true` to
  `PATCH /ai/concierge/profile`. Preference data is not inferred from ordinary
  chat messages, and writes without explicit consent return HTTP 400. The read
  path also ignores any stored preferences whose consent timestamp is missing.

An explicit conversational statement such as “my name is Selam” or “you can
call me Selam” is treated as consent to remember the name. Name extraction is
deliberately conservative; generic phrases like “I'm stressed” are not names.
Profile reads/writes are best-effort: if migration 029 has not been applied or
the profile table is unreachable, chat still works with an empty profile.

### Session ownership and credentials

Each conversation row stores `owner_type` (`user` or `anonymous`) and
`owner_id`. The owner is checked before stored history is read or sent to the
model, and the RPC checks it again while the session row is locked. Supplying a
known session id owned by another identity returns HTTP 403; it does not expose
the history or append a turn.

- **Signed-in users** send `Authorization: Bearer <backend JWT>`. The chatbot
  verifies the existing HS256 JWT with the same `JWT_SECRET` as the main
  backend and uses the JWT `sub` (the users table UUID) as `owner_id`. Telegram's
  external id is not used as the database owner key.
- **Anonymous visitors** send `X-Circler-Anonymous-Token`. The first anonymous
  response includes a freshly signed `anonymous_token`; the client persists it.
  Anonymous credentials use a distinct token type and a separate/derived
  signing key, never the user-JWT key format, and no `users` row is created.
- An invalid or expired `Authorization` header returns HTTP 401. It is never
  silently downgraded to an anonymous session, even when a valid anonymous
  credential is also present. An invalid anonymous credential also returns 401.
- A user JWT is rejected in the anonymous header, and an anonymous credential
  is rejected as a user JWT.
- Client-supplied `history` remains ignored. Ownership is enforced server-side.

Apply Alembic revisions `030`, `031`, then `032`
(`backend/alembic/versions/032_chat_profile.py`) through the repository's
Alembic workflow when configured, or execute the canonical
`backend/supabase/migrations/027_chat_memory_append.sql`,
`028_chat_memory_ownership.sql`, and `029_chat_profile.sql` directly for a
manual disposable-database check. Do this in a disposable database first, then
to the deployment project **before** deploying this chatbot code. The Alembic
revisions execute those SQL files, so the two paths stay in sync. Any instance
still running the pre-RPC overwrite upsert must be retired promptly; keep
old/new instance overlap short.

The backend `alembic/env.py` is currently a placeholder in this checkout, so
do not assume `alembic upgrade` runs until that pre-existing setup is verified;
the SQL files are the operational path meanwhile.

Before applying, verify the existing `public.chat_memory` table definition:
the repository does not contain its `CREATE TABLE`. Revision `028` marks any
pre-existing rows as inaccessible `legacy` rows, enables RLS, and revokes direct
table access from `anon`/`authenticated`, but the exact legacy column types,
existing policies, and key shape must still be checked in the target project.
The RPC is granted only to `service_role`.

---

## API

### `GET /ai/concierge/session?session_id=...`

Opening the chat. `session_id` is optional; the server generates one when it is
missing. Send the same credential headers as a chat turn.

```jsonc
{
  "session_id": "server-issued-or-echoed-id",
  "experience": "first_visit | returning | expired",
  "welcome": {
    "text": "…",
    "cards": [
      { "id": "events", "label": "Wellness events this week",
        "prompt": "Wellness events this week", "needs_location": false }
    ]
  },
  "history": [{ "role": "user", "content": "…" }],
  "profile_name": "Selam | null",
  "anonymous_token": "opaque credential | null",
  "memory_available": true
}
```

`welcome` is `null` for a returning conversation inside the inactivity window.
`history` is empty for a first visit and after expiry. HTTP `403` still means
the session id belongs to another identity; clients should discard it and
retry without a session id.

### `GET /ai/concierge/profile`

Reads the caller's persistent profile for the settings panel. Same
credential headers as a chat turn; ownership always comes from the request
credential, never from a client-supplied id.

```jsonc
{
  "display_name": "Selam | null",
  "preferences": { "budget_etb": 500, "neighbourhood": "Old Airport" },
  "consent_recorded": true
}
```

`consent_recorded` mirrors the row's `preferences_consent_at`. Preferences are
returned only when that consent timestamp exists; without it the read path
ignores anything stored.

### `DELETE /ai/concierge/preferences`

Deletes the saved preference data (stored `preferences` is emptied) while
keeping the profile name and the recorded consent grant. This is the settings
panel's "delete saved preferences" action.

### `DELETE /ai/concierge/personalization`

Disables personalization: withdraws consent and deletes the stored preference
data in one operation. After this, no saved preference reaches the model's
system prompt on any later turn. Withdrawal never requires a `consent` flag —
turning personalization off is itself the withdrawal. The profile name is
not affected.

### `DELETE /ai/concierge/history?session_id=...`

Clears the server-side conversation: deletes the caller's `chat_memory` row
for that session. The session id is only a selector — the owner columns come
from the request credential, so another identity's or a legacy row is never
deleted, and an unknown session id is an idempotent success. The persistent
profile (`chat_profile`) is never touched. On success the response returns a
fresh `session_id` for the next conversation:

```jsonc
{ "cleared": true, "session_id": "new-server-issued-id" }
```

### `PATCH /ai/concierge/profile`

Requires `consent: true`. Example:

```jsonc
{
  "display_name": "Selam",
  "preferences": {
    "interests": ["yoga"],
    "neighbourhood": "Bole",
    "budget_etb": 500,
    "notes": "Mornings only"
  },
  "consent": true
}
```

Unknown preference keys are ignored. Invalid shapes/names return `400`; an
unavailable profile table returns `503`. Stored preferences are added to the
model's system prompt on later turns — and stop being added once consent is
withdrawn via `DELETE /ai/concierge/personalization`. The response returns the
freshly read profile, including the actual `consent_recorded` state.

### `POST /ai/concierge`

Signed-in client:

```http
Authorization: Bearer <backend user JWT>
Content-Type: application/json
```

Anonymous client:

```http
X-Circler-Anonymous-Token: <server-issued anonymous token>
Content-Type: application/json
```

On the very first anonymous request, omit the anonymous header. The response
returns the signed credential for the client to persist.

```jsonc
// request — session_id is omitted on the first turn
{
  "message": "Affordable gym near Bole",
  "session_id": "server-issued-id | omitted",
  "history": []              // legacy field, accepted but always ignored
}

// response
{
  "reply": "…",
  "provider_id": "fb-001 | null",
  "provider_name": "Bole Wellness Hub | null",
  "event_id": "fe-001 | null",
  "event_name": "Sunrise HIIT at Bole Wellness Hub | null",
  "event_provider_id": "fb-001 | null",
  "data_source": "live | fallback",
  "session_id": "server-issued-id",
  "anonymous_token": "opaque signed credential | null",
  "profile_name": "Selam | null"
}
```

The client must persist the returned `session_id` and send it on later turns,
together with the credential for the same identity. `anonymous_token` is
non-null only when a new anonymous identity was issued. `history` remains in
the request model so older clients keep working, but the server never reads it.
`is_first_message` is likewise accepted and ignored. Welcome copy is owned by
the server and served only by `GET /ai/concierge/session`; chat turns never
return an `intro` or an unsolicited greeting.

HTTP status behavior:

- `401` — the supplied user or anonymous credential is malformed, tampered
  with, or expired. The client must not retry the same failing user token as an
  anonymous request.
- `403` — the session id exists but belongs to a different identity (including
  pre-Phase-2 `legacy` rows). The client may clear the local session id and
  start a new conversation; the old history remains inaccessible.

---

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

The deterministic price/availability guard also has a dependency-free quality
suite that can run without installing anything:

```bash
python quality_eval.py        # from chatbot/
python migration_check.py     # from chatbot/ (static SQL/revision contract)
```

`quality_eval.py` prints a pass/fail line per scripted model reply and exits
non-zero if any grounding case regresses. `migration_check.py` validates the
Alembic chain, canonical SQL signatures, RPC parameter names, RLS/privilege
statements, and downgrade paths without connecting to a database. Neither is a
substitute for applying the SQL to a disposable PostgreSQL database. The
chatbot CI job runs both before `pytest`.

The suite mocks Groq and Supabase, so it runs offline and fast. `conftest.py`
removes the live Supabase client for every test, even when a developer has a
populated `.env`. Coverage focuses on the anti-hallucination guards (unknown
ids dropped, names canonicalised, invented prices/availability replaced, stale
fallback events shifted forward, no field leakage), graceful degradation
(model/JSON/RPC/data-source errors → friendly reply, never a 500), expiry,
atomic append, response validation, cache bounds/thread safety,
user/anonymous credential verification, tampering/expiry rejection, and
cross-identity session access.
`test_experience.py` covers first-visit/returning/expired rendering,
history restoration without a repeated greeting, server-side opening with no
model call, profile names surviving expiry, and consent-gated preferences.
`test_profile.py` covers conservative name extraction, sanitization,
preference allow-listing, graceful profile degradation, the recorded-consent
flag, and the preference deletion/withdrawal paths.
`test_settings.py` covers the settings-panel API: profile read with consent
state, identity isolation, saving, deletion vs. withdrawal, disabled
preferences never reaching model prompts, owner-scoped history clearing that
never touches the profile, idempotent unknown sessions, and reported failures.
`test_integration_flows.py` chains the real endpoint flows together:
anonymous bootstrap → credential issuance → chat → returning restore,
authenticated ownership, expiry with a surviving profile name, consent-gated
preferences, cross-identity rejection, grounded event persistence, provider/event
outage handling, and memory-read failure without history exposure.
`test_migrations.py` runs the static migration-contract checks under pytest.
