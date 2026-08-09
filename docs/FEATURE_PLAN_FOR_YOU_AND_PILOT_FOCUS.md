# Feature Plan — For You Home, Boston Day Spa Pilot & Instant Open

**Sources:** `docs/Marketing Team Notes.docx` (Kuriftu marketing team meeting),
`docs/Kuriftu Resort - boston day spa.pdf` (official Boston Day Spa page —
copy, services, contacts, gallery), and owner decisions from the planning
session.

**For the executing model:** phases are ordered by **user journey**, not by
technical convenience — open the bot → land on a feed → tap through → book →
pay. Work them top to bottom. Every phase is independently shippable: finish a
phase, run its acceptance checks, and the app must be releasable before starting
the next. Do NOT skip acceptance checks. Do NOT start a later phase to "batch"
work.

---

## Owner decisions already locked (do not re-ask)

| Decision | Locked answer |
|---|---|
| Boston Day Spa identity | **Rename the existing Kuriftu provider row** to Boston Day Spa, Bole, Addis Ababa. One live provider — no second row. |
| For You page placement | **Replaces `/home`.** `HomeScreen.jsx` is retired; the engagement widgets that still earn their place are folded into the new screen. No new bottom-nav tab. |
| For You feed data | **New backend feed endpoint** returning real ranked data. |
| Non-Boston providers | **Badge + booking blocked.** Browsable, not bookable. |
| Non-member circle landing | **Preview + Join CTA.** |
| Onboarding circles | **2 suggestions total**, one merged list, **keep** "Or start your own". |
| Payment | **In-app payment is now IN scope** (owner reversed the pay-on-site default). Telebirr first — the backend rail already exists. See Phase 7. |
| Instant open | **New requirement.** The Mini App must show its content the moment it opens. Anything that needs a network round trip or isn't cached ranks **below** what can paint immediately. See Phase 2, which sets a budget every later phase must respect. |
| Scope | The above, plus **event banners** and **navigation tips** in the provider profile. Email integration, QR web-app entry, promo discount alerts, and challenge gifts/day passes remain out of scope. |

## Confirmed Boston Day Spa data (from the PDF — do not invent anything else)

- **Name:** Boston Day Spa
- **Location:** "Located in the heart of Addis Ababa, **Bole**"
- **Phones:** `+251 11 662 3808`, `+251 11 663 6557`
- **Email:** `booking@kurifturesorts.com`
- **Story (verbatim source for `description`):** "Boston Day Spa is where the
  Kuriftu brand was born, a testament to our commitment to community
  empowerment… What began as a capacity-building project in Addis Ababa has
  transformed into a sanctuary of well-being, showcasing the work of celebrated
  Ethiopian artists like Merikokeb Berhanu."
- **Services (7, each with its own descriptive copy in the PDF):** Hair Salon ·
  Steam / Sauna / Jacuzzi · Massage Cave · Mani / Pedi · Facial · Wax · Barber
- **Facilities (7):** professional hair styling and barber studio · dedicated
  manicure lounge · relaxing pedicure space · serene massage room · luxury
  facial suite · waxing studio · full-service spa
- **Images:** extracted from the PDF to **`docs/design/boston-day-spa/`** —
  `cover-hero.jpg` plus `service-{hair-salon, steam-sauna-jacuzzi, massage-cave,
  mani-pedi, facial, wax, barber}.jpg` and `gallery-01..06.jpg`. All are
  full-resolution originals (3–6k px); they must be uploaded through
  `backend/app/services/cloudinary_service.py`, never referenced from the repo.

## The one open item still blocking work

**B1 — Boston Day Spa's price list.** The PDF has **no prices**, and the 13
services currently seeded by `backend/update_kuriftu_services.py` are **Kuriftu
African Village** prices from the Jul-15 call. They do not map cleanly onto
Boston Day Spa:

| Boston Day Spa service | Covered by the seeded African Village prices? |
|---|---|
| Massage Cave | Partly — Aroma/Swedish/Deep Tissue rows exist, but are they the same price in Bole? |
| Steam / Sauna / Jacuzzi | Partly — "Steam & Sauna" ETB 2,500 exists; **Jacuzzi does not**. |
| Mani / Pedi | Partly — Manicure/Pedicure rows exist. |
| Hair Salon | **No price** |
| Facial | **No price** |
| Wax | **No price** |
| Barber | **No price** |
| *(Morocco Bath — seeded)* | **Not offered at Boston Day Spa per the PDF** |

This blocks **Phase 7 (payment)** hard: you cannot charge in-app for a service
with no confirmed price. It does **not** block Phases 1–6 — Phase 1 ships the
7 services as a priced-on-enquiry catalogue, and Phase 7 flips them to online
booking service-by-service as prices are confirmed. **Do not carry the African
Village prices over to Boston Day Spa without the owner confirming them.**

---

## Global rules (apply to every phase)

1. **Match prior phases' conventions** (see `docs/HANDOFF.md`):
   - Backend schema changes need BOTH an Alembic migration in
     `backend/alembic/versions/` (next number: **`014`**) AND an idempotent
     `backend/apply_*.py` psycopg2 script (`ALTER TABLE ... ADD COLUMN IF NOT
     EXISTS`), modeled on `backend/apply_provider_contact_migration.py`.
   - Every new/changed request/response shape → update `docs/API_CONTRACT.md`.
   - Every new backend field/endpoint → mock parity in
     `frontend/src/data/mock.js` **and** `frontend/src/api/client.js`. Tests run
     in mock mode (`VITE_USE_MOCK=true`), so a missing mock is a failing test.
   - Models use UUID PKs and JSONB; backend tests run on SQLite via the
     `SQLiteUUID`/`SQLiteJSONB` TypeDecorator pattern — copy the header of
     `backend/app/tests/test_circle_activity.py`.
   - Use `app/utils/logger.py`'s `get_logger(name)`; never bare `print()`.
   - New routes/screens → add to `frontend/src/test/routes.smoke.test.jsx`.
2. **Frontend gates:** `npm test` and `npm run build` must both pass at the end
   of every phase.
3. **The Phase 2 first-paint budget is binding on every later phase.** Any
   change that grows the `/home/bootstrap` payload must re-measure against it.
4. **Lazy-load** every new screen in `App.jsx` (`React.lazy`).

---

## Phase 1 — Provider truth: Boston Day Spa, and everyone else "coming soon"

**Journey step:** what the user sees the moment they browse anything.

**Goal:** the pilot partner's row is real and complete, exactly one provider is
bookable, and nothing that was keyed on the string "kuriftu" silently breaks.

### 1.1 Schema

Alembic `014_provider_launch_state.py` + `backend/apply_provider_launch_migration.py`:

```sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS sheets_export_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS facilities JSONB NULL;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS navigation_tips JSONB NULL;  -- filled in Phase 8
```

`is_coming_soon DEFAULT TRUE` is deliberate: a newly self-onboarded provider is
**not** live until an admin says so. Add all four columns to
`backend/app/models/provider.py`.

### 1.2 Assets

New `backend/upload_boston_assets.py`: upload `docs/design/boston-day-spa/*.jpg`
via `app/services/cloudinary_service.py` and print the resulting URLs. Idempotent
(use a fixed `public_id` per file, e.g. `boston-day-spa/service-facial`). The
seed script in 1.3 consumes those URLs. **Never** commit a provider row pointing
at a local path or at kurifturesorts.com hotlinks.

### 1.3 The rename + reseed script

New `backend/seed_boston_day_spa.py`, idempotent, modeled on
`backend/seed_kuriftu_placeholder.py`:

- `SELECT id, name FROM providers WHERE name ILIKE '%kuriftu%' OR name ILIKE '%boston day spa%'`
- No row → tell the operator to run `seed_kuriftu_placeholder.py` first, exit.
- More than one row → print both and exit **without writing**. Do not guess.
- Otherwise update in place:
  - `name = 'Boston Day Spa'`
  - `location_text = 'Bole, Addis Ababa'`
  - `description` = the OUR STORY copy above
  - `category = 'spa'`, `is_featured = TRUE`, `status = 'active'`,
    `is_coming_soon = FALSE`, `sheets_export_enabled = TRUE`
  - `contact_phone = '+251 11 662 3808'`,
    `contact_email = 'booking@kurifturesorts.com'`
    (the second number `+251 11 663 6557` goes in `navigation_tips` or the
    description — the column holds one)
  - `cover_photo_url` = uploaded `cover-hero`, `photos` = the 6 gallery URLs
  - `facilities` = the 7 confirmed facility strings
  - `services` = the 7 confirmed categories, each
    `{name, description, photo_url, price: null, duration: null,
      booking_method: "phone"}`.
    **`price: null` until B1 lands.** `ProviderDetail.jsx` already renders
    `ETB {service.price?.toLocaleString()}` — it must fall back to
    `Price on enquiry` when price is null (small change, do it here).
  - `price_range = 'Price on enquiry'` until B1 lands.
- `lat`/`lng`: leave whatever the row has. If unset, the "Near me" filter in
  `frontend/src/utils/nearby.js` matches on the neighbourhood string ("Bole"),
  which `location_text` now provides — so this is not blocking.

### 1.4 Repair the name-keyed lookups the rename breaks

- **`backend/app/api/bookings.py:149`** — `if provider and "kuriftu" in provider.name.lower():`
  gates the **Google Sheets booking export** the marketing team reads. After the
  rename it silently stops firing. **Replace the name match with
  `provider.sheets_export_enabled`.** This is the single highest-risk line in
  the whole plan; do it in the same commit as the rename.
- **`backend/update_kuriftu_services.py`** and **`backend/mark_kuriftu_featured.py`**
  — broaden their `WHERE name ILIKE '%kuriftu%'` to also match
  `'%boston day spa%'` so re-running them is a no-op, not a "not found".

### 1.5 Coming-soon gating

Backend:
- `crud/provider.py` → add `is_coming_soon` (and `facilities` on detail) to the
  dicts from **both** `get_all_providers()` and `get_provider_detail()`.
- Keep coming-soon providers **in** the listing — the gate is presentation plus
  a booking block, not a filter.
- Add `Provider.is_coming_soon.asc()` as the **first** sort key in
  `get_all_providers()`, ahead of the existing `is_featured DESC, rating DESC`.
- **Booking block** in `POST /api/bookings`: after the provider lookup,
  `if provider.is_coming_soon: raise HTTPException(400, "This provider isn't
  taking bookings yet.")`, **before** any booking row is written.

Frontend:
- `components/ProviderCard.jsx` + the inline Explore card in `ExploreScreen.jsx`:
  `Coming soon` badge in place of `Featured`, dimmed cover, **no** `Book Now`.
  The card still navigates to `/provider/:id`.
- `pages/ProviderDetail.jsx`: a banner card under the info block (reuse the
  `#promo-banner` styling) reading *"Coming soon to Well Circle — this provider
  isn't taking bookings yet."*; service rows non-tappable; bottom CTA replaced
  by a disabled `Coming soon` button. Do **not** invent a "Notify me" flow.
- `pages/BookingFlow.jsx`: deep-link guard — if the resolved provider is coming
  soon, `showToast` and `navigate('/provider/:id', { replace: true })`.

### 1.6 Admin toggle

`pages/admin/AdminProviders.jsx`: a per-provider Live / Coming soon toggle
calling a new `PATCH /api/admin/providers/{id}/launch-state`
(`{is_coming_soon: bool}`, `get_super_admin` dep). Without it, launching the
next provider needs a psql session.

### 1.7 Mock parity

`frontend/src/data/mock.js`: `MOCK_PROVIDERS[10]` (`'Kuriftu Resort & Spa'`,
the `is_featured: true` entry at ~line 314) becomes Boston Day Spa with the 7
services, `is_coming_soon: false`, and its linked community renamed
`'Boston Day Spa Circle'`. Every other mock provider gets `is_coming_soon: true`.

### Acceptance checks
- `python seed_boston_day_spa.py` twice → second run is a clean no-op.
- Explore lists all providers; only Boston Day Spa has a `Book Now`.
- `/booking/<coming-soon-id>` bounces back with a toast; `POST /api/bookings`
  returns 400 and writes no row.
- A booking against Boston Day Spa still reaches the Google Sheet.
- New `app/tests/test_coming_soon.py`; `python -m app.tests.test_provider_contact` passes.

---

## Phase 2 — Instant open (sets the budget for everything after it)

**Journey step:** tapping the bot button and seeing content — the first
impression, and the thing the marketing team complained about.

**Goal:** from tap to readable content with **zero** spinner on a warm open, and
a first paint that never waits on the network. This phase defines a budget that
Phases 4 and 5 must build to, which is why it comes before the feed.

### 2.1 The bot's `/start` is serially blocking — fix it first

`telegram-bot/bot/handlers/start.py` currently awaits, **in order**, before the
user sees anything:
1. `user.get_profile_photos()` → a Telegram API round trip
2. `photos.photos[0][0].get_file()` → a second Telegram round trip
3. `register_user(...)` → an HTTP call into a possibly **cold** Vercel function

Only then does it `reply_text(...)` with the Open Well Circle button. On a cold
backend that is seconds of dead air on the user's very first interaction.

**Fix:** send the welcome message **and** the Mini App button first, then do
registration and the photo fetch in a background task
(`asyncio.create_task`, or `context.application.create_task` so the bot's
lifecycle owns it). Registration failure already degrades gracefully — the
handler shows the app either way — so nothing is lost by deferring it. Log
failures; never surface them to the user.

Also confirm `telegram-bot/bot/services/keep_warm.py` is actually scheduled in
`bot/main.py` and pings the backend often enough to keep the function warm; a
cold start behind the Mini App button undoes this phase's work.

### 2.2 Respect the cache's persistence limit — it is smaller than you think

`frontend/src/api/cache.js` sets `MAX_PERSISTED_BYTES = 192 * 1024`. **An entry
larger than that stays memory-only** and is therefore gone the moment Telegram
tears the WebView down — which is exactly the cold-open case this phase targets.
`TTL.home` is 60s, but that is not the problem: `peek()` deliberately returns
stale entries and `useResource` paints them immediately, so a persisted-but-stale
`home` entry still gives an instant first paint. **A non-persisted entry gives a
blank screen.**

Therefore:
- **Measure `/home/bootstrap`'s serialized size before and after Phase 4.**
  Add a dev-only assertion or a one-off script; treat **150 KB** as the working
  ceiling to leave headroom.
- The bootstrap payload must be trimmed to fit. Concretely: the feed page it
  carries returns **`comment_count` instead of full `comments` arrays**, caps
  `content` at ~280 chars with a `truncated` flag, and carries at most **10**
  items. Full comments load on the destination screen, where they belong.
- If the payload still will not fit, split it: persist a small
  `home:above-fold` key and leave the remainder memory-only. Do not silently
  exceed the cap.

### 2.3 Rank by readiness, not just recency

The owner's rule: *anything that needs loading or isn't cached yet ranks lower.*
Implement it as a **two-tier first paint**, not a scoring model:

- The feed builder (Phase 4) tags each item with
  `render_cost: "instant" | "media"` — `instant` means it needs no image fetch
  to be readable (text posts, service line items with a cached provider cover),
  `media` means its primary content is an image.
- On **first paint from cache**, the client renders `instant` items first and
  `media` items below them. Once the revalidated response lands, the feed
  settles into the server's ranking order. Animate nothing on this swap — a
  reflow the user can see is worse than the delay it saves.
- **No image ever blocks first paint.** Every feed card reserves a fixed
  aspect-ratio box so a late image cannot shift layout. `SmartImage` already
  handles lazy/async decoding and a shimmer placeholder; set `priority` on **at
  most the first one** visible card, per that component's own guidance.

### 2.4 No full-screen skeleton when anything is cached

`useResource` returns `loading: false` whenever `peek()` finds an entry. The For
You screen (Phase 5) must branch on **data presence**, not on `loading`: if
there are cached items, render them — never a skeleton. Reserve skeletons for a
genuine first-ever open.

### 2.5 Prefetch the one destination that matters

`App.jsx`'s `prefetchTabs()` already warms the four bottom-nav route chunks on
idle. Extend it to also warm the `ProviderDetail` chunk **and** prefetch Boston
Day Spa's detail payload into the cache — with a single live provider, that is
the most probable next screen in the product, and it makes the tap feel free.

### Acceptance checks
- `/start` posts the welcome + button **before** registration completes
  (verify by pointing `BACKEND_URL` at a deliberately slow endpoint).
- Cold open → close → reopen the Mini App: content is on screen in the first
  frame, no spinner. Verify on a throttled connection, not just desktop.
- `localStorage` contains a `wc_cache:v1:...home...` entry after an open —
  if it is missing, the payload blew the 192 KB cap and the phase is not done.
- Lighthouse/DevTools: no cumulative layout shift from feed images.

---

## Phase 3 — Onboarding: at most 2 circle suggestions

**Journey step:** the new user's second screen.

`pages/OnboardingFlow.jsx`, `circles` step only:

- Build **one** merged list, capped at 2:
  1. Real joinable circles from `getCircles()`, filtered
     `!is_joined && !is_private && !is_paid` (the paid filter is new — do not
     put a paywall in front of a first-time user).
  2. Interest-matched `MOCK_COMMUNITIES` entries as filler, only if fewer than
     2 real circles came back.
  3. `.slice(0, 2)`.
- Delete the separate "Available Circles" section and the "Recommended for you"
  header. One unlabelled list of at most 2 cards.
- Keep both interaction models — they hit different backends. A real circle
  joins immediately via `joinCircle()`; a community suggestion toggles into
  `formData.suggested_circle_ids` and is auto-joined by
  `POST /api/users/me/onboard` (`app/api/users.py:80`). Render them identically
  so the distinction is invisible to the user.
- **Keep** the "Or start your own" input, `handleCreateCircle`, and the
  `committedCircle` invite card.

Update `src/test/OnboardingFlow.circles.test.jsx`: assert **at most 2** cards,
and that the create-your-own input is still present.

### Acceptance checks
- 10 public circles seeded → exactly 2 cards render.
- 0 real circles, 3 matching interests → 2 community cards.
- Creating a circle from onboarding still offers the invite share.

---

## Phase 4 — For You feed: backend

**Journey step:** the feed itself.

### 4.1 Reusable post query

`crud/post.py` batches reactions and comments well but only filters one
`community_id`/`circle_id`. Refactor so the batching is shared:

- Extract the batching + assembly into `_assemble_posts(db, posts_data, *, include_comments)`.
- `get_posts()` keeps its signature and calls it with `include_comments=True`.
- New `get_public_feed_posts(db, limit, before=None)`:
  - Posts whose `circle_id` belongs to a circle with
    `is_private = FALSE AND is_paid = FALSE`, **or** whose `community_id` is set.
  - Exclude `is_system_event = TRUE` — auto-generated join/check-in notices are
    noise in a discovery feed.
  - `created_at DESC`, keyset-paginated on `created_at < before`.
  - `include_comments=False` → return `comment_count` only (Phase 2 budget).
  - **Each post gains a `source` object** — this is what makes "tap a post →
    land in their circle" work:
    `{"kind": "circle"|"community", "id", "name", "member_count"}`.
    One batched query per kind. Never per post.

### 4.2 The endpoint

New `backend/app/api/feed.py`, registered in `app/main.py`:

`GET /api/feed/for-you?limit=10&before=<iso8601>` →
`{"items": [...], "next_before": <iso|null>}`

Items discriminated by `type`, each carrying `render_cost` per Phase 2.3:

```jsonc
{ "type": "post",     "render_cost": "instant"|"media", "id", "created_at", "post": {...,"source":{...},"comment_count":N} }
{ "type": "service",  "render_cost": "media",  "id": "<provider_id>:<idx>", "provider": {...}, "service": {name,description,photo_url,price,duration,booking_method} }
{ "type": "event",    "render_cost": "media",  "id", "event": {...}, "provider": {...} }
{ "type": "provider", "render_cost": "media",  "id", "provider": {...}, "promotion": {...}|null }
```

**Ranking is a fixed, deterministic interleave — not a scoring model.** Document
it in `API_CONTRACT.md` so it is testable:

> Posts newest-first. After every 3rd post, splice in one non-post item, cycling
> `event → service → provider`, skipping a category when empty. Only live
> (`is_coming_soon = false`) providers may appear as `service` or `provider`
> items. An `event` item is emitted only for a boosted/featured event — these
> are the **event banners** the marketing team asked for.

Every section wraps in the same defensive `section()` helper `app/api/home.py`
already uses: a failing section degrades to empty and calls `db.rollback()`; it
never blanks the feed.

### 4.3 Keep the single-cold-start property

`GET /api/home/bootstrap` gains a `feed` key holding the **first page** (call the
shared builder directly, not the HTTP route). The For You screen paints from
`bootstrap` — one request on open, exactly as today — and hits
`/api/feed/for-you?before=` only on scroll. Do not regress this into two
requests. Re-measure the payload against Phase 2.2's ceiling.

### Acceptance checks
- New `app/tests/test_for_you_feed.py`: a user who has joined nothing still gets
  a non-empty feed; private- and paid-circle posts never appear; system events
  never appear; every post carries a resolvable `source`.
- Query count is **constant** with respect to the number of posts returned.
  Assert it — the batching regression is the thing worth catching.
- Serialized `bootstrap` stays under the Phase 2 ceiling.
- `docs/API_CONTRACT.md` documents the endpoint and `bootstrap.feed`.

---

## Phase 5 — For You screen replaces Home

**Journey step:** the landing screen.

### 5.1 The screen

New `frontend/src/pages/ForYouScreen.jsx`; delete `pages/HomeScreen.jsx` and
point `importHome` in `App.jsx` at it. The route stays `/home`, so
`SplashScreen`, `BottomNav`, and every existing `navigate('/home')` keep working.

**Kept from the old Home**, pinned above the feed in this order:
1. Greeting + `StreakBadge` + `PointsBadge` — unchanged markup.
2. `WelcomeBanner` when `location.state?.justOnboarded`.
3. `CheckinCard` when the user has joined circles — the daily habit trigger is
   too important to bury in an infinite feed.
4. `FirstRewardCard` and `SocialProofBanner` — small, conversion-critical,
   already under test.
5. `AskWellCircle` stays mounted.

**Dropped** (Explore covers them; the feed replaces the rest): `NearYouSection`,
the hero provider banner, `FeaturedEventsCarousel`, "Featured Providers"
h-scroll, "Join a Circle", the neighbourhood alert, `HomePromoBanner`.

**Then the feed.** First page from `bootstrap.feed` via `useResource` on
`cacheKeys.home()`; append later pages into local state from
`getForYouFeed({ before })`, triggered by an `IntersectionObserver` sentinel.
Apply Phase 2.3's readiness ordering on the cached first paint and Phase 2.4's
no-skeleton-when-cached rule.

### 5.2 Feed item components (`frontend/src/components/feed/`)

- **`FeedPostCard.jsx`** — avatar, name, time-ago, content, activity stat strip,
  photo, reaction counts, comment count, and an `in <circle name>` attribution
  line. **Tapping the card body navigates to `/circle/:id` or `/community/:id`**
  per `post.source.kind`; tapping avatar/name goes to `/users/:id`, matching
  `PostFeed.jsx`. Keep it read-mostly — one 🔥 quick-react is fine. Do **not**
  port `PostFeed.jsx`'s composer, gifting sheet, or comment threads into the feed.
- **`FeedServiceCard.jsx`** — service photo, name, the PDF's descriptive copy
  (truncated), price or `Price on enquiry`. **Tapping navigates to
  `/provider/:id`** (the owner's explicit requirement), with a secondary CTA to
  `/booking/:id` carrying `state.selectedService`, matching `ProviderDetail.jsx`.
- **`FeedEventBanner.jsx`** — full-bleed event banner (the "event banners" ask):
  cover, title, date, provider, CTA to `/booking/:providerId?event_id=…`,
  matching how `EventCard.jsx` already routes. This is the surface for themed
  events and Great Run / boxing-match style promotions.
- **`FeedProviderCard.jsx`** — highlight with rating, location, active promotion
  headline. Taps to `/provider/:id`.

All four honour `is_coming_soon`: no booking CTA when true. All four reserve a
fixed aspect-ratio image box.

### 5.3 Client + mocks

`api/client.js`: `getForYouFeed({ before } = {})` + `cacheKeys.feed(before)`.
Mock mode returns a new `MOCK_FOR_YOU_FEED` in `data/mock.js`, built from
`MOCK_POSTS` + Boston Day Spa's 7 services + `MOCK_EVENTS`, following the same
interleave rule as the backend. `getHomeBootstrap()`'s mock gains `feed`.

### 5.4 Tests to update

- **New** `src/test/ForYouScreen.test.jsx`: all four item types render; tapping
  a post navigates to its circle; tapping a service navigates to the provider
  page; a coming-soon provider's card has no booking CTA; a cached first paint
  renders no skeleton.
- **Update** `src/test/routes.smoke.test.jsx` — `/home` now mounts `ForYouScreen`.
- **Retire or rewrite** `src/test/HomeNearYou.test.jsx` and
  `src/test/HomePromoBanner.test.jsx` — both assert on sections this phase
  removes. If `HomePromoBanner` is no longer rendered anywhere, delete the
  component and its test together rather than leaving dead code.
- `WelcomeBanner.test.jsx` and `CheckinCard.test.jsx` should still pass.

### Acceptance checks
- A **brand-new user who has joined nothing** sees a full, non-empty feed.
  Verify against a real seeded DB, not just mocks — this is the entire point.
- One request on `/home` open.
- Warm reopen paints content in the first frame (Phase 2 gate, re-verified here).

---

## Phase 6 — Circle preview + Join CTA

**Journey step:** where a tapped post lands.

### 6.1 Fix the existing hack while you are here

`pages/CircleDetailScreen.jsx` resolves a circle by fetching the **entire**
circles list and `.find()`-ing it, with a `MOCK_CIRCLES` fallback baked into
production code. There is no `GET /api/circles/{id}` at all.

Add one → circle detail + `is_joined` + `is_owner` + `member_count` + `owner` +
`is_private` + `is_paid` + `price_etb`, plus `preview_posts` (up to 5 recent,
**omitted entirely for paid or private circles**). Rewrite `loadCircle()` to use it.

Access rules:
- Private circle, non-member → **404** (do not leak that it exists).
- Paid circle, non-subscriber → metadata only, no `preview_posts`; the existing
  subscribe flow takes over.
- Public free circle, non-member → metadata + `preview_posts`.

### 6.2 Preview mode

When `!joined` on a public circle: header renders as today; `PostFeed` is
replaced by a **read-only** render of `preview_posts` (no composer, no reaction
buttons, no comment boxes); `leaderboard` and `members` tabs hidden; invite
button hidden; a sticky bottom **Join circle** CTA. On success, flip to full
mode in place — no navigation — and let `PostFeed` mount for real.

### 6.3 Same for provider communities

A For You post can come from a `community`. `pages/CommunityDetail.jsx` needs the
equivalent: non-members see the feed read-only with a Join CTA, reusing the
`joinCommunity` call already wired through `ProviderDetail.jsx`.

### Acceptance checks
- New `app/tests/test_circle_preview.py`: private → 404 for non-members; paid →
  metadata without `preview_posts`; public → both.
- `src/test/CircleDetailScreen.paid.test.jsx` still passes.
- Manual: tap a feed post as a non-member → preview → Join → composer appears
  without a page reload.

---

## Phase 7 — In-app payment (Telebirr)

**Journey step:** the conversion. **Blocked on B1 (prices).**

### 7.1 What already exists — do not rebuild it

The rail is complete end to end and only needs to be switched on:
- `POST /api/payments/telebirr/initiate` → `{to_pay_url, trade_no}`
  (`app/api/payments.py`), storing the trade number on the booking **and its
  multi-day siblings** via `update_booking_group_payment`.
- `POST /api/payments/telebirr/callback` → async webhook, also handles
  subscription activations.
- `GET /api/payments/{booking_id}/status` → polling endpoint.
- `frontend/src/api/client.js` already exports `initiateTelebirr`,
  `getPaymentStatus`, and their mock-mode equivalents.
- `bookings` already carries `payment_method`, `payment_status`,
  `telebirr_trade_no`, `booking_group_id`.

### 7.2 What is actually missing

1. **Prices.** `BookingFlow` computes `amount_etb` from
   `service.price`. With `price: null` (Phase 1) there is nothing to charge.
   **B1 gates this phase.**
2. **`booking_method`.** Every Boston Day Spa service is seeded `"phone"`, which
   routes `BookingFlow.jsx` to its contact screen and skips payment entirely.
   Flip a service to `"online"` **only** once its price is confirmed. This keeps
   the phases decoupled: services can go online one at a time.
3. **The frontend payment step.** `BookingFlow.jsx:230` hardcodes
   `payment_method: 'pay_on_site'` (see the comments at lines 54 and 218).
   Restore a real step for `booking_method: "online"` services:
   create booking → `initiateTelebirr` → open `to_pay_url` → poll status →
   confirmation. Keep `pay_on_site` as the path for `"phone"` services.
4. **Opening the payment URL inside the Telegram WebView.** Use
   `window.Telegram.WebApp.openLink(to_pay_url)` — a bare `window.open` is
   unreliable inside the Mini App WebView. Poll on return via
   `visibilitychange`; `hooks/usePolling.js` already pauses while backgrounded
   and refreshes on return, which is exactly this shape.
5. **Real credentials.** `services/telebirr_payment.py` returns a **mock**
   `to_pay_url` whenever `TELEBIRR_MERCHANT_CODE` is unset. Production needs
   `TELEBIRR_MERCHANT_CODE`, `TELEBIRR_APP_KEY`, and a publicly reachable
   `TELEBIRR_NOTIFY_URL` (the Vercel deployment). Until those exist, the flow
   demos end-to-end but settles nothing. **Confirm with the owner who holds the
   Telebirr merchant account** before wiring production keys.
6. **Failure and timeout states.** The current UI has none: handle
   `payment_status: 'failed'`, a user who abandons the Telebirr page, and a
   webhook that never arrives. A booking stuck `pending` must still be
   recoverable from `MyBookings`.

### 7.3 Document the reversal

`docs/kuriftu-gap-analysis.md` (G3/G6) records that the partner collects payment
**on-site, after** the service, and the whole phone-booking flow was built around
that finding. The owner has now chosen in-app payment. **Add a dated note to
that document** recording the reversal, so the next reader does not "fix" this
back. Charging up front changes the partner's process, not just ours — confirm
they have agreed operationally, not only in principle.

### Acceptance checks
- A priced, `booking_method: "online"` service completes:
  booking → Telebirr → callback → `payment_status: success` → visible in
  `MyBookings` with a reference number.
- A `"phone"` service still reaches the contact screen and never touches payment.
- Multi-day selection: one payment settles every sibling booking in the group.
- Abandoning the Telebirr page leaves a recoverable `pending` booking, not a
  wedged screen.
- `docs/API_CONTRACT.md` payment section updated; gap-analysis note added.

---

## Phase 8 — Navigation tips in the provider profile

**Journey step:** actually getting there. The `navigation_tips` column ships in
Phase 1's migration; this phase fills and renders it.

The marketing team asked for "navigation tips (inside provider profile)". The
PDF gives the raw material: Bole location, two phone numbers, and the seven
facilities — enough for on-site orientation ("the massage cave is past the
manicure lounge") plus getting-there guidance.

- Shape: `navigation_tips JSONB` = `[{"title": str, "detail": str}]`.
- Expose in `get_provider_detail()` **only** — detail-only content, and the list
  response is already the heaviest public payload (Phase 2 budget).
- `pages/ProviderDetail.jsx`: a `Getting there` section between the info block
  and `Services`, rendered only when `navigation_tips?.length`. Each tip is an
  `Icon name="map-pin"` row. If `lat`/`lng` exist, add one "Open in Maps" link.
- Render `facilities` (Phase 1) as a checklist here too — it is the PDF's own
  "Our Facilities" section and it answers "what's actually on site".
- Provider-side editing: extend `ProviderMeResponse`/`ProviderUpdate` on the
  existing `PATCH /api/providers/me`, plus a repeatable field in
  `pages/provider-portal/ProviderPortalOverview.jsx`.
- Seed Boston Day Spa's tips in `seed_boston_day_spa.py`: Bole location, both
  phone numbers, and the facility list.

### Acceptance checks
- A provider with no tips renders no section (no empty header).
- `docs/API_CONTRACT.md` documents the field on the detail response.

---

## Deferred — explicitly out of scope

From `docs/Marketing Team Notes.docx`, to be picked up on the owner's instruction:
**email integration**, **QR / web-app entry point** (the provider portal's
Telegram Login Widget is the proven pattern to copy), **promotional discount
alerts** (the `ProviderPromotion` model and `notification_service.py` already
exist — mostly a trigger + copy job), and **challenge gifts / day passes**
(closest surface: the products store plus `community_challenge`).

---

## Sequencing summary

| Phase | Journey step | Blocked by |
|---|---|---|
| 1 — Provider truth | What you browse | — |
| 2 — Instant open | Tap to first paint | — (do early; it budgets 4 & 5) |
| 3 — Onboarding: 2 circles | New-user setup | — |
| 4 — Feed backend | The feed | 1, 2 |
| 5 — For You screen | The feed | 4 |
| 6 — Circle preview | Tapping a post | 5 |
| 7 — Telebirr payment | Booking | **B1 prices** |
| 8 — Navigation tips | Getting there | — |

Phases 1 and 2 together are a shippable release on their own: the pilot partner
is real and sole-bookable, and the app opens instantly. Phases 4 → 5 → 6 are the
For You unit and should ship together — Phase 5 without Phase 6 sends users from
a good feed into a dead-end circle screen. Phases 3 and 8 are independent and can
land any time. Phase 7 lands when the price list does.
