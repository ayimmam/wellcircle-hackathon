# Well Circle — API Contract v1.1

> **Base URL:** `https://<render-host>/api`
> **Auth:** Bearer JWT token in `Authorization` header (except where noted)
> **Content-Type:** `application/json`

---

## Quick Reference

| Area | Method | Endpoint | Auth | Owner |
|------|--------|----------|------|-------|
| Auth | POST | `/auth/telegram` | None | Frontend |
| Bot | POST | `/bot/register` | Bot API Key | Bot |
| Bot | GET | `/bot/inactive-users` | Bot API Key | Bot |
| Users | GET | `/users/me` | JWT | Frontend |
| Users | PATCH | `/users/me` | JWT | Frontend |
| Users | POST | `/users/me/onboard` | JWT | Frontend |
| Users | GET | `/users/me/points-history` | JWT | Frontend |
| Providers | GET | `/providers` | JWT | Frontend |
| Providers | GET | `/providers/:id` | JWT | Frontend |
| Providers | GET | `/providers/:id/stats` | JWT (provider) | Frontend |
| Communities | GET | `/communities` | JWT | Frontend |
| Communities | GET | `/communities/:id` | JWT | Frontend |
| Communities | POST | `/communities/:id/join` | JWT | Frontend |
| Communities | POST | `/communities/:id/leave` | JWT | Frontend |
| Communities | POST | `/communities/:id/checkin` | JWT | Frontend |
| Communities | GET | `/communities/:id/feed` | JWT | Frontend |
| Bookings | POST | `/bookings` | JWT | Frontend |
| Payments | POST | `/payments/telebirr/initiate` | JWT | Frontend |
| Payments | POST | `/payments/telebirr/callback` | None (webhook) | Telebirr |
| Payments | POST | `/payments/mpesa/initiate` | JWT | Frontend |
| Payments | POST | `/payments/mpesa/callback` | None (webhook) | Safaricom |
| Payments | GET | `/payments/:booking_id/status` | JWT | Frontend |
| Admin | GET | `/admin/analytics` | JWT (admin) | Frontend |
| Admin | GET | `/admin/users` | JWT (admin) | Frontend |
| Admin | GET | `/admin/users/:telegram_id` | JWT (admin) | Frontend |
| Admin | POST | `/admin/providers` | JWT (admin) | Frontend |
| Admin | PUT | `/admin/providers/:id` | JWT (admin) | Frontend |
| Admin | DELETE | `/admin/providers/:id` | JWT (admin) | Frontend |

---

## 1. Auth

### `POST /api/auth/telegram`
Authenticate via Telegram Mini App `initData`. Creates user if first login.

**No auth required.**

```json
// REQUEST
{
  "init_data": "query_id=AAH...&user=%7B%22id%22%3A123456..."
}

// RESPONSE 200
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-string",
    "telegram_id": 123456789,
    "telegram_handle": "meron_fitness",
    "name": "Meron Tadesse",
    "photo_url": "https://t.me/i/userpic/...",
    "goal": "Lose weight and stay consistent",
    "interest_category": "yoga",
    "exercise_frequency": "sometimes",
    "points_balance": 120,
    "tier": "sprout",
    "tier_emoji": "🌿",
    "is_onboarded": true,
    "is_provider": false,
    "is_super_admin": false,
    "location_neighborhood": "Bole",
    "health_app_connected": false,
    "joined_communities": ["uuid-1", "uuid-2"],
    "created_at": "2026-06-06T10:00:00Z"
  },
  "is_new_user": false
}
```

**Frontend logic:**
- On Mini App load: `const initData = window.Telegram.WebApp.initData`
- POST to this endpoint → store token in memory/localStorage
- If `user.is_onboarded === false` → show onboarding flow
- If `user.is_onboarded === true` → go to Home screen

---

## 2. Bot Endpoints

### `POST /api/bot/register`
Called by Telegram bot on `/start`. Creates minimal user record.

**Auth: `X-Bot-API-Key` header** (shared secret, not JWT)

```json
// REQUEST
{
  "telegram_id": 123456789,
  "telegram_handle": "meron_fitness",
  "photo_url": "https://t.me/i/userpic/..."
}

// RESPONSE 200
{
  "id": "uuid-string",
  "telegram_id": 123456789,
  "telegram_handle": "meron_fitness",
  "is_onboarded": false,
  "created": true  // false if user already existed
}
```

### `GET /api/bot/inactive-users`
Returns users inactive for 7+ days (for re-engagement notifications).

**Auth: `X-Bot-API-Key` header**

```json
// RESPONSE 200
{
  "inactive_users": [
    {
      "telegram_id": 123456789,
      "name": "Meron Tadesse",
      "telegram_handle": "meron_fitness",
      "last_activity_at": "2026-05-28T14:00:00Z",
      "days_inactive": 9
    }
  ],
  "count": 1
}
```

---

## 3. Users

### `GET /api/users/me`
Get current user's full profile.

```json
// RESPONSE 200
{
  "id": "uuid-string",
  "telegram_id": 123456789,
  "telegram_handle": "meron_fitness",
  "name": "Meron Tadesse",
  "photo_url": "https://t.me/i/userpic/...",
  "goal": "Lose weight and stay consistent",
  "interest_category": "yoga",
  "exercise_frequency": "sometimes",
  "points_balance": 120,
  "tier": "sprout",
  "tier_emoji": "🌿",
  "is_onboarded": true,
  "is_provider": false,
  "is_super_admin": false,
  "location_neighborhood": "Bole",
  "health_app_connected": false,
  "joined_communities": ["uuid-1", "uuid-2"],
  "created_at": "2026-06-06T10:00:00Z"
}
```

### `POST /api/users/me/onboard`
Complete Mini App onboarding. Sets `is_onboarded = true`.

```json
// REQUEST
{
  "name": "Meron Tadesse",
  "goal": "Lose weight and stay consistent",   // OPTIONAL
  "interest_category": "yoga",                  // REQUIRED: yoga|gym|nutrition|spa|therapy|running
  "exercise_frequency": "sometimes",            // REQUIRED: never|rarely|sometimes|regular|daily
  "suggested_circle_ids": ["uuid-1"]            // OPTIONAL: auto-join these communities
}

// RESPONSE 200
{
  "id": "uuid-string",
  "telegram_id": 123456789,
  "name": "Meron Tadesse",
  "interest_category": "yoga",
  "exercise_frequency": "sometimes",
  "is_onboarded": true,
  "auto_joined_communities": ["uuid-1"],
  "suggested_communities": [
    {
      "id": "uuid-2",
      "name": "Bole Yoga Circle",
      "category": "yoga",
      "member_count": 24,
      "provider_name": "Zen Yoga Studio"
    }
  ]
}
```

**Validation errors → 422:**
```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

### `PATCH /api/users/me`
Update profile fields (personalization, neighborhood opt-in).

```json
// REQUEST (all fields optional)
{
  "name": "Meron T.",
  "goal": "Updated goal",
  "location_neighborhood": "Bole",
  "health_app_connected": true
}

// RESPONSE 200 — same as GET /users/me
```

### `GET /api/users/me/points-history`
Last 20 points transactions.

```json
// RESPONSE 200
{
  "items": [
    {
      "action": "checkin",
      "points": 10,
      "community_name": "Bole Runners",
      "created_at": "2026-06-06T08:30:00Z"
    },
    {
      "action": "decay",
      "points": -5,
      "community_name": null,
      "created_at": "2026-06-05T00:00:00Z"
    }
  ],
  "current_balance": 120,
  "tier": "sprout",
  "tier_emoji": "🌿"
}
```

**Points tiers:**
| Tier | Range | Emoji |
|------|-------|-------|
| seed | 0–99 | 🌱 |
| sprout | 100–299 | 🌿 |
| grove | 300–699 | 🌳 |
| forest | 700+ | 🌲 |

---

## 4. Providers

### `GET /api/providers`
List all providers. Supports filtering.

**Query params:**
- `category` (optional): `yoga|gym|nutrition|spa|therapy`
- `search` (optional): text search on name/description

```json
// RESPONSE 200
{
  "providers": [
    {
      "id": "uuid-string",
      "name": "Zen Yoga Studio",
      "category": "yoga",
      "description": "Premium yoga studio in Bole...",
      "location_text": "Bole, Addis Ababa",
      "lat": 9.0054,
      "lng": 38.7636,
      "price_range": "ETB 500-2000",
      "rating": 4.7,
      "cover_photo_url": "https://...",
      "member_count": 45,
      "community_id": "uuid-comm"
    }
  ],
  "count": 10
}
```

### `GET /api/providers/:id`
Full provider detail with services, photos, linked community.

```json
// RESPONSE 200
{
  "id": "uuid-string",
  "name": "Zen Yoga Studio",
  "category": "yoga",
  "description": "Premium yoga studio in the heart of Bole...",
  "location_text": "Bole, Addis Ababa",
  "lat": 9.0054,
  "lng": 38.7636,
  "price_range": "ETB 500-2000",
  "rating": 4.7,
  "cover_photo_url": "https://...",
  "photos": [
    "https://photo1.jpg",
    "https://photo2.jpg"
  ],
  "services": [
    {
      "name": "Morning Vinyasa Flow",
      "price": 800,
      "duration": "60 min"
    },
    {
      "name": "Private Session",
      "price": 2000,
      "duration": "90 min"
    }
  ],
  "community": {
    "id": "uuid-comm",
    "name": "Zen Yoga Community",
    "member_count": 45,
    "user_joined": true
  },
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B"
}
```

### `GET /api/providers/:id/stats`
Provider dashboard stats. **Provider-only access.**

```json
// RESPONSE 200
{
  "provider_id": "uuid-string",
  "provider_name": "Zen Yoga Studio",
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B",
  "stats": {
    "total_members": 45,
    "new_members_today": 3,
    "bookings_this_week": 12,
    "estimated_revenue_etb": 14400,
    "checkins_today": 8,
    "engagement_rate": 0.67
  },
  "communities": [
    {
      "id": "uuid-comm",
      "name": "Zen Yoga Community",
      "member_count": 45,
      "checkins_today": 8,
      "engagement_rate": 0.67
    }
  ],
  "recent_bookings": [
    {
      "id": "uuid-booking",
      "user_handle": "meron_fitness",
      "service_name": "Morning Vinyasa Flow",
      "slot_datetime": "2026-06-07T07:00:00Z",
      "amount_etb": 800,
      "payment_status": "success",
      "created_at": "2026-06-06T10:30:00Z"
    }
  ],
  "recent_feed": [
    {
      "user_name": "Meron",
      "user_photo": "https://...",
      "event_type": "join",
      "community_name": "Zen Yoga Community",
      "created_at": "2026-06-06T10:00:00Z"
    }
  ]
}
```

---

## 5. Communities

### `GET /api/communities`
List communities. Supports filtering.

**Query params:**
- `joined` (optional): `true` — only user's joined communities
- `category` (optional): `yoga|gym|nutrition|spa|therapy|running`

```json
// RESPONSE 200
{
  "communities": [
    {
      "id": "uuid-string",
      "name": "Bole Runners",
      "description": "Morning runs around Bole...",
      "category": "running",
      "member_count": 32,
      "provider_name": "FitEthiopia Gym",
      "provider_id": "uuid-prov",
      "user_joined": false
    }
  ],
  "count": 5
}
```

### `GET /api/communities/:id`
Community detail with user's join status.

```json
// RESPONSE 200
{
  "id": "uuid-string",
  "name": "Bole Runners",
  "description": "Morning runs around Bole...",
  "category": "running",
  "member_count": 32,
  "provider": {
    "id": "uuid-prov",
    "name": "FitEthiopia Gym",
    "cover_photo_url": "https://..."
  },
  "user_joined": true,
  "user_checked_in_today": false,
  "created_at": "2026-06-01T00:00:00Z"
}
```

### `POST /api/communities/:id/join`
Join a community. **Idempotent** — safe to call multiple times.

```json
// RESPONSE 200
{
  "community_id": "uuid-string",
  "member_count": 33,
  "joined": true,
  "feed_event": {
    "id": "uuid-event",
    "event_type": "join",
    "user_name": "Meron",
    "created_at": "2026-06-06T10:00:00Z"
  }
}
```

### `POST /api/communities/:id/leave`
Leave a community.

```json
// RESPONSE 200
{
  "community_id": "uuid-string",
  "member_count": 31,
  "left": true
}
```

### `POST /api/communities/:id/checkin`
Daily check-in. **One per day per community.** Awards Legacy Points.

```json
// RESPONSE 200
{
  "points_earned": 10,
  "new_balance": 130,
  "tier": "sprout",
  "tier_emoji": "🌿",
  "feed_event": {
    "id": "uuid-event",
    "event_type": "checkin",
    "user_name": "Meron",
    "created_at": "2026-06-06T08:30:00Z"
  }
}

// RESPONSE 409 — already checked in today
{
  "detail": "Already checked in today"
}
```

### `GET /api/communities/:id/feed`
Live activity feed. Poll every 5 seconds.

**Query params:**
- `since` (optional): ISO timestamp — only events after this time
- `limit` (optional): default 20, max 50

```json
// RESPONSE 200
{
  "events": [
    {
      "id": "uuid-event",
      "event_type": "join",
      "user_name": "Meron",
      "user_photo": "https://t.me/...",
      "event_metadata": null,
      "created_at": "2026-06-06T10:00:00Z"
    },
    {
      "id": "uuid-event-2",
      "event_type": "checkin",
      "user_name": "Abel",
      "user_photo": "https://t.me/...",
      "event_metadata": null,
      "created_at": "2026-06-06T08:30:00Z"
    },
    {
      "id": "uuid-event-3",
      "event_type": "booking",
      "user_name": "Sara",
      "user_photo": null,
      "event_metadata": {
        "service_name": "Morning Yoga",
        "amount": 800
      },
      "created_at": "2026-06-06T07:00:00Z"
    }
  ],
  "count": 3
}
```

**Frontend polling pattern:**
```js
// Poll every 5 seconds for new events
const [lastTimestamp, setLastTimestamp] = useState(null);

useEffect(() => {
  const interval = setInterval(async () => {
    const url = lastTimestamp
      ? `/api/communities/${id}/feed?since=${lastTimestamp}`
      : `/api/communities/${id}/feed`;
    const res = await api.get(url);
    if (res.data.events.length > 0) {
      setEvents(prev => [...res.data.events, ...prev]);
      setLastTimestamp(res.data.events[0].created_at);
    }
  }, 5000);
  return () => clearInterval(interval);
}, [id, lastTimestamp]);
```

---

## 6. Bookings & Payments

### `POST /api/bookings`
Create a booking (payment pending).

```json
// REQUEST
{
  "provider_id": "uuid-string",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-07T07:00:00Z",
  "amount_etb": 800,
  "payment_method": "telebirr",
  "phone_number": "0911234567"
}

// RESPONSE 201
{
  "id": "uuid-booking",
  "provider_id": "uuid-string",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-07T07:00:00Z",
  "amount_etb": 800,
  "payment_method": "telebirr",
  "payment_status": "pending",
  "created_at": "2026-06-06T10:30:00Z"
}
```

### `POST /api/payments/telebirr/initiate`
Initiate Telebirr payment for a booking.

```json
// REQUEST
{
  "booking_id": "uuid-booking"
}

// RESPONSE 200
{
  "booking_id": "uuid-booking",
  "to_pay_url": "https://app.ethiomobilemoney.et/...",
  "trade_no": "WC20260606103000001"
}
```

**Frontend:** Open `to_pay_url` via `Telegram.WebApp.openLink(toPayUrl)`, then poll status.

### `POST /api/payments/mpesa/initiate`
Trigger M-Pesa Daraja STK Push.

```json
// REQUEST
{
  "booking_id": "uuid-booking",
  "phone_number": "254712345678"
}

// RESPONSE 200
{
  "booking_id": "uuid-booking",
  "checkout_request_id": "ws_CO_06062026...",
  "message": "STK Push sent. Check your phone."
}
```

### `GET /api/payments/:booking_id/status`
Poll payment status. **Frontend polls every 3 seconds after initiating.**

```json
// RESPONSE 200
{
  "booking_id": "uuid-booking",
  "payment_status": "pending",
  "payment_method": "telebirr",
  "amount_etb": 800
}

// When payment succeeds:
{
  "booking_id": "uuid-booking",
  "payment_status": "success",
  "payment_method": "telebirr",
  "amount_etb": 800,
  "reference_number": "WC20260606103000001"
}
```

### `POST /api/payments/telebirr/callback` *(webhook — no auth)*
### `POST /api/payments/mpesa/callback` *(webhook — no auth)*
These are called by payment providers directly. Frontend does NOT call these.

---

## 7. Admin (Super Admin Only)

All admin endpoints require JWT from a user whose `telegram_id` is in `SUPER_ADMIN_TELEGRAM_IDS` env var.

### `GET /api/admin/analytics`
Platform-wide analytics.

```json
// RESPONSE 200
{
  "total_users": 156,
  "onboarded_users": 142,
  "total_providers": 8,
  "total_communities": 12,
  "total_bookings": 47,
  "successful_payments": 38,
  "total_revenue_etb": 45600,
  "active_users_7d": 89,
  "new_users_today": 5,
  "top_categories": [
    { "category": "yoga", "count": 48 },
    { "category": "gym", "count": 35 }
  ]
}
```

### `GET /api/admin/users`
List all users with pagination.

**Query params:**
- `page` (default: 1)
- `per_page` (default: 20)
- `search` (optional): search by name or telegram_handle
- `is_onboarded` (optional): `true|false`

```json
// RESPONSE 200
{
  "users": [
    {
      "id": "uuid",
      "telegram_id": 123456789,
      "telegram_handle": "meron_fitness",
      "name": "Meron Tadesse",
      "interest_category": "yoga",
      "exercise_frequency": "sometimes",
      "points_balance": 120,
      "is_onboarded": true,
      "is_provider": false,
      "last_activity_at": "2026-06-06T10:00:00Z",
      "created_at": "2026-06-01T00:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "per_page": 20,
  "pages": 8
}
```

### `GET /api/admin/users/:telegram_id`
Get a specific user by their Telegram ID.

```json
// RESPONSE 200 — same shape as single user above with full detail
```

### `POST /api/admin/providers`
Create/onboard a new provider.

```json
// REQUEST
{
  "name": "Zen Yoga Studio",
  "category": "yoga",
  "description": "Premium yoga in Bole",
  "location_text": "Bole, Addis Ababa",
  "lat": 9.0054,
  "lng": 38.7636,
  "price_range": "ETB 500-2000",
  "rating": 4.7,
  "cover_photo_url": "https://...",
  "photos": ["https://photo1.jpg"],
  "services": [
    { "name": "Morning Vinyasa Flow", "price": 800, "duration": "60 min" },
    { "name": "Private Session", "price": 2000, "duration": "90 min" }
  ],
  "owner_telegram_id": 123456789,
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B",
  "create_community": true,
  "community_name": "Zen Yoga Community"
}

// RESPONSE 201
{
  "provider": { ... },
  "community": { "id": "uuid", "name": "Zen Yoga Community" }
}
```

### `PUT /api/admin/providers/:id`
Update a provider. Same body as POST (all fields optional).

### `DELETE /api/admin/providers/:id`
Delete a provider and its linked community.

```json
// RESPONSE 200
{ "deleted": true, "provider_id": "uuid" }
```

---

## 8. Enums & Constants

### Interest Categories
```
yoga | gym | nutrition | spa | therapy | running
```

### Exercise Frequency
```
never | rarely | sometimes | regular | daily
```

Display labels:
| Value | Display |
|-------|---------|
| never | Never |
| rarely | Rarely (1-2x/month) |
| sometimes | Sometimes (1-2x/week) |
| regular | Regular (3-4x/week) |
| daily | Daily |

### Points Tiers
| Tier | Range | Emoji |
|------|-------|-------|
| seed | 0–99 | 🌱 |
| sprout | 100–299 | 🌿 |
| grove | 300–699 | 🌳 |
| forest | 700+ | 🌲 |

### Neighborhoods (for local alerts)
```
Bole | Kazanchis | Piassa | CMC | Sarbet | Megenagna | Other
```

### Hardcoded Alert Banners (frontend — per neighborhood)
```json
{
  "Bole": "New yoga session opening in Bole this Saturday — 3 spots left.",
  "Kazanchis": "A new gym near Kazanchis is offering free first-week trial.",
  "Piassa": "Nutritionist in Piassa offering 20% off this weekend.",
  "CMC": "Running group forming near CMC — join your neighbors!",
  "Sarbet": "Spa day deal in Sarbet — book before Friday.",
  "Megenagna": "Free outdoor fitness class this Sunday at Megenagna.",
  "Other": "Check out trending wellness providers near you."
}
```

---

## 9. Error Responses

All errors follow this shape:

```json
// 401 Unauthorized
{ "detail": "Could not validate credentials" }

// 403 Forbidden
{ "detail": "Provider access required" }
// or
{ "detail": "Super admin access required" }

// 404 Not Found
{ "detail": "Provider not found" }

// 409 Conflict
{ "detail": "Already checked in today" }
// or
{ "detail": "Already a member of this community" }

// 422 Validation Error
{
  "detail": [
    { "loc": ["body", "name"], "msg": "Field required", "type": "missing" }
  ]
}
```

---

## 10. Frontend Flow Summary

```
Telegram Bot /start
    ↓
Bot calls POST /api/bot/register (telegram_id + handle)
    ↓
Bot shows "Open Well Circle" WebApp button
    ↓
User taps button → Mini App opens
    ↓
Mini App reads Telegram.WebApp.initData
    ↓
POST /api/auth/telegram → get JWT + user object
    ↓
if user.is_onboarded === false:
    → Show Onboarding Flow:
        1. Enter name (required)
        2. Set goal (optional)
        3. Pick interest_category (required)
        4. Pick exercise_frequency (required)
        5. Suggest circles based on interest (optional join)
    → POST /api/users/me/onboard
    ↓
Home Screen (authenticated, onboarded)
    ↓
Tab Navigation: Home | Explore | Community | Profile
```

### Provider Dashboard Flow
```
Provider user → same auth flow
    ↓
if user.is_provider === true:
    → Show Provider Dashboard tab/route
    → GET /api/providers/:id/stats (poll for live updates)
    → Apply theme_primary_color + theme_accent_color to dashboard
```

### Admin Dashboard Flow
```
Admin user → same auth flow
    ↓
if user.is_super_admin === true OR telegram_id in SUPER_ADMIN_TELEGRAM_IDS:
    → Show Admin route (/admin/*)
    → GET /api/admin/analytics
    → CRUD providers, view users
```

---

## 11. CORS & Headers

**Allowed origins** (configurable via env):
- `http://localhost:5173` (dev)
- `https://web.telegram.org`
- Your Vercel frontend URL

**Required headers for authenticated requests:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Bot-specific header:**
```
X-Bot-API-Key: <shared-secret>
```
