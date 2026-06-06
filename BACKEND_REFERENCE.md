# Well Circle — Backend Reference for Frontend Team

> **Base URL:** `https://your-backend.onrender.com/api`
> **Auth:** `Authorization: Bearer <JWT>` on all routes except auth + payment callbacks
> **API Docs (live):** `https://your-backend.onrender.com/docs`

---

## 📂 Backend Project Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI entry point + CORS + router registration
│   ├── config.py              # Pydantic settings (env vars)
│   ├── database.py            # SQLAlchemy engine + Supabase PostgreSQL
│   ├── dependencies.py        # JWT auth, role checks, bot API key
│   │
│   ├── api/                   # Route handlers (your endpoints)
│   │   ├── auth.py            # POST /api/auth/telegram
│   │   ├── users.py           # GET/PATCH /api/users/me + onboarding
│   │   ├── providers.py       # GET /api/providers (browse + detail)
│   │   ├── communities.py     # Join, leave, checkin, feed
│   │   ├── bookings.py        # POST /api/bookings
│   │   ├── payments.py        # Telebirr + M-Pesa initiate/callback/status
│   │   ├── admin.py           # Super admin CRUD + analytics
│   │   └── bot.py             # Bot registration + re-engagement
│   │
│   ├── models/                # SQLAlchemy ORM (database tables)
│   │   ├── user.py            # users table
│   │   ├── provider.py        # providers table
│   │   ├── community.py       # communities + community_members + community_feed_events
│   │   └── booking.py         # bookings table
│   │
│   ├── schemas/               # Pydantic validation (request/response shapes)
│   │   ├── user.py            # Auth, onboarding, profile, points
│   │   ├── provider.py        # Provider list, detail, dashboard stats
│   │   ├── community.py       # Community list, detail, feed, join/leave/checkin
│   │   ├── booking.py         # Booking create, payment initiation, status
│   │   └── admin.py           # Platform analytics, admin user list
│   │
│   ├── crud/                  # Database operations
│   │   ├── user.py            # User find/create/onboard/update/tiers
│   │   ├── provider.py        # Provider CRUD + dashboard stats
│   │   ├── community.py       # Join/leave/checkin/feed/suggestions
│   │   └── booking.py         # Booking create + payment update
│   │
│   ├── services/              # Business logic
│   │   ├── telegram_auth.py   # Telegram initData HMAC validation
│   │   ├── telebirr_payment.py # Telebirr Open API integration
│   │   ├── mpesa_payment.py   # M-Pesa Daraja STK Push
│   │   ├── points_engine.py   # Tier calculation + decay constants
│   │   └── scheduler.py       # APScheduler (points decay daily)
│   │
│   └── db/seed.py             # Test user seeder (6 users)
│
├── requirements.txt
├── Procfile                   # Render deployment
└── .env.example
```

---

## 🗄️ Database Tables (Supabase PostgreSQL)

### `users`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | Auto-generated |
| `telegram_id` | BigInteger | ❌ | Unique, indexed. From Telegram |
| `telegram_handle` | String(255) | ✅ | @username |
| `name` | String(255) | ✅ | Set during onboarding |
| `goal` | Text | ✅ | **Only optional onboarding field** |
| `interest_category` | String(50) | ✅ | yoga\|gym\|nutrition\|spa\|therapy\|running |
| `exercise_frequency` | String(50) | ✅ | never\|rarely\|sometimes\|regular\|daily |
| `photo_url` | String(500) | ✅ | Telegram profile photo |
| `points_balance` | Integer | ❌ | Default: 0 |
| `last_checkin_at` | DateTime | ✅ | Last daily check-in |
| `last_activity_at` | DateTime | ✅ | Updated on every authenticated request |
| `is_onboarded` | Boolean | ❌ | Default: false |
| `is_provider` | Boolean | ❌ | Default: false |
| `is_super_admin` | Boolean | ❌ | Default: false |
| `location_neighborhood` | String(100) | ✅ | Bole, Kazanchis, etc. |
| `health_app_connected` | Boolean | ❌ | Default: false |
| `created_at` | DateTime | ❌ | Auto |
| `updated_at` | DateTime | ❌ | Auto |

### `providers`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | Auto-generated |
| `name` | String(255) | ❌ | |
| `category` | String(50) | ❌ | gym\|yoga\|nutrition\|spa\|therapy |
| `description` | Text | ✅ | |
| `location_text` | String(255) | ✅ | e.g. "Bole, Addis Ababa" |
| `lat` | Float | ✅ | Latitude |
| `lng` | Float | ✅ | Longitude |
| `price_range` | String(100) | ✅ | e.g. "ETB 500-5000" |
| `rating` | Float | ✅ | 0-5 |
| `cover_photo_url` | String(500) | ✅ | |
| `photos` | JSONB | ✅ | Array of photo URLs (max 5) |
| `services` | JSONB | ✅ | `[{name, price, duration}]` |
| `owner_user_id` | UUID FK→users | ✅ | Provider owner |
| `theme_primary_color` | String(7) | ✅ | Hex, default `#10B981` |
| `theme_accent_color` | String(7) | ✅ | Hex, default `#F59E0B` |
| `created_at` | DateTime | ❌ | Auto |
| `updated_at` | DateTime | ❌ | Auto |

### `communities`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | Auto-generated |
| `provider_id` | UUID FK→providers | ❌ | |
| `name` | String(255) | ❌ | |
| `description` | Text | ✅ | |
| `category` | String(50) | ✅ | Inherited from provider |
| `member_count` | Integer | ❌ | Denormalized, default: 0 |
| `created_at` | DateTime | ❌ | Auto |

### `community_members` (join table)
| Column | Type | Notes |
|--------|------|-------|
| `community_id` | UUID FK→communities | Composite PK |
| `user_id` | UUID FK→users | Composite PK |
| `joined_at` | DateTime | Auto |

### `community_feed_events`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | Auto-generated |
| `community_id` | UUID FK→communities | ❌ | Indexed |
| `user_id` | UUID FK→users | ❌ | |
| `event_type` | String(50) | ❌ | `join` \| `checkin` \| `booking` |
| `event_metadata` | JSONB | ✅ | `{service_name, amount}` for bookings |
| `created_at` | DateTime | ❌ | Indexed, auto |

### `bookings`
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | Auto-generated |
| `user_id` | UUID FK→users | ❌ | Indexed |
| `provider_id` | UUID FK→providers | ❌ | Indexed |
| `service_name` | String(255) | ❌ | |
| `slot_datetime` | DateTime | ❌ | |
| `amount_etb` | Integer | ❌ | Amount in ETB |
| `payment_method` | String(50) | ❌ | `telebirr` \| `mpesa` |
| `payment_status` | String(50) | ❌ | `pending` \| `success` \| `failed` |
| `telebirr_trade_no` | String(255) | ✅ | Unique |
| `mpesa_checkout_id` | String(255) | ✅ | |
| `phone_number` | String(20) | ✅ | |
| `created_at` | DateTime | ❌ | Auto |

---

## 🔑 Enums & Constants

### Interest Categories
```
yoga | gym | nutrition | spa | therapy | running
```

### Exercise Frequency
```
never | rarely | sometimes | regular | daily
```

### Points Tiers
| Tier | Points Range | Emoji |
|------|-------------|-------|
| seed | 0-99 | 🌱 |
| sprout | 100-299 | 🌿 |
| grove | 300-699 | 🌳 |
| forest | 700+ | 🌲 |

### Points System
- **Check-in:** +10 points per community per day
- **Decay:** -5 points/day after 3 consecutive inactive days
- **Max check-ins:** 1 per community per day

### Neighborhoods (for personalized alerts)
```
Bole | Kazanchis | Piassa | CMC | Sarbet | Megenagna | Other
```

---

## 🔌 All API Endpoints

### 1. Authentication
```
POST /api/auth/telegram
```
**Request:**
```json
{ "init_data": "query_id=...&user=%7B%22id%22%3A12345...&hash=..." }
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "uuid",
    "telegram_id": 12345,
    "telegram_handle": "@username",
    "name": "Meron",
    "photo_url": "https://...",
    "goal": "Stay fit",
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

---

### 2. Users

#### Get Profile
```
GET /api/users/me
Authorization: Bearer <token>
```
**Response:** Same `UserResponse` as above.

#### Complete Onboarding
```
POST /api/users/me/onboard
Authorization: Bearer <token>
```
**Request:**
```json
{
  "name": "Meron Tadesse",
  "goal": "Stay healthy",
  "interest_category": "yoga",
  "exercise_frequency": "sometimes",
  "suggested_circle_ids": ["uuid-1"]
}
```
> `goal` is the only optional field. Everything else is required.

**Response:**
```json
{
  "id": "uuid",
  "telegram_id": 12345,
  "name": "Meron Tadesse",
  "interest_category": "yoga",
  "exercise_frequency": "sometimes",
  "is_onboarded": true,
  "auto_joined_communities": ["uuid-1"],
  "suggested_communities": [
    { "id": "uuid-2", "name": "Zen Yoga", "category": "yoga", "member_count": 42, "provider_name": "Zen Studio" }
  ]
}
```

#### Update Profile
```
PATCH /api/users/me
Authorization: Bearer <token>
```
**Request (all fields optional):**
```json
{
  "name": "New Name",
  "goal": "Updated goal",
  "location_neighborhood": "Bole",
  "health_app_connected": true
}
```

#### Points History
```
GET /api/users/me/points-history
Authorization: Bearer <token>
```
**Response:**
```json
{
  "items": [
    { "action": "checkin", "points": 10, "community_name": "Zen Yoga", "created_at": "2026-06-06T08:00:00Z" }
  ],
  "current_balance": 120,
  "tier": "sprout",
  "tier_emoji": "🌿"
}
```

---

### 3. Providers

#### List All
```
GET /api/providers?category=yoga&search=zen
Authorization: Bearer <token>
```
**Response:**
```json
{
  "providers": [
    {
      "id": "uuid", "name": "Zen Yoga Studio", "category": "yoga",
      "description": "Premium yoga in Bole", "location_text": "Bole, Addis Ababa",
      "lat": 9.01, "lng": 38.75, "price_range": "ETB 500-2000",
      "rating": 4.7, "cover_photo_url": "https://...",
      "member_count": 42, "community_id": "uuid"
    }
  ],
  "count": 1
}
```

#### Provider Detail
```
GET /api/providers/{provider_id}
Authorization: Bearer <token>
```
**Response:**
```json
{
  "id": "uuid", "name": "Zen Yoga Studio", "category": "yoga",
  "description": "...", "location_text": "Bole",
  "photos": ["url1", "url2"],
  "services": [
    { "name": "Morning Vinyasa", "price": 800, "duration": "60 min" },
    { "name": "Private Session", "price": 2500, "duration": "90 min" }
  ],
  "community": {
    "id": "uuid", "name": "Zen Yoga Community",
    "member_count": 42, "user_joined": true
  },
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B"
}
```

#### Provider Dashboard (provider-only)
```
GET /api/providers/{provider_id}/stats
Authorization: Bearer <token>  (must be provider)
```
**Response:**
```json
{
  "provider_id": "uuid", "provider_name": "Zen Yoga Studio",
  "theme_primary_color": "#10B981", "theme_accent_color": "#F59E0B",
  "stats": {
    "total_members": 42, "new_members_today": 3,
    "bookings_this_week": 15, "estimated_revenue_etb": 12000,
    "checkins_today": 8, "engagement_rate": 0.19
  },
  "communities": [
    { "id": "uuid", "name": "Zen Yoga", "member_count": 42, "checkins_today": 8, "engagement_rate": 0.19 }
  ],
  "recent_bookings": [
    { "id": "uuid", "user_handle": "@meron", "service_name": "Morning Vinyasa",
      "slot_datetime": "2026-06-07T07:00:00Z", "amount_etb": 800,
      "payment_status": "success", "created_at": "2026-06-06T10:00:00Z" }
  ],
  "recent_feed": [
    { "user_name": "Meron", "event_type": "checkin", "community_name": "Zen Yoga", "created_at": "..." }
  ]
}
```

---

### 4. Communities

#### List All
```
GET /api/communities?joined=true&category=yoga
Authorization: Bearer <token>
```
**Response:**
```json
{
  "communities": [
    {
      "id": "uuid", "name": "Zen Yoga Community", "description": "...",
      "category": "yoga", "member_count": 42,
      "provider_name": "Zen Yoga Studio", "provider_id": "uuid",
      "user_joined": true
    }
  ],
  "count": 1
}
```

#### Community Detail
```
GET /api/communities/{community_id}
```
**Response:**
```json
{
  "id": "uuid", "name": "Zen Yoga Community", "description": "...",
  "category": "yoga", "member_count": 42,
  "provider": { "id": "uuid", "name": "Zen Yoga Studio", "cover_photo_url": "..." },
  "user_joined": true,
  "user_checked_in_today": false,
  "created_at": "2026-06-01T00:00:00Z"
}
```

#### Join / Leave / Check-in
```
POST /api/communities/{community_id}/join     → { community_id, member_count, joined, feed_event }
POST /api/communities/{community_id}/leave    → { community_id, member_count, left }
POST /api/communities/{community_id}/checkin  → { points_earned, new_balance, tier, tier_emoji, feed_event }
```

> **Check-in rules:** Max 1/day per community. Returns `409` if already checked in, `403` if not a member.

#### Community Feed (polling)
```
GET /api/communities/{community_id}/feed?since=2026-06-06T10:00:00Z&limit=20
```
**Response:**
```json
{
  "events": [
    {
      "id": "uuid", "event_type": "checkin",
      "user_name": "Meron", "user_photo": "https://...",
      "event_metadata": null,
      "created_at": "2026-06-06T10:05:00Z"
    }
  ],
  "count": 1
}
```
> **Polling pattern:** Frontend calls every 10-15 seconds with `since` = timestamp of latest event.

---

### 5. Bookings & Payments

#### Create Booking
```
POST /api/bookings
```
**Request:**
```json
{
  "provider_id": "uuid",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-07T07:00:00Z",
  "amount_etb": 800,
  "payment_method": "telebirr",
  "phone_number": "0911234567"
}
```

#### Telebirr Payment
```
POST /api/payments/telebirr/initiate
  → { booking_id, to_pay_url, trade_no }
```
> Redirect user to `to_pay_url` to complete payment.

#### M-Pesa Payment
```
POST /api/payments/mpesa/initiate
  → { booking_id, checkout_request_id, message }
```
> STK Push sent to phone. User confirms on their device.

#### Poll Payment Status
```
GET /api/payments/{booking_id}/status
  → { booking_id, payment_status, payment_method, amount_etb, reference_number }
```
> **Polling pattern:** Call every 3 seconds until `payment_status` is `success` or `failed`.

---

### 6. Admin (Super Admin only)

```
GET    /api/admin/analytics                → PlatformAnalytics
GET    /api/admin/users?page=1&search=...  → Paginated user list
GET    /api/admin/users/{telegram_id}      → Single user by Telegram ID
POST   /api/admin/providers               → Create provider + optional community
PUT    /api/admin/providers/{id}           → Update provider
DELETE /api/admin/providers/{id}           → Delete provider + cascade
```

**Platform Analytics Response:**
```json
{
  "total_users": 150, "onboarded_users": 120,
  "total_providers": 8, "total_communities": 12,
  "total_bookings": 340, "successful_payments": 290,
  "total_revenue_etb": 245000,
  "active_users_7d": 89, "new_users_today": 5,
  "top_categories": [
    { "category": "yoga", "count": 45 },
    { "category": "gym", "count": 38 }
  ]
}
```

---

### 7. Bot Integration (X-Bot-API-Key auth)
```
POST /api/bot/register          → Register user from /start
GET  /api/bot/inactive-users    → Users inactive 7+ days
```
> Frontend team does NOT need these — they're bot-to-backend only.

---

## 🔐 Auth Flow (Frontend Must Implement)

```
1. Telegram.WebApp.initData → POST /api/auth/telegram
2. Response gives you { token, user }
3. Store token in localStorage
4. Send as: Authorization: Bearer <token>
5. If 401 → clear token, re-auth
```

---

## 🌊 User Onboarding Flow

```
Bot /start → captures telegram_id + handle
   ↓
Bot shows "Open Well Circle" button
   ↓
User opens Mini App → auto-auth via initData
   ↓
if (!user.is_onboarded):
   Show onboarding screens:
     1. Name (required)
     2. Goal (optional)
     3. Interest Category (required, pick one)
     4. Exercise Frequency (required, pick one)
     5. Suggested Circles (optional, auto-matched by interest)
   ↓
   POST /api/users/me/onboard
   ↓
Home Screen (browse providers, communities, check in)
```

---

## 📊 Seed Data (6 test users)

| Handle | Name | Interest | Frequency | Points | Tier | Onboarded |
|--------|------|----------|-----------|--------|------|-----------|
| @meron_fitness | Meron Tadesse | yoga | sometimes | 120 | sprout 🌿 | ✅ |
| @abel_run | Abel Kebede | running | regular | 340 | grove 🌳 | ✅ |
| @sara_wellness | Sara Alemayehu | nutrition | rarely | 45 | seed 🌱 | ✅ |
| @dawit_gym | Dawit Hailu | gym | daily | 720 | forest 🌲 | ✅ (provider) |
| @hana_spa | Hana Girma | spa | sometimes | 210 | sprout 🌿 | ✅ |
| @new_user_test | *(none)* | *(none)* | *(none)* | 0 | seed 🌱 | ❌ |

---

**Well Circle Backend v1.1 | All 25 integration tests passing ✅**
