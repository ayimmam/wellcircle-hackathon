# Well Circle — Phase 2 Deployment Changelog

**Document purpose:** Handoff for deployment / infrastructure managers before pushing Phase 2 to production.  
**Baseline:** MVP originally deployed (backend on Render, frontend on Vercel, bot on Railway, DB on Supabase).  
**Phase 2 scope:** Provider self-onboarding, Legacy Points products store, super-admin dashboard, Telegram approval notifications.  
**Date:** June 2026

---

## 1. Executive Summary

Phase 2 is a **non-breaking additive release**. All original MVP endpoints, routes, and user flows remain functional. New capabilities were added on top of the existing stack.


| Area                       | Change level    | Action required before go-live                        |
| -------------------------- | --------------- | ----------------------------------------------------- |
| **Database (Supabase)**    | **Required**    | Run Alembic migration `001_phase2`                    |
| **Backend (Render)**       | Deploy new code | Redeploy; no new env vars (existing ones still apply) |
| **Frontend (Vercel)**      | Deploy new code | Set `VITE_USE_MOCK=false` in production               |
| **Telegram Bot (Railway)** | Deploy new code | Add `FRONTEND_URL` + `SUPER_ADMIN_TELEGRAM_IDS`       |
| **BotFather**              | Optional        | No URL change unless Mini App domain changed          |
| **Supabase data**          | One-time setup  | Set `is_super_admin` on admin user(s)                 |


**Nothing was removed** from the MVP. No existing API contracts were intentionally broken.

---

## 2. What Did NOT Change (Safe / No Action)

These MVP features work the same as before:

- `POST /api/auth/telegram` — JWT authentication via Telegram `initData`
- User onboarding: `POST /api/users/me/onboard`, `PATCH /api/users/me`
- Provider browse/detail: `GET /api/providers`, `GET /api/providers/:id`, `GET /api/providers/:id/stats`
- Communities: join, leave, check-in, feed
- Bookings and payments (Telebirr / M-Pesa endpoints unchanged)
- Circles, posts, reactions
- Existing admin endpoints: analytics, users, `POST/PUT/DELETE /api/admin/providers`
- Bot `/start` command and `POST /api/bot/register`
- Frontend routes: `/`, `/home`, `/explore`, `/community`, `/profile`, `/provider/:id`, `/booking/:id`, `/provider-dashboard`
- Bottom navigation (Home, Explore, Community, Profile)
- Payment env vars (Telebirr / M-Pesa) — unchanged, still optional for sandbox

---

## 3. Database Changes (Supabase) — **REQUIRED**

### 3.1 New migration file

```
backend/alembic/versions/001_phase2_schema.py
```

### 3.2 Modified table: `providers`


| Column               | Type          | Default    | Purpose                                                                  |
| -------------------- | ------------- | ---------- | ------------------------------------------------------------------------ |
| `status`             | `VARCHAR(50)` | `'active'` | Lifecycle: `draft`, `pending_approval`, `active`, `inactive`, `rejected` |
| `onboarded_by_admin` | `BOOLEAN`     | `false`    | Distinguishes admin-created vs self-onboarded providers                  |
| `submitted_at`       | `TIMESTAMPTZ` | `NULL`     | When self-onboarding application was submitted                           |
| `reviewed_at`        | `TIMESTAMPTZ` | `NULL`     | When admin approved or rejected                                          |


### 3.3 New tables


| Table                 | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `provider_invites`    | Gated invite codes for provider self-onboarding |
| `products`            | Wellness products redeemable with Legacy Points |
| `user_redemptions`    | Redemption history, codes, delivery status      |
| `admin_notifications` | In-app admin event feed                         |


### 3.4 Migration commands (production)

```bash
cd backend
# Ensure DATABASE_URL points to production Supabase
alembic upgrade head
```

**Post-migration backfill (run once in Supabase SQL editor if needed):**

```sql
UPDATE providers SET status = 'active' WHERE status IS NULL;
```

### 3.5 Behavior change (non-destructive)

- **Public provider listing** (`GET /api/providers`) now returns only providers with `status = 'active'` (or `NULL` for legacy rows). Pending/rejected providers are hidden from the marketplace until approved.

---

## 4. Backend Changes (Render)

### 4.1 New files


| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `app/models/provider_invite.py`         | Invite code ORM                                        |
| `app/models/product.py`                 | Product ORM                                            |
| `app/models/user_redemption.py`         | Redemption ORM                                         |
| `app/models/admin_notification.py`      | Admin notification ORM                                 |
| `app/schemas/product.py`                | Product/redemption Pydantic schemas                    |
| `app/schemas/provider_onboarding.py`    | Onboarding/admin management schemas                    |
| `app/crud/provider_invite.py`           | Invite code CRUD                                       |
| `app/crud/product.py`                   | Product browse, redeem, admin inventory                |
| `app/crud/admin_notification.py`        | Notify all super admins                                |
| `app/api/products.py`                   | Public products + redeem routes                        |
| `app/services/telegram_notify.py`       | Sends approval/rejection messages via Telegram Bot API |
| `alembic/versions/001_phase2_schema.py` | DB migration                                           |


### 4.2 Modified files


| File                            | What changed                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `app/models/provider.py`        | Added lifecycle columns (`status`, etc.)                                              |
| `app/models/__init__.py`        | Exports new models                                                                    |
| `app/crud/provider.py`          | Self-onboard, approve/reject, promote, admin list; public list filters active only    |
| `app/api/providers.py`          | Self-onboard, invite generate, `/me`, provider product routes                         |
| `app/api/admin.py`              | Pending providers, approve/reject, promote, notifications, admin products/redemptions |
| `app/api/users.py`              | Added `GET /api/users/me/redemptions`                                                 |
| `app/dependencies.py`           | Added `get_optional_user` (optional JWT for product browse)                           |
| `app/main.py`                   | Registered `products` router; dev `create_all` includes new models                    |
| `app/schemas/provider.py`       | Category pattern extended with `running`                                              |
| `app/tests/test_integration.py` | Phase 2 onboarding + product tests added                                              |


### 4.3 New API endpoints

#### Provider self-onboarding


| Method  | Path                                     | Auth                          | Description                                  |
| ------- | ---------------------------------------- | ----------------------------- | -------------------------------------------- |
| `POST`  | `/api/providers/self-onboard`            | JWT                           | Submit provider application with invite code |
| `POST`  | `/api/providers/invite-code/generate`    | Super admin                   | Generate invite code                         |
| `GET`   | `/api/providers/me`                      | Provider (`is_provider=true`) | Own provider profile + dashboard stats       |
| `PATCH` | `/api/providers/me`                      | Provider                      | Update own profile (cannot change `status`)  |
| `GET`   | `/api/providers/me/products`             | Provider                      | List own products                            |
| `POST`  | `/api/providers/me/products`             | Provider                      | Create product                               |
| `PATCH` | `/api/providers/me/products/:product_id` | Provider                      | Update own product                           |
| `GET`   | `/api/providers/me/redemptions`          | Provider                      | Recent redemptions for own products          |


#### Products store


| Method | Path                        | Auth         | Description                   |
| ------ | --------------------------- | ------------ | ----------------------------- |
| `GET`  | `/api/products`             | Optional JWT | Browse/search/filter products |
| `GET`  | `/api/products/:id`         | Public       | Product detail                |
| `POST` | `/api/products/:id/redeem`  | JWT          | Redeem with Legacy Points     |
| `GET`  | `/api/users/me/redemptions` | JWT          | User redemption history       |


#### Admin (extensions)


| Method | Path                                       | Auth        | Description                                              |
| ------ | ------------------------------------------ | ----------- | -------------------------------------------------------- |
| `GET`  | `/api/admin/providers`                     | Super admin | List all providers (optional `status`, `search` filters) |
| `GET`  | `/api/admin/providers/pending`             | Super admin | Pending applications                                     |
| `POST` | `/api/admin/providers/:id/approve`         | Super admin | Approve + auto-create community + Telegram notify        |
| `POST` | `/api/admin/providers/:id/reject`          | Super admin | Reject + Telegram notify                                 |
| `PUT`  | `/api/admin/providers/promote-user`        | Super admin | Promote user to provider without invite                  |
| `GET`  | `/api/admin/notifications`                 | Super admin | Admin notification feed                                  |
| `GET`  | `/api/admin/products`                      | Super admin | All products inventory                                   |
| `POST` | `/api/admin/products/:id/update-stock`     | Super admin | Set stock quantity                                       |
| `POST` | `/api/admin/redemptions/:id/update-status` | Super admin | Update delivery status                                   |


### 4.4 Backend environment variables

**No new required env vars.** Existing `backend/.env.example` is unchanged.


| Variable                   | Still required | Notes                                                           |
| -------------------------- | -------------- | --------------------------------------------------------------- |
| `DATABASE_URL`             | Yes            | Supabase connection string                                      |
| `TELEGRAM_BOT_TOKEN`       | Yes            | Used by `telegram_notify.py` for approval/rejection messages    |
| `JWT_SECRET`               | Yes            | Do not rotate on deploy unless forcing re-login                 |
| `BOT_API_KEY`              | Yes            | Bot ↔ backend shared secret                                     |
| `FRONTEND_URL`             | Yes            | Used in approval Telegram messages (`/provider-dashboard` link) |
| `SUPER_ADMIN_TELEGRAM_IDS` | Yes            | Fallback admin check if `is_super_admin` not set in DB          |
| `ENVIRONMENT`              | Yes            | Set `production` on Render (disables dev auto-create tables)    |


### 4.5 Render deploy notes

- **Build command:** unchanged (`pip install -r requirements.txt`)
- **Start command:** unchanged (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- **Important:** In production (`ENVIRONMENT=production`), tables are **not** auto-created. Migration **must** run before or immediately after deploy.
- `render.yaml` does not run Alembic automatically — migration is a **manual step** (or add to build command if desired).

---

## 5. Frontend Changes (Vercel)

### 5.1 New pages / routes


| Route                   | Page                                      | Access                         |
| ----------------------- | ----------------------------------------- | ------------------------------ |
| `/admin`                | Redirects to `/admin/analytics`           | `user.is_super_admin === true` |
| `/admin/analytics`      | Platform KPIs, top categories, CSV export | Super admin                    |
| `/admin/providers`      | Pending / active / rejected providers     | Super admin                    |
| `/admin/products`       | Products inventory, stock editor          | Super admin                    |
| `/admin/reports`        | CSV export buttons                        | Super admin                    |
| `/provider-onboard`     | 4-step provider application form          | Authenticated users            |
| `/products`             | Legacy Points store browse                | All users                      |
| `/products/:id`         | Product detail                            | All users                      |
| `/products/:id/redeem`  | Redemption confirmation flow              | Authenticated users            |
| `/users/me/redemptions` | Redemption history                        | Authenticated users            |


### 5.2 Modified pages / components


| File                    | What changed                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `App.jsx`               | Registered all new routes; admin nested layout with `AdminGuard`             |
| `ProviderDashboard.jsx` | Added **Analytics / Products** tabs; product create list; recent redemptions |
| `BurgerMenu.jsx`        | Added **Points Store**, **Become Provider**, **Admin** (admin only)          |
| `BottomNav.jsx`         | Hides on `/admin/`* and `/provider-onboard`                                  |
| `Header.jsx`            | Hides on `/admin/*`                                                          |
| `api/client.js`         | New API methods for onboarding, products, admin                              |
| `data/mock.js`          | Mock products, redemptions, admin data for local dev                         |
| `index.css`             | Phase 2 styles: admin shell, product grid, modals, badges                    |


### 5.3 New components


| File                             | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `components/AdminGuard.jsx`      | Redirects non-admins away from `/admin` |
| `pages/admin/AdminLayout.jsx`    | Admin tab navigation shell              |
| `pages/admin/AdminAnalytics.jsx` | Analytics tab                           |
| `pages/admin/AdminProviders.jsx` | Provider management tab                 |
| `pages/admin/AdminProducts.jsx`  | Products inventory tab                  |
| `pages/admin/AdminReports.jsx`   | Reports/export tab                      |


### 5.4 Frontend environment variables


| Variable            | Required in prod | Default                     | Action                                      |
| ------------------- | ---------------- | --------------------------- | ------------------------------------------- |
| `VITE_API_BASE_URL` | **Yes**          | `http://localhost:8000/api` | Set to `https://<render-backend>/api`       |
| `VITE_USE_MOCK`     | **Yes**          | `false` if unset            | Explicitly set `false` in Vercel production |


**⚠️ If `VITE_USE_MOCK=true` in production, Phase 2 features will show fake data and not hit the real API.**

`frontend/.env.example` only documents `VITE_API_BASE_URL`. Deployment manager should add `VITE_USE_MOCK=false` in Vercel dashboard.

### 5.5 Vercel deploy notes

- Build command unchanged: `npm run build`
- No `vercel.json` routing changes required (SPA fallback already handled)
- Max-width remains **430px** (Telegram Mini App)

---

## 6. Telegram Bot Changes (Railway)

### 6.1 New files


| File                    | Purpose                  |
| ----------------------- | ------------------------ |
| `bot/handlers/admin.py` | `/admin` command handler |


### 6.2 Modified files


| File            | What changed                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `bot/main.py`   | Registers `/admin` command; adds to BotFather command list                  |
| `bot/config.py` | Added `FRONTEND_URL`, `SUPER_ADMIN_TELEGRAM_IDS`, `is_super_admin()` helper |
| `.env.example`  | Documents new bot env vars                                                  |


### 6.3 New bot command


| Command  | Who sees it                 | Behavior                                                                                                          |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/admin` | All users (in command list) | Only responds with dashboard link if `telegram_id` is in `SUPER_ADMIN_TELEGRAM_IDS`; others get permission denied |


### 6.4 Bot environment variables — **NEW**


| Variable                   | Required      | Description                                                              |
| -------------------------- | ------------- | ------------------------------------------------------------------------ |
| `FRONTEND_URL`             | **Yes (new)** | Base URL for admin dashboard link (e.g. `https://wellcircle.vercel.app`) |
| `SUPER_ADMIN_TELEGRAM_IDS` | **Yes (new)** | Comma-separated Telegram user IDs allowed to use `/admin`                |


Existing bot vars unchanged: `TELEGRAM_BOT_TOKEN`, `BACKEND_URL`, `BOT_API_KEY`, `MINI_APP_URL`.

### 6.5 Backend-triggered bot messages (no bot code deploy dependency)

When admin approves/rejects a provider in the dashboard, the **backend** sends Telegram messages directly via `telegram_notify.py` using `TELEGRAM_BOT_TOKEN`. The bot service does not need to be running for these notifications — only the backend token must be valid.

---

## 7. Removed / Deprecated


| Item                       | Status                                         |
| -------------------------- | ---------------------------------------------- |
| Any MVP API endpoint       | **Not removed**                                |
| Any MVP frontend route     | **Not removed**                                |
| `IMPLEMENTATION_PROMPT.md` | Added locally as spec reference (not deployed) |


**Minor route note:** Provider promote endpoint is `PUT /api/admin/providers/promote-user` (no `:provider_id` in path). If external docs referenced a different path, update integrations accordingly.

---

## 8. One-Time Production Setup (After Deploy)

### 8.1 Grant super admin access

Option A — environment (already supported):

```
SUPER_ADMIN_TELEGRAM_IDS=<telegram_user_id>
```

Option B — database (recommended for persistent admin flag):

```sql
UPDATE users SET is_super_admin = true WHERE telegram_id = <YOUR_TELEGRAM_ID>;
```

User must have opened the Mini App at least once so a `users` row exists.

### 8.2 Generate first provider invite code

After admin access works, call (as super admin):

```
POST /api/providers/invite-code/generate
Authorization: Bearer <admin_jwt>
Body: { "expires_in_days": 30 }
```

Share the returned `invite_code` with the first self-onboarding provider.

### 8.3 Seed products (optional)

Existing providers do not automatically get products. Either:

- Provider creates products via **Provider Dashboard → Products tab**, or
- Admin creates/adjusts inventory via **Admin → Products**

---

## 9. Recommended Deployment Order

```
1. Supabase  →  alembic upgrade head  (+ backfill providers.status)
2. Render    →  deploy backend        (verify /health, /docs)
3. Vercel    →  deploy frontend       (VITE_USE_MOCK=false, VITE_API_BASE_URL set)
4. Railway   →  deploy bot            (FRONTEND_URL, SUPER_ADMIN_TELEGRAM_IDS)
5. Supabase  →  SET is_super_admin on admin user
6. Smoke test →  full flow (see section 10)
```

**Do not deploy frontend with mock mode before backend migration is complete.**

---

## 10. Post-Deploy Smoke Test Checklist

- `GET /health` returns OK on Render
- Existing user can log in via Telegram Mini App
- `GET /api/providers` still returns active providers
- Community join/check-in still works
- Admin can open `/admin` in Mini App
- Admin can generate invite code
- User can complete `/provider-onboard` with invite code
- Admin can approve pending provider in `/admin/providers`
- Approved provider receives Telegram message
- Approved provider can open `/provider-dashboard` and create a product
- User can browse `/products` and redeem (if sufficient points)
- `/users/me/redemptions` shows redemption history
- Bot `/admin` returns dashboard link for super admin only

---

## 11. Rollback Plan


| Layer    | Rollback action                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Redeploy previous Vercel build                                                                                                                |
| Backend  | Redeploy previous Render build (new endpoints stop; MVP still works)                                                                          |
| Bot      | Redeploy previous Railway build (`/admin` command removed)                                                                                    |
| Database | **Do not drop tables** if rollback — new tables are unused by old code. Only run `alembic downgrade` if absolutely necessary and after backup |


Phase 2 DB changes are additive. Rolling back code without rolling back DB is safe for MVP functionality.

---

## 12. Files Added to Repository (Quick Reference)

```
backend/alembic/versions/001_phase2_schema.py
backend/app/api/products.py
backend/app/crud/admin_notification.py
backend/app/crud/product.py
backend/app/crud/provider_invite.py
backend/app/models/admin_notification.py
backend/app/models/product.py
backend/app/models/provider_invite.py
backend/app/models/user_redemption.py
backend/app/schemas/product.py
backend/app/schemas/provider_onboarding.py
backend/app/services/telegram_notify.py
frontend/src/components/AdminGuard.jsx
frontend/src/pages/admin/AdminAnalytics.jsx
frontend/src/pages/admin/AdminLayout.jsx
frontend/src/pages/admin/AdminProducts.jsx
frontend/src/pages/admin/AdminProviders.jsx
frontend/src/pages/admin/AdminReports.jsx
frontend/src/pages/MyRedemptions.jsx
frontend/src/pages/ProductDetail.jsx
frontend/src/pages/ProductRedeem.jsx
frontend/src/pages/ProductsStore.jsx
frontend/src/pages/ProviderOnboard.jsx
telegram-bot/bot/handlers/admin.py
IMPLEMENTATION_PROMPT.md          (internal spec — not deployed)
PHASE2_DEPLOYMENT_CHANGELOG.md  (this document)
```

---

## 13. Contact / Ownership Reminder


| Service      | Platform | Owner action on deploy                      |
| ------------ | -------- | ------------------------------------------- |
| Backend API  | Render   | Redeploy + confirm env vars                 |
| PostgreSQL   | Supabase | Run migration                               |
| Mini App     | Vercel   | Redeploy + set `VITE_USE_MOCK=false`        |
| Telegram Bot | Railway  | Redeploy + add 2 new env vars               |
| BotFather    | Telegram | Web App URL unchanged unless domain changed |


---

*Generated for Well Circle Phase 2 release handoff. Share this document with anyone managing Render, Vercel, Railway, or Supabase settings.*