# Well Circle — Project Handoff

This document tracks implementation status against `PRD.md` and `IMPLEMENTATION_PROMPT.md`.  
**Last updated:** June 2026 — after Phase 2 (provider onboarding, products store, admin dashboard).

For deployment-specific steps, see **`PHASE2_DEPLOYMENT_CHANGELOG.md`**.

---

## Shipped Features

### MVP (Complete)

#### Consumer Experience
- **Telegram Mini App shell** — auto-auth via Telegram `initData`, no separate login screen
- **Provider marketplace** — browse, filter by category, provider detail pages
- **Community spaces** — join, leave, daily check-in, live feed
- **Legacy Points engine** — +10 per check-in, tiers (Seed → Forest), backend decay via APScheduler
- **Booking flow** — 3-step flow (service → date/time → payment); provider services seeded in production DB

#### Provider Dashboard (MVP)
- Live KPI cards (members, bookings, revenue, engagement)
- Real-time community feed polling

#### Social & Engagement
- Neighbourhood opt-in on Profile → targeted alerts on Home
- Health app connection toggle (UI mock metrics)
- Circles with leaderboards
- Community posts and point-gifting reactions

---

### Phase 2 (Complete — June 2026)

#### Provider Self-Onboarding
- **Route:** `/provider-onboard` — 4-step form (invite code → details → services → review)
- **API:** `POST /api/providers/self-onboard` with gated invite codes
- **Admin API:** `POST /api/providers/invite-code/generate`
- Provider applications enter `pending_approval` until admin approves
- Approval auto-creates linked community and sends Telegram notification

#### Wellness Products Store
- **Routes:** `/products`, `/products/:id`, `/products/:id/redeem`, `/users/me/redemptions`
- Browse, search, filter (type, in-stock), recommended products by interest
- Redeem with Legacy Points (digital voucher codes + physical delivery address)
- Stock decrements on redemption; points deducted atomically

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

## Infrastructure & Deployment

| Service | Platform | Status |
|---------|----------|--------|
| Backend API | Vercel Serverless (Mangum) / Render | Deployed |
| Database | Supabase PostgreSQL | Phase 2 migration applied |
| Frontend Mini App | Vercel | Deployed (`VITE_USE_MOCK=false` in prod) |
| Telegram Bot | Railway | Deployed |

### Database (Phase 2 schema)
- `providers` — added `status`, `onboarded_by_admin`, `submitted_at`, `reviewed_at`
- New tables: `provider_invites`, `products`, `user_redemptions`, `admin_notifications`
- RLS enabled on `users` table
- Demo `is_super_admin` and provider ownership configured for hackathon demos

### Payments (Demo mode)
- Telebirr/M-Pesa endpoints exist; backend can auto-approve mock transactions for demo flows without live sandbox credentials

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
| Telebirr / M-Pesa live payments | UI + API ready; sandbox credentials optional |
| Real health data (Apple Health, etc.) | UI mock only |
| Dynamic push notifications | Hardcoded neighbourhood alerts |
| Admin invite-code UI | API exists; generate via `/docs` or add UI button later |
| PDF report generation | Placeholder in Reports tab |

---

## Yet to Implement (Phase 3+)

- Real health data integration (Apple Health, Google Fit, Garmin)
- Dynamic location-aware push notifications
- Corporate B2B benefits portal
- Tribe Vault / group wallet split payments
- Rotating wellness savings pool (digital Equb)
- National / diaspora expansion

---

## Key Files (Phase 2)

```
backend/alembic/versions/001_phase2_schema.py
backend/app/api/products.py
backend/app/services/telegram_notify.py
frontend/src/pages/admin/*
frontend/src/pages/ProductsStore.jsx
frontend/src/pages/ProviderOnboard.jsx
telegram-bot/bot/handlers/admin.py
PHASE2_DEPLOYMENT_CHANGELOG.md
```

---

## Quick Verification Checklist

- [ ] User can browse `/products` and redeem with points
- [ ] Provider can apply at `/provider-onboard` with invite code
- [ ] Admin can approve at `/admin/providers`
- [ ] Bot `/admin` opens dashboard for super admin Telegram account
- [ ] Existing MVP flows (explore, communities, bookings) still work

---

*Prepared for hackathon review, deployment handoff, and post-event roadmap planning.*
