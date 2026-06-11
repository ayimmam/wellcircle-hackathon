# Well Circle — Phase 3 Implementation Plan

**Version:** 3.0  
**Date:** June 2026  
**Purpose:** Formal implementation specification for a coding agent to extend the existing Well Circle codebase. All changes are additive — zero breaking changes to Phase 1/2 APIs, routes, or database tables.

---

## 0. How to Read This Document

This document is structured for sequential execution by a coding agent. Before touching any file:

1. Read `HANDOFF.md` to understand what is already shipped and deployed.
2. Read `API_CONTRACT.md` for all existing endpoint shapes.
3. Read `BACKEND_REFERENCE.md` for the full database schema.
4. Treat every section in this document as a **feature module** — each is independently deployable.
5. When a section says "extend existing endpoint", it means add an optional field or query param only. Never remove or rename existing fields.
6. All monetary amounts are stored as integers in ETB (Ethiopian Birr). No floats.
7. All timestamps are UTC ISO 8601: `2026-06-09T12:00:00Z`.

---

## 1. Database Migrations (Run First)

All migrations are non-destructive. Existing rows are unaffected by every `ALTER TABLE` below. Run as a single Alembic migration file: `backend/alembic/versions/002_phase3_schema.py`.

### 1.1 New Table: `provider_events`

Represents a scheduled class or experience instance hosted by a provider. This is distinct from the static `services` array on providers, which describes *what* a provider offers. `provider_events` describes *when* it is offered.

```sql
CREATE TABLE provider_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_name      VARCHAR(255) NOT NULL,
  description       TEXT,
  starts_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at           TIMESTAMP WITH TIME ZONE NOT NULL,
  capacity          INTEGER NOT NULL DEFAULT 10,
  spots_remaining   INTEGER NOT NULL,
  price_etb         INTEGER NOT NULL,
  is_cancelled      BOOLEAN NOT NULL DEFAULT false,
  is_boosted        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_events_provider_id ON provider_events(provider_id);
CREATE INDEX idx_provider_events_starts_at   ON provider_events(starts_at);
CREATE INDEX idx_provider_events_boosted     ON provider_events(is_boosted) WHERE is_boosted = true;
```

**Constraint:** `spots_remaining` must be decremented atomically when a booking is confirmed against an event (see Section 3.4). Use a database-level check: `CHECK (spots_remaining >= 0 AND spots_remaining <= capacity)`.

---

### 1.2 New Table: `community_challenges`

A provider-created, time-bound engagement challenge for a community.

```sql
CREATE TABLE community_challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id     UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  target_checkins  INTEGER NOT NULL,
  reward_points    INTEGER NOT NULL,
  starts_at        TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at          TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_community_id ON community_challenges(community_id);
CREATE INDEX idx_challenges_active       ON community_challenges(is_active, ends_at);
```

---

### 1.3 New Table: `user_notifications`

In-app notification inbox for each user. Separate from `admin_notifications` (which is admin-to-admin). This table is user-facing.

```sql
CREATE TABLE user_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  action_url  VARCHAR(500),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_notifications_user_id   ON user_notifications(user_id, is_read);
CREATE INDEX idx_user_notifications_created   ON user_notifications(created_at DESC);
```

**Valid `type` values:**
```
booking_confirmed | booking_reminder | points_earned | challenge_completed |
challenge_started | event_available | provider_approved | provider_rejected |
community_joined
```

---

### 1.4 New Table: `provider_subscriptions`

Tracks a provider's paid listing plan. One active row per provider at any time.

```sql
CREATE TABLE provider_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  plan         VARCHAR(50) NOT NULL,
  amount_etb   INTEGER NOT NULL,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  telebirr_trade_no VARCHAR(255),
  mpesa_checkout_id VARCHAR(255),
  paid_at      TIMESTAMP WITH TIME ZONE,
  expires_at   TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_provider_id ON provider_subscriptions(provider_id);
```

**Valid `plan` values:** `starter | growth | pro`  
**Valid `status` values:** `pending | active | expired | failed`

---

### 1.5 New Table: `provider_promotions`

Lightweight promotional offer displayed as a badge on provider listing cards in Explore.

```sql
CREATE TABLE provider_promotions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  headline     VARCHAR(255) NOT NULL,
  discount_pct INTEGER,
  valid_until  TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_provider_id ON provider_promotions(provider_id);
CREATE INDEX idx_promotions_active      ON provider_promotions(is_active, valid_until);
```

---

### 1.6 Alter Existing Tables (Non-Destructive)

These add nullable columns to existing tables. All existing rows remain valid.

```sql
-- On bookings: link a booking to a specific event (optional — non-event bookings keep this null)
ALTER TABLE bookings
  ADD COLUMN event_id UUID REFERENCES provider_events(id);

-- On providers: featured placement flag for paid tiers
ALTER TABLE providers
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;

-- On providers: subscription plan label for display
ALTER TABLE providers
  ADD COLUMN subscription_plan VARCHAR(50);
```

---

### 1.7 Inventory Log Table

Tracks every change to `provider_events.spots_remaining` for auditability.

```sql
CREATE TABLE event_inventory_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES provider_events(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     VARCHAR(50) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_log_event_id ON event_inventory_log(event_id);
```

**Valid `reason` values:** `booking_confirmed | booking_cancelled | manual_adjustment | provider_correction`

---

## 2. Backend: New Endpoints

### 2.1 File Structure Additions

Add the following new route files. Do not modify existing route files — only add imports to `app/main.py`:

```
backend/app/api/
  events.py           # Provider event scheduling (NEW)
  challenges.py       # Community challenges (NEW)
  notifications.py    # User notification inbox (NEW)
  subscriptions.py    # Provider subscription payments (NEW)
```

Add to `backend/app/models/`:
```
provider_event.py
community_challenge.py
user_notification.py
provider_subscription.py
provider_promotion.py
```

Add to `backend/app/schemas/`:
```
event.py
challenge.py
notification.py
subscription.py
```

---

### 2.2 Events API (`/api/events`, `/api/providers/:id/events`)

#### `GET /api/events`

Discovery endpoint. Returns upcoming events across all providers. Powers the "Happening Soon" section on Home and the Events sub-tab on Explore.

**Auth:** JWT (required)

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | ISO datetime | `now()` | Filter events starting after this time |
| `to` | ISO datetime | `now() + 7 days` | Filter events starting before this time |
| `category` | string | none | Filter by provider category (`yoga\|gym\|nutrition\|spa\|therapy\|running`) |
| `boosted_only` | bool | false | Return only boosted events |
| `limit` | int | 20 | Max results |
| `page` | int | 1 | Pagination |

**Response 200:**
```json
{
  "events": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "provider_name": "Zen Yoga Studio",
      "provider_category": "yoga",
      "provider_cover_photo_url": "https://...",
      "service_name": "Morning Vinyasa Flow",
      "description": "Start your day right with a focused 60-minute flow.",
      "starts_at": "2026-06-12T07:00:00Z",
      "ends_at": "2026-06-12T08:00:00Z",
      "capacity": 10,
      "spots_remaining": 3,
      "price_etb": 800,
      "is_boosted": false,
      "is_cancelled": false
    }
  ],
  "count": 14,
  "page": 1
}
```

**Urgency logic (backend computed, returned as field):** Add `urgency` string field:
- `"high"` if `spots_remaining <= 2`
- `"medium"` if `spots_remaining <= 5`
- `"low"` otherwise

---

#### `GET /api/providers/:id/events`

Provider-specific upcoming events. Used on the provider detail page and provider dashboard.

**Auth:** JWT (required)

**Query params:** `from`, `to`, `include_cancelled` (bool, default false)

**Response 200:**
```json
{
  "events": [ /* same shape as above */ ],
  "count": 4
}
```

---

#### `POST /api/providers/me/events`

Provider creates a new scheduled event. Provider-only access.

**Auth:** JWT (user must have `is_provider = true`)

**Request:**
```json
{
  "service_name": "Morning Vinyasa Flow",
  "description": "Start your day with a focused flow.",
  "starts_at": "2026-06-12T07:00:00Z",
  "ends_at": "2026-06-12T08:00:00Z",
  "capacity": 10,
  "price_etb": 800
}
```

**Backend logic:**
1. Resolve `provider_id` from the authenticated user's linked provider record.
2. Create `provider_events` row with `spots_remaining = capacity`.
3. Write an `event_inventory_log` entry: `delta = +capacity`, `reason = "provider_correction"`.
4. Return the created event.

**Response 201:**
```json
{
  "id": "uuid",
  "service_name": "Morning Vinyasa Flow",
  "starts_at": "2026-06-12T07:00:00Z",
  "ends_at": "2026-06-12T08:00:00Z",
  "capacity": 10,
  "spots_remaining": 10,
  "price_etb": 800,
  "is_cancelled": false,
  "is_boosted": false,
  "created_at": "2026-06-11T10:00:00Z"
}
```

---

#### `PATCH /api/providers/me/events/:event_id`

Update or cancel a provider's own event. Provider-only.

**Auth:** JWT (`is_provider = true`)

**Request (all fields optional):**
```json
{
  "description": "Updated description",
  "capacity": 12,
  "is_cancelled": true
}
```

**Constraint:** If `capacity` is reduced below current `spots_remaining`, reject with `422`: `"Cannot reduce capacity below current bookings"`. Compute booked count as `capacity - spots_remaining` to derive this check.

**If `is_cancelled = true`:**
1. Set `provider_events.is_cancelled = true`.
2. Find all bookings with `event_id = this event` and `payment_status = 'success'`.
3. Write a `user_notifications` row for each affected user: `type = "booking_cancelled"`, `title = "Your booking was cancelled"`, `body = "Your booking for [service_name] on [date] has been cancelled by the provider."`, `action_url = "/users/me/bookings"`.
4. (Refund logic is Phase 4 — do not implement now. Insert a TODO comment in the handler.)

**Response 200:** Updated event object (same shape as POST response).

---

#### `POST /api/admin/providers/:provider_id/events/:event_id/boost`

Admin marks an event as boosted. Boosted events appear in the "Featured This Week" banner on Home.

**Auth:** JWT (`is_super_admin = true`)

**Request:**
```json
{ "is_boosted": true }
```

**Response 200:**
```json
{ "event_id": "uuid", "is_boosted": true }
```

---

### 2.3 Bookings: Extend to Support Events

**Extend `POST /api/bookings` — non-breaking.**

Add one new optional field to the request body:

```json
{
  "provider_id": "uuid",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-12T07:00:00Z",
  "amount_etb": 800,
  "payment_method": "telebirr",
  "phone_number": "0911234567",
  "event_id": "uuid"   // NEW — optional. If provided, links booking to a specific event.
}
```

**Backend logic when `event_id` is provided:**
1. Fetch the `provider_events` row. Verify `is_cancelled = false` and `spots_remaining > 0`.
2. If either check fails, return `422`: `"This event is no longer available"`.
3. Decrement `spots_remaining` by 1 **atomically** using `UPDATE provider_events SET spots_remaining = spots_remaining - 1 WHERE id = :event_id AND spots_remaining > 0 RETURNING spots_remaining`. If the UPDATE returns no rows (race condition), return `409`: `"No spots remaining"`.
4. Write an `event_inventory_log` row: `delta = -1`, `reason = "booking_confirmed"`, `booking_id = new booking id`.
5. Continue with the existing booking creation logic unchanged.

**Extend `GET /api/users/me/bookings` — this is a new endpoint (currently implied but not formally specified in v1/v2).**

**Auth:** JWT

**Query params:** `status` (optional): `upcoming | completed | cancelled | all` (default: `all`)

**Response 200:**
```json
{
  "bookings": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "provider_name": "Zen Yoga Studio",
      "provider_cover_photo_url": "https://...",
      "service_name": "Morning Vinyasa Flow",
      "slot_datetime": "2026-06-12T07:00:00Z",
      "amount_etb": 800,
      "payment_method": "telebirr",
      "payment_status": "success",
      "event_id": "uuid",
      "created_at": "2026-06-11T10:00:00Z"
    }
  ],
  "count": 3
}
```

**Also extend booking confirmation logic:** After a booking payment reaches `payment_status = 'success'`:
1. Award +50 points to the user (the PRD specifies this for Phase 2 bookings; it was deferred — implement now).
2. Write a `user_notifications` row: `type = "booking_confirmed"`, `title = "Booking confirmed"`, `body = "Your [service_name] at [provider_name] is confirmed for [date]."`, `action_url = "/users/me/bookings"`.
3. Write a `user_notifications` row for the points: `type = "points_earned"`, `title = "+50 Legacy Points"`, `body = "You earned 50 points for booking [service_name]."`.

---

### 2.4 Community Challenges API

#### `GET /api/communities/:id/challenges`

Returns active challenges for a community. Used on the community detail screen.

**Auth:** JWT

**Response 200:**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "title": "Check in 5 times this week",
      "description": "Earn bonus points for staying consistent.",
      "target_checkins": 5,
      "reward_points": 50,
      "starts_at": "2026-06-09T00:00:00Z",
      "ends_at": "2026-06-15T23:59:59Z",
      "is_active": true,
      "user_progress": {
        "checkins_this_period": 3,
        "completed": false
      }
    }
  ],
  "count": 1
}
```

**Backend logic for `user_progress`:** Count `community_feed_events` rows where `user_id = current_user`, `community_id = :id`, `event_type = 'checkin'`, and `created_at` is between `challenge.starts_at` and `challenge.ends_at`.

---

#### `POST /api/providers/me/communities/:community_id/challenges`

Provider creates a challenge for one of their communities. Provider-only.

**Auth:** JWT (`is_provider = true`, and the community must belong to the provider's linked provider record)

**Request:**
```json
{
  "title": "5-day streak challenge",
  "description": "Check in every day this week.",
  "target_checkins": 5,
  "reward_points": 50,
  "starts_at": "2026-06-09T00:00:00Z",
  "ends_at": "2026-06-15T23:59:59Z"
}
```

**Response 201:** Created challenge object (same shape as in the GET response, without `user_progress`).

After creation, write a `user_notifications` row for every member of the community:
- `type = "challenge_started"`, `title = "New challenge in [community_name]"`, `body = "[title] — earn [reward_points] points if you complete it."`, `action_url = "/communities/:community_id"`.

---

#### Challenge completion check (extend existing checkin handler)

In the existing `POST /api/communities/:id/checkin` handler, **after** the check-in is recorded, run the following logic:

```python
# Pseudocode — add after existing checkin logic
active_challenges = get_active_challenges_for_community(community_id)
for challenge in active_challenges:
    progress = count_user_checkins_in_period(user_id, community_id, challenge.starts_at, challenge.ends_at)
    if progress >= challenge.target_checkins:
        already_awarded = check_if_challenge_reward_given(user_id, challenge.id)
        if not already_awarded:
            award_points(user_id, challenge.reward_points)
            record_challenge_award(user_id, challenge.id)
            write_user_notification(
                user_id=user_id,
                type="challenge_completed",
                title=f"Challenge complete! +{challenge.reward_points} points",
                body=f"You completed '{challenge.title}'.",
                action_url="/users/me/points-history"
            )
```

Add a `challenge_awards` table to track completions (prevent double-awarding):

```sql
CREATE TABLE challenge_awards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES community_challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_given INTEGER NOT NULL,
  awarded_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
```

---

### 2.5 Community Leaderboard Endpoint

#### `GET /api/communities/:id/leaderboard`

Returns top members by check-in count within a community. Powers the leaderboard widget on the community detail screen.

**Auth:** JWT

**Query params:** `period` (optional): `week | month | all_time` (default: `all_time`)

**Response 200:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "user_id": "uuid",
      "user_name": "Meron",
      "user_photo": "https://...",
      "checkin_count": 14,
      "is_current_user": true
    },
    {
      "rank": 2,
      "user_id": "uuid",
      "user_name": "Abel",
      "user_photo": "https://...",
      "checkin_count": 11,
      "is_current_user": false
    }
  ],
  "current_user_rank": 1,
  "total_members": 42
}
```

**Backend SQL (all_time):**
```sql
SELECT
  u.id AS user_id,
  u.name AS user_name,
  u.photo_url,
  COUNT(cfe.id) AS checkin_count,
  RANK() OVER (ORDER BY COUNT(cfe.id) DESC) AS rank
FROM community_feed_events cfe
JOIN users u ON cfe.user_id = u.id
WHERE cfe.community_id = :community_id
  AND cfe.event_type = 'checkin'
GROUP BY u.id, u.name, u.photo_url
ORDER BY checkin_count DESC
LIMIT 10;
```

For `week`/`month`, add `AND cfe.created_at >= now() - interval '7 days'` / `'30 days'`.

---

### 2.6 Notifications API

#### `GET /api/users/me/notifications`

**Auth:** JWT

**Query params:** `unread` (bool, default false — if true, only unread); `limit` (default 20); `offset` (default 0)

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "booking_confirmed",
      "title": "Booking confirmed",
      "body": "Your Morning Vinyasa at Zen Yoga Studio is confirmed for Jun 12.",
      "action_url": "/users/me/bookings",
      "is_read": false,
      "created_at": "2026-06-11T10:30:00Z"
    }
  ],
  "unread_count": 3,
  "count": 12
}
```

---

#### `POST /api/users/me/notifications/:id/read`

Mark a single notification as read.

**Auth:** JWT

**Response 200:**
```json
{ "id": "uuid", "is_read": true }
```

---

#### `POST /api/users/me/notifications/read-all`

Mark all notifications as read.

**Auth:** JWT

**Response 200:**
```json
{ "marked_read": 5 }
```

---

### 2.7 Provider Subscriptions API

#### `GET /api/subscriptions/plans`

Public endpoint — no auth required. Returns the plan definitions. Hardcoded in the backend (not stored in DB).

**Response 200:**
```json
{
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "price_etb": 500,
      "billing": "monthly",
      "features": [
        "1 community space",
        "Basic dashboard (members, check-ins)",
        "Up to 5 events per month"
      ]
    },
    {
      "id": "growth",
      "name": "Growth",
      "price_etb": 1500,
      "billing": "monthly",
      "features": [
        "3 community spaces",
        "Full dashboard + analytics",
        "Unlimited events",
        "Products store access",
        "Community challenges"
      ]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price_etb": 3000,
      "billing": "monthly",
      "features": [
        "Unlimited community spaces",
        "Featured placement in Explore",
        "Event boost credits (3/month)",
        "All Growth features",
        "Priority admin support"
      ]
    }
  ]
}
```

---

#### `POST /api/subscriptions/initiate`

A provider (or soon-to-be provider) initiates payment for a subscription plan. Can be called during the provider onboarding flow or from the provider dashboard.

**Auth:** JWT

**Request:**
```json
{
  "plan": "growth",
  "payment_method": "telebirr",
  "phone_number": "0911234567",
  "provider_id": "uuid"
}
```

**Backend logic:**
1. Verify `provider_id` belongs to the authenticated user.
2. Create a `provider_subscriptions` row with `status = 'pending'`.
3. Initiate payment using the **existing** Telebirr or M-Pesa service (same code path as booking payments — reuse `services/telebirr_payment.py` and `services/mpesa_payment.py`).
4. Store `telebirr_trade_no` or `mpesa_checkout_id` on the subscription row.
5. Return the payment initiation response.

**Response 200:**
```json
{
  "subscription_id": "uuid",
  "plan": "growth",
  "amount_etb": 1500,
  "payment_method": "telebirr",
  "to_pay_url": "https://app.ethiomobilemoney.et/...",
  "trade_no": "WC20260611001"
}
```

---

#### `GET /api/subscriptions/status/:subscription_id`

Poll subscription payment status. Same polling pattern as `GET /api/payments/:booking_id/status`.

**Auth:** JWT

**Response 200:**
```json
{
  "subscription_id": "uuid",
  "plan": "growth",
  "status": "active",
  "paid_at": "2026-06-11T10:35:00Z",
  "expires_at": "2026-07-11T10:35:00Z"
}
```

**On payment success (handled in payment callback):**
1. Set `provider_subscriptions.status = 'active'`, `paid_at = now()`, `expires_at = now() + 30 days`.
2. Set `providers.subscription_plan = plan`.
3. If `plan = 'pro'`, set `providers.is_featured = true`.
4. Set the provider's `status = 'active'` if it was `pending_approval` (paying providers skip admin review queue).
5. Set `users.is_provider = true` on the provider's owner.
6. Write a `user_notifications` row: `type = "provider_approved"`, `title = "Your provider account is live"`, `body = "Welcome to Well Circle Pro! Your listing is now visible to users."`.

---

#### Extend payment callbacks (non-breaking)

In `backend/app/api/payments.py`, in the existing `POST /api/payments/telebirr/callback` and `POST /api/payments/mpesa/callback` handlers, **after** the existing booking payment handling logic, add:

```python
# Check if this trade_no / checkout_id matches a provider_subscription instead of a booking
subscription = crud.subscription.get_by_payment_ref(trade_no=outTradeNo)
if subscription:
    handle_subscription_payment_success(subscription)
    return  # don't fall through to booking logic
```

This ensures the same Telebirr/M-Pesa webhook handles both booking payments and subscription payments without any changes to the webhook URL or signature validation.

---

### 2.8 Provider Promotions API

#### `POST /api/providers/me/promotions`

Provider creates a promotional offer shown on their listing card in Explore.

**Auth:** JWT (`is_provider = true`)

**Request:**
```json
{
  "headline": "First session free this weekend",
  "discount_pct": 100,
  "valid_until": "2026-06-15T23:59:59Z"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "headline": "First session free this weekend",
  "discount_pct": 100,
  "valid_until": "2026-06-15T23:59:59Z",
  "is_active": true
}
```

---

#### Extend `GET /api/providers` and `GET /api/providers/:id`

Add `active_promotion` to the provider response shape. This is an **additive field** — existing consumers that don't read it are unaffected.

```json
{
  "id": "uuid",
  "name": "Zen Yoga Studio",
  "...(all existing fields)...",
  "is_featured": false,
  "subscription_plan": "growth",
  "active_promotion": {
    "headline": "First session free this weekend",
    "discount_pct": 100,
    "valid_until": "2026-06-15T23:59:59Z"
  }
}
```

`active_promotion` is `null` when no active promotion exists. Backend query: `SELECT * FROM provider_promotions WHERE provider_id = :id AND is_active = true AND valid_until > now() LIMIT 1`.

Also extend the providers list endpoint ordering: `is_featured = true` rows sort first, then by `rating DESC`. This is a **sort-order change only** — no field is removed from the response.

---

### 2.9 APScheduler Jobs (extend `services/scheduler.py`)

Add two new jobs alongside the existing points decay job. Do not modify the existing decay job.

**Job 1: Booking reminders** — runs every hour.

```python
# Pseudocode
def send_booking_reminders():
    # Find bookings starting in 20-28 hours with payment_status = 'success'
    # For each, write a user_notifications row (type = "booking_reminder")
    # and send a Telegram bot message via telegram_notify.py
    # Track which bookings have been reminded to avoid duplicates
    # (add `reminder_sent BOOLEAN DEFAULT false` column to bookings table)
```

Add to migration: `ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;`

**Job 2: Challenge expiry** — runs daily at midnight UTC.

```python
# Pseudocode
def expire_challenges():
    # Find challenges where ends_at < now() and is_active = true
    # Set is_active = false
    # For members who completed the challenge, they already have their points (awarded on check-in)
    # Write a summary notification to all community members with the results
```

---

## 3. Backend: Models and Schemas

### 3.1 `backend/app/models/provider_event.py`

Create a SQLAlchemy ORM model mirroring the `provider_events` table. Follow the exact pattern of the existing `backend/app/models/booking.py`.

### 3.2 `backend/app/models/community_challenge.py`

SQLAlchemy ORM for `community_challenges` and `challenge_awards`.

### 3.3 `backend/app/models/user_notification.py`

SQLAlchemy ORM for `user_notifications`.

### 3.4 `backend/app/models/provider_subscription.py`

SQLAlchemy ORM for `provider_subscriptions`.

### 3.5 Pydantic Schemas

For each new model, create a corresponding Pydantic schema file in `backend/app/schemas/` following the existing patterns in `backend/app/schemas/booking.py`. Each schema file should define:
- A `Create` schema (request body for POST)
- A `Response` schema (response body)
- A `ListResponse` schema (wraps a list + count)

---

## 4. Frontend: New Routes and Components

### 4.1 Route Table Additions

Add to the React Router config. Do not remove or rename any existing routes.

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/users/me/bookings` | `MyBookings` | Yes | User's booking history and upcoming sessions |
| `/notifications` | `NotificationInbox` | Yes | In-app notification centre |
| `/subscriptions` | `SubscriptionPlans` | Yes | Provider subscription plan picker |
| `/subscriptions/pay` | `SubscriptionPayment` | Yes | Payment flow for subscriptions |
| `/events` | Embedded in Explore | Yes | Events sub-tab (not a standalone page) |

---

### 4.2 Home Screen — "Happening Soon" Section

Add a horizontally scrollable card row to the Home screen, positioned **below** the featured providers row and **above** the neighbourhood alert banner.

Data source: `GET /api/events?limit=10&to=<now+7days>`

**EventCard component props:**
```
provider_name: string
service_name: string
starts_at: ISO string (display as "Tomorrow, 7:00 AM" or "Fri, 7:00 AM")
spots_remaining: number
capacity: number
price_etb: number
urgency: "high" | "medium" | "low"
is_boosted: boolean
```

**Urgency colour mapping** (use existing CSS variables):
- `high` → `var(--accent)` (#F5A623 gold) with "🔥 X spots left" label
- `medium` → `var(--secondary)` (#10B981 green) with "X spots left" label
- `low` → `var(--text-secondary)` with no urgency label

**Boosted events** show a "⭐ Featured" badge in the top-left of the card.

Tapping an EventCard opens the provider detail page with the event pre-selected for booking (pass `event_id` as a query param: `/providers/:provider_id?event_id=:event_id`).

---

### 4.3 Explore Screen — Events Sub-Tab

Add a tab switcher at the top of the existing Explore screen:

```
[ Studios ]  [ Events ]
```

"Studios" = existing provider grid (unchanged).

"Events" tab:
- Fetches `GET /api/events?page=1` with filter controls (Category dropdown, Date range picker — basic: Today / This Week / This Month)
- Renders a vertical list of EventCards (full-width, not a horizontal scroll)
- Infinite scroll / "Load more" pagination using the `page` query param

---

### 4.4 Provider Detail Page — Events Section

Below the existing services list, add an "Upcoming Sessions" section.

Data source: `GET /api/providers/:id/events`

Renders a vertical list of upcoming event slots. Each row shows:
- Date and time (formatted in local timezone)
- Duration (computed from `ends_at - starts_at`)
- Price in ETB
- Spots remaining (with urgency colour)
- "Book This Session" CTA button

Tapping "Book This Session" opens the existing booking flow (Step 1: service pre-filled from the event, Step 2: date/time pre-filled and non-editable, Step 3: payment). Pass `event_id` through the booking flow state so the POST body includes it.

---

### 4.5 Community Detail Screen — New Sections

Add three new sections to the existing community detail screen, below the live feed:

**Section A: Active Challenge Banner**

Data source: `GET /api/communities/:id/challenges`

If an active challenge exists, show a card:
```
🏆 5-day streak challenge
Check in 5 times this week to earn 50 points.
Your progress: ●●●○○  (3 of 5)
Ends: Sunday
```

If `user_progress.completed = true`, show a "✓ Completed — +50 points earned" state instead.

If no active challenge, do not render this section.

**Section B: Community Leaderboard**

Data source: `GET /api/communities/:id/leaderboard?period=week`

Show a period toggle (Week / Month / All Time) at the top. Below it, a ranked list of up to 10 members. Highlight the current user's row with a subtle background. If the current user is not in the top 10, show their rank below the list as a separate row.

**Section C: Upcoming Events from this Provider**

Data source: `GET /api/providers/:provider_id/events?limit=3` (use the `provider_id` from the community's linked provider)

Shows the next 3 upcoming events as compact rows. "See all" link navigates to the provider detail page.

---

### 4.6 My Bookings Screen (`/users/me/bookings`)

New screen accessible from the Profile tab (add "My Bookings" row in the Profile menu list, below the existing Joined Communities section).

Data source: `GET /api/users/me/bookings`

**Layout:**

```
[ Upcoming ]  [ Past ]  [ Cancelled ]
```

Each booking card shows:
- Provider cover photo (thumbnail, left-aligned)
- Provider name + service name
- Date and time (formatted)
- Payment status badge (success = green, pending = amber, failed = red)
- "Add to Calendar" link (generates a Google Calendar deep-link: `https://calendar.google.com/calendar/r/eventedit?text=...&dates=...&details=...` — pure frontend, no backend)
- "View Provider" link

Empty state: "No upcoming bookings. Browse providers to get started." with a CTA to `/providers`.

---

### 4.7 Notification Centre (`/notifications`)

Add a bell icon to the top-right of the Home screen header. Show a red badge with unread count when `unread_count > 0`.

Data source: `GET /api/users/me/notifications?limit=30`

Tapping the bell navigates to `/notifications`.

**Notification list:**
- Each row shows the notification `title`, `body` (truncated at 80 chars), and relative timestamp ("2 hours ago").
- Unread rows have a distinct left border: `border-left: 3px solid var(--accent)`.
- Tapping a row marks it as read (`POST /api/users/me/notifications/:id/read`) and navigates to `action_url`.
- "Mark all as read" button at the top right.

Polling: call `GET /api/users/me/notifications?unread=true&limit=1` every 30 seconds to update the bell badge count. Do not poll the full list — only the unread count.

---

### 4.8 Provider Dashboard — Schedule Tab

Add a "Schedule" tab to the existing provider dashboard tab bar (alongside the existing Analytics and Products tabs).

Data source: `GET /api/providers/me/events?from=now`

**Tab contents:**
- "Create Event" button at top right → opens a modal/bottom sheet with the event creation form
- List of upcoming events as cards, each showing: service name, date/time, capacity fill bar (e.g. "7/10 booked"), price, and action buttons: Edit / Cancel
- Cancelled events shown in a muted style at the bottom with a "Cancelled" badge

**Event creation form fields:**
- Service name (text input or dropdown from provider's existing `services` array)
- Date (date picker)
- Start time / End time (time pickers)
- Capacity (number input, default 10)
- Price in ETB (pre-filled from the matched service if selected from dropdown)
- Description (optional text area)

On submit: `POST /api/providers/me/events` → on success, refresh the events list.

**Capacity fill bar:** A simple progress bar using inline styles. Colour transitions from `var(--secondary)` (green, low fill) to `var(--accent)` (gold, high fill) at 70%+ capacity.

---

### 4.9 Provider Onboarding — Subscription Step

**Modify the existing `/provider-onboard` multi-step form (non-breaking):**

After the current Step 4 (Review & Submit), add a **Step 5: Choose a Plan**.

> Note: This means the step count in the stepper UI increments from 3 steps to 4. Update the step indicator accordingly.

Data source: `GET /api/subscriptions/plans`

Step 5 layout:
```
CHOOSE YOUR PLAN (4/4)

[ Starter — ETB 500/mo ]
  1 community · Basic dashboard · 5 events/mo

[ Growth — ETB 1,500/mo ]   ← Recommended badge
  3 communities · Full analytics · Products store

[ Pro — ETB 3,000/mo ]
  Featured placement · Unlimited events · Boost credits

Selected: Growth
Phone for payment: [0911234567]
Payment method: [ Telebirr ]  [ M-Pesa ]

[< Back]  [Pay & Launch →]
```

On "Pay & Launch":
1. Call `POST /api/subscriptions/initiate` with selected plan, payment method, phone.
2. Open `to_pay_url` via `Telegram.WebApp.openLink()` (same as booking payment flow).
3. Poll `GET /api/subscriptions/status/:id` every 3 seconds.
4. On `status = 'active'`, navigate to the provider dashboard with a success toast: "Your listing is live! 🎉".

The existing invite-code path (`POST /api/providers/self-onboard`) remains unchanged for admin-invited providers who skip payment.

---

### 4.10 Explore Screen — Provider Card Enhancements

**Add to existing ProviderCard component (non-breaking — additive renders only):**

1. If `is_featured = true`: show a "⭐ Featured" banner across the top of the card image.
2. If `active_promotion` is non-null: show a gold pill badge below the provider name: e.g. "🏷 First session free this weekend".
3. If `subscription_plan = 'pro'`: show a small "PRO" badge next to the provider name.

None of these changes affect providers where these fields are null/false — their cards render identically to the current implementation.

---

### 4.11 Points Narrative Enhancements on Profile Screen

**Add to the existing Profile screen (the points/tier section):**

1. **Progress to next tier:** Below the tier badge, add a progress bar and label:
   - "180 points to Grove 🌳" (compute: `next_tier_threshold - current_balance`)
   - Progress bar width: `(current_balance - current_tier_min) / (next_tier_max - current_tier_min) * 100%`
   - At Forest tier (700+), show "Max tier reached 🌲" instead
2. **Unblock Redeem button:** Change the existing greyed-out "Redeem Points (Coming Soon)" to an active button navigating to `/products`. The products store was shipped in Phase 2.
3. **Points explainer modal:** Add a ⓘ icon next to "Legacy Points". Tapping it opens a bottom sheet:
   ```
   How you earn points:
   ✓ Daily check-in: +10 pts
   ✓ Booking a session: +50 pts
   ✓ Completing a challenge: varies

   Points decay -5/day after 3 inactive days.

   Spend points in the Products Store.
   ```

---

### 4.12 CSS and Theme

All new components must use only the existing CSS variables defined in `index.css`. Do not introduce new colour values. The variables are:

```css
--accent: #F5A623
--secondary: #10B981
--bg-primary: #0A0A0F
--bg-card: #18181F
--text-primary: #F5F5F7
--text-secondary: #9CA3AF
--radius-md: 12px
--radius-lg: 16px
--shadow-md: 0 4px 16px rgba(0,0,0,0.5)
```

All new screens must be responsive down to 320px (Telegram Mini App minimum). Follow the mobile-first pattern of existing screens.

---

## 5. Telegram Bot Updates

### 5.1 Booking Reminder Messages

In `telegram-bot/bot/handlers/` add `reminders.py`. This is triggered by the APScheduler job in the backend (Section 2.9, Job 1). The backend calls the Telegram bot API directly (via `telegram_notify.py`) rather than the bot polling for jobs.

Message template:
```
⏰ REMINDER

Your [service_name] at [provider_name] is tomorrow at [time].

Don't forget! Your community is counting on you. 💪

[Open Well Circle]
```

The "Open Well Circle" button is a `WebApp` button linking to `/users/me/bookings` (the new bookings screen).

### 5.2 Challenge Notifications

When a user completes a challenge, the backend writes a Telegram message via `telegram_notify.py`:

```
🏆 CHALLENGE COMPLETE

You finished "[challenge_title]"!

+[reward_points] Legacy Points have been added to your balance.

New balance: [new_balance] 🌿

[Open Well Circle]
```

No changes to existing bot command handlers (`/start`, `/admin`).

---

## 6. API Contract Addendum

This section documents all new endpoints for the frontend team. Append this to the existing `API_CONTRACT.md` as **Section 12**.

### New Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events` | JWT | All upcoming events (discovery) |
| GET | `/providers/:id/events` | JWT | Events for a specific provider |
| POST | `/providers/me/events` | JWT (provider) | Create a scheduled event |
| PATCH | `/providers/me/events/:id` | JWT (provider) | Update or cancel an event |
| POST | `/admin/providers/:id/events/:event_id/boost` | JWT (admin) | Boost an event |
| GET | `/users/me/bookings` | JWT | User's booking history |
| GET | `/communities/:id/challenges` | JWT | Active challenges for a community |
| POST | `/providers/me/communities/:id/challenges` | JWT (provider) | Create a challenge |
| GET | `/communities/:id/leaderboard` | JWT | Community leaderboard |
| GET | `/users/me/notifications` | JWT | Notification inbox |
| POST | `/users/me/notifications/:id/read` | JWT | Mark notification read |
| POST | `/users/me/notifications/read-all` | JWT | Mark all read |
| GET | `/subscriptions/plans` | None | Available subscription plans |
| POST | `/subscriptions/initiate` | JWT | Initiate subscription payment |
| GET | `/subscriptions/status/:id` | JWT | Poll subscription payment status |
| POST | `/providers/me/promotions` | JWT (provider) | Create a promotional offer |

### Extended Existing Endpoints

| Endpoint | What Changed |
|----------|--------------|
| `POST /bookings` | Added optional `event_id` field |
| `GET /providers` | Added `is_featured`, `subscription_plan`, `active_promotion` fields |
| `GET /providers/:id` | Same additions as above |
| `POST /communities/:id/checkin` | Now also checks challenge completion and awards bonus points |

---

## 7. Implementation Order and Dependencies

Execute in this order to avoid dependency failures:

**Step 1 — Database (no code dependencies):**
Run the Alembic migration `002_phase3_schema.py`. All new tables and column additions are independent of code changes.

**Step 2 — Backend models and schemas:**
Add all new SQLAlchemy models and Pydantic schemas. No endpoint logic yet — just the data layer. This unblocks all subsequent backend work.

**Step 3 — Events API and booking extension:**
Implement `events.py` and extend the booking handler. This is the highest-impact backend change and unblocks the frontend Events tab and the "Happening Soon" section.

**Step 4 — Notifications API:**
Implement `notifications.py`. Then wire notification writes into the booking confirmation handler and any other trigger points.

**Step 5 — Challenges API and leaderboard:**
Implement `challenges.py` and the leaderboard endpoint. Extend the existing checkin handler with challenge completion logic.

**Step 6 — Subscriptions API:**
Implement `subscriptions.py`. Reuse existing payment service code. Wire into the payment callbacks.

**Step 7 — Frontend: Home and Explore screen updates:**
"Happening Soon" section, Events sub-tab. Depends on Step 3.

**Step 8 — Frontend: Community detail additions:**
Challenge banner, leaderboard, upcoming events section. Depends on Steps 3, 4, 5.

**Step 9 — Frontend: My Bookings and Notifications:**
New screens. Depends on Steps 3, 4.

**Step 10 — Frontend: Provider dashboard Schedule tab:**
Depends on Step 3.

**Step 11 — Frontend: Provider onboarding subscription step:**
Depends on Step 6.

**Step 12 — Frontend: Card and Profile enhancements:**
Purely additive UI changes. Depends on Step 6 (for featured flags) but can be stubbed without it.

**Step 13 — APScheduler jobs:**
Add to `scheduler.py`. Depends on all backend steps being complete.

**Step 14 — Telegram bot reminders:**
Depends on Step 13.

---

## 8. Non-Goals for This Phase

The following items are explicitly out of scope and must not be implemented:

- Real Apple Health / Google Fit / Garmin data integration (UI mock from Phase 2 remains)
- Refund processing for cancelled bookings (insert TODO comment where relevant)
- Push notifications outside of Telegram bot messages (no FCM/APNs integration)
- Corporate B2B portal
- Tribe Vault / group wallet or payment splitting
- Dynamic neighbourhood alerts (hardcoded banners from Phase 1 remain)
- PDF report generation (placeholder in admin Reports tab remains)
- Subscription renewal reminders or expiry enforcement (subscriptions created; enforcement is Phase 4)

---

## 9. Verification Checklist

After implementation, verify the following before marking Phase 3 complete:

**Events:**
- [ ] Provider can create a scheduled event from the dashboard Schedule tab
- [ ] Event appears in `GET /api/events` with correct `spots_remaining` and `urgency` field
- [ ] "Happening Soon" section renders on Home screen with at least one event
- [ ] Booking with `event_id` decrements `spots_remaining` atomically
- [ ] Cancelling a booking-linked event writes notifications to affected users

**Communities:**
- [ ] Active challenge banner appears on community detail when a challenge exists
- [ ] Checking in while a challenge is active updates `user_progress.checkins_this_period`
- [ ] Completing a challenge (reaching `target_checkins`) awards `reward_points` exactly once
- [ ] Leaderboard renders with correct period filtering

**Bookings:**
- [ ] `GET /api/users/me/bookings` returns correct results filtered by `status`
- [ ] My Bookings screen renders on Profile → My Bookings
- [ ] Confirming a booking payment awards +50 points and writes a notification

**Notifications:**
- [ ] Bell icon on Home shows correct unread badge count
- [ ] Notification inbox lists all notifications for the current user
- [ ] Marking a notification read clears it from the unread count
- [ ] Booking confirmation, points earned, and challenge completed notifications are generated correctly

**Subscriptions:**
- [ ] Plan picker renders correctly on `/subscriptions`
- [ ] Telebirr payment flow completes and activates the subscription
- [ ] Featured provider appears first in Explore after Pro plan activation
- [ ] Provider onboarding Step 5 is reachable and functional

**Existing flows (regression checks):**
- [ ] Auth flow (`/api/auth/telegram`) unchanged
- [ ] Community join / leave / checkin unchanged
- [ ] Products store and redemption unchanged
- [ ] Admin dashboard (providers, analytics) unchanged
- [ ] Provider self-onboarding with invite code unchanged

---

*Well Circle Phase 3 Implementation Plan | June 2026*
