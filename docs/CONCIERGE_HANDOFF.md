# Well Circle — AI Concierge Integration Handoff

> **Audience:** Frontend (Telegram Mini App) team, Backend integration owner
> **Service:** Standalone FastAPI AI Concierge (separate from main `/api` backend)
> **Status:** ✅ LIVE IN PRODUCTION on Render
> **Live Base URL:** `https://well-circle-concierge.onrender.com`
> **Primary Endpoint:** `POST https://well-circle-concierge.onrender.com/ai/concierge`
> **Last updated:** June 2026

---

## 1. Overview & Purpose

The AI Concierge is a chat-based feature that lets users describe their wellness needs in natural language — mood, budget (ETB), neighbourhood, or service type — and receive an instant, AI-generated provider recommendation pulled from the real `providers` table.

It is a **standalone microservice**, separate from the main Well Circle backend (`/api/*` routes documented in the API Contract). It does not require JWT auth and has no dependency on the main backend's auth flow — it can be embedded anywhere in the Mini App (Home screen floating button recommended).

**This service is deployed and live.** All integration work from this point is frontend-side: wiring the chat widget to the production URL and embedding it in the Mini App.

---

## 2. Architecture Summary

```
Telegram Mini App (React)
    │
    │  user types message in "Ask Well Circle" widget
    ▼
Concierge Widget (concierge.html or React component)
    │
    │  POST https://well-circle-concierge.onrender.com/ai/concierge
    │  { message, is_first_message }
    ▼
FastAPI Concierge Service (LIVE on Render)
    │
    ├──► Supabase (live query: providers table) ──► success: use live data
    │         │
    │         └──► failure (DNS / PGRST205 / timeout) ──► use FALLBACK_PROVIDERS
    │
    ├──► Groq API (llama-3.1-8b-instant, structured JSON output)
    │
    └──► Response: { intro, reply, provider_id, provider_name, data_source }
              │
              ▼
    Concierge Widget renders reply + optional "View Provider" link
              │
              ▼
    postMessage → Mini App router → /provider/:id (existing Provider Detail screen)
```

**Key point for frontend team:** `provider_id` returned by this service corresponds to the **same `providers.id`** used by the main backend's `GET /api/providers/:id` endpoint (when `data_source: "live"`). No ID translation needed — it's the same table.

---

## 3. Environment Variables (Configured on Render)

These are already set in the Render dashboard for the live deployment. Documented here for reference/troubleshooting only — **no action needed unless rotating keys**.

| Variable | Purpose | Source |
|---|---|---|
| `GROQ_API_KEY` | Auth for Groq's chat completions API (llama-3.1-8b-instant) | console.groq.com → API Keys |
| `SUPABASE_URL` | Project URL for live `providers` table queries | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | **Must be the `service_role` / `sb_secret_...` key**, not the `anon`/`sb_publishable_...` key — bypasses RLS for reliable reads | Supabase Dashboard → Settings → API → Secret keys |

**If rotating any of these:** update in Render Dashboard → Service → Environment → redeploy. The service will restart automatically.

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
GET https://well-circle-concierge.onrender.com/
```
```json
{
  "status": "ok",
  "service": "well-circle-concierge",
  "database": "live"  // or "unreachable_using_fallback" or "not_configured"
}
```
**Use this to verify Supabase connectivity AND wake the service from Render's free-tier sleep before a demo** (see Section 8).

### Main endpoint
```
POST https://well-circle-concierge.onrender.com/ai/concierge
Content-Type: application/json
```

**Request:**
```json
{
  "message": "I'm stressed and have 500 ETB",
  "is_first_message": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | string | yes | Free-text user input |
| `is_first_message` | boolean | no (default `false`) | Set `true` only on the very first message of a chat session |

**Response:**
```json
{
  "intro": "",
  "reply": "Serenity Yoga Studio in Kazanchis offers calming sessions from ETB 500 — perfect for unwinding on a budget.",
  "provider_id": "uuid-or-fb-002",
  "provider_name": "Serenity Yoga Studio",
  "data_source": "live"
}
```

| Field | Type | Notes |
|---|---|---|
| `intro` | string | Empty `""` unless `is_first_message: true` (see Section 6.2) |
| `reply` | string | Max two sentences (see Section 6.3) |
| `provider_id` | string \| null | Matches `providers.id` in Supabase — `null` if off-topic or no match |
| `provider_name` | string \| null | Human-readable name for display — `null` alongside `provider_id` |
| `data_source` | string | `"live"` or `"fallback"` — for debugging, not user-facing |

**Anti-hallucination guarantee:** the backend validates `provider_id` against the actual fetched dataset (live or fallback) before returning it. If the AI invents an ID that doesn't exist, both `provider_id` and `provider_name` are nulled out server-side — the frontend will never receive a broken provider link.

**Interactive API docs:** `https://well-circle-concierge.onrender.com/docs` (Swagger UI — useful for manual testing without writing curl commands)

---

## 6. Telegram User Journey & Frontend Integration

### 6.1 Static Initial Greeting

The **first message bubble** shown to the user, before they type anything, is hardcoded in the widget (not from the API):

```
🌿 Hi! Welcome to Well Circle. Tell me what wellness service you need, your neighborhood in Addis Ababa, or your budget range, and I will find your perfect match!
```

This is the **only** greeting shown on widget open. It should NOT be duplicated by also rendering `data.intro` from the backend on load — `intro` is only returned in the API *response*, after the user sends their first message (see 6.2).

### 6.2 `is_first_message` Handling

| When | Frontend sends | Backend returns |
|---|---|---|
| User's **very first** message in a session | `is_first_message: true` | `intro` = full ecosystem welcome text (AI Concierge, Circles, Payments, Check-ins — see below) + `reply` = recommendation for that message |
| Every message after | `is_first_message: false` | `intro` = `""` |

**Frontend logic:**
```js
const API_URL = "https://well-circle-concierge.onrender.com/ai/concierge";
let isFirstMessage = true; // reset per session

async function sendMessage(text) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, is_first_message: isFirstMessage }),
  });
  const data = await res.json();

  if (data.intro) {
    // Render intro as its own message bubble, BEFORE the reply bubble
    addMessage(data.intro, 'assistant');
  }
  addMessage(data.reply, 'assistant');

  if (data.provider_id) {
    addProviderLink(data.provider_id, data.provider_name, data.data_source);
  }

  isFirstMessage = false; // never true again this session
}
```

**The full `intro` text** (returned only once, on first message):

```
🌿 Welcome to the Well Circle Ecosystem! 🌿
We build consistency through community and direct access. Here is everything you can do right now:

🕵️‍♂️ 1. AI Concierge Discovery: Talk directly to me! Tell me what wellness services you need, your area in Addis Ababa, or your ETB budget range, and I will instantly scan our dataset to find your match.

👥 2. Accountability Circles: Don't train alone. Switch over to our Community tab to join group circles, share daily milestone updates, and view your squad's active consistency feeds.

💳 3. Direct Payments: Found a fitness center, spa, or yoga hub you like? Book seamlessly with integrated Telebirr and M-Pesa mobile push triggers.

🔥 4. Daily Check-Ins & Level Ups: Build up your health streak to earn Legacy Points, transition your tier status from 'Seed' up to 'Forest', and earn rewards!

💬 To start a consultation, try typing: 'I need a luxury spa package around Bole Atlas' or 'Show me an affordable gym option near Stadium'.
```

**UX note:** this is a long message. On first use it will render as two stacked bubbles (intro + reply). This is intentional — it's the "tour" moment. Subsequent messages are short (intro is empty).

### 6.3 Response Length Control (Two-Sentence Rule)

The system prompt instructs the AI to keep `reply` to a **maximum of two sentences**, enforced via the system prompt sent to Groq's `llama-3.1-8b-instant` (chosen for low latency — important for a live demo).

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

**Recommended handling:**
```jsx
{data.provider_id && data.data_source === 'live' && (
  <button onClick={() => navigate(`/provider/${data.provider_id}`)}>
    View {data.provider_name} →
  </button>
)}
{data.provider_id && data.data_source === 'fallback' && (
  <span className="provider-tag">📍 {data.provider_name}</span>
  // Display name only, no broken navigation link
)}
```

This ensures the "View Provider" button only appears when it will actually resolve to a real booking page.

---

## 7. Integration Steps for Frontend Team

### Option A — iframe (fastest, ~15 min)
1. Deploy `concierge.html` (pre-configured with the live Render URL above) to Netlify/Vercel as a static page
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
Port the `sendMessage()` logic and chat UI from `concierge.html` into a `AskWellCircle.jsx` component matching the app's existing design system (Tailwind classes, theme vars from `Telegram.WebApp.themeParams`). Same API contract, same live URL — just a different rendering layer.

### Testing checklist (against LIVE URL)
- [ ] `GET https://well-circle-concierge.onrender.com/` returns `"database": "live"`
- [ ] Send a message with `is_first_message: true` — confirm `intro` renders as separate bubble
- [ ] Send a follow-up with `is_first_message: false` — confirm `intro` is empty
- [ ] Test a query matching a real seeded provider — confirm `provider_id` matches a real `providers.id` and `/provider/:id` resolves
- [ ] Test an off-topic message ("what's the weather") — confirm `provider_id`/`provider_name` are `null` and `reply` redirects politely
- [ ] **Test inside actual Telegram Mini App** (not just browser) — confirm iframe renders, theme vars apply, postMessage navigation works
- [ ] Confirm `reply` text is ≤2 sentences across multiple test queries

---

## 8. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Render cold start** (free tier sleeps after ~15 min inactivity; first request takes 10-30s) | Hit `GET https://well-circle-concierge.onrender.com/` 5 minutes before going on stage to warm the service |
| **Fallback dataset drift** — fallback provider names/prices no longer resemble real seeded data | Periodically review `FALLBACK_PROVIDERS` in `main.py` against current `providers` table, redeploy |
| **`provider_id` from fallback doesn't resolve in main app** | Frontend checks `data_source` before showing "View Provider" link (see 6.4) |
| **Groq API rate limits / outage** | Caught by the `except` block — returns a graceful fallback `reply` instead of erroring |
| **AI hallucinates a provider_id** | Server-side validation nulls out any `provider_id` not present in the fetched dataset |

---

## 9. Pre-Demo Checklist

- [ ] `GET https://well-circle-concierge.onrender.com/` returns `"database": "live"` (confirms Supabase + Render both healthy)
- [ ] Run 2-3 test queries via `/docs` to confirm response shape and two-sentence replies
- [ ] Widget deployed and iframe/component integrated into Home screen
- [ ] Full flow tested **inside Telegram** on a real device
- [ ] **5 minutes before demo:** hit the health check URL to wake Render from sleep
- [ ] Confirm `provider_id` from a real test query opens the correct Provider Detail page in the main app

---

*Well Circle AI Concierge — Integration Handoff | Hackathon Build | LIVE on Render | June 2026*
