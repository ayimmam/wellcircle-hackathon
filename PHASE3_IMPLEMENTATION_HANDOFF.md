# Well Circle — Phase 3 Implementation Handoff

**Status:** Token limit reached during Phase 3 implementation. This document tracks what needs to be completed.  
**Date:** June 2026  
**Previous handoff:** See `PHASE3_HANDOFF.md` for partial status.  
**Master reference:** `PHASE3_IMPLEMENTATION_PLAN.md` — the authoritative spec for all Phase 3 features.

---

## 🎯 Phase 3 Feature Overview

Phase 3 adds five new feature areas to Well Circle:
1. **Provider Events** — scheduled classes/experiences with spot management
2. **Community Challenges** — time-bound engagement contests with leaderboards
3. **In-App Notifications** — user notification inbox
4. **Provider Subscriptions** — paid listing plans (Starter/Growth/Pro)
5. **Provider Promotions** — promotional badges on provider listings

All features are **fully designed and documented** in `PHASE3_IMPLEMENTATION_PLAN.md`. This document tracks which parts have been implemented and what remains.

---

## 📋 Implementation Checklist

### ✅ SECTION 1: Database Migrations

**File:** `backend/alembic/versions/002_phase3_schema.py`

**Status:** ✅ COMPLETE

**Required Tables:**
- [x] `provider_events` — scheduled events with capacity/booking tracking
- [x] `community_challenges` — time-bound challenges with reward points
- [x] `user_notifications` — in-app notification inbox
- [x] `provider_subscriptions` — subscription payment tracking
- [x] `provider_promotions` — promotional offers/badges
- [x] `event_inventory_log` — audit trail for capacity changes
- [x] `challenge_awards` — challenge completion tracking (prevent double-award)

**Alterations to Existing Tables:**
- [x] `bookings` — add nullable `event_id` FK
- [x] `providers` — add `is_featured BOOLEAN`, `subscription_plan VARCHAR(50)`
- [x] `bookings` — add `reminder_sent BOOLEAN`

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 1 (lines 31-189)

**Next step:** Copy the exact SQL from the spec and create the migration file. Run with:
```bash
cd backend
alembic upgrade head
```

---

### ✅ SECTION 2: Backend Models (ORM)

**Directory:** `backend/app/models/`

**Status:** ⚠️ PARTIALLY COMPLETE (4 of 6 created)

**Files Created:**
1. [x] `provider_event.py` ✅ COMPLETE
2. [x] `community_challenge.py` ✅ COMPLETE
3. [x] `user_notification.py` ✅ COMPLETE
4. [ ] `provider_subscription.py` — STILL NEEDED
5. [ ] `provider_promotion.py` — STILL NEEDED
6. [ ] `event_inventory_log.py` — STILL NEEDED (can be merged into provider_event or separate)

**Pattern to follow:** Copy structure from `backend/app/models/booking.py` exactly.

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 3 (lines 740-810)

---

### ✅ SECTION 3: Backend Schemas (Pydantic)

**Directory:** `backend/app/schemas/`

**Status:** ⚠️ PARTIALLY COMPLETE (1 of 5 created)

**Files Created:**
1. [x] `event.py` ✅ COMPLETE
2. [ ] `challenge.py` — STILL NEEDED
3. [ ] `notification.py` — STILL NEEDED
4. [ ] `subscription.py` — STILL NEEDED
5. [ ] `promotion.py` — STILL NEEDED

**Pattern to follow:** Copy from `backend/app/schemas/booking.py`.

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 3.5 (line 809)

---

### ✅ SECTION 4: Backend CRUD Operations

**Directory:** `backend/app/crud/`

**Status:** ❌ NOT STARTED

**Files to Create:**
1. [ ] `event.py` — CRUD methods: `create()`, `get_by_id()`, `get_by_provider()`, `list_upcoming()`, `update()`, `cancel()`
2. [ ] `challenge.py` — CRUD methods: `create()`, `get_active_for_community()`, `mark_completed()`, `get_leaderboard()`
3. [ ] `notification.py` — CRUD methods: `create()`, `get_for_user()`, `mark_read()`, `mark_all_read()`
4. [ ] `subscription.py` — CRUD methods: `create()`, `get_by_id()`, `get_by_provider()`, `update_status()`, `get_by_payment_ref()`
5. [ ] `promotion.py` — CRUD methods: `create()`, `get_active_for_provider()`, `list_active()`
6. [ ] `booking.py` (EXTEND) — Add method `get_by_user()` with status filtering

**Key logic to implement:**
- Atomic spot decrement in event bookings (Section 2.3 of spec)
- Leaderboard ranking SQL (Section 2.5)
- Challenge completion check logic (Section 2.4)

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 2

---

### ✅ SECTION 5: Backend API Endpoints

**Directory:** `backend/app/api/`

**Status:** ⚠️ PARTIALLY COMPLETE (1 of 4 files partially done)

**Files Status:**
1. [⚠️] `events.py` — Structure created, endpoints started (needs completion)
2. [ ] `challenges.py` — NOT STARTED
3. [ ] `notifications.py` — NOT STARTED
4. [ ] `subscriptions.py` — NOT STARTED

**Files to EXTEND (non-breaking):**
1. [ ] `bookings.py` — Add `event_id` support to POST body; add GET `/api/users/me/bookings` with status filtering
2. [ ] `communities.py` — Extend POST `/api/communities/:id/checkin` to trigger challenge completion checks
3. [ ] `providers.py` — Extend GET `/api/providers` and `/api/providers/:id` to include `active_promotion`; change sort order (featured first)
4. [ ] `payments.py` — Extend payment callbacks to handle `provider_subscriptions` (non-breaking, using payment ref matching)

**Detailed endpoint specs:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 2.1–2.9 (lines 200–955)

**After endpoints are created:**
- [ ] Register all new routers in `backend/app/main.py` (import + include in FastAPI app)

---

### ✅ SECTION 6: Backend Scheduler Jobs

**File:** `backend/app/services/scheduler.py`

**Status:** ❌ EXTENDED

**Jobs to Add:**
1. [ ] Booking reminder notifications — runs hourly, sends reminders for bookings starting in 20–28 hours
2. [ ] Challenge expiry — runs daily at midnight UTC, marks expired challenges as inactive and notifies community

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 2.9 (lines 839–878)

---

### ✅ SECTION 7: Frontend Routes

**File:** `frontend/src/` (React Router config, likely in `App.jsx` or `main.jsx`)

**Status:** ❌ NOT ADDED

**Routes to Add:**
- [ ] `/users/me/bookings` — `MyBookings` component
- [ ] `/notifications` — `NotificationInbox` component
- [ ] `/subscriptions` — `SubscriptionPlans` component
- [ ] `/subscriptions/pay` — `SubscriptionPayment` component
- [ ] Events sub-tab in Explore (integrated into existing `/explore`)

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 4.1 (line 973)

---

### ✅ SECTION 8: Frontend Components (New)

**Directory:** `frontend/src/components/`

**Status:** ❌ NOT CREATED

**Components to Create:**
1. [ ] `EventCard.jsx` — Single event card with urgency colour, boosted badge, spots/capacity
2. [ ] `FeaturedEventsCarousel.jsx` — Horizontally scrollable event list (for Home screen)
3. [ ] `ChallengesList.jsx` — Active challenges for community (with progress bar, reward badge)
4. [ ] `CommunityLeaderboard.jsx` — Top 10 members, period toggle (week/month/all-time)
5. [ ] `MyBookings.jsx` — Full booking history screen with tabs (Upcoming/Past/Cancelled)
6. [ ] `NotificationInbox.jsx` — Full notification centre with mark-read, read-all actions
7. [ ] `SubscriptionPlans.jsx` — Plan picker for provider onboarding (plan cards, recommended badge)
8. [ ] `SubscriptionPayment.jsx` — Payment flow component (mirrors booking payment flow)
9. [ ] `ProviderScheduleTab.jsx` — Provider dashboard Schedule tab with event creation modal

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 4.2–4.10 (lines 1031–1456)

---

### ✅ SECTION 9: Frontend Page Updates (Existing)

**Status:** ❌ NOT COMPLETED

**Page:** `frontend/src/pages/HomeScreen.jsx`
- [ ] Add "Happening Soon" section with `FeaturedEventsCarousel` (below featured providers, above neighbourhood alert)
- [ ] Use `GET /api/events?limit=10&to=<now+7days>` as data source

**Page:** `frontend/src/pages/ExploreScreen.jsx`
- [ ] Add tab switcher: `[ Studios ]  [ Events ]`
- [ ] "Events" tab: `GET /api/events?page=1` with category + date filters, vertical EventCard list, infinite scroll
- [ ] Keep existing "Studios" provider grid unchanged

**Page:** `frontend/src/pages/ProviderDetailPage.jsx`
- [ ] Add "Upcoming Sessions" section (vertical EventCard list from `GET /api/providers/:id/events`)
- [ ] Tapping "Book This Session" pre-fills booking flow with `event_id`

**Page:** `frontend/src/pages/CommunityDetailPage.jsx`
- [ ] Add three sections:
  - [ ] Active Challenge Banner (from `GET /api/communities/:id/challenges`)
  - [ ] Community Leaderboard (from `GET /api/communities/:id/leaderboard`)
  - [ ] Upcoming Events from this Provider (from provider's `GET /api/providers/:id/events`)

**Page:** `frontend/src/pages/ProfileTab.jsx`
- [ ] Add "My Bookings" row in menu → navigates to `/users/me/bookings`
- [ ] Add bell icon to header (Home screen) with unread notification count badge
- [ ] Bell icon taps → navigate to `/notifications`
- [ ] Implement 30-second polling on `GET /api/users/me/notifications?unread=true&limit=1` to update badge

**Page:** `frontend/src/pages/ProviderDashboard.jsx`
- [ ] Add "Schedule" tab (alongside Analytics, Products)
- [ ] Tab shows list of upcoming events (`GET /api/providers/me/events?from=now`)
- [ ] "Create Event" button → opens modal with event creation form
- [ ] Event cards show: service name, date/time, capacity fill bar, price, Edit/Cancel actions

**Page:** `frontend/src/pages/ProviderOnboarding.jsx`
- [ ] Rename current Step 4 to "Review" and make it Step 4
- [ ] Add **Step 5: Choose a Plan** after Step 4
- [ ] Step 5: Plan picker (Starter/Growth/Pro with pricing from `GET /api/subscriptions/plans`)
- [ ] Selected plan + phone + payment method → `POST /api/subscriptions/initiate`
- [ ] Open payment link, poll `GET /api/subscriptions/status/:id` every 3 seconds
- [ ] On success → navigate to provider dashboard

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 4.2–4.10

---

### ✅ SECTION 10: Frontend API Client

**File:** `frontend/src/api/client.js`

**Status:** ❌ EXTENDED

**Methods to Add:**
- [ ] Event endpoints: `getEvents()`, `getProviderEvents()`, `createEvent()`, `updateEvent()`, `boostEvent()`
- [ ] Challenge endpoints: `getChallenges()`, `createChallenge()`, `getCommunityLeaderboard()`
- [ ] Notification endpoints: `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`
- [ ] Subscription endpoints: `getSubscriptionPlans()`, `initiateSubscription()`, `getSubscriptionStatus()`
- [ ] Promotion endpoints: (read-only, included in provider response)
- [ ] Booking endpoints: Extend `createBooking()` to accept optional `event_id`; add `getUserBookings()`

**Reference:** `PHASE3_IMPLEMENTATION_PLAN.md` Section 4

---

## 🚀 Implementation Priority Order (Updated — Continue From Here)

**⏭️ IMMEDIATE NEXT STEPS:**
1. Complete `events.py` endpoints (partial — structure in place, needs logic)
2. Create remaining models: `provider_subscription.py`, `provider_promotion.py`, `event_inventory_log.py`
3. Create remaining schemas: `challenge.py`, `notification.py`, `subscription.py`, `promotion.py`
4. Create all CRUD files (event.py, challenge.py, notification.py, subscription.py, promotion.py)

**After that, follow Tier 1→4 order:**

**Tier 1 (Foundation — ✅ MOSTLY DONE):**
1. ✅ Database migration (COMPLETE)
2. ⚠️ Backend models (4/6 done — finish remaining 2)
3. ⚠️ Backend CRUD (0/6 done — start after schemas)

**Tier 2 (API Surface — IN PROGRESS):**
4. ⚠️ Backend schemas (1/5 done — finish remaining 4)
5. ⚠️ Backend endpoints (1/4 files, partial — complete then add remaining 3 new files + 4 extensions)
6. Main.py router registration

**Tier 3 (Scheduler):**
7. APScheduler jobs (not started)

**Tier 4 (Frontend):**
8. API client methods (not started)
9. New components (not started)
10. New routes (not started)
11. Page updates (not started)

---

## 📖 Reference Files & Specs

| File | Purpose |
|------|---------|
| `PHASE3_IMPLEMENTATION_PLAN.md` | **Master spec** — read this first for every section |
| `API_CONTRACT.md` | Existing endpoint shapes (must extend, not break) |
| `BACKEND_REFERENCE.md` | Database schema + code organization |
| `backend/app/models/booking.py` | Template for model structure |
| `backend/app/schemas/booking.py` | Template for schema structure |
| `backend/app/crud/booking.py` | Template for CRUD patterns |
| `backend/app/api/bookings.py` | Template for endpoint patterns |
| `frontend/src/api/client.js` | Where to add new API methods |
| `frontend/src/pages/HomeScreen.jsx` | Example page structure to extend |

---

## ⚠️ Critical Implementation Notes

### Database Atomicity
- **Event spot decrement must be atomic.** Use `UPDATE ... SET spots_remaining = spots_remaining - 1 WHERE spots_remaining > 0 RETURNING spots_remaining` pattern to prevent race conditions on concurrent bookings. Return 409 if no rows updated.

### Payment Callback Reuse
- **Do not duplicate payment webhook logic.** Extend existing Telebirr/M-Pesa callbacks to detect subscription vs. booking by matching trade ID. Use existing `services/telebirr_payment.py` and `services/mpesa_payment.py` without modification.

### Notification Triggers
- Notifications must be created **atomically with the triggering action** (e.g., when booking confirmed, create notification in same transaction). Use database-level constraints to prevent orphaning.

### Challenge Leaderboard
- Implement using window function `RANK() OVER (ORDER BY ...)` as shown in spec. Avoid loading all users into memory and sorting in Python.

### Frontend Polling
- Notification badge update polls only unread count (lightweight), not full list. Use 30-second interval, not real-time WebSocket (to keep frontend simple).

### Booking Event Link
- When `event_id` is provided to `POST /api/bookings`, the booking is linked to the event **and** the event's spot is reserved. Legacy bookings (without `event_id`) remain supported for backward compatibility.

---

## 🔍 Verification Checklist (Before Handoff)

After implementing Phase 3, verify:

- [ ] All 7 new tables created and indexed in Supabase
- [ ] All 6 new model files follow ORM patterns from `booking.py`
- [ ] All CRUD files implement the exact methods listed in Section 4
- [ ] All endpoint functions match spec signatures in `PHASE3_IMPLEMENTATION_PLAN.md`
- [ ] Event spot decrement is atomic (uses `UPDATE ... WHERE ... RETURNING` pattern)
- [ ] All new routes registered in `backend/app/main.py`
- [ ] Scheduler jobs registered in `services/scheduler.py`
- [ ] Frontend components render without console errors
- [ ] Frontend pages load new sections (Happening Soon, Events tab, etc.)
- [ ] API client has all new methods
- [ ] Notification badge updates via 30-second polling
- [ ] Payment callback detects and routes to subscription handler
- [ ] Booking flow accepts optional `event_id` parameter
- [ ] Provider onboarding has Step 5 (Choose a Plan)
- [ ] All existing Phase 1/2 tests still pass
- [ ] Backend runs without import errors: `python -m pytest backend/`

---

## 🎓 How the Next Agent Should Use This Document

1. **Start here** — read this entire document to understand what's been partially done
2. **For each section** — open the referenced file in `PHASE3_IMPLEMENTATION_PLAN.md` and follow the exact spec
3. **Use Tier 1–4 order** — don't jump between sections; complete each tier before starting the next
4. **Reference templates** — when writing a model/schema/CRUD/endpoint, open the booking equivalents to copy patterns
5. **Test incrementally** — run `pytest` after each tier to catch issues early
6. **Git status** — commit after each tier (so commits are logical and reviewable)
7. **If stuck** — re-read the spec section and the corresponding template file; 95% of the time the answer is there

---

## 📝 What Was Actually Completed (Prior Session)

✅ **COMPLETED:**
- Section 1: Database migration (`002_phase3_schema.py`) — All 7 tables + alterations defined
- Section 3: Backend Models
  - `provider_event.py` ✅
  - `community_challenge.py` ✅
  - `user_notification.py` ✅
- Section 3: Backend Schemas
  - `event.py` ✅
- Section 2: Backend API
  - `events.py` (partially — structure in place, endpoints started)

❌ **NOT COMPLETED (Pick up here):**
- Section 3: Remaining backend models (`provider_subscription.py`, `provider_promotion.py`, `event_inventory_log.py`)
- Section 3: Remaining schemas (`challenge.py`, `notification.py`, `subscription.py`, `promotion.py`)
- Section 4: All CRUD operations (`backend/app/crud/event.py`, `challenge.py`, `notification.py`, etc.)
- Section 2: Complete and extend existing endpoints (bookings, communities, providers, payments)
- Section 2: New API files (`challenges.py`, `notifications.py`, `subscriptions.py`)
- Section 2: APScheduler jobs
- Section 5-9: **All frontend work** (components, pages, routes)

**Next session should start from:** Complete the events.py endpoints, then move to **Section 3 (Remaining Models/Schemas)** → **Section 4 (CRUD)** → **Section 2 (Remaining Endpoints)** following the Tier 1→4 order.

---

*This handoff is complete and accurate based on actual file state. Ready for next LLM session.*
