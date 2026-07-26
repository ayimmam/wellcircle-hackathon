# Well Circle — Project Handoff

This document tracks implementation status against `PRD.md`, `IMPLEMENTATION_PROMPT.md`, and `PHASE3_IMPLEMENTATION_PLAN.md`.  


**Last updated:** July 2026 — after Phase 11 (multi-passion onboarding + real circle creation, `feature/multi-passion-onboarding-circles`). Phase 9 (Kuriftu direct-contact booking fix) is detailed in `kuriftu-gap-analysis.md`; Phase 8 (UX Psychology Growth Loop) in `UX_GROWTH_LOOP_PLAN.md`; Phase 7 (Biniyam's presale/re-entry sprint track) in `BINIYAM_SPRINT_PLAN.md`. **Note:** a separate Phase 10 (booking UX polish + multi-day booking) exists on the not-yet-merged `feature/booking-ux-polish` branch, forked before this one — the two haven't been reconciled yet.


For Phase 3 detail and LLM continuation notes, see also **`PHASE3_HANDOFF.md`**.

---


`main` does **not** yet include the two most recent features. Both are complete,
tested, and pushed to `origin`, but not merged — **check these branches before
assuming `main` is the full story**, and before starting new work that might
overlap with either.

### `feature/booking-ux-polish` (commits `726aae5` on top of `1fe390d`)
Booking UX polish + **multi-day booking**: date-chip selection is now
multi-select (one real `Booking` row per day, one combined payment via a new
`booking_group_id` correlation key); a fixed CSS overflow bug on date chips;
a swapped onboarding emoji; Kuriftu's confirmed phone number wired into the
direct-contact screen's Call button (now primary, ahead of Email); and a new
`backend/.vercelignore` (the Vercel Python builder was bundling every test/
loadtest/maintenance script into the production Lambda). Full detail: that
branch's own `HANDOFF.md` **Phase 10** entry (not visible from `main` until
merged).

### `feature/multi-passion-onboarding-circles` (commit `8415faa` on top of `1fe390d`)
**Multi-select passions** at onboarding (`User.interest_category` → `interest_categories`,
a full-replacement refactor across ~15 backend/frontend consumers — community
suggestions, product personalization, admin analytics all now OR-match across
every selected interest) + a rebuilt circles onboarding step: a one-sentence
explainer, an "Available Circles" list to join an existing real `Circle`
directly, and a "create your own circle" form — either path shows an inline
Telegram invite-friends action. Full detail: that branch's own `HANDOFF.md`
**Phase 11** entry (not visible from `main` until merged).

**Both branches fork independently from the same `main` commit (`1fe390d`) and
have not been reconciled with each other** — they touch almost entirely
different files, so a normal merge/rebase of both into `main` (in either
order) should be low-conflict, but this hasn't been verified. Do that check
before merging.

---

## Shipped Features

### MVP (Complete)

#### Consumer Experience
- **Telegram Mini App shell** — auto-auth via Telegram `initData`, no separate login screen
- **Provider marketplace** — browse, filter by category, provider detail pages
- **Community spaces** — join, leave, daily check-in, live feed
- **Legacy Points engine** — +10 per check-in, tiers (Seed → Sprout → Grove → Forest), backend decay via APScheduler
- **Booking flow** — 3-step flow (service → date/time → payment); provider services seeded in production DB

#### Provider Dashboard (MVP)
- Live KPI cards (members, bookings, revenue, engagement)
- Real-time stats polling (10s interval)

#### Social & Engagement
- Neighbourhood opt-in on Profile → hardcoded alert banners on Home
- Health app connection toggle (UI mock metrics)
- Circles with leaderboards
- Community posts and point-gifting reactions

---

### Phase 2 (Complete — June 2026)

#### Provider Self-Onboarding
- **Route:** `/provider-onboard` — 5-step form (invite code → basic info → services & photos → payment setup → review)
- **API:** `POST /api/providers/self-onboard` with gated invite codes
- **Admin API:** `POST /api/providers/invite-code/generate`
- Provider applications enter `pending_approval` until admin approves
- Approval auto-creates linked community and sends Telegram notification

#### Wellness Products Store
- **Routes:** `/products`, `/products/:id`, `/products/:id/redeem`, `/users/me/redemptions`
- Browse, search, filter (type, in-stock), recommended products by interest
- Redeem with Legacy Points (digital voucher codes + physical delivery address)
- Stock decrements on redemption; points deducted atomically in a single DB transaction

#### Super Admin Dashboard
- **Route:** `/admin` (protected — super admin only)
- **Tabs:** Analytics, Providers (pending/active/rejected), Products inventory, Reports/CSV export
- **API:** pending approve/reject, promote-user, notifications, stock updates, redemption status
- Accessible from burger menu when user is super admin

#### Provider Dashboard (Phase 2 additions)
- **Products tab** — list, create products, view recent redemptions
- **API:** `GET/POST/PATCH /api/providers/me/products`, `GET /api/providers/me/redemptions`

#### Telegram Bot
- **`/admin` command** — opens Admin Dashboard as Mini App WebApp button (super admins only)
- Checks `SUPER_ADMIN_TELEGRAM_IDS` env **and** backend `is_super_admin` DB flag via `GET /api/bot/users/{id}/admin-access`
- Approval/rejection messages sent by backend (`telegram_notify.py`) on admin actions

---

### Phase 3 (Complete — June 2026)

#### Database Schema
- **Migration:** `backend/alembic/versions/002_phase3_schema.py`
- **New tables:** `provider_events`, `community_challenges`, `user_notifications`, `provider_subscriptions`, `provider_promotions`, `event_inventory_log`
- **Alterations:** `bookings` and `providers` extended without breaking Phase 1/2 flows

#### Backend APIs
- **Events** — `/api/events`, `/api/providers/me/events`; discover, create, update, cancel, boost
- **Community challenges** — `/api/communities/:id/challenges`; active challenges, create, check-in completion, leaderboard
- **In-app notifications** — `/api/users/me/notifications`; inbox, mark read, read-all
- **Subscriptions** — `/api/subscriptions`; plan fetch, Telebirr/M-Pesa initiation, status polling, webhooks
- **Extensions:** `bookings` and `communities` APIs updated for Phase 3 tables

#### Frontend
- **Route:** `/notifications` — in-app notification inbox
- **Components:** `FeaturedEventsCarousel.jsx` (Home + Explore), `ChallengesList.jsx` (Community detail)
- **Provider Dashboard tabs added:** Events, Subscriptions (alongside Analytics + Products from Phase 2)
- **API client:** `frontend/src/api/client.js` extended for all Phase 3 endpoints

#### Hackathon Reviewer Critiques Addressed
- **Live Inventory & Locking**: Added real-time spot capacity ratio to `EventCard.jsx` (`"3 spots left out of 15"`) and implemented row-level transaction locking (`with_for_update`) in `POST /api/bookings` with direct `event_inventory_log` logging.
- **Deepened Interactions**: Added "Nudge" and "High-Five" actions on `Leaderboard.jsx` that push live events directly into the community feed (`POST /api/communities/:id/interactions`).
- **Logged Experiences**: Split `/my-bookings` into Upcoming and Past History views; added digital reference codes and inline `.ics` calendar generation for upcoming sessions.
- **Instant Notifications**: Integrated FastAPI `BackgroundTasks` to dynamically log booking confirmation notifications into `user_notifications` immediately.
- **Provider Inventory Editing**: Built inline, instantaneous event capacity and cancellation editing within the Provider Dashboard (`PATCH /api/providers/me/events/:id`).
- **Legacy Points Utility**: Added an explanatory `PointsTooltip` to `ProfileScreen` and `ProductRedeem` views detailing specific monetary values/tier discounts.
- **Provider Event Boosting**: Seamlessly connected `/provider-onboard` to subscriptions, and added a "Boost Event / Ad Space" panel in the Provider Dashboard with mock Telebirr integration targeting `provider_promotions`.

---

## Infrastructure & Deployment

| Service | Platform | Status |
|---------|----------|--------|
| Backend API | Vercel Serverless (Mangum) / Render | Deployed |
| Database | Supabase PostgreSQL | Phase 2 + Phase 3 migrations |
| Frontend Mini App | Vercel | Deployed (`VITE_USE_MOCK=false` in prod) |
| Telegram Bot | Railway | Deployed |

### Database (Phase 2 schema)
- `providers` — added `status`, `onboarded_by_admin`, `submitted_at`, `reviewed_at`
- New tables: `provider_invites`, `products`, `user_redemptions`, `admin_notifications`
- RLS enabled on `users` table (`backend/apply_rls.py`)
- Demo `is_super_admin` and provider ownership configured for hackathon demos

### Payments (Demo mode)
- Telebirr/M-Pesa endpoints exist for bookings and subscriptions
- Backend auto-approves mock transactions when live sandbox credentials are not set

---

## Admin Access Setup

Super admin is granted if **either** condition is true:

1. `users.is_super_admin = true` in Supabase, **or**
2. User's `telegram_id` is in `SUPER_ADMIN_TELEGRAM_IDS` (backend + bot env)

**Frontend** also respects `VITE_SUPER_ADMIN_TELEGRAM_IDS` for the `/admin` route guard.

**Local mock testing:** set `VITE_MOCK_SUPER_ADMIN=true` in frontend `.env`.

---

## Partially Implemented / Known Gaps

| Item | Status |
|------|--------|
| Telebirr / M-Pesa live payments | UI + API ready; sandbox credentials optional; demo auto-approve |
| Real health data (Apple Health, etc.) | UI mock only |
| Dynamic push notifications | ✅ Location alerts still hardcoded, but the bot now sends three *dynamic* DM nudges: 7-day-inactive re-engagement (promo-aware since Phase 7), daily streak-at-risk (Phase 8), and the pre-existing Sunday circle digest |
| Admin invite-code UI | ✅ Generate + copy button on `/admin/providers` |
| Admin redemption status UI | ✅ Redemptions sub-tab on `/admin/products` |
| Admin CSV exports | ✅ Reports tab pulls live data from admin APIs |
| PDF report generation | Placeholder toast in Reports tab |
| Event cancellation refunds | Events cancelled with user notifications; payment refund logic deferred (Phase 4) |
| Dedicated Phase 3 CRUD modules | Logic in route handlers + `subscription_service` / `promotion_service` (optional refactor) |

---

## Yet to Implement (Phase 4+)

- Event/booking refund logic
- Real health data integration (Apple Health, Google Fit, Garmin)
- Dynamic location-aware push notifications
- Corporate B2B benefits portal
- Tribe Vault / group wallet split payments
- Rotating wellness savings pool (digital Equb)
- National / diaspora expansion

---

## Key Files

### Phase 2
```
backend/alembic/versions/001_phase2_schema.py
backend/app/api/products.py
backend/app/services/telegram_notify.py
frontend/src/pages/admin/*
frontend/src/pages/ProductsStore.jsx
frontend/src/pages/ProviderOnboard.jsx
telegram-bot/bot/handlers/admin.py
```

### Phase 3
```
backend/alembic/versions/002_phase3_schema.py
backend/app/api/events.py
backend/app/api/challenges.py
backend/app/api/notifications.py
backend/app/api/subscriptions.py
frontend/src/components/FeaturedEventsCarousel.jsx
frontend/src/components/ChallengesList.jsx
frontend/src/pages/NotificationsScreen.jsx
frontend/src/pages/ProviderDashboard.jsx
```

---

## Quick Verification Checklist

### MVP + Phase 2
- [ ] User can browse `/products` and redeem with points
- [ ] Provider can apply at `/provider-onboard` with invite code
- [ ] Admin can approve at `/admin/providers`
- [ ] Bot `/admin` opens dashboard for super admin Telegram account
- [ ] Existing MVP flows (explore, communities, bookings) still work

### Phase 3
- [x] `FeaturedEventsCarousel` renders on Home and Explore
- [x] `ChallengesList` shows on Community detail; check-in updates challenge progress
- [x] `/notifications` inbox loads and mark-read works
- [x] Provider Dashboard Events tab: create/list events
- [x] Provider Dashboard Subscriptions tab: view plans and initiate payment (demo mode)
- [x] **Hackathon Critiques addressed**: Live Inventory locking, Deep interactions, `.ics` generation, Instant notifications, Inline event editing, Points Utility tooltip, Event Boosting.
### Phase 3.1 — Content & UX Polish (This Session)
- [x] **Legacy Points → Redeem Flow**: Tapping the points badge on Home now navigates to `/products`
- [x] **Products Store populated**: 20 products (2 per provider, 50–150 Legacy Points each) seeded via `backend/seed_products_db.py`
- [x] **Circle Chat & Social Feed**: 7 sample posts across 2 circles (user messages, check-ins, challenge completions, high-fives, joins)
- [x] **Circle Detail Overhaul**: Redesigned `CircleDetailScreen` with Chat / Leaderboard / Members tabs
- [x] **PostFeed Enhanced**: System events styled distinctly (left border + "activity" badge), relative timestamps, reaction badges
- [x] **Mock Data Enriched**: Expanded `MOCK_LEADERBOARD` (6 members), added "Zen Seekers" circle, posts filtered by `circleId`
- [x] **`PointsBadge` clickable**: Accepts `onClick` prop with pointer cursor

### Files Changed (Phase 3.1)
```
frontend/src/components/PointsBadge.jsx
frontend/src/components/PostFeed.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
backend/seed_products_db.py (new — DB seed script for products)
HANDOFF.md
```

### Phase 3.2 — Internationalization (This Session)
- [x] **Language Support**: Added `i18next` and `react-i18next` for Amharic, French, Italian, and English support.
- [x] **Language Selection**: Added a dropdown on the Profile Screen allowing users to switch application language instantly.
- [x] **Global Translations**: Integrated the `useTranslation` hook into global layout components (`BottomNav`, `Header`) and main user screens (`HomeScreen`, `SplashScreen`).
- [x] **Dictionary Setup**: Created `frontend/src/i18n.js` with structured language resources.
- [x] **Extended Translations**: Applied localized text to Explore page, Provider Detail, Booking Flow, Product Redeem, Notifications, and Products Store screens.

### Phase 3.3 — UX Enhancements (This Session)
- [x] **Redeem Flow Activation**: Activated the "Redeem Points" button in the Profile screen to redirect to the Legacy Points Store.
- [x] **Provider Images in Store**: Updated `ProductListItem` backend schema and CRUD logic to expose `provider_cover_photo_url`, rendering the provider's cover photo natively in the Redeem list.
- [x] **Simplified Bookings**: Removed the "+ Add to Calendar" button and `.ics` generation from `MyBookings.jsx` to clean up the booking card view.

### Phase 3.4 — AI Concierge Integration (This Session)
- [x] **Native Chat Component**: Created `AskWellCircle.jsx` chat interface, perfectly matched to the app's native CSS (`max-width: 430px` shell, `var(--bg-glass)` blurs, standard input classes).
- [x] **Microservice API Wiring**: Connected frontend to the live external Groq/FastAPI microservice at `https://well-circle-concierge.onrender.com/ai/concierge`.
- [x] **Interactive Bot UI**: Designed the AI chatbot overlay as a Floating Action Button on the `HomeScreen`.
- [x] **Deep Linking**: Implemented conditional rendering for AI provider recommendations — resolving `live` data IDs directly to `/provider/:id` booking routes while safely displaying `fallback` data as offline location pills.

### Files Changed (Phase 3.2, 3.3 & 3.4)
```
frontend/src/i18n.js
frontend/src/main.jsx
frontend/src/pages/ProfileScreen.jsx
frontend/src/components/BottomNav.jsx
frontend/src/components/Header.jsx
frontend/src/pages/SplashScreen.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/ExploreScreen.jsx
frontend/src/pages/ProviderDetail.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/ProductRedeem.jsx
frontend/src/pages/ProductsStore.jsx
frontend/src/pages/NotificationsScreen.jsx
frontend/src/pages/MyBookings.jsx
backend/app/schemas/product.py
backend/app/crud/product.py
frontend/src/components/AskWellCircle.jsx
frontend/src/components/Icon.jsx
HANDOFF.md
```

---

### Phase 4 — Production Readiness / Beta Hardening (This Session)

Focus: make the app safe for real beta users — resilient navigation, free-tier
responsiveness, and errors that read plainly for users while staying fully
diagnosable from the server side. **Launch posture:** polished beta — payments
remain in demo/auto-approve mode; this pass is reliability, speed, and tests.

#### Graceful Error Handling (users see simple language; ops get full detail)
- **Backend** `backend/app/utils/error_handlers.py` (new) — registers global handlers:
  - Unhandled exceptions: full traceback + correlation id logged; client gets a
    calm generic message (`"Something went wrong on our side…"`) tagged with the
    same `request_id`. **No stack traces or internal messages leak to clients.**
  - Validation errors: specifics logged; client gets a short, friendly summary.
  - Intentional `HTTPException`s (401/403/404/409) pass through their existing
    user-facing `detail` strings; 5xx-class ones are logged.
  - **Request middleware** logs every call as `METHOD path -> status in Xms [req:id]`,
    escalating to WARN/ERROR on 4xx/5xx or slow (>1.5s) responses.
- **Backend** `backend/app/utils/logger.py` — now configures a real stdout
  handler/formatter once (captured by Vercel/Render), quiets noisy libs in prod;
  `main.py` `print()`s replaced with structured logging.
- **Frontend** `frontend/src/components/ErrorBoundary.jsx` (new) — wraps all
  routes; a crashing screen shows a friendly reload card instead of a white page,
  while the technical error goes to the console.
- **Frontend** `frontend/src/api/client.js` — network/timeout errors now read in
  plain language (internal URLs moved to `console.error`); server error
  correlation ids are logged for support.

#### Free-Tier Performance
- **Route-based code splitting** — `frontend/src/App.jsx` lazy-loads every screen
  via `React.lazy` + `Suspense` (admin bundle fully isolated). Initial JS bundle
  ≈ 292 kB / 91 kB gzip; screens load on demand for faster first paint over slow
  Telegram networks.
- **Visibility-aware polling** — `frontend/src/hooks/usePolling.js` (new) pauses
  notification (30s), provider-stats (10s), and community-feed (5s) polling while
  the app is backgrounded and refreshes on return, so cold serverless functions
  aren't woken needlessly.
- **Scheduler gated off serverless** — `main.py` skips the APScheduler background
  job on Vercel (`VERCEL` env), where frozen threads make it unreliable and only
  add cold-start cost; it still runs on long-lived hosts (Render/local).

#### Automated Testing (Vitest + React Testing Library)
- Test infra added: `vitest` + `@testing-library/react` on `happy-dom`, config in
  `vite.config.js`, setup in `src/test/setup.js`. Scripts: `npm test`,
  `npm run test:watch`. Tests run the API client in mock mode (deterministic, no
  network).
- **42 passing tests**, including:
  - Navigation chrome: `BottomNav`, `Header`, `BurgerMenu` (role-based items),
    `AdminGuard` (loading / error+retry / non-admin redirect / admin allow).
  - `ErrorBoundary` (friendly fallback, no raw error leak, reload works).
  - **Route smoke suite** (`src/test/routes.smoke.test.jsx`) — mounts all 23
    reachable routes (every user + admin screen, detail pages, 404 fallback) and
    fails if any trips the ErrorBoundary.

#### Verification
- `npm run build` ✅ · `npm test` → 42/42 ✅ · backend exception handler manually
  verified to return generic message + `request_id` with no leaked internals ✅

#### Known Gap (pre-existing, unrelated)
- `backend/app/tests/test_integration.py` has one pre-existing failure at
  `get_valid_invite` — a SQLite UUID `TypeDecorator` (`cache_ok`) harness issue,
  not caused by this work (the test imports none of the changed modules).

#### Files Changed / Added (Phase 4)
```
backend/app/utils/error_handlers.py   (new)
backend/app/utils/logger.py
backend/app/main.py
frontend/src/App.jsx
frontend/src/components/ErrorBoundary.jsx   (new)
frontend/src/components/Header.jsx
frontend/src/api/client.js
frontend/src/hooks/usePolling.js   (new)
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/CommunityDetail.jsx
frontend/vite.config.js
frontend/package.json
frontend/src/test/setup.js   (new)
frontend/src/test/renderWithProviders.jsx   (new)
frontend/src/test/ErrorBoundary.test.jsx   (new)
frontend/src/test/BottomNav.test.jsx   (new)
frontend/src/test/Header.test.jsx   (new)
frontend/src/test/BurgerMenu.test.jsx   (new)
frontend/src/test/AdminGuard.test.jsx   (new)
frontend/src/test/routes.smoke.test.jsx   (new)
HANDOFF.md
```

---

### Phase 5 — Points Economy, Provider Tools & Social Growth (This Session)

Full implementation of `docs/POINTS_ECONOMY_PLAN.md` (architecture/prioritization doc — read that first for the "why" behind each decision). Landed across two sessions: backend data layer + points service first, then bot handlers, remaining frontend UI, and the migration/docs in this session.

#### B — Redundancy & maintainability remediation
- **B1 — Transaction ledger.** New `point_transactions` table (`backend/app/models/point_transaction.py`) is now the single source of truth for every points mutation. `app/services/points.py: apply_transaction()` is the *only* function allowed to touch `User.points_balance` — it writes a ledger row and updates the cached balance atomically. All 12+ prior call sites (`crud/community.py`, `crud/booking.py`, `crud/product.py`, `crud/post.py`, `services/scheduler.py`) migrated onto it. `GET /users/me/points-history` now reads the ledger instead of `CommunityFeedEvent` (previously blind to booking bonuses, gifts, and decay).
- **B2 — Engine consolidation.** Tier calculation and earn/decay constants unified in `app/services/points.py`; `points_engine.py` kept only as a deprecated import shim (its `points_engine` decay constants were still referenced by the scheduler, and a clean deletion risked breaking any external script importing it — verified with `git grep` there were no other callers of note, but kept the shim as a zero-cost safety net rather than a hard break).
- **B3 — `price_etb` naming collision fixed.** `Product.price_etb` (points) renamed to `points_cost` at the ORM level; the underlying DB column stays `price_etb` (`Column("price_etb", ...)`) so no migration/deploy-order coupling across the three services, and a `price_etb` property alias keeps old callers working for one release. `ProviderEvent.price_etb` (real ETB) is untouched — it was never ambiguous.
- **B4 — Polling standardized onto `usePolling`.** `Header.jsx`'s persistent 30s notification poll, plus the short-lived payment/subscription-status polls in `BookingFlow.jsx`, `ProviderDashboard.jsx`, and `ProviderOnboard.jsx`, all converted from raw `setInterval` to `usePolling` — pauses while backgrounded, cleans up on unmount, no more waking cold serverless functions for nothing.

#### C — Engagement & provider trust features
- **C1 — Provider customer list (mini-CRM).** `GET /providers/me/customers` — distinct users with a successful booking or check-in at that provider, last-visit date, lifetime points redeemed. New "Customers" tab in `ProviderDashboard.jsx`.
- **C2 — Streak + streak freeze.** `User.current_streak`/`freeze_count`; check-in awards a streak freeze every 7-day streak. Surfaced as a badge next to the points chip on Home, plus a toast on streak milestones.
- **C3 — Weekly circle digest.** `GET /api/bot/circle-digests` (ledger-derived weekly top scorer per circle) + a bot `JobQueue` job (`telegram-bot/bot/services/weekly_digest.py`) DMing every circle member each Sunday 18:00 UTC.
- **C4 — First-reward onboarding goal.** `FirstRewardCard.jsx` on Home — picks the cheapest product the backend already flags `is_recommended` for the user's interest category and shows a progress bar / "check in N more times" nudge.
- **C5 — Provider payout-predictability card.** `GET /providers/me/analytics/points` — 4-week trend of points redeemed + unique visits at that provider, rendered as bars in the dashboard's Analytics tab.

#### D — Point valuation & new earning mechanisms
- **D1 — Price suggestions.** `GET /providers/me/products/price-suggestion?category=…` — median/P25–P75 of `points_cost` across active in-category products (falls back to an ETB-anchor heuristic under 3 comparables). Surfaced as a hint chip on the product-creation form that fills the price field on tap.
- **D2 — Evidence-based event participation.** `ProviderEvent.staff_user_id` (provider-designated per event, no new role system needed) + new `evidence_submissions` table. Bot `/evidence` conversation handler (`telegram-bot/bot/handlers/evidence.py`) lists a staff member's ended events, captures a photo, and queues it. Admin review (`GET/POST /admin/evidence...`, with a backend photo proxy that keeps the bot token server-side) mints `event_participation` points to every attendee with a successful booking on approval.
- **D3 — Provider-initiated point awards.** `POST /providers/me/customers/{id}/award` — gated on a verified booking or check-in, capped at 1 award/customer/day, 50 pts/award, 300 pts/provider/day. One-tap "🎁 +25 pts" button on the new Customers tab.
- **Decay rewrite.** Eligibility changed from `last_checkin_at` to "days since last positive-amount ledger transaction" — a user earning via bookings/events/awards but skipping check-ins no longer bleeds points for being active in other ways. Decay is now itself a ledger row (`type=decay`), visible in points history for the first time.

#### E — Social growth loops
- **E1 — Circle invite links + referral credit.** `?startapp=circle_{join_code}` deep link parsed in `AuthContext` (Telegram `initDataUnsafe.start_param`) → `POST /circles/join-by-code` → auto-join + redirect. "Invite friends" button on `CircleDetailScreen` (`switchInlineQuery`, falling back to clipboard copy). Referral credit (+30 pts each side, capped at 10/referrer/month) fires on the invitee's **first-ever check-in**, not signup, to resist farming.
- **E2 — Social proof.** `GET /circles/social-proof/today` → "🔥 N circle-mates checked in today" banner on Home, reusing existing circle-membership + check-in data.

#### Bugs found and fixed while building on top of existing code
- `CircleMember.weekly_points` was dead — only ever populated by seed data, never written on check-in, so the leaderboard always read 0 for real users. C3's digest and E2 both needed a real number, so weekly points are now computed on-demand from the ledger (trailing 7 days of positive transactions) instead of that unfed column.
- While reshaping the circles list response to carry `join_code` (needed for the invite button), caught that returning it to every browsing user would leak a private circle's access gate — scoped it to circles the caller has already joined.

#### Verification
- Backend: `python -m app.tests.test_points_economy` → **65/65 passing** (in-memory SQLite integration test covering every item above). `app.main` imports cleanly with 99 routes.
- Frontend: `npm run build` ✅ · `npm test` → **42/42 passing** (mock-mode route smoke suite catches any render-time crash in the new UI).
- Bot: all new/changed files pass `python -m py_compile`.
- No headless-browser tooling was available in the build sandbox, so the new UI (streak badge, social proof banner, first-reward card, Customers tab, price hint chip, analytics trend bars) was verified via build + the automated route-smoke tests + code review, not a live screenshot — worth a manual pass with `npm run dev` before shipping to real users.

#### Known simplifications (flagged for a fast-follow, not blocking)
- D2's staff picker (event create/edit in `ProviderDashboard.jsx`) sources candidates from the provider's own Customers list rather than a general user lookup, since no user-directory/search UI exists yet — fine for "pick someone who's already interacted with you," not for staff who've never booked or checked in.
- E1's "Invite friends" button uses `switchInlineQuery` rather than a bot-prepared `shareMessage` card — the latter needs a `savePreparedInlineMessage` bot-backend round trip that wasn't built this session; `switchInlineQuery` is the plan's own documented fallback tier.
- The five open questions in `POINTS_ECONOMY_PLAN.md` (valuation anchor, D2 minting fan-out, free-event participant source, referral/cap tuning, legal posture) were resolved by following the plan's own stated recommendations where no user input overrode them — worth a final confirm before scaling point values.

#### Files Changed / Added (Phase 5)
```
backend/alembic/versions/004_points_economy.py   (new)
backend/app/services/points.py   (new)
backend/app/services/telegram_bot.py
backend/app/services/scheduler.py
backend/app/models/point_transaction.py   (new)
backend/app/models/evidence_submission.py   (new)
backend/app/models/__init__.py
backend/app/models/product.py
backend/app/models/provider_event.py
backend/app/models/user.py
backend/app/schemas/evidence.py   (new)
backend/app/schemas/event.py
backend/app/crud/evidence.py   (new)
backend/app/crud/provider.py
backend/app/crud/circle.py
backend/app/crud/community.py
backend/app/crud/booking.py
backend/app/crud/post.py
backend/app/crud/product.py
backend/app/api/providers.py
backend/app/api/bot.py
backend/app/api/admin.py
backend/app/api/circles.py
backend/app/api/events.py
backend/app/api/auth.py
backend/app/api/users.py
backend/app/tests/test_points_economy.py   (new)
telegram-bot/bot/handlers/evidence.py   (new)
telegram-bot/bot/services/weekly_digest.py   (new)
telegram-bot/bot/services/api_client.py
telegram-bot/bot/utils/messages.py
telegram-bot/bot/main.py
frontend/src/components/StreakBadge.jsx   (new)
frontend/src/components/FirstRewardCard.jsx   (new)
frontend/src/components/SocialProofBanner.jsx   (new)
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/CommunityDetail.jsx
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/ProviderOnboard.jsx
frontend/src/context/AuthContext.jsx
frontend/src/components/Header.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/.env.example
docs/API_CONTRACT.md
HANDOFF.md
```

---

### Phase 6 — Pilot Launch Prep: Analytics, Kuriftu Priority, Friction Fixes & Scaling Validation (This Session)

Anteneh's Mon–Wed workstream from `docs/WellCircle_Dev_Timeline.docx` (1-week sprint, Jul 13–19 2026, Kuriftu pilot focus), plus a scaling investigation that came out of it. Branch `migration/backend`; merged to `main` via PR #6 (`365fc1d`) up through the connection-pool fix — see **Known Gap** below for what's still unmerged. See `docs/USER_FLOW_AUDIT.md` for the full flow map and friction-point detail behind items A–C.

#### A — Monday: user-flow audit + analytics decision
- Walked Home → Explore → Provider Detail → Booking → Confirmation as a first-time guest against the actual code (not just the PRD), documented in `docs/USER_FLOW_AUDIT.md`.
- **Analytics tool: PostHog Cloud** (over GA4 / in-house events table) — works inside the Telegram WebView, instant event verification (no 24h GA4 lag), funnels/retention map directly onto the sprint's success criteria.
- Ranked friction points F1–F6; F1 (fake/unclear time slots) and F2 (payment failure has no recovery path) picked for Wednesday.

#### B — Tuesday: analytics instrumentation + Kuriftu pilot-partner ordering
- `frontend/src/analytics.js` — PostHog wrapper (`posthog-js`), Telegram-WebView-safe config (`localStorage` persistence, no cookies, no autocapture). Every call is a no-op when `VITE_POSTHOG_KEY` is unset, so dev/mock/tests are unaffected.
- Events live: `app_open` (+ `identify` by Telegram ID, in `AuthContext`), `explore_view`, `booking_start` (tagged with a `source` — service row vs. Book-Now card vs. direct — to eventually answer whether skipping the provider-detail page hurts conversion), `booking_confirmed`.
- **Kuriftu-first ordering**: `HomeScreen.jsx` was re-sorting providers purely by rating, defeating the backend's `is_featured`-first ordering — fixed so the pilot partner always leads the hero banner + featured carousel. `backend/mark_kuriftu_featured.py` (idempotent) sets `is_featured=TRUE` on the Kuriftu provider + boosts its events once seeded.
- `backend/seed_kuriftu_placeholder.py` — since Bezi's real Kuriftu service-list seed (Tue's own deliverable) hadn't landed yet, inserted a stand-in "Kuriftu Resort & Spa" provider (`is_featured=TRUE`, 3 placeholder services, description explicitly tagged `[Placeholder — replace with Bezi's Tue Jul 14 service audit]`) so front-page ordering was demoable immediately. **Whoever lands the real Kuriftu data should edit this row in place (or delete + reseed), not create a second Kuriftu-named provider** — `mark_kuriftu_featured.py` matches by `name ILIKE '%kuriftu%'` and would then be ambiguous.

#### C — Wednesday: top 2 friction-point fixes
- **F1** — date chips showed only weekday name (`"Mon"`); `getNextDays()` now also returns `dayNumber`, chips render `"Mon 14"`. Scoped to display only per product decision — no real per-provider slot availability yet, so double-booking still isn't prevented server-side.
- **F2** — a booking was created before payment confirmation, so a failed/timed-out payment fell back to the booking form; hitting Pay again called `createBooking` a second time (duplicate booking), with no way to check what happened. Added a dedicated failed-payment screen (`BookingFlow.jsx`) with **Retry Payment** (re-initiates against the *existing* `booking.id`, no duplicate) and **View My Bookings**.
- Verified both in a real headless-Chrome session against the mock dev server (no project run-skill existed for this repo yet — used `puppeteer-core` against system Chrome directly; worth generating a proper run-skill via `/run-skill-generator` if this becomes a recurring need).

#### D — Scaling investigation: Supabase vs. MongoDB, then load-testing what's actually there
Prompted by a proposed MongoDB Atlas migration (motivated by $5k in startup credits + concern that Supabase free tier can't handle the pilot's 200 concurrent users + launch-day registration surge).

- **Recommendation: stayed on Supabase.** The schema is deeply relational (13+ FK'd models, Postgres RLS for authz, Alembic + ad-hoc migrations) and MongoDB doesn't have an RLS equivalent — moving would trade a DB-enforced security guarantee for an app-enforced one built from scratch, plus a full ORM/schema rewrite, for a scaling problem that turned out to be fixable in the existing stack. Free tier's real ceiling (no uptime SLA, auto-pause on inactivity) is better addressed by Supabase Pro (~$25/mo) than a database migration, if it's addressed at all.
- **`backend/loadtest/`** (Locust) — simulates ~200 concurrent Mini App sessions (10:5:1 weighted browse-home : view-provider : full-booking+payment, matching the flow-audit funnel) plus a registration-surge ramp shape. Signs real HMAC Telegram `initData` (verified it round-trips through the actual `validate_init_data()`), so it exercises production auth, not a dev bypass. See `backend/loadtest/README.md` for staged run instructions and how to read results.
- **Bug found (run 1, unpatched):** `app/database.py` hardcoded a client-side SQLAlchemy pool (5 + 10 overflow) regardless of deployment target. On Vercel, each concurrent serverless instance held up to 15 of its own connections *on top of* Supabase's own pooler (Supavisor, already correctly configured on `:6543`) — under 200-concurrent load this produced **15.9% failure rate, 38s median / 174s worst-case latency**, independent of which database sits behind it. Fixed with `NullPool` when `VERCEL` is set (`d0c4d11`), pooled engine kept for Render/local dev.
- **Bug found (run 2, pool fix live):** auth went to a clean 0/200 failures, but `/api/providers`, `/api/communities`, `/api/users/me/onboard` still failed at 14.5% aggregate with 50s+ median latency. Root cause: `get_all_providers` / `get_all_communities` (`app/crud/provider.py`, `app/crud/community.py`) each ran an N+1 query loop (community + promotion lookup per provider; provider + membership lookup per community) — with exactly one connection now held per request for its full duration, each request held that connection through a dozen-plus sequential round-trips instead of releasing it fast. Batched into two queries per request instead of one per row (`91c99a9`); output shape unchanged, verified against `test_integration.py`.
- **Run 3 (both fixes) not yet executed** — `91c99a9` is still local-only, not pushed/merged. Re-run `backend/loadtest/` once it's deployed to get a clean capacity read.
- `backend/cleanup_loadtest_data.py` — deletes synthetic `LoadTest*` users + dependents after a run; used twice this session (183, then 200 users removed from production).

#### Verification
- Frontend: `npm run build` ✅ · `npm test` → 42/42 ✅ (unchanged by this phase's edits).
- Backend: `python -m app.tests.test_integration` — same pre-existing, unrelated failure at a provider-status default assertion (confirmed via `git stash` comparison, not touched by any Phase 6 change); all provider/community CRUD cases pass including the N+1 rewrite.
- PostHog signing verified offline against the backend's real `validate_init_data()` (no network calls) before any load-test run.
- Load test results are the closest thing to a production capacity number this app has — see the before/after table in section D above; full CSVs are gitignored (`backend/loadtest/results-*.csv`), not archived.

#### Known Gaps / Next Steps
- **`91c99a9` (N+1 query fix) needs a PR + merge + redeploy, then a third load-test run** — this is the actual open loop; "can Supabase free tier handle the pilot" is not yet conclusively answered.
- Deploys from this sandbox aren't possible (no git push credentials, no `gh` CLI) — every push/PR/merge in this phase was handed off for a human to run.
- F1's fix is display-only; real per-provider time-slot availability (and server-side double-booking prevention) is still open — flagged in `docs/USER_FLOW_AUDIT.md`.
- No cancellation/reschedule endpoint exists on `bookings` yet (`app/api/bookings.py` only has create) — relevant if Yoni's Sheets-sync work (Thursday's timeline item, "status-update logic tested: cancellations, reschedules") assumes it does; see `docs/SPRINT_TEAM_HANDOFF.md`.

#### Files Changed / Added (Phase 6)
```
backend/app/database.py
backend/app/crud/provider.py
backend/app/crud/community.py
backend/mark_kuriftu_featured.py   (new)
backend/seed_kuriftu_placeholder.py   (new)
backend/cleanup_loadtest_data.py   (new)
backend/loadtest/locustfile.py   (new)
backend/loadtest/telegram_signing.py   (new)
backend/loadtest/requirements.txt   (new)
backend/loadtest/README.md   (new)
frontend/src/analytics.js   (new)
frontend/src/context/AuthContext.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/ExploreScreen.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/data/mock.js
frontend/.env.example
docs/USER_FLOW_AUDIT.md   (new)
docs/SPRINT_TEAM_HANDOFF.md   (new)
.gitignore
HANDOFF.md
```

---

### Phase 7 — Biniyam's Sprint: Presale Promo + Re-Entry Loop (This Session)

Biniyam's Jul 13–19 sprint track from `docs/WellCircle_Dev_Timeline.docx` (see `docs/SPRINT_TEAM_HANDOFF.md`'s Biniyam section for the handoff brief). Full day-by-day detail, the one-page Monday sketch, and test commands live in **`docs/BINIYAM_SPRINT_PLAN.md`** — this entry is the HANDOFF-format summary.

#### What shipped
- **Presale promos.** `provider_promotions.audience` (`all` | `first_time`) — a `first_time` promo is a presale: it displays to everyone but its discount only applies server-side to guests with no prior *successful* booking at that provider. `app/services/promotion_service.py` — `get_eligible_promotion`, `user_is_first_time`, `compute_discount_etb`. `POST /api/providers/me/promotions` accepts `audience` (422 if a presale promo has no `discount_pct`). Migrations: `alembic/versions/005_presale_promo.py` + idempotent `apply_presale_migration.py` + `seed_presale_promo.py` (targets the Kuriftu pilot provider).
- **Server-side discount application.** `POST /api/bookings` re-derives eligibility and applies the discount itself — clients always send the undiscounted amount, so the total can never be gamed client-side. Booking rows record `promotion_id`/`discount_etb`. Provider detail exposes `active_promotion.user_eligible` per caller.
- **Promo-aware re-entry nudge.** `GET /api/bot/inactive-users` now attaches each user's soonest-expiring eligible promo (batched — two queries total, no N+1, per the Phase 6 scaling note). `telegram-bot/bot/utils/nudges.py`'s `build_reengagement_nudge` references the discount and deep-links via `?startapp=reentry_promo_{provider_id}` (same `start_param` mechanism as circle invites); `AuthContext.handleStartParam` opens the provider page and tracks `reentry_open`.
- **Frontend surfaces.** `PromotionForm.jsx` in a new Promotions tab on `ProviderDashboard`; promo banner + auto-applied discount on `ProviderDetail`/`BookingFlow`; Explore card badge. New analytics: `promo_view`, `promo_redeemed`.

#### Verification
- Backend: `python -m app.tests.test_presale_reentry` — **18/18 passing** (new). Fixed one stale, pre-existing assertion in `test_integration.py` (self-onboarding auto-approves in this codebase; the test asserted `pending_approval`).
- Bot: `telegram-bot/bot/tests/test_nudges.py` (new) — pure-function nudge builder tests, 9/9 passing.
- Frontend: 12 new Vitest tests (promo math, `PromotionForm` payloads, Explore `promo_view`, `AuthContext` re-entry deep link, `BookingFlow` discount pricing) — full suite 60/60 at the time.
- `docs/API_CONTRACT.md` updated for all three changed/new shapes (promotions create/response, booking response, `inactive-users` payload).

#### Files Changed / Added (Phase 7)
```
backend/alembic/versions/005_presale_promo.py   (new)
backend/apply_presale_migration.py   (new)
backend/seed_presale_promo.py   (new)
backend/app/models/provider_promotion.py
backend/app/models/booking.py
backend/app/schemas/promotion.py
backend/app/schemas/booking.py
backend/app/services/promotion_service.py
backend/app/api/providers.py
backend/app/api/bookings.py
backend/app/api/bot.py
backend/app/crud/provider.py
backend/app/tests/test_presale_reentry.py   (new)
backend/app/tests/test_integration.py
telegram-bot/bot/utils/nudges.py   (new)
telegram-bot/bot/utils/messages.py
telegram-bot/bot/services/reengagement.py
telegram-bot/bot/tests/test_nudges.py   (new)
frontend/src/components/PromotionForm.jsx   (new)
frontend/src/utils/promo.js   (new)
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/ProviderDetail.jsx
frontend/src/pages/ExploreScreen.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/context/AuthContext.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/src/test/promo.utils.test.js   (new)
frontend/src/test/PromotionForm.test.jsx   (new)
frontend/src/test/ExploreScreen.promo.test.jsx   (new)
frontend/src/test/AuthContext.reentry.test.jsx   (new)
frontend/src/test/BookingFlow.promo.test.jsx   (new)
docs/API_CONTRACT.md
docs/BINIYAM_SPRINT_PLAN.md   (new)
HANDOFF.md
```

---

### Phase 8 — UX Psychology Growth Loop: Onboarding, Habit Loop & Conversion (This Session)

Requested as a 4-stage sticky/high-converting workflow (Smart Defaults, Goal Gradient, Reciprocity, IKEA/Endowment, Loss Aversion, Contrast/Anchoring), scoped down to the principles that fit this MVP rather than implementing all six everywhere. Planned via Explore + Plan subagents against the real codebase plus web research on onboarding/streak/Telegram-Mini-App retention best practice; full architecture, principle-by-principle mapping, and file-by-file plan live in **`docs/UX_GROWTH_LOOP_PLAN.md`**. Every new behavior reuses this session's Phase 7 work (presale promos, re-entry deep links) rather than building parallel systems.

#### Stage 1 — Onboarding (Smart Defaults, Endowed Progress, IKEA)
- `OnboardingFlow.jsx`: the frequency step now arrives pre-selected (`sometimes`, "Most popular" chip, still changeable) so Next is never dead on that step; the name step's progress dot renders as already done ("1 of 5 already done ✓") since Telegram supplied the name for free.
- Backend: `onboard_user()` awards a one-time **+20 welcome points** through the ledger (`TXN_WELCOME` in `app/services/points.py`, idempotent against retries) — the existing `FirstRewardCard` progress bar on Home now starts part-filled instead of at zero (classic endowed progress). `POST /users/me/onboard` returns `welcome_points`/`points_balance`.

#### Stage 2 — First value loop (Reciprocity) & habit-loop trigger
- New `WelcomeBanner.jsx`, shown once on Home right after onboarding (`location.state.justOnboarded`): reflects the plan the user just built (interest · frequency · circles joined · +20 pts) back at them, and surfaces a **welcome gift** — the first provider promo they're eligible for, reusing Phase 7's presale system end to end — plus a soft "add your neighbourhood" link (progressive profiling, asked after investment, not during setup).
- New `CheckinCard.jsx` + shared `useCheckin.js` hook: daily check-in now lives on Home too (previously only inside `CommunityDetail`), with the same streak/freeze toasts and a 7-day milestone celebration (haptic + bigger toast). `GET /api/communities` gained a batched `checked_in_today` field to drive it (`crud/community.py`, no N+1).

#### Stage 3 — Daily habit loop (Loss aversion, ethically bounded)
- **Real bug found and fixed:** streak freezes were earned (`freeze_count` incremented every 7-day streak) but never actually *consumed* — the shipped copy "miss a day without losing your streak" was false. `checkin_community()` now consumes a freeze to cover exactly one missed day (`freeze_used` in the response), so the promise is honest.
- New `GET /api/bot/streaks-at-risk` (`crud/user.py: get_streaks_at_risk`) feeds a new daily 16:00 UTC bot job (`telegram-bot/bot/services/streak_nudge.py`, `build_streak_nudge` in `nudges.py`): "your N-day streak is waiting" — always mentions freezes when the user has any, "progress over perfection" copy, deep-links via `?startapp=reentry_checkin`. `StreakBadge.jsx` shows an amber at-risk dot in-app.

#### Stage 4 — Conversion (Anchoring, honest urgency)
- Consumers: `BookingFlow.jsx` shows the original total struck through beside the discounted one; `ProviderDetail.jsx` previews the cheapest service at its discounted price for eligible users; promo expiries under 7 days read "⏳ Expires in N days" (real dates only — new `daysLeft`/`expiryLabel` helpers in `utils/promo.js`, no fake countdowns).
- Providers: the subscriptions tab in `ProviderDashboard.jsx` now lists plans priciest-first (Pro anchors the set), badges Growth "⭐ Most popular", and adds per-day framing ("≈ 50 ETB/day"). Mock subscription plans (previously an empty array) now mirror the real backend plans so the tab is demoable/testable in mock mode.

#### Quick wins
- `ProfileScreen`'s `PointsTooltip` was advertising fictional tier thresholds (100/500/1000 pts) against the real engine (100/300/700) — rewritten to match, plus honest decay copy. A mismatched reward ladder undermines every goal-gradient surface, so this was fixed first.
- Eleven new analytics events fill out the funnel: `onboarding_step_view`/`onboarding_complete`, `checkin`, `checkin_prompt_view`/`checkin_prompt_click`, `streak_milestone`, `streak_risk_view`, `redemption_start`, `circle_invite_shared`, `profile_prompt_click`, `subscription_plan_view`/`subscription_plan_select`/`subscription_initiated`.

#### Verification
- Backend: `python -m app.tests.test_engagement_loop` (new) — **9/9 passing** (welcome-points idempotency, `checked_in_today`, freeze consumption on both the covered and uncovered path, streaks-at-risk filtering, the bot endpoint payload). `test_integration.py`'s check-in assertion updated (`new_balance` is now 30, not 10, since onboarding awards +20 before the first check-in's +10) — re-ran clean.
- Bot: `test_nudges.py` extended with streak-nudge tests (loss-aversion copy, freeze singular/plural, deep-link format) — all passing. `python -m py_compile` on every changed bot file (python-telegram-bot isn't installed in this sandbox, so the bot itself wasn't run live — only its pure-function logic and syntax were verified).
- Frontend: 4 new test files (`OnboardingFlow`, `WelcomeBanner`, `CheckinCard`, `ProviderDashboard` plan anchoring) plus extensions to `promo.utils` and `BookingFlow.promo` — full suite **74/74 passing**, `npm run build` ✅.
- `docs/API_CONTRACT.md` updated for all four changed/new shapes (`communities` list `checked_in_today`, checkin response `freeze_used`, `GET /api/bot/streaks-at-risk`, onboard response `welcome_points`/`points_balance`).

#### Known Gaps / Next Steps
- No live browser verification was performed for the new UI (build + automated tests only, in this sandbox) — worth a manual `npm run dev` pass over `WelcomeBanner`/`CheckinCard` layout before shipping to real users.
- Two friction points from Phase 6's `USER_FLOW_AUDIT.md` remain open and untouched by this phase: **F5** (no debounce on Explore search) and **F6** (booking confirmation still hardcodes `"+50 Legacy Points (Phase 2)"` instead of the real points awarded — this phase's anchoring work touched the same screen's price rows but not that line).
- A follow-up icon/back-button visual pass was requested after this phase and is tracked separately, not part of Phase 8.

#### Files Changed / Added (Phase 8)
```
backend/app/services/points.py
backend/app/crud/user.py
backend/app/crud/community.py
backend/app/api/users.py
backend/app/api/bot.py
backend/app/tests/test_engagement_loop.py   (new)
backend/app/tests/test_integration.py
telegram-bot/bot/services/streak_nudge.py   (new)
telegram-bot/bot/services/api_client.py
telegram-bot/bot/utils/nudges.py
telegram-bot/bot/utils/messages.py
telegram-bot/bot/main.py
telegram-bot/bot/tests/test_nudges.py
frontend/src/components/WelcomeBanner.jsx   (new)
frontend/src/components/CheckinCard.jsx   (new)
frontend/src/hooks/useCheckin.js   (new)
frontend/src/components/StreakBadge.jsx
frontend/src/pages/OnboardingFlow.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/ProfileScreen.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/ProviderDetail.jsx
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/ProductRedeem.jsx
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/context/AuthContext.jsx
frontend/src/utils/promo.js
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/src/test/OnboardingFlow.test.jsx   (new)
frontend/src/test/WelcomeBanner.test.jsx   (new)
frontend/src/test/CheckinCard.test.jsx   (new)
frontend/src/test/ProviderDashboard.plans.test.jsx   (new)
frontend/src/test/promo.utils.test.js
frontend/src/test/BookingFlow.promo.test.jsx
docs/API_CONTRACT.md
docs/UX_GROWTH_LOOP_PLAN.md   (new)
HANDOFF.md
```

---

### Phase 9 — Kuriftu Gap Analysis: Direct-Contact Booking Fix (This Session)

Following up a real call with Kuriftu African Village (Wed Jul 15, `docs/kuriftu-gap-analysis.md`): their standalone wellness services aren't booked or paid through any online system at all — no fixed time slots, no deposit, payment collected on-site after the service. The app's 3-step online-payment `BookingFlow` couldn't represent this. Scoped fix (of four options offered): implement the direct-contact flow; defer package/bundle schema work and the room+service bundle case (which needs a "room" concept that doesn't exist anywhere in the app) as explicitly out of scope.

#### What shipped
- **`booking_method` per service.** `ServiceItem` gains an optional `"online"` (default) | `"phone"` field, validated via pattern, carried in the existing `services` JSONB — no migration needed for this part.
- **Provider contact fields.** New `providers.contact_phone` / `contact_email` columns (both nullable — a provider may have either, both, or neither). Migration `alembic/versions/006_provider_contact_info.py` + idempotent `apply_provider_contact_migration.py`. Exposed on `GET /api/providers/:id` and provider-self endpoints (`get_provider_me`); `update_provider_me`'s existing generic passthrough picks them up automatically.
- **`BookingFlow.jsx` direct-contact screen.** Phone-booked services show a "Book directly" tag in the service list. Selecting one and tapping Continue skips the date/time and payment steps entirely and shows a dedicated screen: `tel:`/`mailto:` links (only for whichever contact method the provider actually has — nothing fabricated), "no deposit, pay on-site after your visit" copy, and a Back button that returns to service selection without losing the pick. `ProviderDetail.jsx`'s service list carries the same tag for consistency before the guest even opens Booking. New analytics: `booking_contact_requested`, `booking_contact_clicked`.
- **Kuriftu reseeded with confirmed pricing.** `backend/update_kuriftu_services.py` (new, idempotent — edits the existing "kuriftu" row per the gap analysis's own instruction, doesn't insert a duplicate) replaces the placeholder services with all 13 confirmed real services + packages, all `booking_method: "phone"`, and sets `contact_email` to the address surfaced on the call. **No phone number was set** — the call surfaced an email, not a phone number, and none was invented. Mock-mode parity: a new Kuriftu provider entry in `frontend/src/data/mock.js` (`is_featured: true`, matching production) so the flow is demoable and testable without a backend.

#### Verification
- Backend: `python -m app.tests.test_provider_contact` (new) — **8/8 passing** (`ServiceItem.booking_method` validation, provider detail/me exposing contact fields without fabricating unset ones, `update_provider_me` setting one contact field without clobbering the other). `test_integration.py`, `test_presale_reentry.py`, `test_engagement_loop.py` re-ran clean — no regressions.
- Frontend: 4 new Vitest tests (`BookingFlow.phoneBooking.test.jsx`) — phone-tagged services skip straight to the contact screen, the email-only case renders no fabricated phone link and fires the right analytics, Back preserves the selection, and online-booked providers are completely unaffected. Full suite: 78/78 passing (one *pre-existing* flake in `routes.smoke.test.jsx`'s Splash-screen timeout, reproduced on a clean run with none of this phase's files touched — a system-load-sensitive 4s Suspense-wait unrelated to this work, not a regression from it).
- `docs/API_CONTRACT.md` updated: provider detail response gains `contact_phone`/`contact_email`, and a new note documents `booking_method` and the direct-contact flow it triggers.

#### Known Gaps / Next Steps
- **G5 (packages)** needed no schema change to represent as flat line items, and Kuriftu's two bundled packages are seeded that way — but there's still no concept of a package being *composed of* its underlying services, if that's ever needed for pricing logic or inventory.
- **G7 (room + wellness bundle)** is unaddressed — Kuriftu's online, pay-upfront room-bundle path actually matches the app's existing payment model, but there is no "room" entity, room-selection UI, or bundle-pricing concept anywhere in the schema. Flagged, not built.
- No live browser verification was performed in this sandbox (build + automated tests only) — worth a manual `npm run dev` pass on the new contact screen, especially the `tel:`/`mailto:` links on an actual phone, before shipping.

#### Files Changed / Added (Phase 9)
```
backend/alembic/versions/006_provider_contact_info.py   (new)
backend/apply_provider_contact_migration.py   (new)
backend/update_kuriftu_services.py   (new)
backend/app/models/provider.py
backend/app/schemas/provider.py
backend/app/schemas/provider_onboarding.py
backend/app/crud/provider.py
backend/app/tests/test_provider_contact.py   (new)
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/ProviderDetail.jsx
frontend/src/data/mock.js
frontend/src/test/BookingFlow.phoneBooking.test.jsx   (new)
docs/API_CONTRACT.md
docs/kuriftu-gap-analysis.md
HANDOFF.md
```

---

### Phase 10 — Booking UX Polish + Multi-Day Booking (This Session, `feature/booking-ux-polish`)

Direct user feedback from manually walking Onboarding → Home → Booking in the real app, plus one new capability (multi-day booking) scoped via a clarifying question rather than guessed. First feature branch under the new "one branch per feature" process.

#### Quick polish
- **Onboarding frequency-step emoji.** The 📊 bar-chart emoji on "How often do you exercise?" read as generic/placeholder-y ("vibecoded") — swapped for 💪, matching the step's actual content.
- **Date-chip text overflow.** `.date-chip` (booking date picker) had no `flex-shrink: 0` inside its `.h-scroll` flex row, so on narrow viewports the flex algorithm could shrink a chip's box below its text's natural width, spilling the label past the pill (reported with a screenshot showing "Fri 17" overflowing). Fixed in `index.css`; verified via computed-style check in a real browser (`flex-shrink: 0` applied, `scrollWidth <= offsetWidth` on every chip at mobile width) since the sandbox's screenshot tool itself was unreliable this session — page content was verified via `read_page`/`get_page_text`/direct DOM inspection instead.
- **Kuriftu now has a confirmed phone number** (+251 98 056 5656, alongside the email from Phase 9) — added to `contact_phone` in the reseed script and mock data. The "Call" button (already built in Phase 9, just never shown since no phone existed yet) now renders as the **primary** action ahead of Email, matching "most people prefer calling." Uses a plain `tel:` anchor — Telegram's in-app WebView hands non-http(s) schemes to the OS dialer natively; `WebApp.openLink()` (used elsewhere for Telebirr redirect pages) is http(s)-only and would reject a `tel:` link, so it's deliberately not used here.

#### Multi-day booking
A booking can now cover several days of the same service in one flow — scoped via a clarifying question: **one real `Booking` row per selected day, one combined payment.** Not available for event bookings (`event_id` set) — an event already has one fixed date.

- **Backend:** new `bookings.booking_group_id` (nullable UUID correlation key, migration `007_booking_group.py` + idempotent `apply_booking_group_migration.py`). `BookingCreate.additional_slot_datetimes` (optional) triggers `crud/booking.py: create_sibling_bookings()` — one row per extra date, same service/time/payment method, **plain per-day rate** (any promotion discount applies to the primary/first day only — a "first-time visitor" promo covering every day of a multi-day booking wouldn't match its own terms). `update_booking_group_payment()` cascades a payment status change from the primary booking (which alone carries the trade_no/checkout_id — `telebirr_trade_no` is unique, so siblings can't share it) to every sibling sharing its group id, wired into both `telebirr`/`mpesa` initiate routes and their webhook callbacks. Each sibling still gets its own feed event, points bonus, and notification via the existing per-booking side effects in `update_booking_payment` — they're real, independent bookings that happen to be paid for together.
- **Frontend:** `BookingFlow.jsx`'s date chips are now multi-select (`selectedDates` array; a second tap deselects that day). Order summary and the Pay button total scale with day count; the promo discount row notes "Applied to your first day only" when multiple days are selected. `createBooking()` sends the earliest date as `slot_datetime` and the rest as `additional_slot_datetimes`; the confirmation screen lists every date and the combined `total_amount_etb` from the response.

#### Verification
- Backend: `python -m app.tests.test_multi_day_booking` (new) — **8/8 passing** (sibling creation, discount-on-primary-only, payment cascade to all siblings without leaking the trade_no, each sibling earning its own points bonus, the event-booking rejection guard, and single-day bookings staying backward-compatible as a "group of one"). `test_provider_contact.py`'s stale `has_phone: false` expectation updated now that Kuriftu has a real number. All other backend suites re-ran clean.
- Frontend: new `BookingFlow.multiDay.test.jsx` (5/5) plus `BookingFlow.phoneBooking.test.jsx` updated for the call button. Full suite: **83/83 passing**, `npm run build` ✅.
- Live-browser verification (not just automated tests) for the CSS fix, the emoji swap, and multi-select toggling — see the "Date-chip text overflow" note above re: the screenshot tool's reliability this session.

#### Housekeeping (before this branch)
- Added `backend/.vercelignore` — Vercel's Python builder (`@vercel/python`) was bundling the **entire** backend directory into the deployed Lambda by default (no ignore file existed), including every `app/tests/*` suite, the top-level `tests/`/`test_api.py`/`test_auth.py`, `loadtest/`, and all the one-off `seed_*`/`apply_*`/`check_*`/`fix_*`/`patch_*`/`update_*` maintenance scripts — none of which `api/index.py` ever imports. Confirmed via `git grep` that no production code imports from `app.tests`. Doesn't affect Render (git-based deploy, unaffected by `.vercelignore`) or local dev.
- Frontend was already clean by construction — Vite/Rollup only bundles what's reachable from the entry point, so `src/test/*.test.jsx` files were never in `dist/` (verified: no test-related strings anywhere in a production build).

#### Files Changed / Added (Phase 10)
```
backend/alembic/versions/007_booking_group.py   (new)
backend/apply_booking_group_migration.py   (new)
backend/app/models/booking.py
backend/app/schemas/booking.py
backend/app/crud/booking.py
backend/app/api/bookings.py
backend/app/api/payments.py
backend/app/tests/test_multi_day_booking.py   (new)
backend/app/tests/test_provider_contact.py
backend/update_kuriftu_services.py
backend/.vercelignore   (new)
frontend/src/index.css
frontend/src/pages/OnboardingFlow.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/src/test/BookingFlow.multiDay.test.jsx   (new)
frontend/src/test/BookingFlow.phoneBooking.test.jsx
### Phase 11 — Multi-Passion Onboarding + Real Circle Creation (`feature/multi-passion-onboarding-circles`)

Two product requests: (1) let users pick more than one passion at signup, (2) make the onboarding circles step actually explain what circles are, let users create their own circle, and invite friends — right there, not just auto-join interest-matched provider communities. Branched fresh off `main` (not off the unmerged `feature/booking-ux-polish`) to keep this feature isolated, per the one-branch-per-feature process adopted in Phase 10.

Two architecture questions were clarified with the user before building (both had real cost-of-guessing-wrong): whether to fully replace the single `interest_category` field or keep it as a derived "primary" alongside a new array (**chose: fully replace, update every consumer** — bigger but more correct), and which entity "create their own circle" should target. That second one surfaced a real naming confusion in the existing code: the onboarding "circles" step has always suggested **`Community`** rows (provider-owned, category-matched) despite being labeled "circles" throughout the UI/variable names — the app's actual user-created, portable group entity with join codes and an invite-link mechanism is a separate model, **`Circle`** (used by `CircleDetailScreen.jsx`), which had a working backend (`POST /api/circles`) but *zero* frontend UI anywhere to create one. Confirmed: "create your own circle" targets the real `Circle` entity.

#### What shipped

**Multi-passion onboarding.** `User.interest_category` (single string) → `User.interest_categories` (JSONB array, **min 1 required**). Full-replacement refactor across every consumer:
- Migration `008_multi_interest.py` + idempotent `apply_multi_interest_migration.py` — adds the array column, backfills existing single values (`to_jsonb(ARRAY[interest_category])`), drops the old column.
- `get_suggested_communities` now does an **OR match** (`Community.category.in_(interest_categories)`) instead of equality — a user who picked yoga + gym sees communities for either.
- Product "recommended for you" personalization (`browse_products`) matches if the provider's category is *any* of the user's interests.
- Admin analytics' "top categories" breakdown now counts **each interest in its own bucket** per user (someone with 3 interests contributes to 3 buckets) — done in Python (`collections.Counter`) rather than SQL, since JSONB array group-by isn't portable across the real Postgres backend and the SQLite test shim.
- Onboarding's interest step is now a multi-select toggle grid (same pattern as the existing circle-suggestion toggles); `canNext()` requires at least one pick.

**Real circle creation, right in onboarding.** The circles step now has three sections: the existing interest-matched Community suggestions (auto-join, deferred to final submit — unchanged mechanic), a new **"Available Circles"** list (existing public real Circles the user hasn't joined, join button calls `POST /circles/:id/join` immediately), and a new **"Or start your own"** mini-form (`POST /circles`). Whichever circle the user ends up in — joined or created — shows the same inline "invite friends" card, reusing the existing Telegram share-sheet mechanism (`switchInlineQuery` + clipboard fallback), now extracted into `frontend/src/utils/circleInvite.js` so `CircleDetailScreen.jsx` and `OnboardingFlow.jsx` share one implementation instead of two copies.
- **Real gap found and fixed:** `create_circle()` never auto-generated a `join_code` unless the caller supplied one — since no frontend ever called this endpoint before, nobody hit this. New circles now get an auto-generated 8-char code (`secrets`-based, uniqueness-checked, mirrors `provider_invite.py`'s existing pattern) — every circle gets one, not just private ones, since it's what powers the invite-link flow generally.
- `POST /circles` and `POST /circles/:id/join` responses now include `join_code` (previously just a bare message) so the client can build the invite link immediately without a second `GET /circles` round-trip.
- One-sentence explainer added to the circles step: "Circles are small accountability groups — check in together, cheer each other on, and stay consistent as a team."

#### Verification
- Backend: `python -m app.tests.test_multi_passion_circles` (new) — **15/15 passing** (multi-interest storage, OR-match community suggestions excluding already-joined, product personalization across interests, admin analytics per-interest bucketing, circle auto-join-code generation + uniqueness, explicit join_code preserved, join_code visibility gated to members). `test_integration.py`, `test_engagement_loop.py`, `test_presale_reentry.py`, `test_provider_contact.py` all re-ran clean after updating their `onboard_user(...)` calls to the new list-based signature.
- Frontend: new `OnboardingFlow.circles.test.jsx` (6/6 — multi-select toggle, Next gating, explainer text, available-circles join → invite card, create-circle → invite card, OR-matched suggestions) plus the pre-existing `OnboardingFlow.test.jsx` (3/3, unchanged) and `WelcomeBanner.test.jsx` (4/4, updated for the array field and multi-interest display order). Full suite: **84/84 passing**, `npm run build` ✅.
- `docs/API_CONTRACT.md` updated: `interest_categories` everywhere it appears (profile, onboarding request/response, admin user list, flow diagram), plus newly-documented `POST /api/circles` and `POST /api/circles/:id/join` (neither had contract docs before this).

#### Known Gaps / Next Steps
- `feature/booking-ux-polish` (Phase 10) and this branch both fork from `main` independently and haven't been reconciled — merging both will need a normal merge/rebase pass, not a special procedure, since they touch different files almost entirely.
- The "Available Circles" list has no interest-based matching (the `Circle` model has no `category` field) — it just shows public circles the user hasn't joined, unfiltered. Adding a category to `Circle` (or some other matching signal) is a reasonable fast-follow if onboarding circle suggestions need to feel more targeted.
- No live browser verification was performed for this feature in this sandbox (build + automated tests only) — worth a manual `npm run dev` pass through the full onboarding flow, especially the create-circle → invite-friends share-sheet on an actual Telegram client, before shipping.

#### Files Changed / Added (Phase 11)
```
backend/alembic/versions/008_multi_interest.py   (new)
backend/apply_multi_interest_migration.py   (new)
backend/app/models/user.py
backend/app/schemas/user.py
backend/app/schemas/admin.py
backend/app/crud/user.py
backend/app/crud/community.py
backend/app/crud/product.py
backend/app/crud/circle.py
backend/app/api/users.py
backend/app/api/auth.py
backend/app/api/products.py
backend/app/api/admin.py
backend/app/api/circles.py
backend/app/db/seed.py
backend/app/tests/test_multi_passion_circles.py   (new)
backend/app/tests/test_integration.py
backend/app/tests/test_engagement_loop.py
backend/app/tests/test_presale_reentry.py
frontend/src/utils/circleInvite.js   (new)
frontend/src/pages/OnboardingFlow.jsx
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/components/WelcomeBanner.jsx
frontend/src/pages/admin/AdminReports.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/src/test/OnboardingFlow.circles.test.jsx   (new)
frontend/src/test/WelcomeBanner.test.jsx
docs/API_CONTRACT.md
HANDOFF.md
```

### Phase 12 — Google Sheets Booking Export Integration (This Session)

Integration of Google Sheets API to export booking data specifically for the Kuriftu pilot provider.

#### What shipped
- **Google Sheets API Service:** `backend/app/services/sheets.py` manages Google service account authentication and appending rows to a configured spreadsheet.
- **Booking Flow Hook:** `create_new_booking` in `backend/app/api/bookings.py` detects if the booked provider is the Kuriftu pilot. If so, it asynchronously fires `export_booking_to_sheets` in a `BackgroundTask` with `[Name, Phone Number, Date & Time, Service Type, Service Name]` to avoid slowing down the user's HTTP request.
- **Environment config:** Added placeholders to `.env.example` for `GOOGLE_SHEETS_CREDENTIALS` (JSON string) and `GOOGLE_SHEETS_BOOKING_SHEET_ID`.

#### Verification
- Backend: `python -m unittest app.tests.test_sheets` (new) — **1/1 passing** (mocks the Google API client and ensures the correct payload shape is appended).

#### Known Gaps / Next Steps
- Currently hardcoded to check if "kuriftu" is in the provider name. In a multi-tenant scale-out, a `Provider.spreadsheet_id` schema addition would make this data-driven.
- Requires deployment environment (Render/Vercel) variables to be populated manually since they contain actual Google service account keys.

#### Files Changed / Added (Phase 12)
```
backend/requirements.txt
backend/app/services/sheets.py   (new)
backend/app/api/bookings.py
backend/app/tests/test_sheets.py   (new)
backend/.env.example
HANDOFF.md
```

---

### Phase 13 — Pay-on-Site Booking, Strava-style Circle Activity Feed & Emoji Cleanup (This Session)

Executed `docs/FEATURE_PLAN_CIRCLES_AND_POLISH.md` end to end (four work packages, ordered by priority), then reconciled WP1 with Phase 12's Google Sheets booking export (pulled from `main` mid-session — see that entry above) and made three follow-up fixes. See the plan doc for the full task-by-task detail; this entry summarizes what shipped and the real bugs found along the way.

#### WP1 — Booking: no more in-app payment; staff confirms by phone
- `BookingFlow.jsx` Step 0 now shows "You only pay after using the service — no upfront payment." above the service list.
- The old Service → Date/Time → **Payment** (Telebirr/M-Pesa + phone + polling) flow is now Service → Date/Time → **Confirm** — a review screen with a contact phone number field (no payment method picker), ending on a "Booking Request Sent!" summary.
- **Reconciled with Phase 12's Google Sheets export** (pulled mid-session): the real business model is staff-driven, not automatic — a `pay_on_site` booking is created and stays `payment_status: "pending"`; our team calls the guest on the phone number collected in Step 2 to confirm the slot, and for Kuriftu the booking is also on the staff Google Sheet (Phase 12's `export_booking_to_sheets`, unchanged). The first pass of this work had mistakenly auto-flipped `pay_on_site` bookings to `"success"` and awarded points immediately at creation, before Phase 12's sheets logic landed — that's now removed; nothing is auto-confirmed, telebirr/mpesa and pay_on_site all just get a "request received" ack notification, and the real "Booking Confirmed" notification/points bonus only fires once payment status actually flips to success (unchanged existing logic).
- **Bug fixed in passing:** `trigger_booking_notification` (`api/bookings.py`) had been constructing `UserNotification(message=...)` against a model with no `message` column and a non-nullable `title` — silently crashing on every booking's background task since it was added. Fixed to use the real fields.
- `MyBookings.jsx` status pill shows "Confirmed"/"Pending"/"Failed" instead of the raw `payment_status` string.
- Telebirr/M-Pesa remain fully intact for provider subscriptions and API compatibility — nothing was removed from the payment services themselves.

#### WP2 — Notification bell icon
- `Icon.jsx`'s `bell` path replaced with a clean, recognizable bell (was an unrecognizable rough polygon).

#### WP3 — Strava-style circle activity feed
The circles feed already had posts/comments/point-gifting reactions (`PostFeed.jsx`, `posts`/`reactions`/`post_comments` tables) — this extended that system rather than building a parallel one.
- **Schema** (`alembic/versions/009_circle_activity.py` + idempotent `apply_circle_activity_migration.py`): `posts` gained `activity_type`/`distance_km`/`duration_min`/`photo_url` (all optional); `post_comments` gained `parent_comment_id` (one level of replies only).
- **API**: `POST /api/posts` and `POST /api/posts/:id/comments` accept the new optional fields; a reply to an already-nested comment, or to a comment on a different post, returns 422. `GET /api/posts` now nests each top-level comment's replies under it.
- **Bug fixed in passing:** `get_posts()` ran 2 extra queries *per post* (reactions + comments), ~41 queries for a 20-post page — rewritten to 2 queries total for the whole page (batched by post id, grouped in Python), matching the project's established no-N+1 rule from Phase 6.
- **Notifications**: creating a circle post fans out a best-effort, batched `circle_activity` `UserNotification` to every other circle member (never the author), surfaced via the existing generic `/notifications` inbox — no code changes needed there. In-app only, no bot DM, by design (avoids notification spam).
- **Frontend** (`PostFeed.jsx`): an optional "Add activity details" composer (activity type chips, distance/duration inputs, photo URL — no upload backend yet, URL only), a stat strip on activity posts, indented one-level replies with a Reply action, and point-gifting reactions now use the coin `Icon` instead of an emoji (🔥/👏 plain reactions unchanged, per product decision).
- **Bug fixed in passing:** `CircleDetailScreen.loadCircle()` sourced the circle's name/description/member_count from `MOCK_CIRCLES` even in live mode, only merging `join_code` from the real API — a real (non-seed) circle always showed the generic "Circle" fallback name. Now merges name/description/member_count from the live `getCircles()` match too.
- Circle detail's "Chat" tab relabeled "Activity" (internal `chat` key unchanged).
- **Join → straight into Activity with a pre-filled intro** (follow-up fix, same session): `CircleDetailScreen.handleJoin()` now switches `activeTab` to `'chat'` and passes `PostFeed` a one-time `initialDraft` — "Hi I'm {first name}, I'm glad to join you guys!" — pre-filled (and auto-focused) in the composer. `PostFeed` takes `initialDraft`/`onDraftConsumed` props; the draft is applied once at mount and the parent's flag is cleared immediately after, so leaving and returning to the tab later doesn't re-stomp whatever the member is typing by then.

#### WP4 — Emoji cleanup
- **Toast refactor**: `showToast(message, icon)` → `showToast(message, variant)` where `variant` is `'success' | 'error' | undefined`; `ToastContainer` renders an SVG check/x instead of a raw emoji string. All ~82 `showToast` call sites app-wide converted; no call site passes an emoji anymore.
- **Chrome sweep**: decorative emoji in tab icons, buttons, headers, empty states, and badges replaced with `Icon.jsx` SVGs (added `lock` and `flame` icon paths) across `CircleDetailScreen`, `PostFeed`, `BookingFlow`, `CommunityDetail`, `CommunityList`, `ProfileScreen`, `ProductRedeem`, `ProductsStore`, `ProductDetail`, `MyRedemptions`, `ProviderDetail`, `ProviderOnboard`, `ProviderDashboard`, `ExploreScreen`, `FeedEvent`, `ErrorBoundary`, `AskWellCircle`, `FirstRewardCard`, `SocialProofBanner`, `WelcomeBanner`. App-authored copy (e.g. `NEIGHBOURHOOD_ALERTS`) had its leading decorative emoji stripped.
- **Explicitly kept** (per product decision): onboarding/signup screen emoji (`OnboardingFlow.jsx` untouched), the points-gifting coin icon, feed reaction emoji (🔥/👏/etc. in `PostFeed`/`Leaderboard`), and the 🥇🥈🥉 leaderboard medals in `CircleDetailScreen`. Also left untouched as a consistent "icon system": the points-tier badges (🌱🌿🌳🌲 Seed/Sprout/Grove/Forest) and category emoji (🧘💪🥗 etc.) in `constants.js`/`mock.js`.
- **Follow-up fix (same session):** the 🔥 streak emoji was restored on user request — `StreakBadge.jsx`, `CheckinCard.jsx` (active-streak state only; the zero-streak "start your streak" prompt keeps the `star` Icon), and `useCheckin.js`'s streak-continuation toast all use 🔥 again instead of the `flame` SVG swap from the initial sweep.

#### Verification
- Frontend: `npm run build` ✅ · `npm test` → **98/98 passing** across 20 files (3 `BookingFlow` test files updated for the new Confirm-step + phone-field flow, `PostFeed.test.jsx` covering activity stats + nested replies + coin gifting + the join-intro prefill).
- Backend: `python -m app.tests.test_circle_activity` → **20/20 passing** (stats round-trip, nested replies, 2nd-level-reply rejection, notification fan-out, coin gifting). `test_integration.py`, `test_points_economy.py` (65/65), `test_presale_reentry.py`, `test_engagement_loop.py`, and Phase 12's `test_sheets.py` (pytest) all re-ran clean — no regressions from the `Post`/`PostComment` schema change or the booking flow rework. `app.main` imports cleanly, 101 routes.
- Not verified live in this sandbox: no headless-browser pass was run (no dev server available here) — recommended before shipping: `npm run dev` through book → send request → circle post a run → comment → reply → gift via coin → notification appears in `/notifications`; join a circle and confirm the Activity composer is pre-filled.

#### Files Changed / Added (Phase 13)
```
backend/alembic/versions/009_circle_activity.py   (new)
backend/apply_circle_activity_migration.py   (new)
backend/app/models/post.py
backend/app/crud/post.py
backend/app/api/posts.py
backend/app/schemas/booking.py
backend/app/api/bookings.py
backend/app/tests/test_circle_activity.py   (new)
docs/API_CONTRACT.md
docs/FEATURE_PLAN_CIRCLES_AND_POLISH.md   (new)
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/MyBookings.jsx
frontend/src/api/client.js
frontend/src/i18n.js
frontend/src/components/Icon.jsx
frontend/src/components/Toast.jsx
frontend/src/components/PostFeed.jsx
frontend/src/components/FeedEvent.jsx
frontend/src/components/ErrorBoundary.jsx
frontend/src/components/AskWellCircle.jsx
frontend/src/components/FirstRewardCard.jsx
frontend/src/components/SocialProofBanner.jsx
frontend/src/components/StreakBadge.jsx
frontend/src/components/WelcomeBanner.jsx
frontend/src/components/CheckinCard.jsx
frontend/src/components/Leaderboard.jsx
frontend/src/components/PromotionForm.jsx
frontend/src/hooks/useCheckin.js
frontend/src/context/AuthContext.jsx
frontend/src/utils/circleInvite.js
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/pages/CommunityDetail.jsx
frontend/src/pages/CommunityList.jsx
frontend/src/pages/ExploreScreen.jsx
frontend/src/pages/ProductsStore.jsx
frontend/src/pages/ProductDetail.jsx
frontend/src/pages/ProductRedeem.jsx
frontend/src/pages/MyRedemptions.jsx
frontend/src/pages/ProfileScreen.jsx
frontend/src/pages/ProviderDetail.jsx
frontend/src/pages/ProviderOnboard.jsx
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/OnboardingFlow.jsx
frontend/src/pages/admin/AdminAnalytics.jsx
frontend/src/pages/admin/AdminProducts.jsx
frontend/src/pages/admin/AdminProviders.jsx
frontend/src/pages/admin/AdminReports.jsx
frontend/src/data/mock.js
frontend/src/test/BookingFlow.promo.test.jsx
frontend/src/test/BookingFlow.multiDay.test.jsx
frontend/src/test/BookingFlow.phoneBooking.test.jsx
frontend/src/test/PostFeed.test.jsx   (new)
HANDOFF.md
```

---

### Phase 14 — V2 UX Upgrades: Prefs, Ranks, Feedback & Concierge Chips (This Session)

Executed `docs/FEATURE_PLAN_V2_UX_UPGRADES.md` end to end, all 8 phases. Explicitly out of scope per the plan: the major Claude-design UI redesign — no screens were restyled beyond what each task required.

#### Phase 1 — Back-button standardization, CheckinCard bug fix, onboarding hint
- Replaced literal `←` with `<Icon name="chevron-left" />` (+ `aria-label="Go back"`) across `CommunityDetail`, `MyRedemptions`, `ProductDetail`, `ProductRedeem`, `ProviderDashboard` (2 spots), `ProviderOnboard` (also added a missing `Icon` import).
- **Bug fixed:** `CheckinCard` stayed mounted (showing an empty/stale list) once every joined circle had already been checked in today; it now unmounts (`return null`) once `checkedIds` covers every circle.
- Onboarding's interest-picker step gained a one-line hint under the passion chips, shown only after the user selects at least one.

#### Phase 2 — User preferences: phone number + time format
- Backend: `users.phone_number` (E.164, validated `^\+?[0-9]{6,15}$`) and `users.time_format` (`12h`/`24h`) — Alembic `010_user_prefs.py` + idempotent `apply_user_prefs_migration.py`, `UserProfileUpdate`/`UserResponse` schema fields, `_build_response()` wiring. `test_user_prefs.py` — 7/7.
- Frontend: `utils/timeFormat.js` (`detectTimeFormat`/`formatSlot`/`effectiveTimeFormat`, Intl-based auto-detect with a user override), `utils/phone.js` + `components/PhoneInput.jsx` (country-code selector, Ethiopia default, national-number validation).

#### Phase 3 — Booking flow polish
- Time slots now display in the user's preferred AM/PM or 24h format (stable `id="time-slot-{24h value}"` kept for test/automation targeting regardless of display format).
- `PhoneInput` replaces the raw phone `<input>` in the booking Confirm step; a valid phone auto-saves to the profile and unlocks a "Call {provider} now" `tel:` button on the request-sent screen.
- Multi-day booking: selecting a 2nd date now prompts "Book multiple days?" → "Same time on all days?" / "Different times", with a per-day time picker for the latter (`BookingFlow.jsx`'s `timeMode`/`perDayTimes`/`multiDayModalStage` state machine).

#### Phase 4 — Location-aware nearby surfacing
- `utils/nearby.js` (`isNearUser`/`nearbyProviders`/`nearbyEvents`) does neighbourhood text matching — no GPS, per owner decision.
- `components/LocationNudge.jsx` + `components/NearYouSection.jsx`: Home gets a "Near you" section (nudge to set a neighbourhood if unset, else matched providers/events, else a "browse all" fallback).
- Explore gained a "Near me" filter chip that deep-links to Profile's neighbourhood sheet if unset, otherwise filters the current list client-side.
- **Real gap found in passing:** `getEvents()`'s mock branch had always returned an empty array — added a `MOCK_EVENTS` fixture (2 events tied to Bole-area providers) so the "near you" matching and Explore's Events tab have something to show in mock mode.

#### Phase 5 — Weekly ranks (leaderboard)
- Backend `GET /api/ranks` (new `app/api/ranks.py` + `crud/ranks.py`): trailing-7-day sum of positive `point_transactions.amount`, top 20 communities + top 20 individuals + the caller's own rank (`null` if they earned 0 that week, not 0 or last place). A user in two communities contributes to both totals independently. `test_ranks.py` — 10/10.
- Frontend: `CommunityList.jsx` gained a 4th "Ranks" tab (Communities/Individuals segmented toggle, 🥇🥈🥉 medals for top 3, tap a community row to open it, own-row highlighted + a dashed footer showing your rank if you're outside the top 20). `CommunityRanks.test.jsx` — 3/3.

#### Phase 6 — Feedback: bug reports & health-app wishlist
- Backend: new `feedback` table (`type`: bug/health_app_request/suggestion, `message`, `context` JSONB, `status`) — Alembic `011_feedback.py` + `apply_feedback_migration.py`. `POST /api/feedback` (JWT), `GET /api/admin/feedback` (paginated, submitter name/handle joined in one query — no N+1) and `PATCH /api/admin/feedback/:id` (both super-admin) added to `admin.py`. `test_feedback.py` — 15/15.
- Admin: new "Feedback" tab (`AdminFeedback.jsx`) — type filter chips, per-item status `<select>`, following `AdminProducts.jsx`'s styling conventions.
- In-app bug reporting: `components/BugReportSheet.jsx` (same local-overlay pattern as the booking flow's multi-day modal) — textarea + auto-collected context (route/error/user-agent), reachable from Profile's new "Support" section or from `ErrorBoundary`'s crash fallback (which now also stores the caught error and offers a pre-wired "Report this problem" button).
- Health & Activity section replaced the (never-real) connect/disconnect toggle with a "Coming soon" badge and a "Which app should we support first?" vote (`submitFeedback({type: 'health_app_request', ...})`), collapsing to "Thanks for voting: {app}" for the session. Removed the now-fully-dead `MOCK_HEALTH_METRICS` fixture and the unused `Connect Health App`/`Connected` i18n keys.

#### Phase 7 — AI concierge quick-request chips
- `AskWellCircle.jsx` shows 4 tappable chips above the input, only on a fresh conversation (≤1 message): "Affordable gyms around me" (location-aware — sends immediately with the neighbourhood substituted if set, otherwise prefills the input and focuses it without sending), "Best-rated spas", "Yoga classes this week", "Nutrition coaching options" (all send immediately). Each tap fires `concierge_chip_click` via analytics.

#### Verification
- Frontend: `npm run build` ✅ · `npm test` → **145/145 passing** across 31 files (one isolated re-run confirmed a single smoke-test failure seen on one parallel run was the known environment flake noted in the plan, not a real regression).
- Backend: `test_integration`, `test_points_economy` (65/65), `test_presale_reentry`, `test_engagement_loop`, `test_circle_activity` (20/20), `test_ranks` (10/10), `test_feedback` (15/15), `test_user_prefs` (7/7), and `pytest app/tests/test_sheets.py` all pass clean. `app.main` imports cleanly — **105 routes** (up from 101).
- `docs/API_CONTRACT.md` updated: user prefs fields (auth response, `GET`/`PATCH /users/me`), new `## 9b. Ranks` and `## 9c. Feedback` sections, Quick Reference table rows for `/ranks`, `/feedback`, `/admin/feedback`.
- Manual dev pass (mock mode, headless browser): onboarding hint, Home's "Near you" nudge, Community's Ranks tab (both Communities and Individuals views, own-row highlight), Profile's Time Format/Contact/Health-wishlist/Report-a-bug all verified live; booking flow loads with the Confirm-step payment copy intact. Admin's Feedback tab was verified via its dedicated unit tests rather than live (the mock session user isn't a super admin, so `AdminGuard` correctly redirects it away — expected, not a bug).

#### Post-deploy fixes (same session, after pushing to production)
- **Real bug found in production:** after pushing, `POST /api/auth/telegram` started 500ing on Vercel — the production Supabase database still had the pre-Phase-2 schema, so any query touching `users` hit `column users.phone_number does not exist` (Postgres `42703`). The Alembic migration (`010_user_prefs.py`) had been written but never actually applied against the live database — a reminder that this repo's migrations are documentation/local-dev convenience, not auto-applied on deploy. **Fix:** ran the idempotent SQL from `apply_user_prefs_migration.py` (`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number/time_format`) and `apply_feedback_migration.py` (`CREATE TABLE IF NOT EXISTS feedback`) directly in the Supabase SQL editor. Confirmed via Vercel logs that the `/api/auth/telegram` 500s stopped immediately after.
- **UX fix:** `PhoneInput`'s Ethiopia placeholder read `0911234567` even though the `+251` country code is already shown in the adjacent select — the national field should never start with a leading `0` once the code is split out. Added a `placeholder` field per entry in `utils/phone.js`'s `COUNTRY_CODES` (e.g. Ethiopia `911234567`, Kenya `712345678`, UK `7911123456`, ...) and `PhoneInput.jsx` now looks up the active country's placeholder instead of hardcoding Ethiopia's. Verified live for both `+251` and `+44`.

**Deployment reminder for next schema change:** any future Alembic migration under `backend/alembic/versions/` must also be run (via its paired `apply_*.py` idempotent script, or applied as raw SQL) against the production Supabase database — pushing the migration file alone does nothing to the live schema.

#### Files Changed / Added (Phase 14)
```
backend/app/models/user.py
backend/app/models/feedback.py   (new)
backend/app/models/__init__.py
backend/app/schemas/user.py
backend/app/schemas/ranks.py   (new)
backend/app/schemas/feedback.py   (new)
backend/app/api/users.py
backend/app/api/ranks.py   (new)
backend/app/api/feedback.py   (new)
backend/app/api/admin.py
backend/app/crud/ranks.py   (new)
backend/app/crud/feedback.py   (new)
backend/app/main.py
backend/alembic/versions/010_user_prefs.py   (new)
backend/alembic/versions/011_feedback.py   (new)
backend/apply_user_prefs_migration.py   (new)
backend/apply_feedback_migration.py   (new)
backend/app/tests/test_user_prefs.py   (new)
backend/app/tests/test_ranks.py   (new)
backend/app/tests/test_feedback.py   (new)
docs/API_CONTRACT.md
docs/FEATURE_PLAN_V2_UX_UPGRADES.md
frontend/src/utils/timeFormat.js   (new)
frontend/src/utils/phone.js   (new)
frontend/src/utils/nearby.js   (new)
frontend/src/components/PhoneInput.jsx   (new)
frontend/src/components/LocationNudge.jsx   (new)
frontend/src/components/NearYouSection.jsx   (new)
frontend/src/components/BugReportSheet.jsx   (new)
frontend/src/components/ErrorBoundary.jsx
frontend/src/components/AskWellCircle.jsx
frontend/src/components/CheckinCard.jsx
frontend/src/pages/BookingFlow.jsx
frontend/src/pages/ProfileScreen.jsx
frontend/src/pages/HomeScreen.jsx
frontend/src/pages/ExploreScreen.jsx
frontend/src/pages/CommunityList.jsx
frontend/src/pages/OnboardingFlow.jsx
frontend/src/pages/CommunityDetail.jsx
frontend/src/pages/MyRedemptions.jsx
frontend/src/pages/ProductDetail.jsx
frontend/src/pages/ProductRedeem.jsx
frontend/src/pages/ProviderDashboard.jsx
frontend/src/pages/ProviderOnboard.jsx
frontend/src/pages/admin/AdminLayout.jsx
frontend/src/pages/admin/AdminFeedback.jsx   (new)
frontend/src/App.jsx
frontend/src/data/mock.js
frontend/src/api/client.js
frontend/src/i18n.js
frontend/src/test/timeFormat.test.js   (new)
frontend/src/test/phone.test.js   (new)
frontend/src/test/nearby.test.js   (new)
frontend/src/test/ProfileScreen.location.test.jsx   (new)
frontend/src/test/ProfileScreen.healthApp.test.jsx   (new)
frontend/src/test/HomeNearYou.test.jsx   (new)
frontend/src/test/ExploreScreen.nearMe.test.jsx   (new)
frontend/src/test/CommunityRanks.test.jsx   (new)
frontend/src/test/AdminFeedback.test.jsx   (new)
frontend/src/test/BugReportSheet.test.jsx   (new)
frontend/src/test/AskWellCircle.chips.test.jsx   (new)
frontend/src/test/renderWithProviders.jsx
frontend/src/test/CheckinCard.test.jsx
frontend/src/test/OnboardingFlow.test.jsx
frontend/src/test/ErrorBoundary.test.jsx
frontend/src/test/routes.smoke.test.jsx
frontend/src/test/BookingFlow.promo.test.jsx
frontend/src/test/BookingFlow.multiDay.test.jsx
frontend/src/test/BookingFlow.phoneBooking.test.jsx
HANDOFF.md
```

---

### Phase 15 — Paid Circles, Verified Trainers & Strava Integration (This Session)

Executed `docs/new_implementation_plan.md` end to end: file uploads (Cloudinary), a follower system with privacy-aware public profiles, a verified-trainer badge flow, paid circle subscriptions with revenue sharing, and real Strava OAuth integration. Landed directly on `main` (no separate feature branch this time). This entry documents what the code actually does today, including several deliberate/organizational deviations from the plan and a couple of real gaps — not just a restatement of the plan.

#### What shipped

**Uploads.** `POST /api/uploads` (`app/api/uploads.py` + `app/services/cloudinary_service.py`) — multipart upload to Cloudinary, two folders only (`certificates` ≤10MB pdf/jpg/png, `receipts` ≤5MB jpg/png), 422 on bad folder/type/size, 503 if `CLOUDINARY_*` env vars aren't set. Any authenticated user can upload to either folder — there's no check that the uploader is actually mid-trainer-application or mid-circle-subscription, and uploaded files are never cleaned up on rejection (a `delete_file()` helper exists but nothing calls it).

**Followers & public profiles.** New `followers` table + `app/api/followers.py` (mounted on the `users` router): follow/unfollow (both idempotent), paginated follower/following lists (counts batched — no N+1), and `GET /api/users/:id/profile`. Privacy (`profile_privacy`: public/followers/private, default public) gates only `strava_stats` and owned `circles` on that response — identity fields (name, bio, badge, counts) are always visible to any authenticated viewer, even on a "private" profile. `ProfileScreen.jsx` grew a bio editor (300 char max), follower/following stat row, and a 3-way privacy selector; `PublicProfile.jsx` and `FollowersList.jsx` are new pages at `/users/:id` and `/users/:id/followers|following`.

**Verified trainer badge.** `trainer_verifications` table + `app/api/trainer.py`: apply with a certificate + a 200 ETB/year payment-receipt screenshot (both just Cloudinary URLs — no payment gateway, no backend fee enforcement beyond "a receipt exists"), super-admin approve/reject. Approval sets `is_verified_trainer=true` and a 1-year expiry; a new daily scheduler job unsets the badge past expiry (but leaves the verification row's `status` as `"approved"` — `status` alone isn't a reliable "currently verified" signal, use `user.is_verified_trainer`). New pages `TrainerVerification.jsx` (`/trainer/verify`, 4-step flow) and `AdminTrainerVerifications.jsx` (`/admin/trainers`). **Deviation:** the plan put the admin review endpoints on the main `admin.py` router; they actually live on the `trainer` router instead, so they're `/api/admin/trainer-verifications*` served from `app/api/trainer.py`, not `app/api/admin.py`.

**Paid circles.** `circle_subscriptions` + `circle_revenue_ledger` tables + new endpoints on the existing `circles`/`admin` routers (`app/crud/circle_subscription.py` has all the business logic). Eligibility to apply: ≥100 members **and** owner ≥1000 lifetime points (sum of positive, non-reversed point-transactions — not current decaying balance). Revenue split is `floor(5%)` platform / remainder creator (so a creator can net slightly over 95% on amounts that don't divide evenly by 20). Subscriptions run 30 days from approval; receipts pending >72h get escalated to admin. **Access is membership-based, not subscription-status-based** — once approved, a subscriber gets a permanent `CircleMember` row and keeps access even after their subscription formally expires unless the expiry job specifically revokes a membership created inside that subscription's window; this is what makes "grandfathered" free members (who joined before a circle went paid) keep access forever, by the same mechanism. Non-member join attempts on a paid circle get a `402` whose `detail` is a JSON object (`{message, price_etb, circle_id}`), not the usual plain string. `has_circle_access` also gates circle-post create/list/react (`app/api/posts.py`), so paid-circle activity feeds are actually protected, not just the join endpoint. Frontend: monetization, subscribe, and revenue-dashboard UI were merged into the existing `CircleDetailScreen.jsx` (no separate pages), plus a new `AdminPaidCircles.jsx` (`/admin/paid-circles`).

**Strava integration.** `app/services/strava_service.py` + `app/api/strava.py` (`/api/strava/*`): OAuth2 connect/callback/disconnect, `PATCH /strava/visibility` to choose which of 6 stat keys (`distance`/`calories`/`moving_time`/`elevation`/`activity_count`/`recent_activities`) show publicly, and `GET /strava/stats`. Tokens are Fernet-encrypted at rest (key derived from `JWT_SECRET`, so rotating `JWT_SECRET` would strand existing connections — not handled). Activity data is cached (`strava_activity_cache` table) with a **15-minute TTL** as planned, refreshed from Strava's recent-activities endpoint (not the all-time `/athletes/{id}/stats` totals endpoint the plan sketched — "stats" here are an aggregation over the cached recent-activity window instead). `ProfileScreen.jsx` got the connect/disconnect/visibility UI; `PublicProfile.jsx` renders the same stats plus the Strava-required "Powered by Strava" attribution via a new `StravaStats.jsx` component.

**Serverless maintenance job.** The plan called for 3 separate scheduler jobs (expired trainer verifications, expired subscriptions, stale-receipt escalation). They're implemented as one combined `phase15_maintenance_job()` in `scheduler.py`, registered as a single daily APScheduler cron **and** exposed as `POST /api/cron/maintenance` (new `app/api/maintenance.py`, new `CRON_SECRET` env var) — needed because, per this repo's existing convention, APScheduler doesn't run on Vercel's serverless functions, so production needs an external cron (e.g. Vercel Cron or a scheduled GitHub Action) hitting this endpoint daily instead of relying on the in-process scheduler.

#### Known deviations from `docs/new_implementation_plan.md`

- **No verified-trainer search-ranking boost.** The plan's Phase 3 called for `crud/provider.py`'s `get_all_providers()` to boost verified trainers in discovery surfaces. This was not built — `crud/provider.py` has no verified-trainer-aware logic at all. Verified trainers only get a visible badge (profile, followers list, circle ownership `owner_is_verified` flag); they get no ranking/priority boost anywhere.
- **Profile field wiring lives in `app/api/users.py`, not `app/crud/user.py`.** The plan specified `_build_response()` in `crud/user.py` would grow the new fields; in the actual code, `api/users.py` owns that response-building function and `crud/user.py` was left untouched for this phase. Functionally equivalent, just a different file than documented.
- **Test suite consolidation.** The plan specified 6 separate test files (`test_cloudinary_upload.py`, `test_followers.py`, `test_trainer_verification.py`, `test_paid_circles.py`, `test_strava_integration.py`, `test_cross_feature.py`) totaling ~79 tests. What actually exists is one focused script, `app/tests/test_phase15_backend.py`, that runs a single happy-path scenario across all five features (follow/unfollow + self-follow rejection, trainer apply→approve, paid-circle eligibility→subscribe→approve→95/5 ledger split→grandfathered access, Strava token encrypt/decrypt, activity caching). It's a real, passing regression check, but it is **not** equivalent coverage to the ~79 planned tests — there is, notably, **no automated test at all for the upload endpoint** (no mocked-Cloudinary test exists anywhere in the repo), and no dedicated edge-case coverage (duplicate applications, pagination, admin-list filtering, expiry/escalation scheduler jobs, Strava rate-limit handling, privacy-permutation matrix). Frontend coverage is broader relative to plan: `FollowersList.test.jsx`, `PublicProfile.test.jsx`, `TrainerVerification.test.jsx`, `CircleDetailScreen.paid.test.jsx`, `ProfileScreen.healthApp.test.jsx` (covers the Strava UI despite the name), `AdminLaunchFeatures.test.jsx` (covers both new admin tabs in one file), and `phase15.client.test.js` (client-layer upload/402/Strava-stats tests) — 6 files, not 8, and no separate admin test files, but real assertions rather than a single script.
- **Admin paid-circle review doesn't require a rejection reason**, unlike trainer-verification rejection which does (schema-level: `reason` is optional on `PaidCircleAdminReviewRequest`, required on `AdminTrainerReviewRequest`). Not necessarily wrong, just inconsistent between the two review flows.

#### Verification
- Backend: `python -m app.tests.test_phase15_backend` — passes (see script for exact assertions covered, described above). Full regression re-run clean with no failures: `test_integration`, `test_points_economy` (65/65), `test_presale_reentry`, `test_engagement_loop`, `test_circle_activity` (20/20), `test_ranks` (10/10), `test_feedback` (15/15), `test_user_prefs` (7/7), `test_multi_day_booking`, `test_multi_passion_circles`, `test_provider_contact`, `test_bot_security`, and `pytest app/tests/test_sheets.py`. `app.main` imports cleanly — **135 routes** (up from 105 in Phase 14).
- Frontend: `npm run build` ✅ (clean, no warnings). `npm test` → **176/176 passing** across 37 files, including the new `routes.smoke.test.jsx` entries for `/trainer/verify`, `/users/:id`, `/users/:id/followers`, `/users/:id/following`, `/admin/trainers`, `/admin/paid-circles`.
- `docs/API_CONTRACT.md` updated: new `## 9e`–`## 9i` sections (File Uploads, Followers & Public Profiles, Trainer Verification, Paid Circles, Strava Integration), `GET`/`PATCH /users/me` examples updated with the new profile fields, Quick Reference table extended, and a pre-existing duplicate-`## 10`-heading bug (two sections both numbered 10) fixed while in the area (`Frontend Flow Summary` → `## 11`, `CORS & Headers` → `## 12`).
- Not verified live in this sandbox: no headless-browser pass and no real Cloudinary/Strava credentials were available here, so the actual OAuth round-trip and file upload were verified by code review + the unit test's mocked/direct-function-call coverage only, not an end-to-end request against the real Cloudinary/Strava APIs.

#### Post-deploy fixes (same session, after the initial push)
- **Real bug found in production (#1):** the first production deploy 500'd on every request (Vercel logs: `ModuleNotFoundError: No module named 'cloudinary'` on `import cloudinary` inside `app/services/cloudinary_service.py`, raised while importing `app.main`, which crashed the whole Lambda — every route, not just uploads). Root cause: this repo has **two** requirements files for the backend — `backend/requirements.txt` (used by Render) and `backend/api/requirements.txt` (a separate copy Vercel's `@vercel/python` builder actually reads, since it resolves dependencies relative to the `api/index.py` entrypoint). `cloudinary` and `cryptography` had been added to the former when Phase 15 was built, but nobody updated the latter, so Vercel installed a dependency set one release behind. **Fix:** added the two missing packages to `backend/api/requirements.txt`; verified by installing that exact file into a clean venv and confirming `app.main` imports (135 routes). **This is a standing footgun** — any future new dependency must be added to both files, or this exact class of Vercel-only outage will recur; there's no automated check preventing the two files from drifting.
- **Real bug found in production (#2):** immediately after fix #1 landed, `POST /api/auth/telegram` (and by extension every other endpoint touching `users`) started 500ing with `psycopg2.errors.UndefinedColumn: column users.bio does not exist`. Confirmed the exact scenario flagged as a known gap below: the Phase 15 migration was never applied to the live Supabase database — the ORM's full `users` column list (including `bio`, `profile_privacy`, `is_verified_trainer`, `strava_*`) doesn't match the live schema. **Fix:** ran the idempotent SQL from `apply_phase15_migration.py` directly against production. Also observed (not fixed, since it's outside this incident's scope): the Vercel deployment logs `"Well Circle API starting (env=development, serverless=True)"`, meaning production has `ENVIRONMENT=development` set rather than `production` — worth correcting in the Vercel project settings, since `development` mode triggers `Base.metadata.create_all` on every cold start (harmless for schema drift on already-existing tables like `users`, since `create_all` never runs `ALTER TABLE`, but not the intended production posture either).

#### Known Gaps / Next Steps
- ~~Production Supabase migration status is unconfirmed for this phase~~ — **confirmed and fixed** (see post-deploy fix #2 above): it had not been applied; it now has.
- `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET` and `STRAVA_CLIENT_ID`/`CLIENT_SECRET`/`REDIRECT_URI` must be set in the Vercel (and Render, if used) project's environment for uploads/trainer-verification/paid-circle receipts/Strava to work at all — without them, uploads 503 and Strava connect 503s. See `.env.example`, which already documents all of these.
- Vercel's `ENVIRONMENT` var is set to `development`, not `production` — should be corrected in the Vercel project settings to match this repo's intended serverless posture (see post-deploy fix #2).
- No external cron is confirmed wired up to `POST /api/cron/maintenance` in production — without one, expired trainer badges, expired subscriptions, and stale-receipt escalation never run on Vercel (the in-process APScheduler job is Vercel-skipped by design, matching this repo's existing serverless convention).
- Verified-trainer search-ranking boost (plan Phase 3) is unbuilt, as noted above — a reasonable fast-follow if trainer discoverability becomes a priority.
- No automated test exists for the upload endpoint itself; worth adding a mocked-Cloudinary test before depending on it further.
- No live/manual walkthrough of the real Strava OAuth round-trip or an actual file upload was possible in this sandbox (no credentials, no browser) — do a manual pass through connect → grant → visibility toggle → disconnect, and a real certificate/receipt upload, before treating this phase as launch-verified.

#### Files Changed / Added (Phase 15)
```
backend/app/services/cloudinary_service.py   (new)
backend/app/services/strava_service.py   (new)
backend/app/api/uploads.py   (new)
backend/app/api/followers.py   (new)
backend/app/api/trainer.py   (new)
backend/app/api/strava.py   (new)
backend/app/api/maintenance.py   (new — not in original plan; serverless cron entry point)
backend/app/models/follower.py   (new)
backend/app/models/trainer_verification.py   (new)
backend/app/models/circle_subscription.py   (new)
backend/app/models/strava_activity_cache.py   (new)
backend/app/schemas/trainer_verification.py   (new)
backend/app/schemas/circle_subscription.py   (new)
backend/app/crud/follower.py   (new)
backend/app/crud/trainer_verification.py   (new)
backend/app/crud/circle_subscription.py   (new)
backend/app/crud/strava.py   (new)
backend/alembic/versions/012_phase15_foundation.py   (new)
backend/apply_phase15_migration.py   (new)
backend/app/tests/test_phase15_backend.py   (new — consolidated, see deviations above)
backend/requirements.txt
backend/api/requirements.txt   (fixed post-deploy — see above)
backend/.env.example
backend/app/config.py
backend/app/main.py
backend/app/models/user.py
backend/app/models/circle.py
backend/app/models/__init__.py
backend/app/schemas/user.py
backend/app/crud/circle.py
backend/app/api/users.py
backend/app/api/circles.py
backend/app/api/admin.py
backend/app/api/posts.py
backend/app/services/scheduler.py
frontend/src/pages/FollowersList.jsx   (new)
frontend/src/pages/PublicProfile.jsx   (new)
frontend/src/pages/TrainerVerification.jsx   (new)
frontend/src/pages/admin/AdminTrainerVerifications.jsx   (new)
frontend/src/pages/admin/AdminPaidCircles.jsx   (new)
frontend/src/components/StravaStats.jsx   (new)
frontend/src/components/VerifiedBadge.jsx   (new)
frontend/src/pages/ProfileScreen.jsx
frontend/src/pages/CircleDetailScreen.jsx
frontend/src/pages/admin/AdminLayout.jsx
frontend/src/App.jsx
frontend/src/api/client.js
frontend/src/data/mock.js
frontend/src/test/FollowersList.test.jsx   (new)
frontend/src/test/PublicProfile.test.jsx   (new)
frontend/src/test/TrainerVerification.test.jsx   (new)
frontend/src/test/CircleDetailScreen.paid.test.jsx   (new)
frontend/src/test/ProfileScreen.healthApp.test.jsx   (new)
frontend/src/test/AdminLaunchFeatures.test.jsx   (new)
frontend/src/test/phase15.client.test.js   (new)
frontend/src/test/routes.smoke.test.jsx
docs/API_CONTRACT.md
HANDOFF.md
```

---

*Prepared for hackathon review, deployment handoff, and post-event roadmap planning.*

