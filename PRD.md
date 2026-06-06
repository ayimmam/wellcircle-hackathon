**Well Circle**

Product Requirements Document

_Hackathon Build - 1-Day Sprint_

Telegram Mini App | Ethiopia | Wellness Marketplace + Community

| **Version**          | **Status** | **Date**  | **Market** |
| -------------------- | ---------- | --------- | ---------- |
| v1.1 (Patch Applied) | DRAFT      | June 2026 | Ethiopia   |

**What's new in v1.1 (Patch)**

This document integrates the Personalized Engagement feature patch (**Section 6.6**) into the v1.0 base. Changes: Feature Priority Matrix updated · Section 6.6 (Personalized Engagement) added · Provider Dashboard renumbered to 6.7 · Users data model updated with two new columns · Demo Script Act 2 updated · API Section 8.5 updated with PATCH endpoint.

# **1\. Executive Summary**

Well Circle is a Telegram Mini App that connects individuals and corporate teams to verified wellness providers across Ethiopia. It solves a two-sided market problem: consumers lack a single discovery and accountability layer for wellness services, while providers have no efficient digital channel to reach them.

Hackathon Pitch in One Sentence: Well Circle is where your Telegram community becomes your gym buddy, your accountability group, and your wellness wallet - all without leaving the app.

## **1.1 What We Are Building Today**

Given a 1-day sprint with a frontend team, a backend team, and no-code tooling, we are scoping to one fully functional demo loop that impresses wellness provider partners with concrete ROI evidence.

| **Dimension**        | **Decision**                                                |
| -------------------- | ----------------------------------------------------------- |
| Target demo audience | Wellness providers / potential partners                     |
| Core working feature | Community Spaces + Group Joining with Live Feed             |
| Payment integration  | Telebirr (primary) + M-Pesa (secondary) - real transactions |
| Provider data        | Real confirmed partners (not dummy data)                    |
| Market               | Ethiopia / Addis Ababa (ETB currency)                       |
| Platform             | Telegram Mini App (WebApp)                                  |
| Backend              | Python / FastAPI                                            |
| Supporting tooling   | No-code / low-code for non-critical screens                 |

# **2\. Product Identity**

## **2.1 Name Rationale: Well Circle**

| **Element** | **Meaning**                                                                |
| ----------- | -------------------------------------------------------------------------- |
| Wella       | "Well" (wellness) + Amharic resonance of commitment and depth              |
| Circle      | Community-first positioning; mirrors Telegram's group culture              |
| Combined    | A serious wellness community - not a solo tracker, not a marketplace alone |

## **2.2 Tagline**

Your tribe, your wellness. Right where you chat.

## **2.3 Demo Persona**

Primary user shown in demo: Meron, an Addis Ababa-based 28-year-old HR manager who discovers a yoga studio through Well Circle, joins a corporate wellness community with her team, watches her Legacy Points accumulate in real time - and receives a personalised neighbourhood wellness alert that feels like magic.

Provider shown in demo: The confirmed wellness partner - shown their provider dashboard where community member count grows live during the demo, directly illustrating lead acquisition ROI.

# **3\. Problem Statement**

## **3.1 Consumer Pain**

- Provider fragmentation: Addis Ababa alone has hundreds of gyms, yoga studios, nutritionists, and therapists, all operating on Telegram DMs or word-of-mouth with no central discovery layer.
- Group coordination chaos: Telegram groups with manual Telebirr transfers collapse into confusion - no splits, no accountability, no booking confirmation.
- Consistency failure: Awareness of healthy habits is high; follow-through is low. There is no social friction to keep individuals accountable.

## **3.2 Provider Pain**

- Zero discovery infrastructure: Most wellness SMEs in Ethiopia have no CRM, no booking system, and no pipeline beyond Telegram or word-of-mouth referrals.
- No corporate B2B access: Corporate wellness budgets exist but providers cannot tap them at scale.
- No data: Providers cannot measure engagement, retention, or community health.

Core Insight: The gap is not between knowing and wanting - it is between wanting and doing. Well Circle closes that gap by embedding accountability and discovery directly inside Telegram, where Ethiopian users already spend hours daily. Telegram is the dominant messaging platform in Ethiopia.

# **4\. Hackathon Scope & Prioritization**

This is a 1-day build. Everything below is ruthlessly prioritized using a MUST SHIP / SHIP IF TIME / PLACEHOLDER framework. The demo must tell a coherent story in under 5 minutes.

## **4.1 Feature Priority Matrix**

v1.1 Update: Two Personalized Engagement features added (highlighted in green) - Demographic-based Notifications and Health App Connection. Both are SHIP IF TIME scope.

| **Feature**                                     | **Status**       | **Who Builds**                   | **Demo Role**               |
| ----------------------------------------------- | ---------------- | -------------------------------- | --------------------------- |
| Community Spaces - Join + Live Feed             | **MUST SHIP**    | Backend + Frontend               | Core demo loop              |
| Provider Marketplace - Browse + View Listing    | **MUST SHIP**    | Frontend + No-code data          | Shows inventory             |
| One-tap Booking Flow (UI only, no payment yet)  | **MUST SHIP**    | Frontend                         | Demo CTA                    |
| Telebirr Payment Integration (primary)          | **MUST SHIP**    | Backend                          | Proves real money           |
| M-Pesa Payment (Daraja STK Push, secondary)     | **MUST SHIP**    | Backend                          | Regional breadth            |
| Legacy Points - Earn on Check-in (display only) | **MUST SHIP**    | Frontend                         | Shows gamification          |
| Provider Dashboard - Live Member Count          | **MUST SHIP**    | Backend + Frontend               | ROI proof for partners      |
| User Onboarding via Telegram Auth               | **MUST SHIP**    | Backend                          | Required for Mini App       |
| Legacy Points Decay Logic (backend)             | SHIP IF TIME     | Backend                          | Shows sophistication        |
| Full Booking + Payment End-to-End               | SHIP IF TIME     | Backend + Frontend               | Wow factor                  |
| **Demographic-based Notifications**             | **SHIP IF TIME** | **Backend (DB only) + Frontend** | **Personalisation teaser**  |
| **Health App Connection (UI-only)**             | **SHIP IF TIME** | **Frontend only**                | **Engagement depth signal** |
| B2B / Corporate UI Screens                      | PLACEHOLDER      | No-code                          | Pitch slide only            |
| Full Rewards Marketplace                        | PLACEHOLDER      | No-code / mockup                 | Pitch slide only            |

# **5\. User Stories**

## **5.1 Consumer - Must Ship**

- As a Telegram user, I can launch Well Circle from a Telegram bot link so that I arrive at the Mini App home screen without downloading anything.
- As a new user, I am authenticated automatically via Telegram's initData so that I do not need to create a separate account.
- As a user, I can browse a list of verified wellness providers near me (Addis Ababa) with name, category, rating, and price range.
- As a user, I can view a provider's full listing page: services offered, photos, location, and a Book Now button.
- As a user, I can browse Community Spaces - topic or provider-linked groups - and see member count and a preview feed.
- As a user, I can join a Community Space with one tap, and immediately see the live feed update to show my join event.
- As a user, I can check in to a community space and see my Legacy Points balance increase on screen.
- As a user, I can initiate a booking and be prompted to pay via Telebirr or M-Pesa STK Push.

## **5.2 Consumer - Ship If Time (Personalization)**

New in v1.1 - aligned with pitch deck Slide 6: Smart Notifications

- As a user, I can opt in to local wellness alerts by selecting my neighbourhood in Addis Ababa on my Profile screen.
- As a user, I see a hyper-relevant wellness alert banner on the Home screen once my neighbourhood is saved.
- As a user, I can connect a health/fitness app (Apple Health, Google Fit) from my Profile to visualise my activity metrics within Well Circle.
- As a user, I can disconnect the health app connection at any time, returning to the default (unconnected) state.

## **5.3 Provider - Must Ship**

- As a wellness provider, I can see my provider dashboard showing total community members, today's new joins, and bookings received.
- As a provider, I can watch the member counter on my dashboard update in near-real-time during the demo (polling or websocket).
- As a provider, I can see which community spaces are linked to my listing and how active they are.

## **5.4 Provider - Ship If Time**

- As a provider, I can see individual booking requests with user Telegram handle and service requested.
- As a provider, I can receive an M-Pesa payment confirmation linked to a booking.

# **6\. Functional Specification**

## **6.1 Telegram Mini App Shell**

- Entry point: Telegram Bot with /start command that opens the Mini App via WebApp button.
- Auth: Read window.Telegram.WebApp.initDataUnsafe.user on load; POST to /auth/telegram to exchange for a session token (JWT). No separate login screen.
- Navigation: Bottom tab bar with 4 tabs - Home, Explore, Community, Profile.
- Theme: Respect Telegram's colorScheme (light/dark). Use CSS variables from Telegram.WebApp.themeParams.

## **6.2 Community Spaces - Core Feature**

### **6.2.1 Community List Screen**

- Displays all available Community Spaces as cards.
- Each card shows: Community name, linked provider name, member count, category tag (Yoga, Nutrition, Running, etc.), joined/not joined state.
- Filter bar: All | Joined | By Category.

### **6.2.2 Community Detail Screen**

- Header: Community name, provider logo, member count (live-updating badge), joined CTA button.
- Live Feed: Vertical scrollable list of activity events - joins, check-ins, bookings. Each event has user avatar (Telegram photo), username, action text, and timestamp.
- Feed updates via polling every 5 seconds (GET /communities/:id/feed?since=&lt;timestamp&gt;). No WebSocket required for MVP - polling is acceptable latency for demo.
- On Join: POST /communities/:id/join → optimistically update member count + append join event to feed.

### **6.2.3 Check-In**

- Button: Check In Today - one tap, one per day per community.
- POST /communities/:id/checkin → returns { points_earned: 10, new_balance: 120 }.
- Toast notification: +10 Legacy Points earned!
- Check-in button state changes to Checked in today (disabled) after use.

## **6.3 Marketplace - Browse & Listing**

- Home screen: Featured providers (real seeded partners) in a horizontally scrollable card row.
- Explore screen: Full grid of providers. Filterable by category (Gym, Yoga, Nutrition, Spa, Therapy).
- Provider card: Cover photo, name, category badge, star rating, price range (ETB), distance if geolocation granted.
- Provider detail screen: Photo gallery (max 5), services list with prices, location map pin (static image), associated Community Space card, Book Now CTA.

## **6.4 Booking Flow**

- Step 1 - Service selection: User selects service from provider's list.
- Step 2 - Date/time picker: Simple date and time slot selector (slots hardcoded per provider for MVP).
- Step 3 - Payment method: Two buttons - Pay with Telebirr and Pay with M-Pesa.
- Step 4 - Telebirr: User confirms phone number (pre-filled from Telegram profile if available). POST /payments/telebirr/initiate → returns toPayUrl or triggers OTP flow. Show pending spinner. Poll /payments/:id/status every 3 seconds.
- Step 4b - M-Pesa (alternative): Input phone number in 254XXXXXXXXX format. POST /payments/mpesa/initiate → triggers Daraja STK Push. Show pending spinner. Poll /payments/:id/status every 3 seconds.
- Step 5 - Confirmation: On payment success, show booking confirmation card with reference number. Append booking event to Community feed.

## **6.5 Legacy Points Engine**

Displayed on the Profile screen: Current balance, lifetime earned, a simple tier badge based on balance threshold.

| **Action**                  | **Points** | **Notes**                                     |
| --------------------------- | ---------- | --------------------------------------------- |
| Daily check-in              | +10        | One per day per community                     |
| Post receives 10+ reactions | +25        | Phase 2 - not in MVP; shown in pitch deck     |
| Complete a paid booking     | +50        | Phase 2 - not in MVP; shown in pitch deck     |
| 3 days inactive (decay)     | −5 / day   | APScheduler job; not surfaced visually in MVP |

Tiers based on cumulative balance:

| **Tier**  | **Range** | **Badge**   |
| --------- | --------- | ----------- |
| Seed 🌱   | 0-99      | Entry level |
| Sprout 🌿 | 100-299   | Emerging    |
| Grove 🌳  | 300-699   | Established |
| Forest 🌲 | 700+      | Elite       |

- Decay logic (backend): If no check-in for 3 consecutive days, balance decays by 5 points/day. Implemented in APScheduler - not surfaced visually in MVP.
- Redemption: Not active in MVP. Show Redeem Points button as greyed out with Coming Soon label.

## **6.6 Personalized Engagement ✦ NEW**

**Sprint note (v1.1 patch):**

Both sub-features are scoped to be lightweight. No new service integrations are required. Backend work is limited to a single DB migration. Health metrics are entirely simulated - zero real data is read or stored. Inspired by pitch deck Slide 6: Smart Notifications.

### **6.6.1 Demographic-Based Notifications ✦ NEW**

Goal: Surface hyper-local wellness alerts that feel relevant to the user, increasing perceived app value in the demo without requiring a full notification infrastructure.

**Opt-in flow:**

- On the Profile screen, below the Legacy Points tier badge, display a card: "Get local wellness alerts - tell us your neighbourhood."
- Tapping the card opens a bottom sheet with a short list of Addis Ababa neighbourhoods: Bole, Kazanchis, Piassa, CMC, Sarbet, Megenagna, Other.
- User selects one and taps Save. A PATCH to /users/me persists location_neighborhood to the DB.
- The card updates to: "✓ Showing alerts for \[Neighbourhood\]" - no further backend logic required for MVP.

**Notification display (frontend-only for MVP):**

- After a neighbourhood is saved, inject a single simulated alert banner into the Home screen feed: e.g., "New yoga session opening in Bole this Saturday - 3 spots left."
- This banner is hardcoded per neighbourhood (map of neighbourhood → alert string in the frontend). No dynamic query or push infrastructure is needed.
- If no neighbourhood is saved, the banner is not shown.

Backend requirement: DB column only - see Section 7.2. No new endpoints beyond the existing PATCH /users/me.

### **6.6.2 Health App Integration (UI-Only) ✦ NEW**

Goal: Signal product vision for wearable/health data integration without building any real integration. Entirely a frontend concern - no backend changes required.

Entry point: Profile tab → new row below joined communities: "Health & Activity".

| **State**              | **UI**                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| Disconnected (default) | Button: Connect Health App (outlined, secondary colour)                          |
| Connected              | Button changes to ✓ Connected (filled, accent colour); mock metrics appear below |

**Mock metrics displayed in Connected state:**

- Steps this week: 6,240
- Active minutes: 48 min
- Wellness score: 72 / 100 (Well Circle index)

These values are hardcoded constants in the frontend. They do not change between sessions and are never sent to the backend.

**Toggle behaviour:**

- Tapping ✓ Connected disconnects (returns to default state).
- State is stored in React component state (or localStorage for persistence across sessions - frontend team's discretion).
- health_app_connected in the DB (see Section 7.2) may optionally be synced via PATCH /users/me if time permits, but is not required for the demo.

Demo talking point: "In Phase 2, this pulls real data from Apple Health, Google Fit, or Garmin - and your Legacy Points engine rewards consistent activity automatically."

### **6.6.3 Future Notification Types (Pitch Deck Vision - Phase 2)**

The following notification types are shown in the investor pitch (Slide 6) as part of the Smart Notifications vision. They are out of scope for the hackathon but should inform Phase 2 engineering design.

| **Type**          | **Trigger**                                  | **Example Message**                                                                     |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Location-Aware    | Neighbourhood opt-in (MVP above)             | "A yoga studio near Bole is offering a free first class this Saturday."                 |
| Health-Synced     | Health app connection detects low step count | "Your step count is below your usual - your Circle has a class at 6pm."                 |
| Habit Reminders   | Missed daily check-in by 8pm                 | "Skipped a check-in? Your Circle noticed. Still time before midnight. 💪"               |
| Milestone Moments | 7-day streak reached                         | "You've been active for 7 days straight - you're on a streak! Your Circle is watching." |

Privacy: All notification types are always opt-in. Users choose what to share. Privacy is a feature, not a footnote. - Pitch Deck Slide 6

## **6.7 Provider Dashboard**

_Renumbered from 6.6 in v1.0 to accommodate new Section 6.6 (Personalized Engagement)._

Why This Screen Matters: This is the screen you show the wellness partner in the room during the demo. It must be beautiful, live, and data-rich. Build it with the same care as the consumer app.

- Access: Separate route /provider/dashboard - provider logs in via Telegram handle whitelisted in DB.
- KPI cards (top row): Total Community Members | New Members Today | Bookings This Week | Estimated Revenue (ETB).
- Live Member Feed: Same polling pattern as consumer feed. Shows new joins in real time.
- Community performance list: Each linked community space with member count, check-ins today, engagement rate.
- Bookings table: Booking ID, user handle, service, date, amount, payment status.

# **7\. Technical Architecture**

## **7.1 Stack Decisions**

| **Layer**          | **Choice**                                      | **Rationale**                                       |
| ------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Frontend           | React + Vite (Telegram Mini App)                | Fast builds; Telegram SDK integrates cleanly        |
| Backend            | Python FastAPI                                  | Team comfort; async support for polling endpoints   |
| Database           | PostgreSQL (Supabase)                           | Free tier; real-time capable; instant setup         |
| Auth               | Telegram initData HMAC validation               | No password; zero friction for demo                 |
| Payment - Telebirr | Telebirr Open API (Ethio Telecom)               | Primary payment rail for Ethiopia; highest adoption |
| Payment - M-Pesa   | Safaricom Daraja API (STK Push)                 | Secondary; signals cross-border readiness           |
| Scheduler          | APScheduler (in-process)                        | Points decay job; no Redis needed for MVP           |
| Hosting            | Railway or Render (FastAPI) + Vercel (frontend) | Free tier; deploy in < 10 min                       |
| No-code screens    | Softr or Glide for B2B / corporate placeholder  | Unblock frontend team                               |

## **7.2 Data Models**

v1.1 Update: Two new columns added to the users table - location_neighborhood and health_app_connected. See migration SQL below.

### **users**

| **Field**                 | **Type**    | **Notes**                                                                                                     |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| id                        | UUID        | PK                                                                                                            |
| telegram_id               | BIGINT      | UNIQUE - from Telegram initData                                                                               |
| username                  | TEXT        |                                                                                                               |
| photo_url                 | TEXT        | Telegram CDN URL                                                                                              |
| points_balance            | INTEGER     | DEFAULT 0                                                                                                     |
| last_checkin_at           | TIMESTAMP   | For decay logic                                                                                               |
| is_provider               | BOOLEAN     | DEFAULT false                                                                                                 |
| **location_neighborhood** | **TEXT**    | **Nullable. Set on opt-in. Used for local alert banner targeting (frontend lookup).**                         |
| **health_app_connected**  | **BOOLEAN** | **DEFAULT false. Optional sync only - not required for demo. Frontend state is the source of truth for MVP.** |
| created_at                | TIMESTAMP   |                                                                                                               |

**Migration note:**

Add both columns in a single ALTER TABLE statement. Neither column has a NOT NULL constraint, so the migration is safe to run on existing rows without a backfill.

ALTER TABLE users

ADD COLUMN location_neighborhood TEXT,

ADD COLUMN health_app_connected BOOLEAN DEFAULT false;

### **providers**

| **Field**       | **Type**        | **Notes**                                  |
| --------------- | --------------- | ------------------------------------------ |
| id              | UUID            | PK                                         |
| name            | TEXT            | Real partner name                          |
| category        | TEXT            | gym \| yoga \| nutrition \| spa \| therapy |
| description     | TEXT            |                                            |
| location_text   | TEXT            | e.g. Bole, Addis Ababa                     |
| lat / lng       | FLOAT           | For map pin                                |
| price_range     | TEXT            | e.g. ETB 500-5000                          |
| rating          | FLOAT           | Seeded from real reviews                   |
| cover_photo_url | TEXT            |                                            |
| owner_user_id   | UUID FK → users |                                            |

### **communities**

| **Field**    | **Type**            | **Notes**                               |
| ------------ | ------------------- | --------------------------------------- |
| id           | UUID                | PK                                      |
| provider_id  | UUID FK → providers |                                         |
| name         | TEXT                |                                         |
| category     | TEXT                |                                         |
| member_count | INTEGER             | DEFAULT 0 - Denormalized for fast reads |
| created_at   | TIMESTAMP           |                                         |

### **community_members**

| **Field**    | **Type**                | **Notes** |
| ------------ | ----------------------- | --------- |
| community_id | UUID FK                 |           |
| user_id      | UUID FK                 |           |
| joined_at    | TIMESTAMP               |           |
| PRIMARY KEY  | (community_id, user_id) |           |

### **community_feed_events**

| **Field**    | **Type**  | **Notes**                             |
| ------------ | --------- | ------------------------------------- |
| id           | UUID      | PK                                    |
| community_id | UUID FK   |                                       |
| user_id      | UUID FK   |                                       |
| event_type   | TEXT      | join \| checkin \| booking            |
| metadata     | JSONB     | { service_name, amount } for bookings |
| created_at   | TIMESTAMP | Indexed for feed polling query        |

### **bookings**

| **Field**         | **Type**  | **Notes**                              |
| ----------------- | --------- | -------------------------------------- |
| id                | UUID      | PK                                     |
| user_id           | UUID FK   |                                        |
| provider_id       | UUID FK   |                                        |
| service_name      | TEXT      |                                        |
| slot_datetime     | TIMESTAMP |                                        |
| amount_etb        | INTEGER   | Amount in Ethiopian Birr               |
| payment_method    | TEXT      | telebirr \| mpesa                      |
| payment_status    | TEXT      | pending \| success \| failed           |
| telebirr_trade_no | TEXT      | Telebirr outTradeNo for reconciliation |
| mpesa_checkout_id | TEXT      | Daraja CheckoutRequestID (M-Pesa only) |
| created_at        | TIMESTAMP |                                        |

# **8\. API Specification (FastAPI)**

## **8.1 Auth**

| **Method** | **Endpoint**   | **Description**                                                                        |
| ---------- | -------------- | -------------------------------------------------------------------------------------- |
| POST       | /auth/telegram | Validate Telegram initData HMAC; return JWT + user object. Create user if first login. |

## **8.2 Providers**

| **Method** | **Endpoint**         | **Description**                                                             |
| ---------- | -------------------- | --------------------------------------------------------------------------- |
| GET        | /providers           | List all providers. Query params: category, search.                         |
| GET        | /providers/:id       | Full provider detail including services array, photos, linked community_id. |
| GET        | /providers/:id/stats | Provider dashboard stats. Auth required (provider only).                    |

## **8.3 Communities**

| **Method** | **Endpoint**             | **Description**                                                                                        |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| GET        | /communities             | List communities. Query param: joined=true filters to user's joined communities.                       |
| GET        | /communities/:id         | Community detail + member count + user joined status.                                                  |
| POST       | /communities/:id/join    | Join community. Increments member_count. Inserts feed event. Idempotent.                               |
| POST       | /communities/:id/leave   | Leave community. Decrements member_count.                                                              |
| POST       | /communities/:id/checkin | Daily check-in. Enforces one-per-day. Returns points_earned, new_balance. Inserts feed event.          |
| GET        | /communities/:id/feed    | Paginated feed events. Query param: since=&lt;ISO timestamp&gt; for polling. Returns newest 20 events. |

## **8.4 Bookings & Payments**

| **Method** | **Endpoint**                 | **Description**                                                                                                        |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST       | /bookings                    | Create booking record (status: pending). Body: provider_id, service_name, slot_datetime, payment_method, phone_number. |
| POST       | /payments/telebirr/initiate  | Initiate Telebirr payment. Returns toPayUrl. Stores outTradeNo on booking.                                             |
| POST       | /payments/telebirr/callback  | Telebirr notifyUrl callback. Updates booking payment_status.                                                           |
| POST       | /payments/mpesa/initiate     | Trigger Daraja STK Push. Returns checkout_request_id.                                                                  |
| POST       | /payments/mpesa/callback     | Daraja callback URL. Updates booking payment_status.                                                                   |
| GET        | /payments/:booking_id/status | Poll payment status. Frontend calls every 3s after initiating payment.                                                 |

## **8.5 Users**

v1.1 Update: PATCH /users/me added to support neighbourhood opt-in (location_neighborhood) and optional health app sync (health_app_connected).

| **Method** | **Endpoint**             | **Description**                                                                                                                                    |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET        | /users/me                | Current user profile: username, photo_url, points_balance, tier, joined communities, location_neighborhood, health_app_connected.                  |
| GET        | /users/me/points-history | Last 10 point transactions (earn/decay events).                                                                                                    |
| **PATCH**  | **/users/me**            | **Update profile fields. Body: { location_neighborhood?: string, health_app_connected?: boolean }. Used by Personalized Engagement opt-in flows.** |

# **9\. Frontend Screen Map**

v1.1 Update: Profile screen updated - now includes neighbourhood opt-in card and Health & Activity section.

| **Screen**           | **Tab**   | **Must Ship?** | **Key Components**                                                                                                                   |
| -------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Splash / Auth        | -         | Yes            | Auto-auth on load; loading spinner                                                                                                   |
| Home                 | Home      | Yes            | Featured provider cards (horizontal scroll); Neighbourhood alert banner (if opted in); Quick join community CTA; Points balance chip |
| Explore              | Explore   | Yes            | Provider grid; Category filter chips; Search bar                                                                                     |
| Provider Detail      | Explore   | Yes            | Photo gallery; Services list; Book Now button; Linked community card                                                                 |
| Community List       | Community | Yes            | Community cards with member count; Joined/Explore tabs                                                                               |
| Community Detail     | Community | Yes            | Live feed; Member count badge; Check-in button; Join button                                                                          |
| Booking Flow         | Explore   | Yes            | 3-step: Service → Date/Time → Payment                                                                                                |
| Telebirr Payment     | Booking   | Yes            | OTP or redirect flow; polling status                                                                                                 |
| M-Pesa Payment       | Booking   | Yes            | Phone input; STK Push pending state; Polling status                                                                                  |
| Booking Confirmation | Booking   | Yes            | Reference card; +points earned; Share to Telegram button                                                                             |
| Profile              | Profile   | Yes            | Points balance; Tier badge; Neighbourhood opt-in card; Joined communities list; Health & Activity section (new); Redeem (greyed)     |
| Provider Dashboard   | /provider | Yes            | KPI cards; Live feed; Bookings table                                                                                                 |
| B2B Corporate Screen | -         | Placeholder    | Static no-code mockup; shown in pitch slide only                                                                                     |

# **10\. Demo Script (5 Minutes)**

v1.1 Update: Act 2 extended by 30 seconds to include the Personalization Teaser beat. Total demo time is now ~5 minutes.

Demo Goal: The wellness provider in the room must leave thinking: 'Well Circle gives me something I cannot get anywhere else - a live, growing, measurable community of paying customers inside an app my users already use.'

## **Act 1 - The Problem (30 seconds)**

- Open with two screens side by side: a chaotic WhatsApp group (payment screenshots, confusion) vs Well Circle.
- Say: "This is how your customers find you today. Here is what we built instead."

## **Act 2 - Consumer Experience (2 minutes)**

_Consumer journey through discovery, community, and personalisation._

- Open Telegram → click bot link → Well Circle loads instantly. No download.
- Navigate to Explore → show real partner listing - photos, services, ETB pricing.
- Tap into Community Spaces → show the provider's community with member count.
- Tap Join → member count increments on screen. Tap Check In → toast: +10 Legacy Points.
- Live feed shows the join event - username, timestamp, action.

**- Personalization Teaser (30 seconds - new in v1.1) -**

Navigate to Profile → tap "Get local wellness alerts" → select Bole from the neighbourhood picker → tap Save.

Return to Home - a contextual banner appears: "New yoga session opening in Bole this Saturday - 3 spots left."

Scroll to Health & Activity → tap Connect Health App → button flips to ✓ Connected and mock metrics animate in (Steps: 6,240 · Active mins: 48 · Wellness score: 72).

Say: "In 30 seconds, the app knows where you live and what you're tracking - and it can start making your feed feel personal. This is what Phase 2 looks like."

## **Act 3 - The Money (60 seconds)**

- Tap Book Now → select service → select time slot → tap Pay with Telebirr.
- Confirm Ethiopian phone number → Telebirr OTP or redirect flow triggers.
- Show phone receiving Telebirr payment prompt (use sandbox or real test number).
- Payment confirms → booking confirmation card appears → feed event fires.

## **Act 4 - Provider ROI (90 seconds)**

- Switch to Provider Dashboard (open on laptop / second screen).
- Show KPI cards: community members, new joins today, bookings this week.
- Say: "Every time a user joins your community in Well Circle, you see it here, in real time. No more invisible customers."
- Show bookings table - the booking just made appears with payment status: Confirmed.
- Say: "This is your acquisition pipeline. No marketing agency. No Instagram spend. Just your Telegram community, working for you."

## **Act 5 - Vision Close (30 seconds)**

- Flash the Phase 2 / Phase 3 roadmap slide.
- Say: "Today: marketplace and community. Month 3: Circles, leaderboards, smart notifications, wellness products store. Month 6: your corporate wellness pipeline."
- End on the tagline: Your tribe, your wellness. Right where they chat.

# **11\. Hackathon Build Timeline**

Principle: The backend team unblocks the frontend team by Hour 4. After that, integration only - no new features without agreement from both leads.

| **Time Block** | **Backend**                                                                                                           | **Frontend**                                                                   | **No-code**                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Hour 1-2       | FastAPI scaffold + Supabase setup + Telegram auth endpoint                                                            | Telegram Mini App shell + bottom nav + theme vars                              | Set up Softr/Glide for B2B placeholder screens |
| Hour 3-4       | Providers API + Communities API + seed real partner data + DB migration (location_neighborhood, health_app_connected) | Home screen + Explore screen + Provider detail                                 | Seed B2B screen content                        |
| Hour 5-6       | Community join / check-in / feed polling endpoints + PATCH /users/me                                                  | Community list + Community detail + live feed polling                          | Corporate page polish                          |
| Hour 7-8       | Telebirr Open API integration + M-Pesa Daraja integration + booking endpoints                                         | Booking flow (3 steps) + payment screens + confirmation                        | Review & hand off mockups                      |
| Hour 9-10      | Provider dashboard stats endpoint + payment callback handling                                                         | Provider dashboard (KPI cards + live feed + bookings table)                    | -                                              |
| Hour 11-12     | Points decay scheduler + bug fixes + end-to-end test                                                                  | Profile screen (neighbourhood opt-in + Health & Activity) + polish + bug fixes | -                                              |
| Final 30 min   | Deploy to Railway/Render + smoke test all endpoints                                                                   | Deploy to Vercel + configure bot + final smoke test                            | -                                              |

# **12\. Payment Integration Guide**

## **12.1 Telebirr - Open API (Primary)**

- Register at developer.ethiotelecom.et for Telebirr Open API credentials. Sandbox provisioning can take 1-2 business days - apply before hackathon day.
- Flow: POST /payment/create with merchantCode, outTradeNo (unique per transaction), subject, totalAmount (in ETB), returnUrl, notifyUrl.
- Response contains a toPayUrl - open via Telegram.WebApp.openLink(toPayUrl) to launch the Telebirr payment screen.
- Telebirr sends an async POST notification to your notifyUrl on payment completion. Parse the resultCode - 0 = success.
- Store outTradeNo on booking record to reconcile the async callback to the correct booking.

Telebirr Sandbox Note: Telebirr sandbox credentials from Ethio Telecom may take 1-2 days to provision. Apply before hackathon day. If not ready in time, see Fallback Plan below.

## **12.2 M-Pesa - Daraja STK Push (Secondary)**

- Register at developer.safaricom.co.ke - sandbox credentials available immediately.
- Flow: POST /mpesa/stkpush with BusinessShortCode, PassKey, Amount, PhoneNumber (254XXXXXXXXX format), CallBackURL.
- CallBackURL must be publicly reachable - use ngrok during development, Railway URL in demo.
- On callback: parse Body.stkCallback.ResultCode - 0 = success.
- Store CheckoutRequestID from initiation response to match to callback.

Fallback Plan: If Telebirr sandbox is not provisioned in time: build the full Telebirr UI flow, display a simulated success state using a mocked response, and disclose this honestly in the demo as 'awaiting production key'. M-Pesa via Daraja can serve as the live payment proof instead - sandbox is available immediately.

# **13\. Risks & Mitigations**

| **Risk**                                     | **Likelihood** | **Impact** | **Mitigation**                                                                                                                                                                      |
| -------------------------------------------- | -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telebirr sandbox not provisioned in time     | High           | High       | Apply for credentials before hackathon day. If blocked, use mocked success state for Telebirr UI; fall back to M-Pesa Daraja (sandbox available immediately) as live payment proof. |
| M-Pesa STK Push fails in demo                | Medium         | Low        | M-Pesa is secondary payment. Test with Safaricom sandbox. Have a pre-recorded screen capture as backup if needed.                                                                   |
| Feed polling too slow for live demo          | Low            | High       | Reduce poll interval to 2s for demo. Pre-seed a join event to fire 30 seconds into demo.                                                                                            |
| Provider dashboard not ready                 | Medium         | Critical   | This is the pitch centrepiece. Assign most senior frontend dev here from Hour 9.                                                                                                    |
| Telegram Mini App CSP issues                 | Low            | Medium     | Test Mini App loading from Bot early (Hour 2). Use Telegram's test bot for development.                                                                                             |
| Database schema changes mid-sprint           | Medium         | High       | Freeze schema after Hour 4 (post-migration). Backend returns to no schema changes after that point.                                                                                 |
| No-code tools too slow to deploy             | Low            | Low        | B2B placeholder is pitch-slide only. Skip if no-code setup takes > 1 hour.                                                                                                          |
| **Personalization feature delays core work** | **Low**        | **Medium** | **Both 6.6.1 and 6.6.2 are SHIP IF TIME. Cut immediately if core features are at risk. Health app UI is pure frontend - never blocks backend.**                                     |

# **14\. Success Metrics**

## **14.1 Hackathon Day - Definition of Done**

- A real user can open Well Circle from a Telegram bot link on their phone.
- That user can join a community and see the member count increment.
- That user can check in and see Legacy Points update.
- That user can initiate a Telebirr payment and complete the OTP or redirect flow (or a confirmed sandbox equivalent).
- A provider can view their dashboard and see the member join reflected in real time.
- (Stretch) Profile shows neighbourhood alert banner after opt-in. Health app mock metrics display on connect.

## **14.2 Post-Hackathon - 90-Day Targets**

| **Metric**                             | **Target**                       | **How Measured**                                           |
| -------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Provider listings live                 | 10 verified Addis Ababa partners | Provider DB count                                          |
| Telegram Mini App monthly active users | 500 MAU                          | Telegram analytics + /users/me calls                       |
| Community join rate                    | 60% of users join 1+ community   | community_members table / users table                      |
| Daily check-in rate (DAU proxy)        | 25% DAU                          | community_feed_events type=checkin / MAU                   |
| Telebirr bookings                      | 50 paid bookings / month         | bookings table payment_status=success                      |
| Provider dashboard weekly sessions     | 3+ sessions / provider / week    | Server access logs on /provider/dashboard                  |
| **Neighbourhood opt-in rate**          | **20% of users**                 | **users.location_neighborhood not null / total users**     |
| **Health app connect rate**            | **10% of users**                 | **users.health_app_connected = true or localStorage flag** |

# **15\. Appendix**

## **15.1 Out of Scope for Hackathon**

- Tribe Vault / group wallet / auto-split payments.
- Full Legacy Points redemption marketplace.
- Corporate Benefits Portal.
- Rotating Wellness Savings Pool.
- Targeted ad network.
- Push notifications (Telegram bot messages can substitute for MVP).
- Provider self-onboarding flow (manual seed for hackathon).
- Real health data integration - Apple Health / Google Fit / Garmin API (Phase 2).
- Dynamic push notification infrastructure (Phase 2 - placeholder hardcoded in MVP).
- Circles user-created groups + weekly leaderboards (Month 3 roadmap).
- Wellness products store (Month 3 roadmap).
- Community posts with reaction-based Legacy Points gifting (Month 3 roadmap).

## **15.2 Phase Roadmap (from Pitch Deck)**

| **Phase**     | **Timeline**        | **Key Deliverables**                                                                                                                                                                 |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hackathon MVP | Day 1               | Marketplace + booking · Community Spaces + live feed · Telebirr + M-Pesa · Legacy Points (earn & display) · Provider dashboard · Personalized Engagement teaser (SHIP IF TIME)       |
| Month 3       | Circles & Community | Circles - user-created groups · Weekly leaderboards · Smart notifications (opt-in infrastructure) · Wellness products store · Community posts + reactions with Legacy Points gifting |
| Month 6       | Scale               | Corporate wellness portal (B2B) · Group savings pools + auto-split · Full Legacy Points redemption · National provider expansion · Cross-border (Diaspora wellness)                  |

## **15.3 Naming Notes**

- Bot handle suggestion: @WellCircleBot
- Mini App title shown in Telegram: Well Circle
- Provider dashboard subdomain suggestion: providers.wellcircle.app

## **15.4 Environment Variables Checklist**

| **Variable**           | **Used By**                 | **Source**                                     |
| ---------------------- | --------------------------- | ---------------------------------------------- |
| TELEGRAM_BOT_TOKEN     | Backend auth validation     | BotFather                                      |
| SUPABASE_URL           | Backend DB                  | Supabase dashboard                             |
| SUPABASE_SERVICE_KEY   | Backend DB                  | Supabase dashboard                             |
| TELEBIRR_MERCHANT_CODE | Telebirr payment (primary)  | Ethio Telecom developer portal                 |
| TELEBIRR_APP_KEY       | Telebirr payment (primary)  | Ethio Telecom developer portal                 |
| TELEBIRR_NOTIFY_URL    | Telebirr async callback     | Your Railway URL + /payments/telebirr/callback |
| MPESA_CONSUMER_KEY     | Daraja STK Push (secondary) | developer.safaricom.co.ke                      |
| MPESA_CONSUMER_SECRET  | Daraja STK Push (secondary) | developer.safaricom.co.ke                      |
| MPESA_SHORTCODE        | Daraja STK Push (secondary) | Safaricom                                      |
| MPESA_PASSKEY          | Daraja STK Push (secondary) | Safaricom                                      |
| MPESA_CALLBACK_URL     | Daraja callback             | Your Railway URL + /payments/mpesa/callback    |
| JWT_SECRET             | Session tokens              | Generate locally: openssl rand -hex 32         |

_Well Circle PRD v1.1 | Personalized Engagement integrated | Hackathon Build | Confidential | June 2026_