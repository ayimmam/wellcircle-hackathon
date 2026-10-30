# Well Circle — AI Concierge Integration Handoff

> **Audience:** Frontend (Telegram Mini App) team, Backend integration owner
> **Service:** Standalone FastAPI AI Concierge (separate from main `/api` backend)
> **Status:** Base URL verified live. Deploy the build containing `/session` and `/profile` before shipping clients.
> **Live Base URL:** `https://well-circle-concierge.vercel.app`
> **Primary Endpoint:** `POST https://well-circle-concierge.vercel.app/ai/concierge`
> **Last updated:** June 2026

---

## 1. Overview & Purpose

The AI Concierge is a chat-based feature that lets users describe their wellness needs in natural language — mood, budget (ETB), neighbourhood, or service type — and receive an instant, AI-generated provider recommendation pulled from the real `providers` table.

It is a **standalone microservice**, separate from the main Well Circle backend (`/api/*` routes documented in the API Contract). Signed-in users send the main backend's existing user JWT; anonymous visitors receive a separate server-signed credential. Anonymous chat does not create a user row. It can be embedded anywhere in the Mini App (Home screen floating button recommended).

**The deployed service is live, but this branch adds owner-aware chat memory, credentials, server-owned opening state, and stricter grounding. Deploy the service build and database revisions before enabling the new client flow.**

---

## 2. Architecture Summary

```
Telegram Mini App (React)
    │
    │  user types message in "Ask Well Circle" widget
    ▼
Concierge Widget (concierge.html or React component)
    │
    │  GET  /ai/concierge/session  (welcome/history; no model call)
    │  POST /ai/concierge          (one chat turn)
    ▼
FastAPI Concierge Service (deployed on Vercel)
    │
    ├──► Supabase (providers/events + owner-scoped chat_memory/chat_profile)
    │         │
    │         └──► failure (DNS / PGRST205 / timeout) ──► use FALLBACK_PROVIDERS
    │
    ├──► Groq API (structured JSON output)
    │
    └──► Response: { reply, provider_id, provider_name, data_source,
                      session_id, profile_name, anonymous_token }
              │
              ▼
    Concierge Widget renders reply + optional "View Provider" link
              │
              ▼
    postMessage → Mini App router → /provider/:id (existing Provider Detail screen)
```

**Key point for frontend team:** `provider_id` returned by this service corresponds to the **same `providers.id`** used by the main backend's `GET /api/providers/:id` endpoint (when `data_source: "live"`). No ID translation needed — it's the same table.

---

## 3. Environment Variables (Configured on Vercel)

These are already set in the Vercel project for the live deployment. Documented here for reference/troubleshooting only — **no action needed unless rotating keys**.

| Variable | Purpose | Source |
|---|---|---|
| `GROQ_API_KEY` | Auth for Groq's chat completions API (model set by `GROQ_MODEL`) | console.groq.com → API Keys |
| `SUPABASE_URL` | Project URL for live `providers` table queries | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | **Must be the `service_role` / `sb_secret_...` key**, not the `anon`/`sb_publishable_...` key — bypasses RLS for reliable reads | Supabase Dashboard → Settings → API → Secret keys |
| `JWT_SECRET` | Verifies signed-in user JWTs; must match the main backend | Main backend environment |
| `ANON_SESSION_SECRET` | Optional separate signing key for anonymous credentials; derived from `JWT_SECRET` when omitted | Deployment secret |
| `MEMORY_INACTIVITY_HOURS` | Conversation expiry window (default 24) | Deployment environment (optional) |
| `MEMORY_MAX_MESSAGES` | Maximum stored messages per conversation (default 5) | Deployment environment (optional) |

**If rotating any of these:** update the Vercel project environment variables and redeploy.

---

## 4. Hybrid Database Logic

### How it works

Every request to `/ai/concierge` calls `fetch_providers()`, which:

1. Attempts a live query: `supabase_client.table("providers").select("*").execute()`
2. **If successful and returns ≥1 row** → uses live data, marks `data_source: "live"`
3. **If it fails for any reason** (DNS resolution failure, `PGRST205` schema cache error, network timeout, Supabase outage) **or returns 0 rows** → silently falls back to the hardcoded `FALLBACK_PROVIDERS` array, marks `data_source: "fallback"`

This means **the demo cannot crash due to a database issue** — worst case, the AI recommends from a curated local dataset of 5 realistic Addis Ababa providers instead of the live table.

### `PGRST205` — what it is and why this matters

`PGRST205: Could not find the table 'public.providers' in the schema cache` is PostgREST's error when it can't resolve the table — usually caused by:
- Wrong Supabase project URL
- Using the publishable/anon key without correct RLS read policies
- Stale schema cache after a recent migration

The hybrid logic means **this error degrades gracefully** rather than returning a 500 or crashing the widget. The live deployment has already been verified to connect successfully (see Section 9 verification steps).

### Keeping `FALLBACK_PROVIDERS` in sync

The fallback dataset (5 entries: gym, yoga, nutrition, spa, therapy — one per category, spread across Bole/Kazanchis/CMC/Sarbet) should be **periodically refreshed** to roughly match real seeded provider names/prices, so that if it activates mid-demo, judges don't notice a mismatch with the rest of the app. This is a manual edit to the `FALLBACK_PROVIDERS` list in `main.py`, followed by a redeploy.

### Debugging on stage

The response includes `"data_source": "live"` or `"data_source": "fallback"`. This field is **not currently displayed in the UI** but is present in the raw JSON response — useful for confirming which path is active by checking `/docs` or curl against the live URL before the demo.

---

## 5. API Contract — Live Endpoint

### Health check
```
GET https://well-circle-concierge.vercel.app/
```
```json
{
  "status": "ok",
  "service": "well-circle-concierge",
  "database": "live"  // or "unreachable_using_fallback" or "not_configured"
}
```
**Use this to verify Supabase connectivity and warm a cold serverless instance before a demo** (see Section 8).

### Opening the chat
```
GET https://well-circle-concierge.vercel.app/ai/concierge/session?session_id=...
```

Send the same `Authorization: Bearer <user JWT>` or
`X-Circler-Anonymous-Token: <anonymous token>` header used for chat. The
response contains `experience` (`first_visit`, `returning`, or `expired`),
`welcome` (text plus four cards, `null` when returning inside 24h), owned
`history`, `session_id`, `profile_name`, and an `anonymous_token` when a new
identity was issued. This endpoint never calls the model or writes
`chat_memory`.

### Main endpoint
```
POST https://well-circle-concierge.vercel.app/ai/concierge
Content-Type: application/json
```

**Request:**
```json
{
  "message": "I'm stressed and have 500 ETB",
  "session_id": "server-issued-id"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | string | yes | Free-text user input |
| `session_id` | string | no | Persist the server-issued value after the first response |
| `history` | array | no | Legacy field; accepted but always ignored |
| `is_first_message` | boolean | no | Legacy field; accepted but ignored |

**Response:**
```json
{
  "reply": "Serenity Yoga Studio in Kazanchis offers calming sessions from ETB 500 — perfect for unwinding on a budget.",
  "provider_id": "uuid-or-fb-002",
  "provider_name": "Serenity Yoga Studio",
  "data_source": "live",
  "session_id": "server-issued-id",
  "anonymous_token": null,
  "profile_name": "Selam"
}
```

| Field | Type | Notes |
|---|---|---|
| `reply` | string | 2–4 sentences (see Section 6.3); never a greeting |
| `provider_id` | string \| null | Matches `providers.id` in Supabase — `null` if off-topic or no match |
| `provider_name` | string \| null | Human-readable name for display — `null` alongside `provider_id` |
| `data_source` | string | `"live"` or `"fallback"` — for debugging, not user-facing |
| `session_id` | string | Echo/generated id the client persists |
| `anonymous_token` | string \| null | Non-null only when a new anonymous identity is issued |
| `profile_name` | string \| null | Name remembered outside expiring history |

**Persistent profile:** `PATCH /ai/concierge/profile` stores a display name or
preferences only with `"consent": true`. Without it the server returns 400.
See `chatbot/README.md` for the full payload.

**Anti-hallucination guarantee:** the backend validates `provider_id` and
`event_id` against the actual fetched dataset (live or fallback) before
returning them. If the AI invents an ID that doesn't exist, both its ID and
display name are nulled out server-side — the frontend will never receive a
broken provider/event link. If the rejected id is an event, the reply is also
replaced with a short refusal, so an unverified event cannot survive in prose.
For a selected listing, explicit `ETB` amounts, free/no-cost claims, and event
`spots_remaining` claims are checked against the fetched row; a mismatch is
replaced with a deterministic listing-backed reply before the response is
returned or persisted. Reservation/booking confirmations are rejected because
the listing does not prove a place was held. Clients must not substitute a
different provider or rewrite the server reply when `data_source` is
`fallback`. Degraded-mode demo events are shifted to the next future weekend, so
a stale fixture date is never presented as an upcoming event.

**Interactive API docs:** `https://well-circle-concierge.vercel.app/docs` (Swagger UI — useful for manual testing without writing curl commands)

---

## 6. Telegram User Journey & Frontend Integration

### 6.1 Server-owned opening state

Clients no longer hardcode a greeting and no longer send a silent `__init__`
chat turn. On open they call:

```
GET https://well-circle-concierge.vercel.app/ai/concierge/session?session_id=...
```

with the same user JWT or anonymous credential used for chat. The response has
one of three experiences:

| Server state | UI |
|---|---|
| `first_visit` (new session) | Full intro + four suggestion cards |
| `returning` (active within 24h) | Restored history, **no greeting**, no cards |
| `expired` (older than 24h) | Short fresh welcome + four suggestion cards, no stale history |

The endpoint is read-only: it never calls the model, never creates a
`chat_memory` row, and therefore cannot produce an unsolicited assistant reply.
`welcome` is `null` for a returning conversation. The four cards are
server-owned (`id`, `label`, `prompt`, `needs_location`) so the Telegram Mini
App, public web app, and standalone demo render the same options.

### 6.1b Settings panel (personalization + conversation controls)

The chat header has a gear button that opens a compact settings panel in all
three clients. It is backed by four owner-scoped endpoints behind the same
credential rules as chat:

| Action in the panel | Endpoint | Effect |
|---|---|---|
| View saved profile | `GET /ai/concierge/profile` | Returns `display_name`, `preferences`, `consent_recorded` |
| Save/edit preferences | `PATCH /ai/concierge/profile` | Requires `consent: true`; stores preferences |
| Enable personalization | `PATCH /ai/concierge/profile` with `{"consent": true, "preferences": {}}` | Records consent so preferences may be saved |
| Delete saved preferences | `DELETE /ai/concierge/preferences` | Removes the preference data; name and consent grant stay |
| Disable personalization | `DELETE /ai/concierge/personalization` | Withdraws consent AND deletes saved preferences |
| Clear conversation history | `DELETE /ai/concierge/history?session_id=...` | Deletes the owned `chat_memory` row only |

Client rules mirrored by all three implementations:

* The toggle state always comes from the server (`consent_recorded`), never a
  local guess.
* Disabling prompts for confirmation first (it deletes saved preferences) and
  calls the withdrawal endpoint; the response is authoritative even if it
  means the toggle goes off with no data left to keep.
* Deleting preferences asks for confirmation; ordinary saves/toggles do not.
* Every operation waits for the backend response before updating the UI;
  failures surface as an inline error and the previous state is kept.
* Clearing history swaps in the freshly issued `session_id` from the response
  and reloads the opening experience; the anonymous credential and thus the
  persistent profile are intentionally preserved.
* A session id is a selector only. Ownership for every endpoint is resolved
  server-side from the user JWT or anonymous credential.

### 6.2 Chat turns

| When | Frontend sends | Backend returns |
|---|---|---|
| Every message | `{ message, session_id }` | `reply` + provider/event metadata, never an `intro` |
| Every message | Credential header (`Authorization` or `X-Circler-Anonymous-Token`) | `session_id`, `profile_name`, optional new anonymous token |

**Frontend logic:**
```js
const API_URL = "https://well-circle-concierge.vercel.app/ai/concierge";

async function openChat() {
  const res = await fetch(`${API_URL}/session${sessionId ? `?session_id=${sessionId}` : ''}`, { headers });
  const data = await res.json();
  if (data.welcome) addMessage(data.welcome.text, 'assistant');
  if (data.history) data.history.forEach(m => addMessage(m.content, m.role));
  renderCards(data.welcome?.cards || []);
}

async function sendMessage(text) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentials },
    body: JSON.stringify({ message: text, session_id: sessionId }),
  });
  const data = await res.json();
  addMessage(data.reply, 'assistant');
  if (data.provider_id) addProviderLink(data.provider_id, data.provider_name, data.data_source);
  sessionId = data.session_id;
}
```

The server persists only the current turn. The next open restores the stored
history; opening again with an active session must not repeat the greeting.

### 6.2.1 Profile name and consented preferences

A profile name is stored in `public.chat_profile`, separately from the expiring
`chat_memory` row, so an expired conversation can still say “Welcome back,
Selam!”. Signed-in users may fall back to `users.name`. Explicit statements such
as “my name is Selam” are remembered; generic phrases are not.

Preference data uses `PATCH /ai/concierge/profile` and requires `consent: true`.
Without it the server returns HTTP 400. Preferences survive history expiry and
are included in the model prompt only when the row records that explicit
consent; a stored preference without a consent timestamp is ignored on read.

**UX note:** the full intro is intentionally longer than a normal reply. It is
rendered once on first visit and is not returned by chat turns. After expiry,
only the short welcome is shown.

### 6.3 Response Length Control

The system prompt asks the model to keep `reply` to **2–4 sentences, including the closing question**. The deterministic grounding guard can replace a bad reply with a canonical listing-backed message.

**Frontend should NOT further truncate** `reply` — it's already concise. Just render it as-is in a chat bubble. If `reply` is empty or missing, fall back to a generic message like *"Let's find the best wellness option for you."*

### 6.4 Metadata Payload — Linking to Booking/Payment Pages

When `provider_id` and `provider_name` are non-null, render a tappable link/button below the reply bubble:

```jsx
{data.provider_id && data.data_source === 'live' && (
  <button onClick={() => navigate(`/provider/${data.provider_id}`)}>
    View {data.provider_name} →
  </button>
)}
```

This `provider_id` is the same UUID used by the main backend's `GET /api/providers/:id` — landing on the Provider Detail screen gives the user direct access to the existing **Book Now** CTA and Telebirr/M-Pesa payment flow (Section 6.4 of the PRD).

**Fallback caveat:** if `data_source: "fallback"`, `provider_id` will be a placeholder like `fb-001` and will **not** match a real row in the main `providers` table — navigating to `/provider/fb-001` will 404 against the real backend.

**Implemented client behavior:** open the provider detail route only for
`data_source: "live"`; for fallback data, send the user to the explore screen
with the provider name as a search term. Never substitute a different live
provider for the one the server returned.

```jsx
if (data.provider_id && data.data_source === 'live') {
  navigate(`/provider/${data.provider_id}`);
} else if (data.provider_name) {
  navigate('/explore', { state: { search: data.provider_name } });
}
```

This keeps fallback names useful without producing a broken `/provider/fb-001`
link.

---

## 7. Integration Steps for Frontend Team

### Option A — iframe (fastest, ~15 min)
1. Deploy `concierge.html` (pre-configured with the live Vercel URL above) to Netlify/Vercel as a static page
2. Add a floating "Ask Well Circle ✨" button to the Home screen
3. On tap, open a fullscreen/bottom-sheet modal containing:
   ```html
   <iframe src="https://<netlify-url>" style="width:100%; height:100%; border:none;" />
   ```
4. Listen for navigation messages:
   ```js
   window.addEventListener('message', (e) => {
     if (e.data.type === 'navigate_to_provider') {
       navigate(`/provider/${e.data.provider_id}`);
     }
   });
   ```

### Option B — Native React component (better long-term)
Port the `sendMessage()` logic and chat UI from `concierge.html` into an `AskWellCircle.jsx` component matching the app's existing design system (Tailwind classes, theme vars from `Telegram.WebApp.themeParams`). Same API contract, same live URL — just a different rendering layer.

### Testing checklist (against LIVE URL)
- [ ] `GET https://well-circle-concierge.vercel.app/` returns `"database": "live"`
- [ ] Open with a new session — confirm `first_visit` renders the full intro and four cards
- [ ] Reopen with an active session — confirm history returns with no greeting
- [ ] Reopen after the inactivity window — confirm the short welcome and four cards return
- [ ] Confirm opening the chat does not send `__init__` or call the model
- [ ] Test a query matching a real seeded provider — confirm `provider_id` matches a real `providers.id` and `/provider/:id` resolves
- [ ] Test an off-topic message ("what's the weather") — confirm `provider_id`/`provider_name` are `null` and `reply` redirects politely
- [ ] Force a fallback response and confirm the client does not replace the server's provider or rewrite `reply` with an unrelated live provider
- [ ] Force a fallback event and confirm the event pill opens the events list instead of a `/booking/:providerId` URL built from a placeholder id
- [ ] **Test inside actual Telegram Mini App** (not just browser) — confirm iframe renders, theme vars apply, postMessage navigation works
- [ ] Confirm `reply` stays within the documented 2–4-sentence limit across several queries

---

## 8. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Cold start / sleeping deployment** (the first request can be slower) | Hit `GET https://well-circle-concierge.vercel.app/` a few minutes before going on stage to warm the service |
| **Fallback dataset drift** — fallback provider names/prices no longer resemble real seeded data | Periodically review `FALLBACK_PROVIDERS` in `chatbot/models.py` against the current `providers` table, redeploy |
| **`provider_id` from fallback doesn't resolve in main app** | Frontend checks `data_source` before opening a provider detail route; it must not substitute an unrelated live provider |
| **`event_id` from fallback doesn't resolve in main app** | Frontend opens the events list instead of a `/booking/:providerId` route unless `data_source` is `live` |
| **Groq API rate limits / outage** | Caught by the `except` block — returns a graceful fallback `reply` instead of erroring |
| **AI hallucinates a provider/event id** | Server-side validation nulls out any id not present in the fetched dataset |
| **AI invents a price, free offer, reservation, or availability count** | Deterministic guard checks explicit ETB/free claims and `spots_remaining`/booking claims against the selected listing, replaces mismatches, and logs the violation |
| **An event is absent after an event-fetch failure** | The server rejects the id and replaces the whole reply with a short refusal, so an unverified event cannot remain in prose |
| **Stale fallback events** | `build_fallback_events()` shifts the demo fixture to the next future weekend on every degraded-mode fetch |

---

## 9. Pre-Demo Checklist

- [ ] `GET https://well-circle-concierge.vercel.app/` returns `"database": "live"` (confirms Supabase + the deployed service are healthy)
- [ ] Run 2-3 test queries via `/docs` to confirm response shape and two-sentence replies
- [ ] Widget deployed and iframe/component integrated into Home screen
- [ ] Full flow tested **inside Telegram** on a real device
- [ ] **5 minutes before demo:** hit the health check URL to warm the service
- [ ] Confirm `provider_id` from a real test query opens the correct Provider Detail page in the main app

---

*Well Circle AI Concierge — Integration Handoff | Hackathon Build | Deployment: Vercel | June 2026*
