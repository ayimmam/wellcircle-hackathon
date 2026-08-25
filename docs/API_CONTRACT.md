# Well Circle — API Contract v1.2

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
| Bot | GET | `/bot/streaks-at-risk` | Bot API Key | Bot |
| Home | GET | `/home/lite` | JWT | Frontend |
| Home | GET | `/home/bootstrap` | JWT | Frontend |
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
| Events | GET | `/events` | JWT | Frontend |
| Events | GET | `/providers/me/events` | JWT (provider) | Frontend |
| Events | POST | `/providers/me/events` | JWT (provider) | Frontend |
| Challenges | GET | `/communities/:id/challenges` | JWT | Frontend |
| Challenges | POST | `/providers/me/communities/:id/challenges` | JWT (provider) | Frontend |
| Notifications | GET | `/users/me/notifications` | JWT | Frontend |
| Subscriptions | GET | `/subscriptions/plans` | JWT | Frontend |
| Subscriptions | POST | `/subscriptions/initiate` | JWT | Frontend |
| Products | GET | `/products` | JWT | Frontend |
| Products | POST | `/products/:id/redeem` | JWT | Frontend |
| Providers | GET | `/providers/me/customers` | JWT (provider) | Frontend |
| Providers | POST | `/providers/me/customers/:id/award` | JWT (provider) | Frontend |
| Providers | GET | `/providers/me/products/price-suggestion` | JWT (provider) | Frontend |
| Providers | GET | `/providers/me/analytics/points` | JWT (provider) | Frontend |
| Providers | POST | `/providers/me/promotions` | JWT (provider) | Frontend |
| Bot | GET | `/bot/staff-events` | Bot API Key | Bot |
| Bot | POST | `/bot/evidence` | Bot API Key | Bot |
| Bot | GET | `/bot/circle-digests` | Bot API Key | Bot |
| Admin | GET | `/admin/evidence` | JWT (admin) | Frontend |
| Admin | GET | `/admin/evidence/:id/photo` | JWT (admin) | Frontend |
| Admin | POST | `/admin/evidence/:id/review` | JWT (admin) | Frontend |
| Circles | GET | `/circles` | JWT | Frontend |
| Circles | POST | `/circles` | JWT | Frontend |
| Circles | POST | `/circles/:id/join` | JWT | Frontend |
| Circles | GET | `/circles/:id/leaderboard` | JWT | Frontend |
| Circles | POST | `/circles/join-by-code` | JWT | Frontend |
| Circles | GET | `/circles/social-proof/today` | JWT | Frontend |
| Ranks | GET | `/ranks` | JWT | Frontend |
| Feedback | POST | `/feedback` | JWT | Frontend |
| Admin | GET | `/admin/feedback` | JWT (admin) | Frontend |
| Admin | PATCH | `/admin/feedback/:id` | JWT (admin) | Frontend |
| Auth | POST | `/auth/telegram-widget` | None | Provider website |
| Providers | GET | `/providers/me/bookings` | JWT (provider) | Provider website |
| Providers | GET | `/providers/me/analytics/services` | JWT (provider) | Provider website |
| Providers | GET | `/providers/me/analytics/demographics` | JWT (provider) | Provider website |
| Providers | GET | `/providers/me/analytics/timeseries` | JWT (provider) | Provider website |
| Providers | POST | `/providers/me/redemptions/:id/update-status` | JWT (provider) | Provider website |
| Uploads | POST | `/uploads` | JWT | Frontend |
| Users | POST | `/users/:id/follow` | JWT | Frontend |
| Users | DELETE | `/users/:id/follow` | JWT | Frontend |
| Users | GET | `/users/:id/followers` | JWT | Frontend |
| Users | GET | `/users/:id/following` | JWT | Frontend |
| Users | GET | `/users/:id/profile` | JWT | Frontend |
| Trainer | POST | `/trainer/apply` | JWT | Frontend |
| Trainer | GET | `/trainer/status` | JWT | Frontend |
| Admin | GET | `/admin/trainer-verifications` | JWT (admin) | Frontend |
| Admin | POST | `/admin/trainer-verifications/:id/review` | JWT (admin) | Frontend |
| Circles | POST | `/circles/:id/apply-paid` | JWT (owner) | Frontend |
| Circles | POST | `/circles/:id/subscribe` | JWT | Frontend |
| Circles | GET | `/circles/:id/subscriptions/pending` | JWT (owner) | Frontend |
| Circles | POST | `/circles/subscriptions/:id/review` | JWT (owner) | Frontend |
| Circles | GET | `/circles/:id/revenue` | JWT (owner) | Frontend |
| Circles | GET | `/circles/:id/subscription-status` | JWT | Frontend |
| Admin | GET | `/admin/paid-circle-applications` | JWT (admin) | Frontend |
| Admin | POST | `/admin/paid-circle-applications/:id/review` | JWT (admin) | Frontend |
| Strava | GET | `/strava/connect` | JWT | Frontend |
| Strava | GET | `/strava/callback` | None (OAuth redirect) | Strava |
| Strava | POST | `/strava/disconnect` | JWT | Frontend |
| Strava | GET | `/strava/stats` | JWT | Frontend |
| Strava | PATCH | `/strava/visibility` | JWT | Frontend |
| Maintenance | POST | `/cron/maintenance` | `X-Cron-Secret` / Bearer `CRON_SECRET` | Vercel Cron |

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
    "interest_categories": ["yoga", "nutrition"],
    "exercise_frequency": "sometimes",
    "points_balance": 120,
    "tier": "sprout",
    "tier_emoji": "🌿",
    "is_onboarded": true,
    "is_provider": false,
    "is_super_admin": false,
    "location_neighborhood": "Bole",
    "health_app_connected": false,
    "phone_number": null,
    "time_format": null,
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

Each user carries `promo` — the soonest-expiring active discount promotion
they are still eligible for (`null` if none) — so the bot's re-entry nudge can
reference it ("come back and use your discount before it expires") and
deep-link into the Mini App with `?startapp=reentry_promo_{provider_id}`.

```json
// RESPONSE 200
{
  "inactive_users": [
    {
      "telegram_id": 123456789,
      "name": "Meron Tadesse",
      "telegram_handle": "meron_fitness",
      "last_activity_at": "2026-05-28T14:00:00Z",
      "days_inactive": 9,
      "promo": {
        "provider_id": "uuid-provider",
        "provider_name": "Kuriftu Resort & Spa",
        "headline": "Presale: 20% off your first visit",
        "discount_pct": 20,
        "valid_until": "2026-07-26T23:59:59Z"
      }
    }
  ],
  "count": 1
}
```

### `GET /api/bot/streaks-at-risk`
Users whose streak is alive but who haven't checked in today (last check-in
was exactly yesterday). The bot's daily 16:00 UTC job DMs each one a
streak nudge with a `?startapp=reentry_checkin` deep link (the Mini App
tracks it as `reentry_open` and lands on Home's check-in card).

**Auth: `X-Bot-API-Key` header**

```json
// RESPONSE 200
{
  "users": [
    {
      "telegram_id": 123456789,
      "name": "Meron Tadesse",
      "current_streak": 6,
      "freeze_count": 1
    }
  ],
  "count": 1
}
```

---

## 2a. Home

### `GET /api/home/bootstrap`

Everything the Home screen renders, in one round trip. Home otherwise opens
with six parallel calls, each able to land on its own cold serverless function.

Each key is assembled independently — a section that fails comes back empty
rather than failing the whole response.

The arrays are the same shapes the individual endpoints return, so the client
seeds their caches from this payload and Explore / Circles open without a
request of their own:

| Key | Equivalent endpoint |
|-----|---------------------|
| `providers` | `GET /providers` |
| `communities` | `GET /communities` |
| `events` | `GET /events` (next 7 days, limit 20) |
| `featured_events` | `GET /events?boosted_only=true` (next 7 days, limit 10) |
| `social_proof` | `GET /circles/social-proof/today` |
| `unread_count` | `unread_count` from `GET /users/me/notifications` |
| `feed` | first page of `GET /feed/for-you` (Phase 4 — For You screen) |

```json
// RESPONSE 200
{
  "providers": [ /* ...same objects as GET /providers... */ ],
  "communities": [ /* ...same objects as GET /communities... */ ],
  "events": [ /* ...same objects as GET /events... */ ],
  "featured_events": [ /* ...boosted events... */ ],
  "social_proof": { "checked_in_today": 4 },
  "unread_count": 3,
  "feed": { "items": [ /* ...see GET /feed/for-you... */ ], "next_before": "2026-06-06T10:00:00Z" }
}
```

Clients should treat this endpoint as optional: on `404` fall back to calling
the six endpoints individually, so a frontend deploy that lands ahead of the
backend degrades instead of breaking Home.

`feed` calls the same builder `GET /feed/for-you` uses directly (not the HTTP
route) — the For You screen still opens with exactly one request; scrolling
past the first page is what hits `GET /feed/for-you?before=...`. Keep this
payload under the **150 KB working ceiling** (192 KB is the hard cap past
which `frontend/src/api/cache.js` stops persisting the entry to
`localStorage`, so it's lost the moment Telegram tears the WebView down) — see
`backend/check_bootstrap_payload_size.py`.

### `GET /api/home/lite`

The text-first half of the same payload, so For You has something readable on
it while `/home/bootstrap` is still running. The client fires **both together**
on open — this is not a replacement for the bootstrap, it is the head start.

`/home/bootstrap` cannot answer until the provider directory, every provider's
services, and the boosted-event query are done. None of that is needed to
render the part of the feed that is words. This endpoint runs the two queries
the first screenful actually depends on, plus two counters:

| Key | Notes |
|-----|-------|
| `partial` | Always `true`. Marks the payload as a subset, so it is never cached as the whole thing. |
| `communities` | `GET /communities?joined=true` — the user's own circles, which is all the check-in card needs. |
| `social_proof` | Same as the bootstrap's. |
| `unread_count` | Same as the bootstrap's. |
| `feed` | First page of `GET /feed/for-you`, **posts only** — no `event`, `service` or `provider` items, and no interleave. |

```json
// RESPONSE 200
{
  "partial": true,
  "communities": [ /* ...joined circles only... */ ],
  "social_proof": { "checked_in_today": 4 },
  "unread_count": 3,
  "feed": { "items": [ /* ...only type: "post"... */ ], "next_before": "2026-06-06T10:00:00Z", "partial": true }
}
```

`feed.next_before` is derived from the same posts query the full payload uses,
so it is identical in both and a client that starts paginating off a lite page
stays consistent once the full page replaces it.

Optional in the same way as the bootstrap: on `404` the client falls back to
sharing `/home/bootstrap`'s in-flight request, so a frontend deploy ahead of
the backend loses the head start rather than the screen.

---

## 2b. For You Feed

### `GET /api/feed/for-you?limit=10&before=<iso8601>`

Discovery feed replacing Home (Phase 4/5). Returns:

```json
// RESPONSE 200
{
  "items": [
    { "type": "post", "render_cost": "instant", "id": "uuid", "created_at": "2026-06-06T10:00:00Z",
      "post": { "...": "same shape as GET /posts, but comment_count instead of comments, and content truncated to ~280 chars with truncated: true/false",
                "source": { "kind": "circle", "id": "uuid", "name": "Addis Morning Runners", "member_count": 24 } } },
    { "type": "event", "render_cost": "media", "id": "uuid",
      "event": { "...": "same shape as GET /events" }, "provider": { "id", "name", "category", "cover_photo_url" } },
    { "type": "service", "render_cost": "media", "id": "<provider_id>:<service_index>",
      "provider": { "id", "name", "category", "location_text", "rating", "cover_photo_url", "is_coming_soon" },
      "service": { "name", "price", "duration", "description", "photo_url", "booking_method" } },
    { "type": "provider", "render_cost": "media", "id": "uuid",
      "provider": { "...": "same brief shape as the service item's provider" }, "promotion": null }
  ],
  "next_before": "2026-06-05T09:00:00Z"
}
```

**Ranking is a fixed, deterministic interleave — not a scoring model.** Posts
newest-first. After every 3rd post, splice in one non-post item, cycling
`event → service → provider`, skipping a category when empty; any items left
over once the post stream runs out are appended at the end (so a brand-new
user with zero posts still sees a non-empty feed built entirely from
providers/services/events). The top featured/highest-rated provider is
additionally pinned as the very first feed item, ahead of any posts. Both
live and coming-soon providers may appear as `service` or `provider` items —
coming-soon ones render with a "Coming soon" badge and no booking CTA (see
`is_coming_soon` on the embedded `provider` object) rather than being
excluded from the feed. An `event` item is emitted only for a
boosted/featured event.

`render_cost` (`"instant"` or `"media"`) drives the Phase 2 two-tier first
paint: on a cached first render the client shows `instant` items (no image
needed to be readable) above `media` items, then settles into server order
once the revalidated response lands.

`next_before` paginates the **posts** only (keyset on `created_at`); the
interleaved non-post items are additional and outside that cursor. `null`
means no more posts.

`post.source` is what makes "tap a post → land in its circle/community" work
— `kind` is `"circle"` or `"community"`. Posts from private or paid circles,
and system-generated join/check-in posts (`is_system_event: true`), never
appear in this feed.

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
  "interest_categories": ["yoga", "nutrition"],
  "exercise_frequency": "sometimes",
  "points_balance": 120,
  "tier": "sprout",
  "tier_emoji": "🌿",
  "is_onboarded": true,
  "is_provider": false,
  "is_super_admin": false,
  "location_neighborhood": "Bole",
  "health_app_connected": false,
  "phone_number": null,
  "time_format": null,
  "bio": "Yoga instructor & marathon runner 🧘‍♀️",
  "profile_privacy": "public",
  "is_verified_trainer": true,
  "follower_count": 42,
  "following_count": 18,
  "strava_stats": null,
  "joined_communities": ["uuid-1", "uuid-2"],
  "created_at": "2026-06-06T10:00:00Z"
}
```

> **Note:** `strava_stats` on `GET /users/me` and `PATCH /users/me` is always
> `null` — the authenticated user's own Strava data is fetched separately via
> `GET /api/strava/stats` (§9i), not embedded here. It **is** populated on the
> public-profile endpoint (`GET /api/users/:id/profile`, §9f) when viewable.
> `health_app_connected` is a legacy field kept for backward compatibility —
> it's now derived from Strava connection status (`strava_athlete_id is not
> null`) and any value sent for it in `PATCH /users/me` is silently
> overwritten with the real Strava state.

### `POST /api/users/me/onboard`
Complete Mini App onboarding. Sets `is_onboarded = true`.

```json
// REQUEST
{
  "name": "Meron Tadesse",
  "goal": "Lose weight and stay consistent",   // OPTIONAL
  "interest_categories": ["yoga", "nutrition"], // REQUIRED, min 1: yoga|gym|nutrition|spa|therapy|running
  "exercise_frequency": "sometimes",            // REQUIRED: never|rarely|sometimes|regular|daily
  "suggested_circle_ids": ["uuid-1"]            // OPTIONAL: auto-join these communities
}

// RESPONSE 200
{
  "id": "uuid-string",
  "telegram_id": 123456789,
  "name": "Meron Tadesse",
  "interest_categories": ["yoga", "nutrition"],
  "exercise_frequency": "sometimes",
  "is_onboarded": true,
  "welcome_points": 20,        // one-time endowed-progress award
  "points_balance": 20,        // balance after the award
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
Update profile fields (personalization, neighborhood opt-in, contact/format prefs).

```json
// REQUEST (all fields optional)
{
  "name": "Meron T.",
  "goal": "Updated goal",
  "location_neighborhood": "Bole",
  "health_app_connected": true,
  "phone_number": "+251911234567",   // E.164; backend only checks shape (6-15 digits, optional +)
  "time_format": "12h",              // '12h' | '24h' — 422 on any other value
  "bio": "Yoga instructor & marathon runner 🧘‍♀️",  // max 300 chars — 422 if longer
  "profile_privacy": "followers"     // 'public' | 'followers' | 'private' — 422 on any other value
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
      "community_id": "uuid-comm",
      "is_featured": false,
      "is_coming_soon": false   // true = browsable, not bookable (For You / launch gating, Phase 1)
    }
  ],
  "count": 10
}
```

Coming-soon providers stay in this list (the gate is presentation + a booking
block, not a listing filter) but sort behind live providers —
`is_coming_soon ASC` is the first sort key, ahead of `is_featured`/`rating`.

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
      "price": 800,          // null = priced on enquiry (no confirmed price yet)
      "duration": "60 min",  // null when price is also null
      "description": null,   // optional descriptive copy
      "photo_url": null      // optional per-service photo
      // "booking_method" omitted here = "online" (default, in-app booking + payment)
    },
    {
      "name": "Private Session",
      "price": 2000,
      "duration": "90 min"
    }
  ],
  "facilities": ["Steam room", "Sauna"],  // optional on-site facility list (Phase 1)
  "navigation_tips": [       // optional, detail-only (Phase 8) — [] when the provider hasn't set any
    { "title": "Parking", "detail": "Free parking behind the building." }
  ],
  "is_coming_soon": false,   // true = banner shown, booking blocked, service rows non-tappable
  "community": {
    "id": "uuid-comm",
    "name": "Zen Yoga Community",
    "member_count": 45,
    "user_joined": true
  },
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B",
  "contact_phone": null,             // set when at least one service is booking_method "phone"
  "contact_email": "booking@example.com",
  "active_promotion": {              // null when no active promotion
    "id": "uuid-promo",
    "headline": "Presale: 20% off your first visit",
    "discount_pct": 20,
    "valid_until": "2026-07-26T23:59:59Z",
    "audience": "first_time",        // "all" | "first_time" (presale)
    "user_eligible": true            // detail only — whether THIS user's booking will get the discount
  }
}
```

`GET /api/providers` list items carry the same `active_promotion` object minus
`user_eligible` (the list has no per-user context — treat it as marketing copy).

**Direct-contact services (Kuriftu gap analysis, Jul 15).** A service's
`booking_method` is `"online"` (default, omitted) or `"phone"` — a `"phone"`
service isn't booked or paid in-app at all: no time slots, no upfront
payment. The guest contacts the provider directly using `contact_phone`
and/or `contact_email` (either may be null) and pays on-site after the
service. `POST /api/bookings` is never called for these — there is
intentionally no server-side record of a phone/email booking request.
**Frontend:** `BookingFlow.jsx` shows a "Book directly" tag on these service
rows and, when one is selected, replaces the date/payment steps with a
contact screen (`tel:`/`mailto:` links) instead of continuing the normal flow.

### `POST /api/providers/me/promotions`
Create a promotion for your own provider. **Provider-only access.**

`audience: "first_time"` makes it a **presale promo**: the discount is applied
automatically (server-side) to bookings by users with no prior successful
booking at this provider. Presale promos must carry a `discount_pct` (422
otherwise).

```json
// REQUEST
{
  "headline": "Presale: 20% off your first visit",
  "discount_pct": 20,               // optional for audience "all", required for "first_time"
  "valid_until": "2026-07-26T23:59:59Z",
  "audience": "first_time"          // optional, default "all"
}

// RESPONSE 201
{
  "id": "uuid-promo",
  "headline": "Presale: 20% off your first visit",
  "discount_pct": 20,
  "valid_until": "2026-07-26T23:59:59Z",
  "is_active": true,
  "audience": "first_time"
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

### `GET /api/providers/me` / `PATCH /api/providers/me`
Provider self-service profile. **Provider-only access** (`get_current_provider`).

```json
// RESPONSE 200 (GET)
{
  "id": "uuid-string",
  "name": "Zen Yoga Studio",
  "category": "yoga",
  "status": "active",
  "description": "...",
  "location_text": "Bole, Addis Ababa",
  "lat": 9.0054, "lng": 38.7636,
  "services": [ /* same shape as provider detail */ ],
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B",
  "contact_phone": null,
  "contact_email": null,
  "facilities": ["Free parking", "Wheelchair accessible"],
  "navigation_tips": [
    { "title": "Parking", "detail": "Free parking behind the building, ask for the yellow gate." }
  ],
  "dashboard_stats": { "total_members": 45, "new_members_today": 3, "total_products": 6, "active_products": 4 }
}
```

`PATCH` accepts the same fields (all optional) minus `id`/`status`/`dashboard_stats`.
`facilities`/`navigation_tips` (Phase 8) are the provider-editable source for
the "Getting there" section on `GET /api/providers/:id` — repeatable-field UI
in `pages/provider-portal/ProviderPortalOverview.jsx`.

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
      "user_joined": false,
      "checked_in_today": false   // per-user; drives the HomeScreen check-in card
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

Streak rules: consecutive days increment `current_streak`; every 7-day streak
earns a freeze; **a freeze is consumed automatically to cover exactly one
missed day** (`freeze_used: true`); a longer gap (or no freeze) resets to 1.

```json
// RESPONSE 200
{
  "points_earned": 10,
  "new_balance": 130,
  "current_streak": 4,
  "freeze_count": 1,
  "freeze_used": false,  // true when a freeze just covered a one-day gap
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

## 5a. Posts & Circle Activity (Strava-style feed)

### `POST /api/posts`
Create a post in a community or circle. `activity_type`/`distance_km`/
`duration_min`/`photo_url` are all optional — a plain text post omits them.
When posted into a circle, every OTHER circle member gets a best-effort
in-app `circle_activity` notification (see `GET /api/users/me/notifications`);
a notification failure never blocks the post itself.

```json
// REQUEST
{
  "circle_id": "uuid-circle",       // or community_id
  "content": "Morning run felt great!",
  "activity_type": "run",            // optional: run|walk|ride|yoga|gym|swim|general
  "distance_km": 5.2,                // optional
  "duration_min": 32,                // optional
  "photo_url": "https://..."         // optional — URL only, no upload endpoint yet
}

// RESPONSE 200
{ "id": "uuid-post", "message": "Post created successfully" }
```

### `GET /api/posts?circle_id=...&community_id=...&limit=20`
Returns posts newest-first, each with reactions, total points gifted, and
comments nested one level deep (`replies` on each top-level comment).

```json
{
  "posts": [
    {
      "id": "uuid-post",
      "content": "Morning run felt great!",
      "is_system_event": false,
      "activity_type": "run",
      "distance_km": 5.2,
      "duration_min": 32,
      "photo_url": null,
      "user": { "id": "uuid-user", "name": "Meron", "photo_url": null },
      "created_at": "2026-07-16T07:00:00Z",
      "reactions": { "🔥": 2, "coins": 1 },
      "total_points_gifted": 10,
      "comments": [
        {
          "id": "uuid-comment",
          "content": "Nice pace!",
          "created_at": "2026-07-16T07:05:00Z",
          "parent_comment_id": null,
          "user": { "id": "uuid-user-2", "name": "Abel", "photo_url": null },
          "replies": [
            {
              "id": "uuid-reply",
              "content": "Thanks!",
              "created_at": "2026-07-16T07:06:00Z",
              "parent_comment_id": "uuid-comment",
              "user": { "id": "uuid-user", "name": "Meron", "photo_url": null },
              "replies": []
            }
          ]
        }
      ]
    }
  ]
}
```

### `POST /api/posts/{post_id}/comments`
`parent_comment_id` (optional) makes this a reply. Replies are **one level
deep only** — replying to a comment that already has a `parent_comment_id`
returns `422`, as does a `parent_comment_id` from a different post.

```json
// REQUEST
{ "content": "Nice pace!", "parent_comment_id": "uuid-comment" }  // omit for a top-level comment

// RESPONSE 200
{ "id": "uuid-comment", "message": "Comment added successfully" }
```

### `POST /api/posts/{post_id}/react`
Unchanged shape. `emoji` can be a plain reaction (`"🔥"`) or `"coins"` for a
point-gift reaction (frontend renders gifting via the coin icon, not an
emoji) — `points_gifted > 0` transfers points through the ledger and is
capped by the giver's balance.

```json
// REQUEST
{ "emoji": "coins", "points_gifted": 5 }

// RESPONSE 200
{ "message": "Reaction added successfully", "points_gifted": 5 }
```

---

## 6. Bookings & Payments

### `POST /api/bookings`
Create a booking.

**Coming-soon providers are rejected.** If `provider.is_coming_soon` is true,
this returns `400 { "detail": "This provider isn't taking bookings yet." }`
before any booking row (or its siblings) is written.

**`payment_method: "pay_on_site"` (WP1, consumer booking flow default).** No
payment gateway is involved — the guest pays the provider in person after the
service. The backend marks the booking (and every sibling in a multi-day
group) `payment_status: "success"` immediately at creation, which fires the
same side effects a gateway success would: +50 Legacy Points, a provider
community feed event, and a "Booking Confirmed" in-app notification. Do not
call `POST /api/payments/telebirr/initiate` or `.../mpesa/initiate` for a
`pay_on_site` booking — there is nothing to poll. `telebirr`/`mpesa` remain
valid values (used by provider-subscription payments and kept for API
compatibility) and still create a `pending` booking that requires payment
initiation + `GET /api/payments/:booking_id/status` polling as before.

**Promotions are applied server-side.** Clients always send the
**undiscounted** per-day amount; if the user is eligible for the provider's
active promotion (see `active_promotion.user_eligible` on provider detail),
the backend deducts the flat % and returns the final charged `amount_etb`
plus a `promotion` object (`null` when nothing applied). Payment initiation
uses the booking's stored (discounted) amount.

**Multi-day booking.** `additional_slot_datetimes` (optional) books the same
service/time on more days — each becomes its own `Booking` row sharing the
primary's `booking_group_id`, so one payment covers all of them (see
`GET /api/payments/:booking_id/status` — polling the primary booking's status
is sufficient signal for the whole group, since a payment success/failure
cascades to every booking sharing its group id). Any promotion discount
applies to the **primary/first day only** — the response's `promotion`
reflects that, and `total_amount_etb` is the combined charge across every
day. **Not supported for event bookings** (`event_id` set) — an event already
has one fixed date; sending both is a 422.

```json
// REQUEST
{
  "provider_id": "uuid-string",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-07T07:00:00Z",
  "amount_etb": 800,               // undiscounted, per day — backend applies any promo
  "payment_method": "telebirr",
  "phone_number": "0911234567",
  "additional_slot_datetimes": ["2026-06-09T07:00:00Z", "2026-06-11T07:00:00Z"]  // optional
}

// RESPONSE 201
{
  "id": "uuid-booking",              // the primary (first-day) booking
  "provider_id": "uuid-string",
  "service_name": "Morning Vinyasa Flow",
  "slot_datetime": "2026-06-07T07:00:00Z",
  "amount_etb": 640,                // final charged amount for THIS day (800 − 20%)
  "payment_method": "telebirr",
  "payment_status": "pending",
  "promotion": {                    // null when no promotion applied
    "id": "uuid-promo",
    "headline": "Presale: 20% off your first visit",
    "discount_pct": 20,
    "discount_etb": 160
  },
  "additional_booking_ids": ["uuid-booking-2", "uuid-booking-3"],  // [] for a single-day booking
  "total_amount_etb": 2240,         // 640 + 800 + 800 — combined charge across every day
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
      "interest_categories": ["yoga"],
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

### `PATCH /api/admin/providers/:id/launch-state`
Flip a provider's coming-soon gate. Admin-created providers (`POST
/api/admin/providers`, promote-user) default `is_coming_soon: false`
(immediately live); self-onboarded providers default `true` until an admin
uses this endpoint. `GET /api/admin/providers` list items carry
`is_coming_soon` so the admin UI can render a Live/Coming soon toggle.

```json
// REQUEST
{ "is_coming_soon": false }

// RESPONSE 200
{ "provider_id": "uuid-string", "is_coming_soon": false }
```

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

## 9. Phase 2 & 3 Endpoints (Overview)

### Events & Booking
- `GET /api/events` — Discover events
- `GET /api/events/{id}` — Event details
- `GET /api/providers/me/events` — Provider dashboard events
- `POST /api/providers/me/events` — Provider create event
- `PATCH /api/providers/me/events/{id}` — Update event (capacity/etc)
- `POST /api/providers/me/events/{id}/cancel` — Cancel event
- `POST /api/providers/me/events/{id}/boost` — Boost event

### Challenges
- `GET /api/communities/{id}/challenges` — List community challenges
- `POST /api/providers/me/communities/{id}/challenges` — Create challenge

### Notifications
- `GET /api/users/me/notifications` — Inbox
- `PATCH /api/users/me/notifications/read` — Mark read
- `POST /api/users/me/notifications/read-all` — Mark all read

### Subscriptions
- `GET /api/subscriptions/plans` — View plans
- `GET /api/subscriptions/status/{id}` — Check sub status
- `POST /api/subscriptions/initiate` — Pay subscription
- `POST /api/providers/me/subscriptions/initiate` — Provider initiated pay

### Products & Store
- `GET /api/products` — Browse store
- `GET /api/products/{id}` — Product details
- `POST /api/products/{id}/redeem` — Redeem with points
- `GET /api/users/me/redemptions` — My redemptions

---

## 9a. Points Economy (Part B/C/D/E)

All points mutations now flow through a single ledger (`point_transactions`); `GET /users/me/points-history` reads from it. `Product.points_cost` replaced `Product.price_etb` — the API still accepts/emits `price_etb` as a deprecated alias for one release. `ProviderEvent.price_etb` is unaffected (that one was always real ETB).

### Provider CRM & awards (C1 / D3)
- `GET /api/providers/me/customers` — JWT (provider). Distinct users with a successful booking or community check-in at this provider.
  ```json
  { "customers": [
    { "user_id": "uuid", "name": "Meron", "photo_url": "...", "last_visit": "2026-07-07T09:00:00Z", "lifetime_points_redeemed": 120, "points_balance": 120 }
  ], "count": 1 }
  ```
- `POST /api/providers/me/customers/{customer_user_id}/award?points=25&note=...` — JWT (provider). Query params, not body. Caps: 1 award/customer/day, 50 pts/award, 300 pts/provider/day. 400 if the customer has no verified interaction or a cap is hit.
  ```json
  { "transaction_id": "uuid", "customer_user_id": "uuid", "points_awarded": 25, "customer_new_balance": 145, "provider_daily_remaining": 275 }
  ```

### Price suggestions (D1)
- `GET /api/providers/me/products/price-suggestion?category=yoga` — JWT (provider). Median/P25–P75 of `points_cost` across active in-category products; falls back to a flag when fewer than 3 comparables exist.
  ```json
  { "category": "yoga", "has_comparables": true, "suggestion_text": "Similar yoga providers charge 300–500 pts (median 400)", "median": 400, "p25": 300, "p75": 500, "sample_size": 6 }
  ```

### Provider payout predictability (C5)
- `GET /api/providers/me/analytics/points` — JWT (provider). Last 4 weeks of points redeemed + unique visits at this provider.
  ```json
  { "provider_id": "uuid", "weekly_trend": [ { "week_label": "Week 1", "points_redeemed": 220, "unique_visits": 5 } ] }
  ```

### Evidence-based event participation (D2)
- `ProviderEvent.staff_user_id` (nullable) — set via `POST`/`PATCH /api/providers/me/events` — the one user allowed to submit evidence for that event.
- `GET /api/bot/staff-events?telegram_id=...` — Bot API Key. Ended events this Telegram user is designated staff for, without a submission yet.
- `POST /api/bot/evidence` — Bot API Key. `{ "telegram_id": 123, "event_id": "uuid", "telegram_file_id": "..." }` → `{ "id": "uuid", "status": "pending" }`.
- `GET /api/admin/evidence` — JWT (admin). Pending submissions with event/provider/submitter/attendee-count context.
- `GET /api/admin/evidence/{id}/photo` — JWT (admin). Streams the photo bytes through the backend (bot token never reaches the browser).
- `POST /api/admin/evidence/{id}/review` — JWT (admin). `{ "action": "approve", "points_per_participant": 25 }` or `{ "action": "reject" }`. On approval, mints `event_participation` points for every user with a successful booking on the event.

### Referrals & circle invites (E1)
- `User.referred_by` (nullable) — set by the frontend when a new user completes onboarding after a `?startapp=circle_{code}` deep link (see Frontend Flow Summary).
- `POST /api/circles/join-by-code` — JWT. `{ "join_code": "..." }` → joins the circle. Referral credit (+30 pts each, capped at 10/referrer/month) fires automatically on the invitee's **first-ever check-in**, not at join time.
- `GET /api/circles` — now also returns `join_code` per circle, but **only for circles the caller has already joined** (it's the private-circle access gate, so it isn't exposed to browsers).
- `GET /api/bot/circle-digests` — Bot API Key. Per-circle weekly top scorer + member Telegram IDs, for the bot's Sunday digest job.

**`POST /api/circles`** — JWT. Create a circle; creator is auto-added as a member.
```json
// REQUEST
{ "name": "Morning Yogis", "description": "optional", "is_private": false }

// RESPONSE 200
{ "id": "uuid-circle", "name": "Morning Yogis", "join_code": "A1B2C3D4", "message": "Circle created successfully" }
```
Every circle gets a `join_code` — auto-generated (8-char uppercase/digits, unique) if not supplied — not just private ones; it's what powers the `?startapp=circle_{code}` invite-link flow generally, not only private-circle access control.

**`POST /api/circles/:id/join`** — JWT. `{ "join_code": "..." }` (only required for private circles).
```json
// RESPONSE 200
{ "id": "uuid-circle", "name": "Morning Yogis", "join_code": "A1B2C3D4", "message": "Joined circle successfully" }
```
Now returns `join_code` (previously just a bare message) so the client can build the invite link immediately after joining, without a second `GET /api/circles` round-trip.

### Circle preview + Join CTA (Phase 6)

**`GET /api/circles/:id`** — JWT. Circle detail for a non-member's preview
page, replacing `CircleDetailScreen.jsx`'s old hack of fetching the whole
`GET /circles` list and `.find()`-ing it.

```json
// RESPONSE 200
{
  "id": "uuid-circle",
  "name": "Addis Morning Runners",
  "description": "We run every morning at 6 AM around Meskel Square.",
  "member_count": 24,
  "is_joined": false,
  "is_owner": false,
  "is_private": false,
  "is_paid": false,
  "price_etb": null,
  "paid_circle_status": "free",
  "join_code": null,           // only exposed once is_joined is true
  "owner": { "id": "uuid", "name": "Selam Alemu", "telegram_handle": "selam_well", "is_verified_trainer": false },
  "preview_posts": [ /* up to 5 recent posts, same shape as GET /posts — omitted (null) for paid or private circles */ ]
}
```

Access rules:
- **Private circle, non-member** → `404` (does not leak that the circle exists).
- **Paid circle, non-subscriber** → metadata only, `preview_posts: null`; the existing subscribe flow takes over.
- **Public free circle, non-member** → metadata + `preview_posts`.
- A member or the owner always gets `is_joined`/`is_owner: true` and a non-null `join_code`; `preview_posts` is only ever populated for the non-member preview case (members render the full `PostFeed` instead).

**Frontend:** when `!is_joined` on a public circle, `PostFeed` is replaced by
a read-only render of `preview_posts` (no composer, no reaction buttons, no
comment boxes), the `leaderboard`/`members` tabs and invite button are
hidden, and a sticky bottom **Join circle** CTA takes over. On success the
screen flips to full mode in place — no navigation. The same read-only
preview + Join CTA pattern applies to `CommunityDetail.jsx` for provider
communities (reusing `POST /api/communities/:id/join`).

### Social proof & streaks (C2 / E2)
- `POST /api/communities/{id}/checkin` response now also includes `current_streak` and `freeze_count`.
- `GET /api/circles/social-proof/today` — JWT. `{ "checked_in_today": 3 }` — how many of the caller's circle-mates checked in today, across all their circles.
- `GET /api/circles/{id}/leaderboard` — `weekly_points` is now computed from the ledger (trailing 7 days of positive transactions) instead of the previously-unfed `CircleMember.weekly_points` column; response shape is unchanged.

---

## 9b. Ranks — Weekly Leaderboard (V2 UX Phase 5)

**`GET /api/ranks`** — JWT. Trailing 7-day weekly leaderboard, both community and individual. Metric is the sum of positive `point_transactions.amount` rows with `created_at >= now() - 7 days` (negative/reversal transactions reduce the total but don't count as separate entries; transactions older than 7 days are excluded entirely).

```json
// RESPONSE 200
{
  "communities": [
    { "community_id": "uuid", "name": "Shanti Yoga Circle", "member_count": 83, "weekly_points": 2450, "rank": 1 }
  ],
  "users": [
    { "user_id": "uuid", "name": "Hana Girma", "photo_url": "https://...", "weekly_points": 340, "rank": 1 }
  ],
  "me": { "rank": 8, "weekly_points": 120 }
}
```
- `communities` / `users` are each capped at the top 20, ordered by `weekly_points` descending.
- A user who belongs to two communities contributes their weekly points to both communities' totals (community sums are independent per-community aggregates, not mutually exclusive).
- `me.rank` is `null` (not `0` or last place) when the caller earned 0 points in the trailing 7 days.
- Mock mode (`getRanks()` in `client.js`) returns the `MOCK_RANKS` fixture from `data/mock.js`.

---

## 9c. Feedback — Bug Reports & Health-App Wishlist (V2 UX Phase 6)

**`POST /api/feedback`** — JWT. Submit a bug report, health-app connect request, or general suggestion.
```json
// REQUEST
{ "type": "bug", "message": "Booking button does nothing on Safari", "context": { "route": "/booking/123", "error": null, "user_agent": "Mozilla/5.0 ..." } }

// RESPONSE 201
{ "id": "uuid" }
```
- `type` — one of `bug` | `health_app_request` | `suggestion`.
- `message` — 1-2000 chars.
- `context` — optional free-form JSON (route/error/user_agent); not validated beyond being an object.
- New rows default to `status: "new"`.

**`GET /api/admin/feedback?type=&status=&page=`** — Super admin. Paginated (20/page), newest-first, submitter name/handle joined in a single query.
```json
// RESPONSE 200
{
  "items": [
    { "id": "uuid", "user_id": "uuid", "user_name": "Alice", "user_handle": "alice_tg", "type": "bug", "message": "...", "context": {...}, "status": "new", "created_at": "2026-07-17T10:00:00Z" }
  ],
  "total": 42,
  "page": 1
}
```

**`PATCH /api/admin/feedback/{id}`** — Super admin. `{ "status": "reviewed" }` (`new` | `reviewed` | `resolved`) → `{ "id": "uuid", "status": "reviewed" }`. 404 if the id doesn't exist.

Mock parity: `submitFeedback()`, `getAdminFeedback()`, `updateFeedbackStatus()` in `client.js`.

---

## 9d. Provider Website (`/provider-portal`)

A standalone website for providers, separate from the Telegram Mini App —
`frontend/src/pages/provider-portal/*`, gated by `ProviderPortalGuard` +
`ProviderPortalAuthContext` (its own `wc_provider_token` localStorage key,
independent of the Mini App's `wc_token` session). It reuses
`ProviderDashboard.jsx` (`hideBackButton` prop) for the actual dashboard, so
Analytics/Events/Products/Customers/Promotions/Subscriptions tabs are
unchanged; only the items below are new.

### Login — Telegram Login Widget

**`POST /api/auth/telegram-widget`** — No JWT required. Validates the
[Telegram Login Widget](https://core.telegram.org/widgets/login) callback
payload (HMAC-SHA256, secret key = `SHA256(bot_token)` — **not** the Mini App
`initData` scheme, which prefixes with `"WebAppData"`). Unlike
`POST /api/auth/telegram`, this **never creates a user** — it only signs in
an existing account with `is_provider = true`.

```json
// REQUEST
{ "id": 123456789, "first_name": "Meron", "username": "meron_fitness", "photo_url": "https://...", "auth_date": 1752800000, "hash": "..." }

// RESPONSE 200 — same AuthResponse shape as POST /auth/telegram
{ "token": "eyJ...", "user": { ... }, "is_new_user": false }

// RESPONSE 401 — bad/expired/tampered signature
// RESPONSE 403 — { "detail": "No provider account found for this Telegram account" }
```

Frontend: `authTelegramWidget()` in `client.js`. The widget itself requires
the deployed domain to be registered with BotFather (`/setdomain`) and HTTPS
— it does not render on `localhost`; local/dev and the Vitest mock mode use
a "Continue as Demo Provider" button instead (`VITE_USE_MOCK=true`).

### Bookings, service mix, demographics, custom time metrics

All **JWT (provider)**, scoped to the caller's own provider via `get_provider_by_owner`.

**`GET /api/providers/me/bookings?page=&per_page=&start_date=&end_date=&payment_status=&service_name=`**
Full paginated booking list — each row also carries the customer's
demographic fields, so the table doubles as a lightweight CRM view.
```json
{
  "bookings": [
    { "id": "uuid", "user_handle": "meron_fitness", "user_name": "Meron Tadesse",
      "service_name": "Morning Vinyasa Flow", "slot_datetime": "2026-06-07T07:00:00Z",
      "amount_etb": 800, "payment_status": "success", "created_at": "2026-06-06T10:30:00Z",
      "customer_demographics": { "location_neighborhood": "Bole", "interest_categories": ["yoga"], "exercise_frequency": "sometimes" } }
  ],
  "total": 1, "page": 1, "per_page": 20
}
```

**`GET /api/providers/me/analytics/services?start_date=&end_date=`** — Most-booked-service breakdown, sorted by bookings count descending.
```json
{ "services": [ { "service_name": "Morning Vinyasa Flow", "bookings_count": 18, "revenue_etb": 9000 } ] }
```

**`GET /api/providers/me/analytics/demographics`** — Breakdown of this
provider's customers using only the fields that exist today (no age/gender
column) — `location_neighborhood`, `interest_categories` (multi-select, so a
customer can land in more than one bucket), `exercise_frequency`.
```json
{
  "total_customers": 4,
  "by_neighborhood": [ { "label": "Bole", "count": 2 } ],
  "by_interest_category": [ { "label": "yoga", "count": 2 } ],
  "by_exercise_frequency": [ { "label": "sometimes", "count": 1 } ]
}
```

**`GET /api/providers/me/analytics/timeseries?start_date=&end_date=`** —
Custom time metrics: daily bookings/revenue/check-ins for a provider-chosen
date range (max 366 days; 422 if `end_date < start_date` or range exceeded).
```json
{
  "provider_id": "uuid", "start_date": "2026-07-12", "end_date": "2026-07-18",
  "series": [ { "date": "2026-07-12", "bookings": 3, "revenue_etb": 0, "checkins": 4 } ],
  "totals": { "bookings": 8, "revenue_etb": 3500, "checkins": 18, "unique_customers": 4 }
}
```

### Redeem management

**`GET /api/providers/me/redemptions?page=&per_page=&status=`** — Now
paginated (previously a bare 10-item list). Each item also carries
`provider_notes`, `delivery_address`, `points_spent`.
```json
{ "redemptions": [ { "id": "uuid", "user_name": "Meron", "product_name": "Private Yoga Session", "redemption_code": "YOGA-ABC123", "delivery_status": "pending", "provider_notes": null, "delivery_address": null, "points_spent": 400, "redeemed_at": "2026-07-07T09:00:00Z" } ], "count": 1, "total": 1, "page": 1, "per_page": 20 }
```

**`POST /api/providers/me/redemptions/{redemption_id}/update-status`** —
Provider-scoped equivalent of the admin redemption-status endpoint; 404 if
the redemption doesn't belong to one of this provider's products.
```json
// REQUEST
{ "status": "shipped", "notes": "Sent via Bole courier" }   // status: pending|confirmed|shipped|delivered

// RESPONSE 200
{ "redemption_id": "uuid", "delivery_status": "shipped", "provider_notes": "Sent via Bole courier" }
```

Mock parity: `getProviderBookings()`, `getProviderServiceBreakdown()`,
`getProviderDemographics()`, `getProviderMetricsTimeseries()`,
`updateProviderRedemptionStatus()` in `client.js`.

---

## 9e. File Uploads (Phase 15)

Generic upload endpoint backing certificate/receipt uploads for trainer
verification (§9g) and paid-circle receipts (§9h). Wraps Cloudinary
(`app/services/cloudinary_service.py`); requires `CLOUDINARY_CLOUD_NAME` /
`CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` to be set, or every call
503s.

**`POST /api/uploads`** — JWT required. `multipart/form-data`: `file`
(binary) + `folder` (`certificates` | `receipts` — any other value is a 422,
there is no generic/other folder).

| Folder | Max size | Allowed types |
|--------|----------|---------------|
| `certificates` | 10 MB | `application/pdf`, `image/jpeg`, `image/png` |
| `receipts` | 5 MB | `image/jpeg`, `image/png` |

```json
// RESPONSE 200
{ "url": "https://res.cloudinary.com/.../wellcircle/certificates/abc123.pdf", "public_id": "wellcircle/certificates/abc123" }

// RESPONSE 422 — wrong folder, wrong content-type, oversized, or empty file
{ "detail": "File exceeds the 10MB limit for certificates" }

// RESPONSE 503 — Cloudinary env vars not configured
{ "detail": "Cloudinary is not configured" }
```

Note: any authenticated user may upload to either folder — the backend does
not check that the uploader is actually applying for trainer verification or
subscribing to a circle. Files are stored under `wellcircle/{folder}/` in
Cloudinary; there is a `delete_file(public_id)` helper in the service but no
endpoint calls it today (uploaded files are never cleaned up on
rejection/replacement).

---

## 9f. Followers & Public Profiles (Phase 15)

Instagram-style follow graph plus a privacy-aware public profile. Mounted
under `/api/users` (`app/api/followers.py`), alongside the `users` router.

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/api/users/:id/follow` | Idempotent — following twice returns the same `{following: true}`. 404 if target doesn't exist, 400 on self-follow. |
| DELETE | `/api/users/:id/follow` | Idempotent — unfollowing when not following returns `{following: false, removed: false}`, not a 404. |
| GET | `/api/users/:id/followers?page=&per_page=` | `per_page` 1–100, default 20. 404 if `:id` doesn't exist. |
| GET | `/api/users/:id/following?page=&per_page=` | Same pagination/shape. |
| GET | `/api/users/:id/profile` | Public profile, privacy-gated (see below). |

```json
// RESPONSE 200 — GET /api/users/:id/followers
{
  "items": [
    { "id": "uuid", "name": "Hana", "telegram_handle": "hana_runs", "photo_url": "https://...",
      "bio": "Marathon coach", "is_verified_trainer": true, "follower_count": 340, "following_count": 12 }
  ],
  "total": 1, "page": 1, "per_page": 20
}

// RESPONSE 200 — GET /api/users/:id/profile
{
  "id": "uuid", "name": "Hana", "telegram_handle": "hana_runs", "photo_url": "https://...",
  "bio": "Marathon coach", "is_verified_trainer": true, "follower_count": 340, "following_count": 12,
  "profile_privacy": "followers",
  "is_following": true,
  "strava_stats": { "distance": 42.1, "activity_count": 5, "recent_activities": [ /* ... */ ] },
  "circles": [
    { "id": "uuid", "name": "Endurance Club", "description": "...", "is_paid": true, "price_etb": 350 }
  ]
}
```

**Privacy enforcement** (`profile_privacy` on the target user — `public` |
`followers` | `private`, default `public`):
- Identity fields (`name`, `handle`, `photo_url`, `bio`, `is_verified_trainer`,
  follower/following counts) are **always visible to any authenticated
  viewer**, regardless of privacy setting — privacy only gates `strava_stats`
  and `circles`.
- `public`: `strava_stats` + `circles` visible to anyone.
- `followers`: visible only if the viewer follows the target (or is the
  target).
- `private`: visible only to the target themselves; everyone else gets
  `strava_stats: null` and `circles: []`.
- `circles` lists **every** circle the target owns (not just ones they're
  active in) — there's no membership or paid-access filter on this list.
- If the target has Strava connected but the live fetch fails (rate limit,
  token issue), `strava_stats` silently falls back to `null` rather than
  erroring the whole profile request.

---

## 9g. Trainer Verification (Phase 15)

Users apply for a "Verified Trainer" badge by uploading a certificate +
proof of a 200 ETB/year fee (`app/api/trainer.py`, mounted at `/api`, so
routes are `/api/trainer/*` and — unusually — the admin routes for this
feature also live here as `/api/admin/trainer-verifications*`, not on the
main `admin` router). The 200 ETB fee is enforced only as UI copy — the
backend just stores whatever receipt URL is submitted; there's no payment
gateway integration.

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/trainer/apply` | JWT | 201 on success. 409 if an application is already `pending`, or `approved` and not yet expired. |
| GET | `/api/trainer/status` | JWT | `{ "application": null \| {...} }` |
| GET | `/api/admin/trainer-verifications?page=&per_page=&status=` | JWT (super admin) | `status`: `pending` (default) \| `approved` \| `rejected` \| `all`. |
| POST | `/api/admin/trainer-verifications/:id/review` | JWT (super admin) | `{action: "approve"\|"reject", rejection_reason?}`. `rejection_reason` required (max 1000 chars) when rejecting. |

```json
// REQUEST — POST /api/trainer/apply
{
  "certificate_url": "https://res.cloudinary.com/.../cert.pdf",
  "certificate_public_id": "wellcircle/certificates/cert123",
  "payment_receipt_url": "https://res.cloudinary.com/.../receipt.png",
  "payment_receipt_public_id": "wellcircle/receipts/receipt123"
}

// RESPONSE 201
{
  "id": "uuid", "user_id": "uuid", "status": "pending", "payment_status": "pending",
  "rejection_reason": null, "certificate_url": "https://...", "payment_receipt_url": "https://...",
  "created_at": "2026-07-26T10:00:00Z", "expires_at": null
}
```

- **Approve** sets `user.is_verified_trainer = true`,
  `verified_trainer_expires_at = approved_at + 365 days`, and
  `payment_status = "paid"` (approval implicitly confirms payment — there's
  no separate payment-verification step).
- **Reject** clears `is_verified_trainer` and stores `rejection_reason`;
  the user can re-apply immediately (re-applying reuses the same row rather
  than creating a new one, since `user_id` is unique on this table).
- A daily scheduler job (`check_expired_verifications`, part of the combined
  `phase15_maintenance` job — see §5 note in HANDOFF) flips
  `is_verified_trainer` back to `false` once `verified_trainer_expires_at`
  passes, and sends a renewal-nudge notification. It does **not** reset the
  `TrainerVerification.status` field back from `"approved"` — the row stays
  "approved" even after the badge itself has expired, so `status` alone is
  not a reliable "is currently verified" check; use `user.is_verified_trainer`
  for that.
- Verified trainers get an `owner_is_verified` flag on circles they own
  (`GET /api/circles`, batched — not N+1) and a `VerifiedBadge` on their
  profile, follower lists, and public profile.

---

## 9h. Paid Circles (Phase 15)

Circle owners can apply to monetize their circle once it's grown; members
subscribe by uploading a payment-receipt screenshot that the owner manually
approves — there's no payment gateway integration, same pattern as trainer
verification. Well Circle takes a 5% platform fee. Endpoints live on the
existing `circles` (`/api/circles`) and `admin` (`/api/admin`) routers.

**Eligibility to apply** (checked both on apply and again on admin approval):
- Circle has **≥ 100 members**
- Circle owner has **≥ 1000 lifetime points** — sum of positive,
  non-reversed `point_transactions.amount` rows for the owner (not their
  current balance, which decays)

**Revenue split** — integer ETB, no fractional currency: platform fee is
`floor(amount_etb * 5 / 100)`, creator gets the remainder (so creator gets
slightly *more* than a clean 95% on amounts that don't divide evenly by 20,
e.g. ETB 101 → platform 5, creator 96).

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/circles/:id/apply-paid` | JWT (circle owner) | `{price_etb}` (1–10000). 403 if not owner, 400 if eligibility not met or already applied/approved. |
| POST | `/api/circles/:id/subscribe` | JWT | Uploads a receipt; 201. 409 if circle isn't an approved paid circle, caller is the owner, or a current (active/pending) subscription already exists. |
| GET | `/api/circles/:id/subscriptions/pending` | JWT (owner) | Receipts awaiting the owner's review. |
| POST | `/api/circles/subscriptions/:id/review` | JWT (owner) | `{action: "approve"\|"reject"}`. Approve creates the revenue-ledger row and adds a `CircleMember` if missing. |
| GET | `/api/circles/:id/revenue` | JWT (owner) | Lifetime totals + monthly trend. |
| GET | `/api/circles/:id/subscription-status` | JWT | Caller's own subscription (active one preferred, else most recent of any status). |
| GET | `/api/admin/paid-circle-applications?page=&per_page=` | JWT (super admin) | Circles with `paid_circle_status = "pending_approval"`. |
| POST | `/api/admin/paid-circle-applications/:id/review` | JWT (super admin) | `{action, reason?}` — `reason` is optional here (unlike trainer rejection, which requires one). |

```json
// RESPONSE 201 — POST /api/circles/:id/subscribe
{ "id": "uuid", "status": "pending_approval", "period_start": "2026-07-26T10:00:00Z", "period_end": "2026-08-25T10:00:00Z", "amount_etb": 350 }

// RESPONSE 200 — GET /api/circles/:id/revenue
{
  "total_revenue_etb": 1050, "creator_earnings_etb": 998, "platform_fee_etb": 52,
  "active_subscribers": 3, "pending_receipts": 1,
  "monthly_trend": [ { "month": "2026-07", "revenue": 1050, "subscribers": 3 } ]
}
```

**Access model — important deviation from a typical "active subscription
required" gate:** access to a paid circle's activity feed/leaderboard
(`has_circle_access`) is **membership-based**, not subscription-status-based.
Once a subscription is approved, the subscriber gets a permanent
`CircleMember` row; access checks just look for that membership row (or
circle ownership), not whether a subscription is currently `active`. This is
intentional for **grandfathering**: members who joined before a circle went
paid keep access indefinitely. The practical effect is that a subscriber
whose 30-day period lapses is **not** immediately locked out — a daily
scheduler job (`check_expired_subscriptions`) marks the subscription
`expired` and only revokes membership if the member's `joined_at` falls
within that specific subscription's period (so it won't accidentally evict a
grandfathered free member).

**Join gate:** `POST /api/circles/:id/join` on a paid, non-member returns
**402** with a JSON object as the `detail` (not a plain string, which is
unusual for this codebase's error convention):
```json
// RESPONSE 402
{ "detail": { "message": "Paid circle — subscription required", "price_etb": 350, "circle_id": "uuid" } }
```

**Stale-receipt escalation:** a receipt sitting in `pending_approval` for
more than 72 hours is escalated once (an `AdminNotification` is created for
every super-admin) via the same daily scheduler job — the owner isn't
blocked from still approving/rejecting it after escalation.

---

## 9i. Strava Integration (Phase 15)

Full OAuth2 flow (`app/api/strava.py`, mounted at `/api/strava`). Users
connect Strava, choose which stat categories to expose, and stats are
fetched on-demand (pull model, not a webhook subscription) and cached.

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/strava/connect` | JWT | Returns `{authorization_url}`. 503 if `STRAVA_CLIENT_ID`/`SECRET`/`REDIRECT_URI` aren't all set. |
| GET | `/api/strava/callback` | None — Strava redirect | `code` + `state` query params. `state` is a short-lived (10 min) signed JWT carrying the user id, not a raw CSRF token. Redirects to `{FRONTEND_URL}/profile?strava=connected` on success; 502 on token-exchange failure. |
| POST | `/api/strava/disconnect` | JWT | Clears tokens, visibility prefs, and the activity cache. |
| GET | `/api/strava/stats` | JWT | `{connected, stats}` — refreshes from Strava if the cache is stale (see TTL below); 503 if Strava errors (e.g. rate-limited) and there's nothing usable cached. |
| PATCH | `/api/strava/visibility` | JWT | `{visible_stats: [...]}`. 422 on unknown or duplicate keys. |

**Valid `visible_stats` keys** (exactly these six):
`distance`, `calories`, `moving_time`, `elevation`, `activity_count`, `recent_activities`

On first connect, all of these are enabled **except `calories`**
(`["distance", "moving_time", "elevation", "activity_count", "recent_activities"]`)
unless the user already had a preference saved from a prior connection.

```json
// RESPONSE 200 — GET /api/strava/stats
{
  "connected": true,
  "stats": {
    "distance": 42.1, "moving_time": 14400, "elevation": 320.5,
    "activity_count": 5,
    "recent_activities": [
      { "id": 77, "name": "Morning run", "type": "Run", "distance": 5.0, "moving_time": 1500, "start_date": "2026-07-25T06:00:00Z" }
    ]
  }
}
```

- Access/refresh tokens are stored **Fernet-encrypted** (key derived from
  `SHA256(JWT_SECRET)`), never in plaintext, in `strava_access_token` /
  `strava_refresh_token`.
- Stats are computed from a **15-minute-TTL cache** of the user's recent
  activities (`strava_activity_cache` table, `crud/strava.py`) — Strava's
  dedicated `/athletes/{id}/stats` all-time-totals endpoint is not used;
  "stats" here means an aggregation over cached recent activities
  (`distance` in km, `calories`/`elevation` summed, `activity_count` = rows
  cached, `recent_activities` = latest 5). On a fresh/expired cache, a live
  call to Strava fetches the 100 most recent activities and re-caches them.
- `disconnect` sets the legacy `health_app_connected` flag back to `false`;
  connecting sets it `true` (see the note on `PATCH /users/me` in §3 — this
  field is no longer independently settable by the client).
- The public-profile endpoint (§9f) reuses this same cache/refresh logic, so
  viewing someone's public profile can trigger a live Strava refresh on
  their behalf if their cache is stale.

---

## 10. Error Responses

All errors follow this shape:

```json
// 401 Unauthorized
{ "detail": "Could not validate credentials" }

// 402 Payment Required — paid-circle join gate (§9h); detail is an object, not a string
{ "detail": { "message": "Paid circle — subscription required", "price_etb": 350, "circle_id": "uuid" } }

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

// 503 Service Unavailable — Cloudinary/Strava not configured, or Strava temporarily erroring
{ "detail": "Cloudinary is not configured" }
```

---

## 11. Frontend Flow Summary

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
        3. Pick interest_categories — one or more (required, min 1)
        4. Pick exercise_frequency (required)
        5. Suggest circles matching ANY selected interest (optional join);
           also offers joining an existing real circle or creating a new one
           (GET/POST /api/circles, POST /api/circles/:id/join), each with an
           inline "invite friends" action once joined/created
    → POST /api/users/me/onboard
    ↓
Home Screen (authenticated, onboarded)
    ↓
Tab Navigation: Home | Explore | Community | Profile
```

### Circle Invite Deep Link (E1)
```
User shares https://t.me/{bot}?startapp=circle_{join_code} (CircleDetailScreen "Invite friends")
    ↓
Recipient taps link → Telegram opens the Mini App with initDataUnsafe.start_param = "circle_{join_code}"
    ↓
Mini App completes the normal auth flow above, then AuthContext parses start_param
    ↓
POST /api/circles/join-by-code { join_code } → navigate to /circle/{id}
    ↓
Referral credit (+30 pts to both sides) fires later, on the invitee's first check-in — not here
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

## 12. CORS & Headers

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
