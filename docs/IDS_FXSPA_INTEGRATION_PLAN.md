# IDS Next / FX Spa Integration — Implementation Plan

**Status:** Draft for review · **Author:** engineering · **Date:** 2026-08-19
**Pilot window:** Jul 27 – Sep 27 2026 · **Go/No-Go:** Sep 27 2026 (≈5.5 weeks left)
**Sources:** `docs/IDS_Integration_Meeting_Notes.docx` (incl. its two inline comments),
`docs/FX Spa - Hospitality Software Solutions _ IDS Next.html`,
`docs/Kuriftu Resort - boston day spa.pdf`, `docs/kuriftu-gap-analysis.md`, and both codebases —
`wellcircle-hackathon/` (this repo) and its sibling `../wellcircle-web/` (app.wellcircle.et).

**Revision 2 (2026-08-19)** — incorporates answers on TravelBook, the upcoming IDS vendor meeting,
and the location of the web app. Changes from rev 1: TravelBook is reframed from "probably rooms" to
**our reference implementation**; §18 is restructured as a meeting agenda; §12.3 is now real,
schedulable work rather than an unknown.

---

## 0. TL;DR

The meeting notes frame this as "how do we get a Google Sheet into FortuneNext." That framing is
probably wrong for this pilot, for three reasons:

1. **Kuriftu runs only two IDS modules, and the one that matters here is FX Spa** — not FortuneNext
   Front Office. Boston Day Spa sells *appointments against therapists/rooms*, not room-nights.
2. **FX Spa is marketed as cloud-based** (IDS's own product page). The on-prem / VPN / local-agent
   anxiety in §2 of the notes is a FortuneNext 7.0 concern and may not apply to FX Spa at all.
3. **TravelBook is the answer to "is this even possible", and it changes the whole risk profile.**
   TravelBook is a booking platform *already integrated with IDS, doing what we are trying to do*.
   So the question is no longer "can a third-party booking platform write appointments into IDS" —
   it demonstrably can. The question is **"through which mechanism, and can we be granted the same
   one?"** That is a far better question, and it is answerable in a single meeting rather than a
   sprint of speculation. The notes' Option A (channel manager) is very likely a category error —
   channel managers distribute *room* inventory — and can be dropped in favour of asking the vendor
   directly how TravelBook is wired (§18, A1–A4).

We now have a **meeting scheduled with the IDS engineering team in India** for Kuriftu's account.
That is the right forum and it deserves a precise agenda rather than the open-ended discovery
questions in the original notes — §18 supplies one, built around "replicate the TravelBook path."

Even so: **the two features the comments actually ask for — never double-book, and tell the guest
reliably when a booking changes — do not require IDS integration to build, and must not be blocked
on it.** They require us to own an inventory model and a delivery-guaranteed notification
pipeline on our side. IDS sync is then a *reconciliation* problem layered on top, which can land at
whatever tier Kuriftu's answers permit.

So the plan is: **build the booking spine first (Phase 0, no IDS dependency), then attach FX Spa
through a swappable adapter at whichever tier is available (Phases 1–3).** Phase 0 alone makes the
pilot demonstrably better than the sheet, and de-risks Go/No-Go against an IDS answer that may not
arrive in time.

---

## 1. Where we are today (verified in code)

| Piece | Current behaviour | File |
| --- | --- | --- |
| Booking creation | Row inserted, `payment_status='pending'`, **no availability check of any kind** | `backend/app/api/bookings.py` |
| Slot list | **Hardcoded client-side array** of 13 times, identical for every provider and every day | `frontend/src/data/mock.js:1250` (`MOCK_TIME_SLOTS`) |
| Double booking | **Nothing prevents it.** Two users can book the same therapist at the same minute. The only inventory logic in the codebase is `ProviderEvent.spots_remaining` under `SELECT … FOR UPDATE` (a good precedent to copy) | `backend/app/api/bookings.py` |
| Confirmation | Manual. Staff read a Google Sheet and phone the guest; `pay_on_site` bookings sit `pending` forever unless someone edits the DB | `backend/app/services/sheets.py` |
| Cancellation | **No endpoint exists.** Not user-side, not staff-side | — |
| Reschedule | **No endpoint exists** | — |
| Telegram notify | `send_telegram_notification()` spawns a bare `Thread` and returns. On Vercel the function can freeze before the thread runs — **fire-and-forget with no retry, no delivery record** | `backend/app/services/telegram_bot.py:29` |
| Scheduler | APScheduler is **skipped entirely when `VERCEL` is set**; only `/api/cron/maintenance` runs serverless-side | `backend/app/main.py`, `backend/app/api/maintenance.py` |
| Bot | Callback buttons exist **only inside the `/evidence` ConversationHandler** — there is no top-level callback routing, so booking actions are net-new wiring | `telegram-bot/bot/main.py`, `handlers/evidence.py` |
| Boston Day Spa | 7 services, all `booking_method: "phone"`, all `price: null`, `sheets_export_enabled = TRUE` | `backend/seed_boston_day_spa.py` |
| Provider portal | Boston Day Spa already has a **username/password staff login** | `backend/create_boston_provider_login.py` |
| Web app | `../wellcircle-web/` — a **near-fork** of `frontend/`. `BookingFlow.jsx` and `MyBookings.jsx` are **byte-identical**; `client.js` differs only in `resolveApiBase()` + 3 WhatsApp/Google auth functions | `../wellcircle-web/src/` |
| Web app tests | **None.** No `src/test/`, no vitest dependency — the `routes.smoke.test.jsx` safety net does not exist there | `../wellcircle-web/package.json` |
| Web app VCS | **Not a git repository at all.** No history, no branches, no CI | `../wellcircle-web/` |
| Web app deploy | Manual `rsync` over SSH to cPanel from one machine's hardcoded absolute path | `../wellcircle-web/deploy-sftp.sh` |
| Web-user notifications | `create_notification()` only pushes out-of-band **if `user.telegram_id` is set**. WhatsApp/Google users have an `auth_identities` row and often **no `telegram_id`** — so today they get *nothing* outside the app | `backend/app/services/notification_service.py:19` |

Four of these are the whole ballgame:

- **The hardcoded `MOCK_TIME_SLOTS` array is shown to real users in production.** We are currently
  advertising availability we have never checked. Every double-booking complaint traces here.
- **The provider portal staff login already exists.** That is our reliable change-capture channel
  and it needs no IDS cooperation whatsoever. It is the single highest-leverage thing in this plan.
- **Web-app guests currently cannot be notified of anything out-of-band.** A guest who signs in with
  WhatsApp OTP, books, and has their slot cancelled receives no message on any channel. That is
  precisely the failure the meeting comments are about, and it is live in production today (§8.4).
- **The booking UI is duplicated byte-for-byte across two codebases, one of which has no tests and no
  git.** Every change in §12.1 has to land twice. §12.3 proposes what to do about that.

---

## 2. What the meeting comments actually require

The two inline comments in the .docx are the real requirements document. Decoded:

> **C0 (Anteneh, Aug 6):** "Boston day spa case: FX module + travelbook (integrated with IDS)"

Kuriftu runs **two** IDS modules; FX Spa is the one Boston Day Spa operates on. **TravelBook is a
booking platform already integrated with IDS, doing essentially what Well Circle wants to do** —
noted as a *working example of the implementation we are trying to reach*, not as a system we need
to integrate with. It is our existence proof and our template: whatever mechanism TravelBook was
granted is the mechanism to ask for (§18, A1–A4).

> **C1 (Anteneh, Aug 6):** "confirmation 30 minutes - an hour prior / User preference saved, and
> option to join waitlist / overbook usually happen during morning / Message user via telegram on
> any changed booking"

| Comment | Requirement | Design response |
| --- | --- | --- |
| "confirmation 30 min – 1 hr prior" | The spa confirms very late. We must **never** show a guest "Confirmed" before the spa says so | Explicit `requested → held → confirmed` state machine (§5) with a hard confirmation deadline and auto-escalation (§7) |
| "overbook usually happen during morning" | Morning slots are the risk concentration | Per-window allocation caps + **morning bookings confirm the night before, not at T-60** (§7.3) |
| "user preference saved" | Store therapist/time/allergy preferences and pass them to the spa | `user_service_preferences`, mapped to FX Spa Guest Profile fields (§10) |
| "option to join waitlist" | Full slot ⇒ offer waitlist, claim on cancellation | `waitlist_entries` + time-boxed `waitlist_offers` (§9) |
| "message user via telegram on **any** changed booking" | **Delivery-guaranteed**, not fire-and-forget | Transactional outbox drained by the always-on Railway bot, with retries + undeliverable escalation (§8) |

Note the tension the comments create and nobody has resolved yet: **a 07:30 appointment confirmed at
07:00 is operationally useless** to a guest who has to cross Addis. §7.3 proposes the fix; it needs
Kuriftu's sign-off (B2).

---

## 3. Target architecture

```
 Telegram Mini App ─┐
 app.wellcircle.et ─┼─► Well Circle API ─► bookings + slot_holds  (source of truth for OUR inventory)
 Telegram Bot ──────┘        │                     │
                             │                     ├─► notification_outbox ──► Railway bot ──► Telegram
                             │                     └─► pms_sync_log
                             │
                             └─► PmsAdapter (interface)
                                    ├── SheetsAdapter        (today — Tier C)
                                    ├── FxSpaFileAdapter     (CSV/SFTP — Tier B)
                                    └── FxSpaApiAdapter      (live REST — Tier A)
 Provider Portal (staff) ─────► confirm / reassign / cancel  ── always available, zero IDS dependency
```

### 3.1 The adapter (anti-corruption layer)

`backend/app/services/pms/` — one interface, three implementations, selected per-provider by a
`providers.pms_adapter` column so we can flip Boston Day Spa without touching anyone else.

```python
class PmsAdapter(Protocol):
    async def fetch_availability(self, provider, service, window) -> list[PmsSlot]: ...
    async def push_booking(self, booking) -> PmsResult:      # idempotent on booking.id
    async def cancel_booking(self, booking, reason) -> PmsResult: ...
    async def pull_changes(self, since) -> list[PmsChange]:  # cancellations/moves made IN FX Spa
```

Everything above the adapter is written once. `NullAdapter` (no-op) is the default so nothing
regresses for other providers. **`push_booking` must be idempotent keyed on our `booking.id`** — the
one non-negotiable requirement we hand to IDS, because retries are certain over an Ethiopian link.

### 3.2 Integration tiers — mapped to the notes' options

| Tier | = Notes' option | What we get | Effort | Feasible by Sep 27? |
| --- | --- | --- | --- | --- |
| **C. Sheet + staff portal** | current + hardened | Reliable *because a human confirms*; no IDS dependency | Phase 0 | **Yes — this is the pilot floor** |
| **B. File/report exchange** | Option B (CSV/XML) | Nightly/hourly reconciliation; catches spa-side cancellations | Phase 1–2 | Likely, if Kuriftu can produce an FX Spa appointment report export (B5) |
| **A. Live FX Spa API — "the TravelBook path"** | Option C (Marketplace/Partner) | True availability + instant writes + webhooks | Phase 3 | **Re-rated from "unlikely" to "ask for it directly."** TravelBook proves the path exists; if it's an existing certified connector rather than a bespoke build, onboarding a second partner onto it could be far faster than the notes assumed |
| ~~Channel manager~~ | Option A | — | — | **Probably N/A for spa** — see §0. Drop unless the vendor says otherwise |

**The tier table is now a decision to be made in the IDS meeting, not a guess.** The single most
valuable outcome of that meeting is learning which mechanism TravelBook uses, because that tells us
whether Tier A is a six-week partner engagement or a credentials-and-config exercise. Build Phase 0
regardless; let the meeting decide whether Phase 2 (file reconciliation) is a waypoint or a
throwaway.

One secondary avenue worth 30 minutes if the vendor path stalls: kurifturesorts.com's "Reserve"
button is a React app already wired to a payment gateway. If its reservation flow lands in FX Spa,
its backend is another integration surface — but with a direct vendor meeting booked, this drops to
a fallback rather than something to chase.

---

## 4. Data model changes

All migrations go through **Alembic** (`backend/alembic/versions/` — latest is `017_provider_map_url.py`, so this work starts at `018`).
Reminder from `CLAUDE.md`: the integration test runs on SQLite via `SQLiteUUID`/`SQLiteJSONB`
TypeDecorators — every new UUID/JSONB column must be declared the same way, and any Postgres-only
constraint needs an application-level equivalent so tests still cover the behaviour (§4.3).

### 4.1 New tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `provider_resources` | The thing that can be double-booked: a therapist, a room, a chair. Mirrors FX Spa's *Staff Management* + *Resource List* | `id, provider_id, kind(staff\|room\|equipment), name, external_ref, service_names JSONB, is_active` |
| `provider_allocation_blocks` | The slots Well Circle is *allowed to sell* — the carve-out the spa agrees not to sell elsewhere | `id, provider_id, resource_id NULL, weekday, start_time, end_time, max_concurrent, service_names JSONB, valid_from, valid_to, confirmation_policy` |
| `booking_slot_holds` | **The double-booking guarantee.** One row per occupied resource-interval | `id, provider_id, resource_id, booking_id, starts_at, ends_at, status(held\|confirmed\|released), expires_at` |
| `booking_events` | Append-only audit of every state transition — who, when, why, from where | `id, booking_id, from_status, to_status, actor_type(user\|staff\|system\|pms), actor_id, reason, metadata JSONB, created_at` |
| `notification_outbox` | Delivery-guaranteed messaging (§8) | `id, user_id, channel(telegram\|sms\|inapp), dedupe_key UNIQUE, payload JSONB, status(pending\|sent\|failed\|undeliverable), attempts, next_attempt_at, last_error, sent_at` |
| `waitlist_entries` | "Notify me if something opens" | `id, user_id, provider_id, service_name, window_start, window_end, flexible_days JSONB, resource_pref_id, status, expires_at` |
| `waitlist_offers` | Time-boxed claim on a freed slot | `id, waitlist_entry_id, slot_hold_id, claim_token, offered_at, expires_at, status(offered\|claimed\|expired\|declined)` |
| `user_service_preferences` | Guest profile we sync to FX Spa (§10) | `id, user_id, provider_id NULL, preferred_resource_id, preferred_time_of_day, therapist_gender_pref, allergies TEXT, notes TEXT, consent_share_health BOOL, updated_at` |
| `pms_sync_log` | Every adapter call in and out, for debugging and for the KPI audit trail | `id, provider_id, booking_id, direction(push\|pull), adapter, request JSONB, response JSONB, status, error, created_at` |

### 4.2 `bookings` — added columns

```
booking_status          VARCHAR(32)  NOT NULL DEFAULT 'requested'   -- see §5
duration_minutes        INTEGER      NOT NULL DEFAULT 60            -- needed for overlap maths
ends_at                 TIMESTAMPTZ                                  -- generated at write time
resource_id             UUID REFERENCES provider_resources(id)
slot_hold_id            UUID REFERENCES booking_slot_holds(id)
confirmation_deadline_at TIMESTAMPTZ                                 -- §7
confirmed_at            TIMESTAMPTZ
cancelled_at            TIMESTAMPTZ
cancelled_by            VARCHAR(16)   -- user|provider|system|pms
cancellation_reason     TEXT          -- FX Spa tracks these; so should we
pms_reservation_id      VARCHAR(128)
pms_sync_status         VARCHAR(24)  NOT NULL DEFAULT 'not_synced'
pms_last_synced_at      TIMESTAMPTZ
idempotency_key         VARCHAR(64)  UNIQUE
source                  VARCHAR(24)  NOT NULL DEFAULT 'miniapp'      -- miniapp|webapp|bot|staff|pms
```

**Back-compat is mandatory.** `MyBookings.jsx`, the provider portal and `admin_list_bookings()` all
read `payment_status` today. Keep writing it (`pending|success|failed`) as a *derived* mirror of
`booking_status` for one release, add `booking_status` to every response, migrate readers, then stop
overloading it. Do not do a big-bang rename mid-pilot.

`bookings.duration_minutes` should be seeded from `providers.services[].duration` — which is
currently `null` for all seven Boston Day Spa services. **Service durations are a hard prerequisite
for overlap detection** (B1).

### 4.3 The constraint that actually prevents double booking

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_slot_holds
  ADD CONSTRAINT no_overlapping_holds
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('held','confirmed'));
```

This is the guarantee — a database-enforced impossibility, not a check that races. Supabase supports
`btree_gist`.

Because SQLite (used by `app/tests/test_integration.py`) cannot express this, the same rule is *also*
enforced in application code inside the transaction:

```python
with db.begin_nested():
    db.execute(select(ProviderAllocationBlock)
               .where(...).with_for_update())          # serialization point
    if overlapping_holds_exist(db, resource_id, start, end):
        raise SlotUnavailable()
    db.add(BookingSlotHold(...))
```

Lock the **allocation block** row, mirroring the existing `ProviderEvent` `with_for_update()`
pattern in `api/bookings.py` — same idiom, so it reads like the surrounding code. The DB constraint
is the backstop that catches anything the app logic misses.

Holds expire: an unconfirmed `held` row past `expires_at` is released by the reaper (§13) so an
abandoned checkout doesn't sterilise a slot.

---

## 5. Booking lifecycle

```
                  ┌──────────── expired (hold lapsed, never submitted)
                  │
  requested ──► held ──► confirmed ──► checked_in ──► completed
      │           │          │                            │
      │           │          ├──► rescheduled ─┐          │
      │           │          │                 └──► (new booking, old = superseded)
      └───────────┴──────────┴──► cancelled_by_user
                             ├──► cancelled_by_provider
                             └──► no_show
```

| Status | Guest-facing label (EN/AM) | Meaning |
| --- | --- | --- |
| `requested` | "Request sent" | We have it; slot not yet held |
| `held` | "Reserved — awaiting spa confirmation" | Our inventory is committed; FX Spa/staff has not confirmed |
| `confirmed` | "Confirmed ✅" | Staff (or FX Spa) confirmed. **Only state that may say "Confirmed"** |
| `checked_in` | "You're in" | Guest arrived |
| `completed` | "Completed" | Service delivered → points award + review prompt |
| `cancelled_by_*` | "Cancelled" | With reason |
| `no_show` | "Missed" | Feeds a future no-show policy |

**Every transition writes a `booking_events` row and enqueues an outbox message.** That is how
"message user via telegram on any changed booking" becomes structural rather than a thing we
remember to do at each call site. One helper, `transition_booking(db, booking, to_status, actor,
reason)`, is the only sanctioned way to change status — enforced by code review and a test that
greps for direct `booking_status =` assignments outside the service module.

**KPI hook (notes §6):** the pilot's "processed through the platform" definition maps cleanly onto
this machine. Recommend defining it as **`completed` OR (`confirmed` AND slot in the past AND not
`no_show`)**, evidenced by `booking_events`. That gives a defensible, auditable number for the 2%
success fee, and it is a *decision to get in writing before Go/No-Go* (C2).

---

## 6. Availability — replacing the fake slot list

New endpoint:

```
GET /api/providers/{id}/availability?service=Massage%20Cave&from=2026-08-20&to=2026-08-27
→ { "timezone": "Africa/Addis_Ababa",
    "slots": [ { "start": "...", "end": "...", "remaining": 2,
                 "resources": ["uuid"], "policy": "morning_prior_evening" } ] }
```

Computed as: `allocation_blocks` ∩ resource roster − active `slot_holds` − (Tier A/B) PMS-reported
busy intervals. Cached ~60 s server-side; the Mini App uses `usePolling` (which pauses when
backgrounded — per `CLAUDE.md`, use it, not raw `setInterval`) so we don't wake cold Vercel
functions needlessly.

`MOCK_TIME_SLOTS` stays in `src/data/mock.js` for mock-mode tests **only**; the live path must read
this endpoint. Slots with `remaining === 0` render as "Full — join waitlist" rather than
disappearing, which is what makes the waitlist discoverable at the exact moment of disappointment.

All times are `Africa/Addis_Ababa` (UTC+3, no DST) at the presentation edge; storage stays UTC.
Worth deciding explicitly whether guest-facing times use Ethiopian clock conventions (C4).

---

## 7. The 30–60 minute confirmation window

### 7.1 Never lie about status

Between booking and confirmation the guest sees **"Reserved — the spa confirms about an hour
before"** with the expected confirmation time rendered explicitly. No green tick, no "Confirmed"
string, no ambiguity. This single change removes most of the perceived-reliability problem even
before any IDS work.

### 7.2 The confirmation job

`POST /api/cron/booking-confirmations` (secured with the existing `CRON_SECRET` pattern from
`api/maintenance.py`), run every 5 minutes:

1. Find `held` bookings whose `confirmation_deadline_at` is within the next 15 min.
2. Tier A: call `PmsAdapter.fetch_availability` / push and auto-confirm on success.
3. All tiers: push the booking to the **staff console** "Needs confirmation now" queue and ping the
   staff Telegram/portal.
4. If still unconfirmed at `deadline + grace`: escalate — notify the ops channel, and message the
   guest honestly ("we haven't heard back yet — call us on +251 11 662 3808 or we'll call you").
   **Silence is the failure mode we are engineering against.**

### 7.3 Morning overbooking (the comment's specific warning)

Two mechanisms:

- **Tighter allocation for morning windows.** `provider_allocation_blocks` gets a lower
  `max_concurrent` for 06:00–12:00. If the spa historically oversells mornings, we sell fewer morning
  slots than the raw roster suggests. Configurable per weekday by staff, so it's tunable during the
  pilot without a deploy.
- **Morning bookings confirm the evening before.** `confirmation_policy = 'prior_evening'` on those
  blocks sets `confirmation_deadline_at = 19:00 the previous day` instead of T-60. A guest told at
  19:00 the night before can re-plan; a guest told at 07:00 cannot. Everything else stays at T-60
  (`policy = 'lead_60m'`).

This is a **policy change we are asking Kuriftu to accept**, not just code (B2). It is the single
biggest guest-experience lever in the whole plan.

---

## 8. Reliable change notification (the hard requirement)

Today's path — `create_notification()` → `send_telegram_notification()` → `Thread(...).start()` —
**cannot** satisfy "message user via telegram on any changed booking." On Vercel the function may
freeze before the thread runs; there is no retry, no record of whether it landed, and a blocked-bot
user fails silently.

### 8.1 Transactional outbox

- Every state transition inserts a `notification_outbox` row **in the same DB transaction** as the
  booking change. If the booking commits, the notification is guaranteed to exist. If it rolls back,
  no phantom message. This is the entire point.
- `dedupe_key` (e.g. `booking:<id>:status:<to_status>:<attempt_epoch_bucket>`) is `UNIQUE`, so a
  retried request cannot double-message the guest.

### 8.2 The drainer runs on Railway, not Vercel

**Recommendation: the telegram-bot worker owns the outbox drain.** It is the only always-on process
we have (`CLAUDE.md`: Vercel skips the scheduler; Railway runs 1 replica). It already has a
`job_queue`; add `run_repeating(drain_outbox, interval=30)`.

- New backend endpoints, `X-Bot-API-Key` authenticated, alongside the existing `/api/bot/*` family:
  `GET /api/bot/outbox/pending?limit=50` and `POST /api/bot/outbox/{id}/result`.
- Bot sends via `python-telegram-bot`, reports back `sent` / `failed` / `undeliverable`.
- Backoff: 30 s → 2 m → 10 m → 1 h → 6 h, max 6 attempts.
- Telegram `403 Forbidden: bot was blocked by the user` ⇒ `undeliverable` immediately (no retries),
  and the booking lands on the **staff call list** — a human phones them. Because Railway is capped
  at 1 replica, there is no concurrent-drain race; the `FOR UPDATE SKIP LOCKED` claim on pending rows
  guards it anyway if that ever changes.
- Keep a Vercel cron fallback (`/api/cron/outbox-drain`) so a Railway outage degrades to
  slower-but-still-delivered.

### 8.3 Channels — Telegram is not enough

`notification_outbox.channel` exists because **Telegram cannot reach every guest**.
`create_notification()` today short-circuits on `if user and user.telegram_id`, so a WhatsApp-OTP or
Google guest on `app.wellcircle.et` gets nothing outside the app. For those users a cancellation is
silent — the exact failure mode the meeting comments are about.

Channel selection per user, in order of preference:

1. **Telegram** — if `auth_identities` has a `telegram` row / `users.telegram_id` is set.
2. **WhatsApp** — if the user authenticated by WhatsApp OTP, we already hold a verified E.164 number
   and `app/services/otp.py` already describes a **pluggable BSP transport** (Twilio Verify or
   similar). Reuse that transport for templated booking notifications. Note that WhatsApp business
   messaging outside a 24-hour service window requires **pre-approved message templates** — those
   need submitting early, so this is a Phase-0 task even though it lands in Phase 1 (C3).
3. **SMS** — fallback where WhatsApp fails.
4. **In-app only + staff call list** — the floor. Never silent.

The outbox schema already carries `channel`; the drainer picks the first channel with a usable
address and falls through on `undeliverable`.

### 8.4 Message content

Every change message states **what changed, the new state, and the next action**, with inline
buttons (§11). Sent for: confirmed, cancelled (either side), rescheduled/moved, therapist reassigned,
confirmation deadline slipped, waitlist offer, reminder. Bilingual EN/AM via the existing `i18next`
keys plus server-side templates keyed on the user's language.

---

## 9. Waitlist

**Join:** availability shows `remaining: 0` → "Join waitlist" → capture desired window, day
flexibility, and resource preference. Also offered automatically when a hold fails the race
(`SlotUnavailable` at commit time — a genuinely good recovery, not an error page).

**Match & offer:** on any event that frees a resource-interval (user cancel, staff cancel, PMS pull
reporting a cancellation, hold expiry), find matching `waitlist_entries` ordered by
`created_at`, and:

1. Create a **new `slot_hold` in the offer's name** — the freed slot is held, not open, so the
   offer is real and a walk-in booking can't snipe it mid-offer.
2. Insert `waitlist_offers` with a `claim_token` and `expires_at = now + 20 min` (tunable; shorter
   inside 3 hours of the slot).
3. Outbox → Telegram with **Claim** / **Pass** inline buttons.
4. On expiry or Pass: release, cascade to the next entry. Offer to one guest at a time — a
   first-come-wins broadcast generates more disappointment than it converts.

**Claim:** `POST /api/waitlist/offers/{token}/claim` converts the hold into a booking, atomically,
under the same exclusion constraint. Late claim ⇒ "sorry, gone — still on the list?"

---

## 10. Guest preferences ↔ FX Spa Guest Profiles

FX Spa's Guest Profiles hold "preferences, likes, dislikes, allergies, consumables, average spend,
and preferred spa employee." We mirror the subset we can honestly collect:

| Well Circle field | FX Spa concept | Used for |
| --- | --- | --- |
| `preferred_resource_id` | preferred spa employee | pre-select at booking; pass on sync |
| `preferred_time_of_day` | — | waitlist matching, "book again" suggestions |
| `therapist_gender_pref` | preference | resource filtering |
| `allergies`, `notes` | allergies / dislikes | passed to spa **only with consent** |

**Privacy.** Allergies and health notes are sensitive personal data. Gate on an explicit
`consent_share_health` toggle, default **off**, with plain-language copy about who sees it. Never
put them in the Google Sheet (a shared spreadsheet is the wrong home for health data) — sheet export
should be restricted to name/phone/slot/service. That's a change to `services/sheets.py` worth making
in Phase 0 regardless of everything else here.

Surfaces: a "Your spa preferences" section in the Mini App profile, and prefill at booking time.

---

## 11. Telegram bot changes

The bot uses `CallbackQueryHandler` today only *inside* the `/evidence` `ConversationHandler` — there is no top-level callback routing, so booking/waitlist buttons are net-new wiring (though `handlers/evidence.py` is a usable local pattern to copy).

```
telegram-bot/bot/handlers/booking.py   (new)
  CallbackQueryHandler(pattern=r"^bk:(confirm|cancel|reschedule|directions):")
  CallbackQueryHandler(pattern=r"^wl:(claim|pass):")
telegram-bot/bot/services/outbox.py    (new)  — §8.2 drain loop
```

- Callback payloads carry an **opaque short token**, never a raw booking UUID — the callback_data
  budget is 64 bytes and the value is user-visible in the client. Backend validates
  `(token, telegram_id)` server-side; a token belonging to another user is rejected and logged.
- New bot-auth endpoints: `POST /api/bot/bookings/{token}/action`,
  `POST /api/bot/waitlist/offers/{token}/claim`.
- `/mybookings` command → upcoming bookings with status.
- Deep link `t.me/<bot>?startapp=booking_<short_id>` opens the Mini App on the booking, reusing the
  existing `startapp` sanitisation pattern from `VisitScreen.jsx`.

Guard rails: answer every callback query promptly (Telegram shows a spinner otherwise); make every
action idempotent (double-tap must not double-cancel); and edit the original message in place so the
history shows current state rather than a contradictory stack of old buttons.

---

## 12. Frontend changes

### 12.1 Mini App (`frontend/` — this repo, `wellcircle.et`)

| File | Change |
| --- | --- |
| `src/pages/BookingFlow.jsx` | Replace `MOCK_TIME_SLOTS` with `getAvailability()`; show `remaining`; render "Full — join waitlist"; optional therapist picker; prefill preferences; surface the honest "spa confirms ~1 hr before" copy on the confirm step; handle `409 SlotUnavailable` by offering the waitlist instead of erroring |
| `src/pages/MyBookings.jsx` | Drive labels from `booking_status` not `payment_status`; add Cancel and Reschedule; show `confirmation_deadline_at`; show cancellation reason |
| `src/pages/ProfileScreen.jsx` | "Your spa preferences" section + health-sharing consent toggle |
| `src/pages/WaitlistScreen.jsx` *(new)* | Active waitlist entries; leave; claim an open offer |
| `src/api/client.js` | `getAvailability`, `cancelBooking`, `rescheduleBooking`, `joinWaitlist`, `leaveWaitlist`, `claimWaitlistOffer`, `getServicePreferences`, `putServicePreferences` — **plus mock-mode branches for each** (tests run with `VITE_USE_MOCK=true`) |
| `src/test/routes.smoke.test.jsx` | Add `/waitlist` — per `CLAUDE.md`, every new route goes here |

### 12.2 Provider portal (`frontend/src/pages/provider-portal/` — `provider.wellcircle.et`)

**This is the highest-value UI in the plan.** Boston Day Spa already has a staff login.

- **Today board** — every Well Circle booking for today, grouped by hour, colour-coded by status
  (deliberately echoing FX Spa's own colour-coded appointment calendar, so it reads as familiar).
- **"Needs confirmation now"** queue driven by `confirmation_deadline_at` — the primary work surface.
- One-tap **Confirm / Reassign therapist / Cancel (with reason) / Mark no-show / Mark completed**.
  Every tap is a `transition_booking()` call, so the guest is messaged automatically (§8).
- **Allocation editor** — set `max_concurrent` per window and per weekday, so mornings can be tuned
  during the pilot without a deploy.
- Designed **mobile-first for a front-desk phone**, large tap targets, works on a flaky connection
  (optimistic UI + queued retry). Front-desk staff will not use this on a laptop.

### 12.3 Standalone web app (`../wellcircle-web/` — `app.wellcircle.et`)

**Correction to rev 1 and to `CLAUDE.md`:** the web app source *is* available — it lives in the
sibling directory `../wellcircle-web/`, not inside this repo. `CLAUDE.md`'s line that "its frontend
source is not in this repo" is technically true but misleading and should be amended to point at the
sibling checkout. This work is therefore fully schedulable.

**What the code actually looks like.** `wellcircle-web` is a *near-fork* of `frontend/`, sharing the
same backend (`.env.production` → `wellcircle-hackathon-backend.vercel.app/api`):

| File | Relationship to `frontend/` |
| --- | --- |
| `src/pages/BookingFlow.jsx` | **byte-identical** (751 lines) |
| `src/pages/MyBookings.jsx` | **byte-identical** (96 lines) |
| `src/hooks/usePolling.js` | **byte-identical** |
| `src/api/client.js` | differs only in `resolveApiBase()` and 3 extra functions (`authWhatsAppStart`, `authWhatsAppVerify`, `authGoogle`) |
| `src/App.jsx`, `src/context/AuthContext.jsx` | genuinely diverged — different routes (`/login`, `/landing`), different auth |
| `src/data/mock.js` | diverged (~244 diff lines) |

The booking route is `/booking/:providerId` in **both** — so §12.1's changes port across unchanged.

**The duplication decision.** Doing §12.1 twice by hand, in a repo with no tests and no git, during a
five-week pilot, is how the two apps silently drift apart on exactly the flow we are trying to make
reliable. Three options:

| Option | Effort | Risk |
| --- | --- | --- |
| **1. Copy the diffs by hand** | lowest now | Highest later — guaranteed drift on the booking flow |
| **2. Extract `BookingFlow` + `MyBookings` + booking API calls into a shared local package** (`packages/booking-ui`, consumed by both via a relative file dependency) | ~1 day | Low — one implementation, one place to fix |
| **3. Full monorepo merge** | days | Too much churn mid-pilot |

**Recommend option 2, done in Phase 0 before the booking rewrite starts.** Extracting two
byte-identical files is a mechanical, low-risk refactor *today*; it becomes a merge conflict once
both sides have diverging booking changes. Doing it first makes every later phase half the work.

**Prerequisites I'd want before shipping booking changes there — these are hygiene gaps, not
nice-to-haves:**

- **Put `wellcircle-web` under git.** It is currently unversioned. During a pilot where we are about
  to touch its most important flow, "no history and no way to revert" is the single scariest fact in
  this document.
- **Add vitest + a `routes.smoke.test.jsx`** mirroring the mini app's. `vite.config.js` already
  carries the `vitest/config` reference; the dependency is just missing.
- **Deploy story.** `deploy-sftp.sh` hardcodes `/Users/anteneh/…` and runs from one machine. Any
  backend contract change now has to be released in lockstep across Vercel (backend + mini app) and a
  manual rsync to cPanel. At minimum, document the release order; better, make the script
  path-independent (C5).

**Then the §12.1 changes apply as-is**, plus web-specific work: the notification-channel selection in
§8.3 matters most here, because this is where non-Telegram guests live.

---

## 13. Scheduled work — and where it runs

`CLAUDE.md` is clear that APScheduler is skipped on Vercel, so **every job needs a cron entry point**
(the `/api/cron/*` + `CRON_SECRET` pattern already in `api/maintenance.py`).

| Job | Cadence | Home | Purpose |
| --- | --- | --- | --- |
| `outbox-drain` | 30 s | **Railway bot** (Vercel cron fallback) | §8.2 |
| `booking-confirmations` | 5 min | Vercel cron | §7.2 |
| `hold-reaper` | 5 min | Vercel cron | Release expired holds → triggers waitlist matching |
| `waitlist-offer-expiry` | 1 min | Railway bot | Cascade offers |
| `pms-pull` | 15 min (Tier A/B) | Railway bot | Cancellations/moves made *inside* FX Spa |
| `pms-push-retry` | 5 min | Vercel cron | Retry failed `push_booking` |
| `booking-reminders` | existing hourly | existing | Extend to fire on `confirmed`, not `payment_status == 'success'` |

Note the existing `booking_reminder_job` filters `payment_status == "success"` — under `pay_on_site`
that is **never true**, so Boston Day Spa guests currently get no reminders at all. Fixing that is a
one-line Phase 0 win.

---

## 14. Security & privacy

- **PMS credentials** in env only (`FXSPA_BASE_URL`, `FXSPA_CLIENT_ID`, `FXSPA_CLIENT_SECRET`,
  `FXSPA_PROPERTY_CODE`), added to `app/config.py`'s single `Settings` instance. Never in the repo,
  never logged. `pms_sync_log` must redact auth headers and guest health notes.
- **Inbound webhook** (Tier A) verified by HMAC over the raw body + timestamp, with replay rejection.
- **Bot callback tokens**: opaque, single-purpose, expiring, bound to `telegram_id` server-side.
- **PII to the spa**: the minimum to deliver the service — name, phone, slot, service, and *only if
  consented* preferences/allergies. Health data never enters the Google Sheet (§10).
- **Guest-facing errors stay generic**, operator logs carry the `request_id` — the existing rule in
  `app/utils/error_handlers.py`. A PMS failure must never leak an IDS stack trace to a guest.
- **Rate-limit** cancel/reschedule/claim per user to blunt abuse of the waitlist race.

---

## 15. Testing

**Backend** (`backend/app/tests/`, run as scripts per `CLAUDE.md`, not via pytest):

- `test_slot_holds.py` — **the concurrency test that matters**: N threads booking one slot ⇒ exactly
  one success, N−1 `SlotUnavailable`. Run against Postgres for the exclusion constraint *and* SQLite
  for the app-level guard.
- `test_booking_lifecycle.py` — every legal transition, every illegal one rejected, `booking_events`
  written for each.
- `test_outbox.py` — transactional guarantee (rollback ⇒ no message), dedupe, backoff, blocked-bot
  ⇒ `undeliverable` + staff escalation.
- `test_waitlist.py` — offer/claim/expire cascade; two claimants ⇒ one winner.
- `test_confirmation_policy.py` — morning ⇒ prior-evening deadline; afternoon ⇒ T-60; escalation.
- `test_pms_adapter.py` — against a `FakeFxSpaAdapter`: idempotent push, retry-safe, pull applies
  spa-side cancellations and notifies. **No test may hit a live IDS endpoint.**

**Frontend** (`npm test`, mock mode): availability rendering incl. full-slot waitlist CTA; status
labels from `booking_status`; cancel/reschedule; `/waitlist` added to `routes.smoke.test.jsx`.

**Manual / staged**: a dry-run day where staff work the Today board against real appointments before
we route real guests through it (§16, Week 5).

---

## 16. Phasing against Sep 27

| Phase | Window | Contents | IDS dependency |
| --- | --- | --- | --- |
| **0a — Repo hygiene** | Aug 19 – Aug 22 | `wellcircle-web` into git; vitest + smoke test; extract `packages/booking-ui` from the two byte-identical booking files; WhatsApp template submission started | **None** |
| **0b — Booking spine** | Aug 19 – Sep 5 | Status machine, resources/allocation, holds + exclusion constraint, real availability endpoint, cancel/reschedule, outbox + bot drain, staff Today board, reminder fix, sheet PII trim | **None** |
| **1 — Guest features** | Sep 1 – Sep 12 | Waitlist, preferences/consent, morning policy, bot inline actions, Mini App + web app screens, WhatsApp/SMS channel | None |
| **2 — FX Spa reconcile** | Sep 8 – Sep 19 | `FxSpaFileAdapter`: ingest an FX Spa appointment export (CSV/report) → detect spa-side cancellations/moves → notify; optional outbound file drop | **B1/B2** |
| **3 — TravelBook-path API** | Sep 15 – post-pilot | `FxSpaApiAdapter`, webhooks, true availability. **Start date now depends on what the IDS meeting reveals** — if TravelBook rides an existing connector we can be granted, this may overtake Phase 2 entirely | IDS meeting (§18 A1–A4) |
| **Hardening** | Sep 15 – Sep 22 | Load/concurrency tests, staff training, dry run, runbook | — |
| **Freeze + report** | Sep 23 – Sep 27 | KPI report against the §5 definition, Go/No-Go pack | — |

Phases 0 and 1 overlap deliberately and are the commitment. Phases 2 and 3 are best-effort and gated
on the IDS meeting; **neither is on the critical path for Go/No-Go**, which is the main structural
change this plan makes versus the meeting notes.

**Phase 0a is only ~3 days and pays for itself immediately** — the booking-UI extraction halves every
subsequent frontend task, and putting `wellcircle-web` under git before we rewrite its booking flow
is not optional in my view.

**Sequencing note:** if the IDS meeting lands early and the answer to A2 is "yes, here are
credentials", **skip Phase 2 and go straight to Phase 3.** The file-reconciliation adapter exists to
cover the case where the vendor answer is slow or negative; don't build it out of momentum.

---

## 17. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No IDS answer before Sep 27 | Phase 2/3 slip | Phase 0/1 carry the pilot alone — that's the design |
| Option A (channel manager) turns out irrelevant to spa | A sprint wasted if we start there | Confirm before building (A1) |
| Staff don't use the Today board | Confirmations stall, guests wait | Mobile-first, Telegram ping to staff, tiny surface, in-person training, name a champion |
| Spa sells our allocated slots anyway | Double booking survives despite our constraint | Allocation must be a written agreement, not an assumption (B3); pull-reconcile detects drift; staff can shrink allocation live |
| Telegram blocked / no Telegram | Silent failure — the exact thing we're fixing | `undeliverable` → staff call list; SMS as a later channel |
| Service durations still null | Overlap detection is guesswork | B1 — needed before Phase 0 ships |
| Vercel cold start delays confirmations | Late confirmations near the deadline | Critical loops live on always-on Railway; existing `keep_warm` helps |
| Guest data in a shared Google Sheet | Privacy exposure | §10 — trim in Phase 0 |
| **`wellcircle-web` is not in git** | An unrecoverable mistake in the flow we're actively rewriting | Phase 0a — initialise the repo before touching booking code |
| Booking UI duplicated byte-for-byte across two apps | Silent drift on the exact flow we're hardening; a fix applied to one app only | Phase 0a — extract `packages/booking-ui` (§12.3) |
| Web guests unreachable (no Telegram) | Cancellation notices silently dropped | §8.3 — WhatsApp/SMS channel; **submit WhatsApp templates in week 1**, approval takes days |
| Manual cPanel deploy from one machine | Backend/frontend contract skew on release day | Document release order; make `deploy-sftp.sh` path-independent (C5) |

---

## 18. Questions — organised by who can answer them

### A. For the IDS engineering team (India) — the meeting agenda

The single goal of this meeting: **understand how TravelBook writes into IDS, and find out whether we
can be granted the same mechanism.** Everything else is secondary.

- **A1 — How is TravelBook integrated with IDS?** Named product/mechanism, please: Integration
  Marketplace connector, a certified partner API, a middleware/connector service, a database-level
  integration, or a file exchange? *This one answer collapses most of §3.2.*
- **A2 — Can Well Circle be granted the same integration path for Kuriftu's FX Spa?** What does
  onboarding look like — commercial partner agreement, certification, or just credentials scoped to
  this property? **What is the realistic calendar time?** (Our pilot Go/No-Go is Sep 27.)
- **A3 — Does that path cover *spa appointments* specifically, or only room reservations?** If
  TravelBook only writes room inventory, we need the FX Spa equivalent, and the answer to A1 may not
  transfer.
- **A4 — Is there API documentation, a sandbox, and a test property we can develop against?** We
  should not be testing against Kuriftu's live spa calendar.
- **A5 — Availability reads:** can we *query* free/busy for a therapist or room, or only *write*
  appointments? Read access is what makes double-booking prevention exact rather than probabilistic.
- **A6 — Idempotency.** Will the API accept a client-supplied external reference (our `booking.id`)
  and treat repeat submissions as the same appointment? **This is our one non-negotiable ask** —
  retries are certain over an Ethiopian link, and without it every timeout risks a duplicate.
- **A7 — Change notification.** When staff cancel or move an appointment *inside FX Spa*, can we be
  pushed a webhook? If not, what is the lowest-latency pull — and does it include the cancellation
  reason (the FX Spa product page implies reasons are tracked)?
- **A8 — Resource model.** How does FX Spa represent therapists, rooms and equipment, and how do we
  address a specific one when booking? Our `provider_resources` table needs to map to it.
- **A9 — Guest profiles.** Can we push preferences/allergies/preferred-employee onto a guest profile,
  and how are guests matched — phone number, email, an ID we mint?
- **A10 — Deployment.** Is Kuriftu's FX Spa cloud-hosted (as the product page implies) or on-prem? If
  cloud, we can drop the VPN/local-agent contingency in the notes entirely.
- **A11 — Rate limits, auth model, and error semantics.** Specifically: how do we distinguish "slot
  taken" from "system unavailable"? We must never tell a guest "unavailable" when the truth is "we
  couldn't reach the server."

*Worth saying explicitly in the meeting:* we are not asking IDS to build anything new. We are asking
to be pointed at the path a comparable partner already uses.

### B. For Kuriftu operations — needed before Phase 0 ships

- **B1 — Service durations and prices for the 7 Boston Day Spa services.** All are `null` today.
  Durations are required for overlap detection; absent them I'll assume a flat 60 minutes, which is
  wrong for Mani/Pedi vs Massage Cave.
- **B2 — Will Kuriftu confirm morning bookings the evening before** (19:00) instead of at T-60? A
  07:30 slot confirmed at 07:00 doesn't help a guest crossing Addis. Biggest single guest-experience
  lever in this plan, and it's a policy call, not a code one.
- **B3 — Can we get a written allocated block?** e.g. "Well Circle may sell up to N concurrent
  appointments per hour; the spa will not sell those slots elsewhere." Our exclusion constraint makes
  double booking impossible *within our inventory*; nothing we build can stop the front desk selling
  the same therapist. Without this we are managing the risk, not eliminating it.
- **B4 — Who at the spa owns the Today board day to day?** A named person, not a role. Every
  confirmation-flow design lives or dies on this.
- **B5 — Can FX Spa export an appointment report (CSV/XML) on a schedule, and where can it land**
  (SFTP, shared folder, emailed attachment, manual export)? Only needed if the IDS answer pushes us
  to Phase 2 — but manual export caps reconciliation at once-daily, too slow to catch same-day
  cancellations.
- **B6 — Cancellation policy.** How late can a guest cancel free? Is there a no-show consequence?
  Affects copy, points, and whether `no_show` carries a penalty.

### C. For you — decisions I need to proceed

- **C1 — Approve Phase 0a (~3 days).** Put `wellcircle-web` under git, add vitest + smoke test, and
  extract the byte-identical booking UI into a shared package before the rewrite. I'd rather ask than
  reorganise your repo layout unprompted — but I think shipping booking changes into an unversioned,
  untested codebase during a pilot is the largest avoidable risk here.
- **C2 — Lock the definition of "processed through the platform"** for the 2% success fee. I propose:
  `completed`, or `confirmed` with the slot in the past and not `no_show`, evidenced by the
  `booking_events` audit trail. Notes §6 flags this as unsettled; it's cheap to settle now and
  expensive once there's a number to argue about.
- **C3 — WhatsApp Business templates.** To message web-app guests about cancellations outside a
  24-hour window we need pre-approved templates, and approval takes days. Do we have a BSP account
  (Twilio or otherwise) live, or does that need setting up? **This gates Phase 1 and should start in
  week 1.**
- **C4 — Ethiopian clock convention** for guest-facing times, or 12/24h Gregorian? There's already a
  `time_format` user preference — I need to know whether it's sufficient.
- **C5 — `deploy-sftp.sh` hardcodes `/Users/anteneh/…`.** Should I make it path-independent, and is
  there anyone besides you who needs to be able to deploy the web app?
- **C6 — Should `CLAUDE.md` be amended** to point at `../wellcircle-web/` as the web app's source? It
  currently says the source "is not in this repo", which sent rev 1 of this plan down the wrong path.

### Answered since rev 1

- ~~Q2 — What is "travelbook"?~~ → A booking platform already integrated with IDS, doing what we do.
  **Reference implementation, not an integration target.** Reframed §0/§2/§3.2 around it.
- ~~Q3 — Can we reach the people behind the integration?~~ → **Yes, a meeting with the IDS team in
  India is scheduled.** Became §18.A.
- ~~Q12 — Who owns `app.wellcircle.et`'s frontend?~~ → **We do; it's `../wellcircle-web/`.** Became
  §12.3, now fully scheduled.
- **Q1 (channel manager / Revenue & Distribution Connect) remains open** — but it stops mattering if
  A1 gives us the TravelBook path. Ask it only if time allows.

---

## 19. Appendix — API surface (additions to `docs/API_CONTRACT.md` §6)

```
GET    /api/providers/{id}/availability?service=&from=&to=
POST   /api/bookings                             # + idempotency_key, resource_id, preferences
GET    /api/bookings/{id}
POST   /api/bookings/{id}/cancel                 # { reason }
POST   /api/bookings/{id}/reschedule             # { slot_datetime, resource_id? }
POST   /api/bookings/{id}/confirm-attendance

POST   /api/waitlist                             # { provider_id, service_name, window, flexibility }
GET    /api/waitlist/me
DELETE /api/waitlist/{id}
POST   /api/waitlist/offers/{token}/claim
POST   /api/waitlist/offers/{token}/decline

GET    /api/users/me/service-preferences
PUT    /api/users/me/service-preferences

GET    /api/providers/me/bookings/today
POST   /api/providers/me/bookings/{id}/transition  # { to_status, reason, resource_id? }
GET    /api/providers/me/resources                 # CRUD
GET    /api/providers/me/allocation                # CRUD

GET    /api/bot/outbox/pending?limit=50            # X-Bot-API-Key
POST   /api/bot/outbox/{id}/result                 # X-Bot-API-Key
POST   /api/bot/bookings/{token}/action            # X-Bot-API-Key
POST   /api/bot/waitlist/offers/{token}/claim      # X-Bot-API-Key

POST   /api/pms/fxspa/webhook                      # HMAC-signed, no JWT
POST   /api/cron/booking-confirmations             # CRON_SECRET
POST   /api/cron/hold-reaper                       # CRON_SECRET
POST   /api/cron/pms-sync                          # CRON_SECRET
POST   /api/cron/outbox-drain                      # CRON_SECRET (Railway fallback)

GET    /api/admin/pms/sync-log
POST   /api/admin/pms/replay/{booking_id}
```

`docs/API_CONTRACT.md` is the source of truth between services and must be updated in the same PR as
each endpoint — per `CLAUDE.md`.
