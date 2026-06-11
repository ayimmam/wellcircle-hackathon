# Well Circle — Project Handoff

This document tracks implementation status against `PRD.md`, `IMPLEMENTATION_PROMPT.md`, and `PHASE3_IMPLEMENTATION_PLAN.md`.  
**Last updated:** June 2026 — after Phase 3 (events, challenges, in-app notifications, subscriptions).

For Phase 3 detail and LLM continuation notes, see also **`PHASE3_HANDOFF.md`**.

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
| Dynamic push notifications | Hardcoded neighbourhood alerts on Home |
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
- [ ] `FeaturedEventsCarousel` renders on Home and Explore
- [ ] `ChallengesList` shows on Community detail; check-in updates challenge progress
- [ ] `/notifications` inbox loads and mark-read works
- [ ] Provider Dashboard Events tab: create/list events
- [ ] Provider Dashboard Subscriptions tab: view plans and initiate payment (demo mode)

---

*Prepared for hackathon review, deployment handoff, and post-event roadmap planning.*
