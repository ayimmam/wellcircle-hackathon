# Feature Plan — Booking Polish + Strava-style Circles

**Author's intent (from product owner):** ship four things — (1) a "pay after service"
note + payment removal in booking, (2) a proper notification icon, (3) an emoji
cleanup so the app doesn't look "vibe-coded", (4) a Strava-style activity feed
inside circles (post runs, comment, reply-to-comment, gift points via a coin,
plus in-app notifications when circle-mates post).

**How to use this doc:** work packages are ordered for execution. Do them top to
bottom. Each task lists **Files**, **Steps**, and an **Acceptance check**. Do not
skip the acceptance check. Run `npm run build` + `npm test` (frontend) and the
relevant backend test after each work package.

**Key discovery that shrinks the work:** the circles feed ALREADY has posts,
comments, and point-gifting reactions.
- Backend: `backend/app/models/post.py` (`Post`, `Reaction`, `PostComment`),
  `backend/app/crud/post.py`, `backend/app/api/posts.py` (verify exact filename),
  API client `getPosts / createPost / reactToPost / commentOnPost`.
- Frontend: `frontend/src/components/PostFeed.jsx` (compose, reactions, flat
  comments), rendered in `frontend/src/pages/CircleDetailScreen.jsx` under the
  "Chat" tab.
So WP4 EXTENDS these files; it does not create a parallel system.

**Global rules for every task (match how prior phases shipped):**
- Backend schema changes need BOTH an Alembic migration in
  `backend/alembic/versions/` AND an idempotent `apply_*.py` script
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), following `apply_migration.py`.
- New/changed request/response shapes MUST be updated in `docs/API_CONTRACT.md`.
- Every new backend field must also exist in `frontend/src/data/mock.js` so
  mock mode (`VITE_USE_MOCK=true`, used by tests) still renders.
- Add/extend tests following existing patterns (backend: a `test_*.py` run as a
  script; frontend: Vitest files under `frontend/src/test/`). New routes go in
  `routes.smoke.test.jsx`.
- Models use UUID PKs; the integration test runs on SQLite via TypeDecorators —
  prefer discrete typed columns over new JSONB where practical.

---

## Work Package 1 — Booking: "pay after service" note + remove payment step

**Why first:** self-contained, user-facing, no backend schema change, low risk.
**Decision locked:** remove payment from the CONSUMER booking flow only. Keep the
price visible, labelled as paid on-site after the service. Provider
subscriptions and product-point redemption are NOT touched.

### Task 1.1 — Add the "payment is only after using the service" line to service picking
**File:** `frontend/src/pages/BookingFlow.jsx` (Step 0, the `{step === 0 && ...}`
block, after the `<h2>Select a Service</h2>` at ~line 461).
**Steps:**
1. Under the section title, add a small helper line:
   `<p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{t('You only pay after using the service — no upfront payment.')}</p>`
2. Add the English string to `frontend/src/i18n.js` (and other locales if you can;
   English is required, others optional — `t()` falls back to the key).
**Acceptance:** on `/book/:providerId` step 1, the note shows above the service list.

### Task 1.2 — Remove the payment step; go straight to a "Booking Confirmed" summary
**Files:** `frontend/src/pages/BookingFlow.jsx`, `frontend/src/api/client.js`,
`frontend/src/pages/MyBookings.jsx`, `backend/app/schemas/booking.py`,
`backend/app/api/bookings.py`.
**Context:** today the flow is Service → Date/Time → Payment(Telebirr/M-Pesa +
phone) → poll → success screen. New flow: Service → Date/Time → **Confirm** →
"Booking Confirmed" summary. No payment method, no phone, no polling.

**⚠️ Business-logic constraint (verified against the code — do not skip):**
everything downstream of a booking fires only when `payment_status` becomes
`"success"` via `update_booking_payment()` in `backend/app/crud/booking.py`
(~line 45): the +50 booking-bonus points (ledger `TXN_BOOKING_BONUS`), the
provider-community feed event, the user inbox notification, AND first-time
presale-promo eligibility (`promotion_service.user_is_first_time` counts prior
*successful* bookings). Also `Booking.payment_method` is `nullable=False`
(`models/booking.py:20`) and `BookingCreate.payment_method` is required with
pattern `^(telebirr|mpesa)$` (`schemas/booking.py:21`). So the backend must
mark pay-on-site bookings successful at creation — otherwise every booking is
stuck yellow-"PENDING" in MyBookings and no points/notifications ever fire.

**Steps:**
1. `STEP_LABELS` (line 12): change `['Service', 'Date & Time', 'Payment']` →
   `['Service', 'Date & Time', 'Confirm']`.
2. Rename the Step 2 block (`{step === 2 && ...}`, ~line 528): keep the order
   summary card (service, dates/time, amount, platform fee, promo discount,
   total) but **DELETE** the payment-methods buttons, the phone-number input, and
   the "Order summary" heading text `Payment Method` → change to `t('Review & Confirm')`.
3. Under the total, add a note:
   `<p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 12 }}>{t('No payment now. Pay {{name}} directly after your service.', { name: provider.name })}</p>`
4. `canNext()` (line 129): for `step === 2`, return `true` (nothing left to fill).
5. The action button (`step === 2` branch, ~line 654): replace the `Pay ETB ...`
   button's `onClick={handlePay}` with a new `handleConfirm`, and label it
   `{t('Confirm Booking')}` (remove the coins icon + price from the label — price
   stays in the summary card above).
6. **`handleConfirm`** — replace `handlePay`'s body so it creates the booking but
   does NOT initiate payment or poll:
   ```js
   const handleConfirm = async () => {
     try {
       const [primaryDate, ...extraDates] = [...selectedDates].sort();
       const bk = await createBooking({
         provider_id: providerId,
         service_name: selectedService.name,
         slot_datetime: `${primaryDate}T${selectedTime}:00Z`,
         amount_etb: subtotal,
         payment_method: 'pay_on_site', // schema still requires the field — see step 9
         ...(eventId ? { event_id: eventId } : {}),
         ...(extraDates.length > 0
           ? { additional_slot_datetimes: extraDates.map(d => `${d}T${selectedTime}:00Z`) }
           : {}),
       });
       setBooking(bk);
       setPaymentStatus('success'); // reuse the success screen as the confirmation screen
       track('booking_confirmed', { provider_id: providerId, service: selectedService?.name, amount_etb: bk?.total_amount_etb ?? totalPrice, days: numDays });
     } catch (err) {
       showToast(err.message || 'Could not confirm booking. Try again.');
     }
   };
   ```
7. **DELETE / stop using:** `handlePay`, `handleRetryPayment`, `initiatePaymentFor`,
   the `usePolling(...)` payment poll block (~line 193), the `processing` screen
   (~line 382), the `failed` screen (~line 405), and the `paymentMethod` /
   `phoneNumber` / `pollAttemptsRef` state. Remove now-unused imports
   `initiateTelebirr, initiateMpesa, getPaymentStatus`.
8. **Confirmation screen** (the `paymentStatus === 'success'` block, ~line 312):
   keep it — it already shows a full summary (provider, service, date, time,
   amount, fee, promo, total). Change the "Total Paid" row label to
   `{t('Total (pay on-site)')}`, remove the `Payment` row (there is no method).
   The `+50 Legacy Points` chip STAYS — after step 9 the bonus really is awarded
   at confirmation.
9. **Backend — make `pay_on_site` a first-class, immediately-successful method:**
   - `backend/app/schemas/booking.py:21` — relax the pattern:
     `payment_method: str = Field(..., pattern="^(telebirr|mpesa|pay_on_site)$")`.
   - `backend/app/api/bookings.py` (`create_new_booking`) — after the primary +
     sibling bookings are created, add:
     ```python
     if request.payment_method == "pay_on_site":
         from app.crud.booking import update_booking_group_payment
         update_booking_group_payment(db, booking.id, group_id, "success")
     ```
     This reuses ALL existing success side-effects (+50 points via ledger,
     provider feed event, inbox notification, promo-eligibility bookkeeping)
     with zero new code paths. `payment_status="success"` here means "booking
     finalized" — acceptable because live payments were demo/auto-approve anyway.
   - **Fix the pre-existing bug in `trigger_booking_notification`
     (`api/bookings.py:24-27`):** it constructs
     `UserNotification(user_id=..., message=msg, is_read=False)` but the model
     (`models/user_notification.py`) has NO `message` column and `title` is
     `nullable=False` — this background task has been crashing silently on every
     booking. Fix to
     `UserNotification(user_id=user_id, type="booking", title="Booking confirmed", body=msg, action_url="/my-bookings")`.
     THEN check for double-notification: `update_booking_payment` on success also
     creates a `UserNotification` — keep exactly ONE of the two for the
     pay-on-site path (recommend: drop the `trigger_booking_notification`
     background-task call for pay_on_site and rely on `update_booking_payment`'s).
   - Do NOT remove the Telebirr/M-Pesa endpoints or `update_booking_payment` —
     subscriptions still use the payment services, and the method pattern still
     accepts telebirr/mpesa for API compatibility.
10. **`frontend/src/pages/MyBookings.jsx` (~lines 35-48)** — the status pill
   prints `payment_status` raw ("SUCCESS"). Map it for display:
   `success → 'Confirmed'` (green), `pending → 'Pending'` (yellow),
   `failed → 'Failed'`. Keep the raw value in data; only the label changes.
11. **Mock parity:** `createBooking` in `client.js` mock mode should return
   `payment_status: 'success'` for `payment_method: 'pay_on_site'` so mock/live
   behave identically.
12. Update `docs/API_CONTRACT.md`: booking create body now accepts
   `payment_method: "pay_on_site"` and documents the immediate-success behavior.
**Acceptance:** book a service end-to-end in `npm run dev` (mock mode) — Service →
Date/Time → Confirm shows the summary + "pay on-site" note → Confirm Booking shows
the confirmation screen. No Telebirr/M-Pesa UI appears anywhere in booking.
MyBookings shows the new booking as green "Confirmed", not "PENDING". Backend
test: a `pay_on_site` booking POST leaves the row with `payment_status='success'`,
the user +50 points richer (ledger row `booking_bonus`), and exactly one inbox
notification. `routes.smoke.test.jsx` still passes (update it if it asserts
payment UI).

---

## Work Package 2 — Fix the notification icon

**Why:** tiny, isolated, high visual payoff.
**File:** `frontend/src/components/Icon.jsx` — the `bell` entry (lines 27–32).
**Problem:** the current `bell` path is a rough polygon that doesn't read as a bell.
**Steps:**
1. Replace the `bell` paths with a clean, standard bell (Feather-style):
   ```jsx
   bell: (
     <>
       <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
       <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
     </>
   ),
   ```
2. Find where the notification icon is rendered (likely
   `frontend/src/components/Header.jsx` — `<Icon name="bell" .../>`) and confirm
   it still sizes correctly. No prop changes needed.
3. If an unread-count badge is desired, it's already likely handled by Header; do
   not add scope here unless it's missing.
**Acceptance:** the header notification icon renders as a recognizable bell in the
running app.

---

## Work Package 3 — Strava-style circle activity feed (FLAGSHIP)

**Why this is the headline feature and its own package:** it's the core value ask
(post runs, comment, reply, gift points, get notified). It builds on the existing
posts/comments/reactions system. Do it in the sub-order below: backend schema →
backend API → frontend feed → notifications. Ship backend before frontend so the
API client has something real to call (mock parity keeps tests green meanwhile).

### Decisions locked
- **Post creation:** manual. User writes an activity update with a title/note and
  OPTIONAL structured stats (activity type, distance, duration) and an OPTIONAL
  photo URL. No GPS/health tracking (none exists).
- **Feed location:** the existing per-circle "Chat" tab in `CircleDetailScreen`,
  upgraded into an "Activity" feed. Not a new global feed.
- **Replies:** one level deep (reply to a comment). No infinitely nested threads.
- **Point-gifting:** stays, but the gift action uses the **coin icon**
  (`<Icon name="coins" />`). Other reactions stay as emoji (e.g. 🔥 / 👏) —
  "the rest of the emoji icons are available."
- **Notifications:** IN-APP ONLY — CONFIRMED by product owner (reuse
  `user_notifications` inbox + the `/notifications` screen). NO Telegram bot DMs
  for post activity (avoids spam). If bot DMs are wanted later, that's a
  fast-follow, not this package.

### Task 3.1 — Backend schema: activity stats on posts + comment replies
**Files:** `backend/app/models/post.py`, a new
`backend/alembic/versions/006_circle_activity.py`, a new idempotent
`backend/apply_circle_activity_migration.py`.
**Steps:**
1. On `Post`, add nullable columns:
   - `activity_type = Column(String(30), nullable=True)`  # 'run','walk','ride','yoga','gym','swim','general'
   - `distance_km = Column(Numeric(6, 2), nullable=True)`
   - `duration_min = Column(Integer, nullable=True)`
   - `photo_url = Column(String(500), nullable=True)`
2. On `PostComment`, add:
   - `parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("post_comments.id"), nullable=True)`
   (NULL = top-level comment; set = a reply to that comment.)
3. Alembic migration `006_circle_activity.py`: `op.add_column(...)` for each of
   the five columns above; downgrade drops them.
4. `apply_circle_activity_migration.py`: mirror `apply_migration.py` — psycopg2,
   `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ...` (×4) and
   `ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id ...`.
**Acceptance:** `python -m app.tests.test_integration` (or the posts test) imports
cleanly; the new columns exist after running the apply script against a scratch DB.

### Task 3.2 — Backend API: accept stats on create, return replies nested
**Files:** `backend/app/crud/post.py`, the post Pydantic schema (check
`backend/app/schemas/` — if posts have no schema module yet, the router may take
an inline body; follow whatever `backend/app/api/posts.py` does today),
`backend/app/api/posts.py`, `docs/API_CONTRACT.md`.
**Steps:**
1. **Create post** — `crud/post.py: create_post(db, user_id, content, community_id, circle_id)`
   gains optional kwargs `activity_type=None, distance_km=None, duration_min=None,
   photo_url=None`, persisted onto the `Post` row. Extend the router's request
   body to match. All optional; a plain text post still works.
2. **Create comment** — `crud/post.py: create_comment(db, post_id, user_id, content)`
   gains optional `parent_comment_id=None`. Validate: the parent comment exists,
   belongs to the SAME post, and itself has `parent_comment_id IS NULL` (enforce
   single-level nesting) — else `HTTPException(422)`. Extend the router body.
3. **Read posts** — `crud/post.py: get_posts()` currently runs 2 extra queries
   PER POST (reactions loop at line ~37, comments at ~45 — a 41-query response at
   the default limit of 20). Since this serialization is being reshaped anyway,
   fix it per the project's Phase 6 no-N+1 rule: fetch ALL reactions for the page
   of post ids in one query and ALL comments (joined to `User`) in a second, then
   group in Python. Include the new activity fields on each post, and shape
   comments one level deep: top-level comments (`parent_comment_id IS NULL`) each
   get a `replies: [...]` array of their children. Sort comments and replies
   oldest-first (matches current `created_at.asc()` behavior).
4. Update `docs/API_CONTRACT.md`: post create body, comment create body, and the
   posts read response (new fields + `replies`).
**Acceptance:** a backend test creates a post with stats, a comment, and a reply to
that comment, then reads the feed and asserts the stats round-trip and the reply
appears under its parent's `replies`. Rejecting a 2nd-level reply returns 4xx.

### Task 3.3 — Backend: notify circle-mates when someone posts
**Files:** the posts create path (`backend/app/crud/post.py` or the router),
reusing `backend/app/models/user_notification.py`.
**Steps:**
1. After a post is created in a circle (`circle_id` set, and NOT a
   `is_system_event`), fan out `UserNotification` rows to every OTHER member of
   that circle:
   - `type='circle_activity'`
   - `title` = e.g. `f"{author_name} shared an activity in {circle_name}"`
   - `body` = a short preview (post content truncated, or e.g. "Ran 5.2 km — congratulate them!")
   - `action_url = f"/circle/{circle_id}"`
2. Do this as a single batched insert (get member IDs in one query, bulk-insert
   notifications) — no N+1, matching the Phase 6 scaling rule. Exclude the author.
3. Keep it best-effort: wrap in try/except so a notification failure never blocks
   the post from being created.
**Acceptance:** backend test — user A (in a circle with B and C) creates a post;
B and C each get one `circle_activity` notification with the circle `action_url`;
A gets none. Verify via `GET /api/users/me/notifications`.

### Task 3.4 — Frontend: activity composer + stats + replies + coin gifting
**File:** `frontend/src/components/PostFeed.jsx` (extend), plus
`frontend/src/api/client.js` (extend `createPost` / `commentOnPost` payloads) and
`frontend/src/data/mock.js` (add the new fields to mock posts so tests render).
**Steps:**
1. **Composer:** below the existing textarea, add an OPTIONAL expandable
   "Add activity details" section:
   - an activity-type selector (chips: Run / Walk / Ride / Yoga / Gym / Swim);
   - number inputs for distance (km) and duration (min);
   - a photo-URL input (keep it a URL field for now — no file upload backend yet;
     note this limitation in a comment).
   Pass these to `createPost({ content, circle_id, activity_type, distance_km,
   duration_min, photo_url })`. Empty details → omit them (plain post still works).
2. **Render activity:** when a post has `activity_type`, show a compact stat strip
   under the content (e.g. `Icon name="leaf"`/route pin + "Run · 5.2 km · 32 min").
   If `photo_url`, render the image (`max-width:100%`, rounded).
3. **Gifting → coin icon:** replace the 👏 / 🌟 / 💎 gift buttons with buttons that
   use `<Icon name="coins" />` + the point amount (e.g. `<Icon name="coins"/> Gift 5`,
   `Gift 10`, `Gift 50`). Keep `handleReact(post.id, 'coins', N)` semantics; the
   backend `Reaction.emoji` can store `'coins'` or keep the existing emoji value —
   pick one and keep it consistent with what `reactToPost` sends. Keep the plain
   emoji reactions (🔥 etc.) as-is — those are the "rest of the emoji icons."
4. **Replies:** render each top-level comment with its `replies` indented beneath
   it. Add a "Reply" action on each comment that opens an inline input. The
   current client signature is `commentOnPost(postId, content)` sending
   `{ content }` (`client.js:457`); extend it to
   `commentOnPost(postId, content, parentCommentId = null)` sending
   `{ content, ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}) }`,
   and call it with `comment.id` from the Reply input.
5. **Rename tab:** in `CircleDetailScreen.jsx`, the "Chat" tab label → "Activity"
   (keep the `key: 'chat'` internal key to avoid churn, or rename consistently).
   While in this file, note a verified live-mode quirk: `loadCircle()` (line ~30)
   sources the circle's name/description from `MOCK_CIRCLES` even in live mode
   (falling back to a generic `{ name: 'Circle' }`), and only merges
   `join_code`/`is_joined` from the real `getCircles()` response. Fix in passing:
   when the `getCircles()` match is found, also take `name`, `description`, and
   `member_count` from it so real circles display their real identity.
6. **Mock parity:** add `activity_type`/`distance_km`/`duration_min`/`photo_url` to
   a couple of `MOCK` posts and add a `replies: []` array to mock comments so the
   feed renders in mock mode and tests pass.
**Acceptance:** in `npm run dev`, inside a joined circle you can: post a run with
stats + see the stat strip; gift points via a coin button; comment; reply to a
comment (shows indented). `npm test` passes (add a PostFeed test asserting a run
post renders its stats and a reply renders under its parent).

### Task 3.5 — Frontend: surface activity notifications
**Files:** `frontend/src/pages/NotificationsScreen.jsx` (verify it renders the new
`circle_activity` type — it's generic, so likely already works), and optionally a
small "N new activities" nudge.
**Steps:**
1. Confirm `circle_activity` notifications render in `/notifications` (generic
   title/body/action_url list — should need no change; verify `action_url`
   `/circle/:id` navigates correctly).
2. Optional (nice-to-have, keep small): on the circle Activity tab, if there are
   posts newer than the user's last view, that's already visible in-feed — do not
   over-build. The in-app inbox is the notification surface.
**Acceptance:** creating a post as another user makes a `circle_activity` entry
appear in `/notifications`; tapping it opens that circle.

---

## Work Package 4 — Emoji cleanup (do LAST — single final pass)

**Why last:** WP1–WP3 add/rename UI. Sweeping emojis before that would let new
code re-introduce them. Do this as one final pass over the FINISHED UI.

### Policy — CONFIRMED by product owner (no further approval needed)
- **KEEP (untouched):** onboarding/signup screen emojis; the points-gifting
  **coin** (an `Icon` per WP3); feed **reaction** emojis (🔥/👏 etc.); the
  leaderboard medals **🥇🥈🥉** in `CircleDetailScreen.jsx` (rank is meaningful).
- **REMOVE / replace with `Icon.jsx` SVGs:** ALL decorative UI-chrome emojis —
  tab icons, buttons, section headers, empty-state icons, badges — AND the
  ✅/❌/✨/🎉-style **toast glyphs** (see the Toast refactor below).

### Task 4.1 — Toast refactor (removes ✅/❌ app-wide in one move)
**File:** `frontend/src/components/Toast.jsx` + every `showToast(...)` call site.
Today: `showToast(message, icon = '✨')` renders the raw emoji string in
`.toast-icon`. Change to a variant API:
1. `showToast(message, variant)` where `variant` ∈ `'success' | 'error' | undefined`.
2. `ToastContainer` renders `<Icon name="check" size={16} />` (green,
   `color: '#10b981'`) for `success`, `<Icon name="x" size={16} />` (red,
   `color: 'var(--danger)'`) for `error`, and NO icon otherwise. Drop the `'✨'`
   default.
3. Sweep every call site (`grep -rn "showToast(" frontend/src`): 2nd args that
   are success-ish emojis (✅ 🎉 📝 💬 ✨ …) → `'success'`; error-ish (❌ ⏳) →
   `'error'`; celebratory copy stays in the MESSAGE text, not the icon.
**Acceptance:** no `showToast` call passes an emoji; toasts render the SVG
check/x; existing toast-related tests updated and passing.

### Task 4.2 — Chrome emoji sweep (hit-list from code review; grep for the rest)
Run `grep -rnP "[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]" frontend/src` for the
full list (EXCLUDE onboarding files, feed reactions, and the 🥇🥈🥉 medals).
Known instances to convert:
- `CircleDetailScreen.jsx`: tab icons `💬 🏆 👥` → `Icon name="message-circle"/"trophy"/"users"`;
  `🔒` private (header + join-gate card) → new `lock` icon; `✅ You're a member` →
  `Icon name="check"`; `🤝 Join Circle` → plain text; `📤 Invite friends` →
  `Icon name="send"`; `👥` member-count chip → `Icon name="users"`; `👤` avatar
  fallback → `Icon name="user"`; `🌿` points → `Icon name="leaf"`; empty-state
  `🏆`/`👥` → `Icon`. Leaderboard `🥇🥈🥉` STAY.
- `PostFeed.jsx`: `📝 Post` → `Icon name="send"` + "Post"; `💬 Comment` →
  `Icon name="message-circle"`; `🌿 +N Legacy Points gifted` → `Icon name="leaf"`;
  `👤` fallbacks → `Icon name="user"`; empty-state `💬` → `Icon`. Gift buttons
  already coin-iconed in WP3; 🔥/👏 reactions STAY.
- `BookingFlow.jsx`: payment screens are deleted in WP1; on the surviving
  screens replace the `🏷` promo label with `Icon name="ticket"`.
- Everything else the grep finds (Home, Profile, Explore, promos' `⏳`, etc.):
  same rule — chrome → `Icon`, onboarding → untouched. Where no icon fits,
  plain text is fine; do not invent elaborate new glyphs.
- Add missing paths to `Icon.jsx` as needed: `lock` (coins, users, trophy,
  message-circle, send, leaf, check, x, user, ticket already exist).

**Acceptance:** the emoji grep over `frontend/src` returns only onboarding
files, feed reaction emojis, and 🥇🥈🥉. `npm run build` + `npm test` pass. App
visually scanned — no stray emoji in headers/tabs/buttons/toasts.

---

## Suggested branch / PR layout
- `feature/booking-no-payment` — WP1
- `fix/notification-icon` — WP2 (can fold into WP1 PR if trivial)
- `feature/circle-activity-feed` — WP3 (the big one; backend + frontend together)
- `chore/emoji-cleanup` — WP4 (last, after the others merge)

## Final verification before calling it done
- Frontend: `npm run build` ✅ and `npm test` ✅ (all suites, including
  `routes.smoke.test.jsx`).
- Backend: the new posts/activity test passes; `app.main` imports cleanly;
  `python -m app.tests.test_integration` shows no NEW failures (one pre-existing
  SQLite UUID failure is known/unrelated).
- `docs/API_CONTRACT.md` updated for every changed shape.
- `docs/HANDOFF.md` gets a new phase entry summarizing what shipped.
- Manual pass in `npm run dev`: booking (no payment) → circle post a run → comment
  → reply → gift via coin → notification appears in `/notifications`.
