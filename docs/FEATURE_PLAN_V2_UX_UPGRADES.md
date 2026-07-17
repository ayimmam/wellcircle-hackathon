# Feature Plan V2 — UX Upgrades (Location, Booking, Ranks, Feedback)

**For the executing model (Sonnet):** work phases top to bottom. Every phase is
independently shippable — finish a phase, run its acceptance checks, and the app
must be releasable before starting the next. Do NOT skip acceptance checks. Do
NOT start a later phase to "batch" work.

**Owner decisions already locked (do not re-ask):**
- Nearby events/facilities: **both** a Home "Near you" section **and** an
  Explore "Near me" filter, using **neighbourhood text matching** (no GPS).
- Ranks metric: **weekly points, trailing 7 days** (matches existing circle
  leaderboard math from the points ledger).
- Bug reports + health-app wishlist: **backend table + Admin dashboard tab**.
- Back buttons: standardize on the **`chevron-left` Icon** (`<`), not `←`.
- Time format: default **AM/PM**, auto-detect via `Intl` where possible,
  user-editable in Profile.
- Phone numbers: **country-code selector** (Ethiopia default) + national
  number; validation rules in Phase 3.2.

**Documented corrections/assumptions (flagged for the owner, not blockers):**
- The owner wrote "09 or 07 followed by 7 digits". Real Ethiopian mobile
  numbers are `09`/`07` + **8** digits (10 digits total; E.164 `+251` + 9
  digits). This plan specs 8. If the owner truly wants 7, change one constant
  in `frontend/src/utils/phone.js`.
- Telegram's WebApp API does **not** expose the device's 12/24-hour setting.
  `Intl.DateTimeFormat().resolvedOptions().hourCycle` in the WebView is the
  closest signal (reflects device locale, imperfect) — used as the default,
  Profile setting wins.

---

## Global rules (apply to every task)

1. **Match prior phases' conventions** (see `docs/HANDOFF.md`):
   - Backend schema changes need BOTH an Alembic migration in
     `backend/alembic/versions/` (next numbers: `010`, `011`) AND an
     idempotent `backend/apply_*.py` psycopg2 script
     (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT
     EXISTS`), modeled on `apply_circle_activity_migration.py`.
   - Every new/changed request/response shape → update `docs/API_CONTRACT.md`.
   - Every new backend field/endpoint → mock parity in
     `frontend/src/data/mock.js` + `frontend/src/api/client.js` (tests run in
     mock mode, `VITE_USE_MOCK=true`).
   - Models use UUID PKs; backend tests run on SQLite via the
     `PatchedUUID`/`PatchedJSONB` TypeDecorator pattern — copy the header of
     `backend/app/tests/test_circle_activity.py` for any new backend test.
     Run backend tests as scripts with env vars:
     `DATABASE_URL="postgresql://user:pass@localhost:5432/testdb" TELEGRAM_BOT_TOKEN=test JWT_SECRET=test BOT_API_KEY=test PYTHONIOENCODING=utf-8 python -m app.tests.test_<name>`
   - Frontend: `npm test` (Vitest, mock mode) and `npm run build` must pass
     after every phase. New routes/screens → add to
     `src/test/routes.smoke.test.jsx`.
2. **No decorative emoji** in new UI — use `frontend/src/components/Icon.jsx`
   SVGs. Exceptions that stay emoji: onboarding screens, feed reactions
   (🔥/👏), 🥇🥈🥉 medals, the 🔥 streak indicator, tier badges (🌱🌿🌳🌲),
   category emoji in `constants.js`/`mock.js`.
3. **Toasts** use the variant API: `showToast(message, 'success'|'error')` or
   no second arg. Never pass an emoji.
4. **No N+1 queries** — batch aggregates (see `crud/post.py: get_posts` for
   the pattern).
5. **i18n**: every new user-facing English string added via `t('...')` with
   the key registered in `frontend/src/i18n.js`'s `en` block (other languages
   optional — `t()` falls back to the key).
6. Booking business model (do not regress): bookings are created
   `payment_status: "pending"`; staff call the guest to confirm; nothing is
   auto-confirmed; Kuriftu bookings also sync to Google Sheets
   (`backend/app/services/sheets.py`). There is NO in-app payment in the
   consumer booking flow.

---

## Phase 1 — Quick visual & behavior fixes (frontend only, zero backend)

### Task 1.1 — Standardize back buttons on the chevron icon (owner item: back-button consistency)
Some screens render a literal `←` character; others already use
`<Icon name="chevron-left" />`. Standardize ALL on the Icon.
**Files (verified exact occurrences of `←`):**
- `frontend/src/pages/CommunityDetail.jsx` (~line 131)
- `frontend/src/pages/MyRedemptions.jsx` (~line 33)
- `frontend/src/pages/ProductDetail.jsx` (~line 25)
- `frontend/src/pages/ProductRedeem.jsx` (~line 92)
- `frontend/src/pages/ProviderDashboard.jsx` (~lines 145 and 161 — two spots)
- `frontend/src/pages/ProviderOnboard.jsx` (~line 133)
**Steps:**
1. Replace each `←` text node with `<Icon name="chevron-left" size={20} />`.
   Add `import Icon from '../components/Icon';` (or `'../../components/Icon'`
   under `pages/admin/`) where missing. Keep the surrounding
   `btn btn-icon btn-secondary` classes and onClick handlers untouched.
2. Add `aria-label="Go back"` to any of these buttons missing it.
3. Re-grep `←` across `frontend/src` — zero hits when done. Also grep `->`
   arrow text just in case (should be none).
**Acceptance:** grep clean; `npm test` passes; visually, every back button
across Booking, Circle, Community, Products, Provider Dashboard/Onboard,
Redemptions screens is the same `<` chevron.

### Task 1.2 — Home check-in card disappears once every circle is checked in (owner item 12)
**File:** `frontend/src/components/CheckinCard.jsx`.
**Current bug:** after checking in to all circles, the card stays with all
buttons in "Checked in" state.
**Steps:**
1. The card already tracks `checkedIds`. Add:
   `const allDone = list.length > 0 && list.every(c => checkedIds.has(c.id));`
2. When `allDone`, return `null` (card unmounts). Two nuances:
   - Do NOT hide instantly mid-interaction: hide after the last check-in's
     toast fires. Simplest robust approach: `if (allDone) return null;` is
     acceptable — the toast is rendered by the global `ToastContainer`, not
     inside the card, so unmounting the card does not kill the toast.
   - Also handle circles that arrive already checked in (`checked_in_today`)
     — the initial `checkedIds` seed already covers this, so a user who did
     all check-ins yesterday-today sees no card on load.
3. Update/extend `frontend/src/test/CheckinCard.test.jsx`: new test —
   rendering with ALL circles `checked_in_today: true` renders nothing
   (`home-checkin-card` absent); and after clicking the last remaining
   check-in button, the card disappears (`waitFor` removal).
**Acceptance:** new tests pass; in `npm run dev`, checking in to every listed
circle removes the card from Home.

### Task 1.3 — Circle explainer appears the moment a passion is selected (owner item 3 gap)
**Status of item 3 overall: ALREADY IMPLEMENTED — verify, don't rebuild.**
Multi-select passions exist (`interest_categories` array + `toggleInterest`
in `frontend/src/pages/OnboardingFlow.jsx`), and the circles step has the
explainer ("Circles are small accountability groups — check in together…"),
an available-circles join list, a create-your-own form, and a Telegram invite
action. The ONLY gap vs. the owner's description: the explainer shows on the
*circles step*, not immediately when a passion is selected on the *interest
step*.
**File:** `frontend/src/pages/OnboardingFlow.jsx` (interest step block).
**Steps:**
1. On the interest step, when `formData.interest_categories.length > 0`,
   render a small hint under the passion chips (fade/slide in is fine but
   optional):
   > "Nice pick! Each passion has **circles** — small accountability groups
   > you can join (or create) on the next steps."
   Style: `fontSize 0.8rem`, `color: var(--text-secondary)`, margin-top 8.
2. Do not alter the existing circles-step content or its tests
   (`OnboardingFlow.circles.test.jsx` must keep passing).
3. Add one assertion to `frontend/src/test/OnboardingFlow.test.jsx` (or the
   circles test file): selecting a passion makes the hint text appear.
**Acceptance:** all onboarding tests pass; hint visible in dev after tapping
any passion chip.

---

## Phase 2 — User profile foundations (backend migration + profile settings)

This phase unblocks Phase 3 (booking). Ship it alone first.

### Task 2.1 — Backend: `users.phone_number` + `users.time_format`
**Files:** `backend/app/models/user.py`, `backend/app/schemas/user.py`,
`backend/app/crud/user.py` (profile update path), `backend/app/api/users.py`,
new `backend/alembic/versions/010_user_prefs.py`, new
`backend/apply_user_prefs_migration.py`, `docs/API_CONTRACT.md`.
**Steps:**
1. Model: add
   `phone_number = Column(String(20), nullable=True)` (store E.164, e.g.
   `+251911234567`) and
   `time_format = Column(String(3), nullable=True)  # '12h' | '24h'`.
2. Migration `010_user_prefs.py` (revision `'010'`, down_revision `'009'`):
   `op.add_column('users', ...)` for both; downgrade drops them. Mirror in
   `apply_user_prefs_migration.py` with `ADD COLUMN IF NOT EXISTS`.
3. Schemas: expose both fields on the user profile response; accept both as
   optional fields on the existing profile-update request (find the schema
   used by `PATCH/PUT /users/me` — follow whatever `updateProfile` in
   `frontend/src/api/client.js` calls today). Validate `time_format` against
   `{'12h','24h'}` (422 otherwise). Do NOT deep-validate phone server-side
   beyond max length + optional `+`/digits regex `^\+?[0-9]{6,15}$` — the
   frontend owns UX validation; the backend just refuses garbage.
4. Mock parity: add `phone_number: null, time_format: null` to `MOCK_USER`
   in `frontend/src/data/mock.js`; make the mock `updateProfile` merge them.
5. `docs/API_CONTRACT.md`: document both fields on profile read/update.
6. Backend test: extend an existing user test script (or add
   `test_user_prefs` cases to the closest suite) — update profile with
   `phone_number` + `time_format`, read back, assert persisted; assert 422 on
   `time_format: 'xx'`.
**Acceptance:** backend test passes; `app.main` imports cleanly; contract
updated.

### Task 2.2 — Frontend: time-format preference (detect + Profile setting)
**Files:** new `frontend/src/utils/timeFormat.js`,
`frontend/src/pages/ProfileScreen.jsx`, `frontend/src/context/AuthContext.jsx`
(only if needed for defaulting), `frontend/src/i18n.js`.
**Steps:**
1. `utils/timeFormat.js` exports:
   - `detectTimeFormat()` → `'12h' | '24h'` using
     `Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle`
     (`h11`/`h12` → `'12h'`, `h23`/`h24` → `'24h'`, fallback `'12h'`).
   - `formatSlot(slot24, format)` → `"14:00"` + `'12h'` → `"2:00 PM"`;
     `"09:00"` + `'12h'` → `"9:00 AM"`; `'24h'` returns input unchanged.
   - `effectiveTimeFormat(user)` → `user?.time_format || detectTimeFormat()`.
2. ProfileScreen: new "TIME FORMAT" row (near APPEARANCE/LANGUAGE) with two
   chips `12-hour (2:00 PM)` / `24-hour (14:00)`; selecting calls
   `updateProfile({ time_format })` and toasts success. Current selection =
   `effectiveTimeFormat(user)`.
3. Unit test `frontend/src/test/timeFormat.test.js`: `formatSlot` cases
   (`00:00`→`12:00 AM`, `12:00`→`12:00 PM`, `18:30`→`6:30 PM`, 24h
   passthrough).
**Acceptance:** tests pass; toggling in Profile persists (mock mode: survives
navigation within session).

---

## Phase 3 — Booking upgrades (do 3.1 → 3.2 → 3.3 → 3.4, each shippable)

### Task 3.1 — AM/PM time slots (owner item 5)
**File:** `frontend/src/pages/BookingFlow.jsx`.
**Steps:**
1. Time-slot buttons render `formatSlot(slot, effectiveTimeFormat(user))`
   instead of the raw slot. Internal state/payloads STAY 24h (`"14:00"`) —
   only display changes. `useAuth()` is already imported? (BookingFlow does
   not currently use it — add `const { user } = useAuth();`.)
2. Everywhere BookingFlow displays a chosen time (step-2 summary, request-sent
   screen), run it through `formatSlot`.
3. Update the three BookingFlow test files ONLY if they assert on raw time
   strings (they select by `MOCK_TIME_SLOTS[0]` name — `'06:00'` will now
   render `6:00 AM` in 12h default; either set `MOCK_USER.time_format='24h'`
   in those tests via mock, or select by `formatSlot(...)`. Prefer asserting
   through the same helper so tests don't hardcode).
**Acceptance:** booking tests pass; dev: slots show `6:00 AM … 7:00 PM` by
default, and flipping Profile→24-hour shows `06:00 … 19:00`.

### Task 3.2 — Country-code phone input + validation (owner item 7)
**Files:** new `frontend/src/utils/phone.js`, new
`frontend/src/components/PhoneInput.jsx`, used by `BookingFlow.jsx` (and
later ProfileScreen), `frontend/src/i18n.js`.
**Steps:**
1. `utils/phone.js`:
   - `COUNTRY_CODES`: curated list, Ethiopia FIRST/default:
     `[{ code: '+251', country: 'Ethiopia', flagLabel: 'ET', nationalLength: 9, mobilePrefixes: ['9','7'] }, { code: '+254', country: 'Kenya', flagLabel: 'KE' }, { code: '+1', country: 'USA/Canada', flagLabel: 'US' }, { code: '+44', country: 'UK', flagLabel: 'GB' }, { code: '+971', country: 'UAE', flagLabel: 'AE' }, { code: '+966', country: 'Saudi Arabia', flagLabel: 'SA' }, { code: '+49', country: 'Germany', flagLabel: 'DE' }, { code: '+33', country: 'France', flagLabel: 'FR' }, { code: '+39', country: 'Italy', flagLabel: 'IT' }, { code: '+86', country: 'China', flagLabel: 'CN' }, { code: '+91', country: 'India', flagLabel: 'IN' }]`
     (flat data — trivially extendable).
   - `normalizeEthiopian(input)`: `09XXXXXXXX`/`07XXXXXXXX` (10 digits) →
     `+2519XXXXXXXX`/`+2517XXXXXXXX`; `9XXXXXXXX`/`7XXXXXXXX` (9 digits) →
     prefix `+251`; passthrough for already-E.164.
   - `validatePhone(code, national)` → `{ valid, e164, error }`:
     - Ethiopia (`+251`): national must be exactly 9 digits starting `9` or
       `7` (after normalization). Error copy:
       "Enter a valid Ethiopian number: 09/07 + 8 digits, or +251 + 9 digits."
     - Any other code: 6–12 digits. Error: "Enter a valid phone number for
       {country}."
   - Strip spaces/dashes/parens before validating.
2. `PhoneInput.jsx`: `<select>` of country codes (default `+251`) + `tel`
   input side by side; props `{ value, onChange }` where `onChange` receives
   `{ e164, valid }`; shows the error message inline (small red text) once
   the field has been touched and is invalid. If the user types a leading
   `0`-form or `+`-form directly into the national field while ET is
   selected, auto-normalize on blur.
3. BookingFlow step 2: replace the plain phone `<input>` with `PhoneInput`.
   `canNext()` for step 2 becomes `phoneValid` (from PhoneInput state) instead
   of the current `length >= 9` check. Payload `phone_number` = the E.164
   value.
4. Unit tests `frontend/src/test/phone.test.js`: ET valid (`0911234567`,
   `0712345678`, `+251911234567`, `911234567`), ET invalid (`0811234567`,
   `091123456` (9 total), letters), non-ET generic length pass/fail.
   Update `BookingFlow` tests to type a valid number through the new input
   (target the national-number input by id `phone-input` — keep that id).
**Acceptance:** phone unit tests + booking tests pass; dev: invalid input
shows the message and blocks the button; valid ET local input normalizes.

### Task 3.3 — Confirm-step copy, save phone to profile, "call the provider yourself" (owner item 6)
**Files:** `frontend/src/pages/BookingFlow.jsx`,
`frontend/src/context/AuthContext.jsx` (uses existing `updateProfile`),
`frontend/src/i18n.js`, `frontend/src/pages/ProfileScreen.jsx`.
**Steps:**
1. Label above the phone field: change `Contact Phone Number` →
   `t('Type your phone number so {{name}} can contact you', { name: provider.name })`.
2. Prefill: if `user.phone_number` exists, initialize `PhoneInput` with it
   (parsed back into code+national; ET default if unparseable).
3. On successful booking request, fire-and-forget
   `updateProfile({ phone_number: e164 }).catch(() => {})` **only when the
   number differs from the saved one** — never block or fail the booking on
   it.
4. Request-sent screen: below the summary, when `provider.contact_phone`
   exists add a secondary button
   `t('Or call {{name}} to confirm now', { name: provider.name })` as a
   `tel:` anchor (same pattern as the existing direct-contact screen —
   plain `tel:` href works in the Telegram WebView). Hide when no
   contact_phone.
5. ProfileScreen: show the saved phone (masked-ish is unnecessary; show as
   stored) in a new "CONTACT" row with an Edit action opening `PhoneInput`
   inline; saving calls `updateProfile`.
6. Tests: BookingFlow promo/multiDay tests updated for the new label; add
   assertion that the tel: link appears when the mock provider has
   `contact_phone` (Kuriftu does) — note: for pay-online providers use one
   with contact_phone in mock, or extend one mock provider with it.
**Acceptance:** tests pass; dev walk-through: prefilled phone for a returning
user, booking request sent, call button dials (href correct), Profile shows
the saved number.

### Task 3.4 — Multi-day booking with per-day times (owner item 4)
**File:** `frontend/src/pages/BookingFlow.jsx` (frontend only — verified the
backend already accepts arbitrary datetimes in `additional_slot_datetimes`,
so different times per day need NO backend change).
**Owner-specified flow (implement exactly):**
1. User taps a day; taps a second day → a modal pops up:
   - "Book multiple days?" → **[Yes, multiple days]** / **[No — keep just
     {new day}]** (No: replace selection with the newly tapped day).
   - If Yes → second question in the same modal: "Same time on all days?" →
     **[Same time]** / **[Different times]**.
2. `Same time` → exactly the current implementation (one time picker applies
   to all selected days). Store `timeMode: 'same'`.
3. `Different times` → `timeMode: 'perDay'`: Step 1's time picker becomes
   sequential: header "Pick a time — Day 1 of N: {Mon 21}" with the slot
   grid; choosing a slot advances to Day 2 of N, etc. Show already-chosen
   days as small chips with their time and allow tapping a chip to re-pick.
   `canNext()` for step 1 requires every selected day to have a time.
4. The modal only appears the FIRST time the selection grows past one day in
   a session; subsequent extra days follow the already-chosen mode. Deselect
   down to 1 day resets nothing (keep mode; harmless).
5. Event bookings (`eventId` set) keep their single-date behavior — the
   modal must never appear for them.
**Payload:** sort selected days; primary = first day at its own time
(`slot_datetime`); the rest go in `additional_slot_datetimes` each at its own
time (same-time mode = same time repeated, as today).
**Displays:** step-2 summary and the request-sent screen list each day with
its own time (`Mon 21 · 9:00 AM`, `Tue 22 · 6:30 PM`) when `perDay`, or the
current combined form when `same`. Use `formatSlot`.
**Modal implementation:** a simple in-page overlay div (`position: fixed`,
dim backdrop, card) — the codebase has no modal component; keep it local to
BookingFlow (`id="multi-day-modal"`), no portal needed.
**Tests:** extend `BookingFlow.multiDay.test.jsx`:
- selecting a 2nd day opens the modal; "No" keeps only the new day;
- "Yes → Same time" behaves like the existing suite (keep old assertions);
- "Yes → Different times" walks two days with two different times and the
  summary shows both `day · time` pairs; payload check via the mock
  (mock `createBooking` echoes input) — assert `slot_datetime` and
  `additional_slot_datetimes[0]` carry DIFFERENT times.
**Acceptance:** full booking suite passes; dev walk-through of both modes.

---

## Phase 4 — Location: nudge + "Near you" on Home + "Near me" in Explore (owner items 2a & 9)

### Task 4.1 — Shared neighbourhood matching util + reusable nudge
**Files:** new `frontend/src/utils/nearby.js`, new
`frontend/src/components/LocationNudge.jsx`,
`frontend/src/pages/ProfileScreen.jsx`.
**Steps:**
1. `utils/nearby.js`:
   - `isNearUser(provider, neighbourhood)` → case-insensitive substring match
     of the neighbourhood against `provider.location_text` (e.g. `'Bole'`
     matches `'Bole Sub-City, near Edna Mall'` AND `'Bole Medhanialem'` —
     that is intended). Null/empty neighbourhood → `false`.
   - `nearbyProviders(providers, neighbourhood)` → filtered list.
   - `nearbyEvents(events, providers, neighbourhood)` → events whose
     provider matches (events carry `provider_id`; match through the
     providers list).
2. `LocationNudge.jsx`: a compact card — map-pin Icon + "Set your
   neighbourhood to see events & studios near you" + button "Choose area".
   Button navigates `navigate('/profile', { state: { openNeighbourhood: true } })`.
3. ProfileScreen: on mount, if `location.state?.openNeighbourhood`, auto-open
   the existing neighbourhood sheet (`setShowNeighbourhoodSheet(true)`) and
   clear the state (replace navigation) so back doesn't re-trigger.
**Acceptance:** unit test for `isNearUser` cases; nudge navigates and the
sheet opens automatically.

### Task 4.2 — Home "Near you in {area}" section
**File:** `frontend/src/pages/HomeScreen.jsx` (+ `FeaturedEventsCarousel`
untouched — this is a separate section).
**Steps:**
1. Below the neighbourhood alert banner position:
   - If `user.location_neighborhood` is NOT set → render `<LocationNudge />`
     (this IS the item-9 nudge; dismissible per session via local state X
     button, reappears next session).
   - If set → render a "Near you in {area}" section when there are matches:
     up to 3 matched providers as horizontal `ProviderCard`s, and if
     `getEvents()` returns upcoming events from matched providers, a row of
     up to 3 `EventCard`s above them titled "Happening near you". Each is
     already tappable → provider detail / booking.
2. HomeScreen already fetches providers; add the events fetch it needs
   (Explore already calls `getEvents()` — reuse that client fn; in mock mode
   it returns `MOCK_EVENTS`).
3. Empty state: if the area matches nothing, show one line "Nothing in
   {area} yet — browse all studios" linking to `/explore`. (Do not hide the
   section entirely; the owner wants users to see the system responds to
   their location.)
4. Mock data: ensure at least one provider AND one event match a selectable
   neighbourhood (e.g. `'Bole'` matches Lifestyle Fitness + Shanti Yoga —
   verify `MOCK_EVENTS` has an event for one of them; add one if not).
5. Test `frontend/src/test/HomeNearYou.test.jsx`: with a user whose
   neighbourhood is `'Bole'` (override mock user via localStorage token path
   is messy — instead export the section as its own component
   `NearYouSection({ user, providers, events })` and test it directly with
   props: matches render; no-neighbourhood renders the nudge; no-matches
   renders the browse-all line).
**Acceptance:** tests pass; dev: set neighbourhood in Profile → Home shows
the section with real matches.

### Task 4.3 — Explore "Near me" filter
**File:** `frontend/src/pages/ExploreScreen.jsx`.
**Steps:**
1. Add a `Near me` toggle chip at the END of the category chip row (both
   Studios and Events views). Active state filters the rendered list through
   `isNearUser` (events filtered via their provider).
2. If tapped with no `user.location_neighborhood`: do NOT filter; open the
   same Profile-sheet path as `LocationNudge` (navigate with
   `openNeighbourhood: true`) — this is the second item-9 nudge surface.
3. The toggle composes WITH the category filter (category AND near-me).
4. Persist the toggle only in component state (resets on leave — fine).
5. Test: extend an Explore test — with neighbourhood set, toggling filters
   the provider list to matches only; with none set, navigate mock called.
**Acceptance:** tests pass; dev behavior as described.

---

## Phase 5 — Community & individual ranks (owner item 8)

### Task 5.1 — Backend `GET /api/ranks`
**Files:** new route (add to `backend/app/api/circles.py` OR a new
`backend/app/api/ranks.py` registered in `main.py` — prefer the new module),
`backend/app/crud/` (new `ranks.py`), `docs/API_CONTRACT.md`, new test
`backend/app/tests/test_ranks.py`.
**Metric (locked):** positive `point_transactions.amount` sums over the
trailing 7 days.
**Response shape:**
```json
{
  "communities": [ { "community_id": "...", "name": "...", "member_count": 47, "weekly_points": 1240, "rank": 1 } ],
  "users":       [ { "user_id": "...", "name": "...", "photo_url": null, "weekly_points": 120, "rank": 1 } ],
  "me":          { "rank": 14, "weekly_points": 30 }
}
```
**Steps:**
1. `crud/ranks.py`:
   - Users: one aggregate query — `SELECT user_id, SUM(amount) FROM
     point_transactions WHERE amount > 0 AND created_at >= now()-7d GROUP BY
     user_id ORDER BY sum DESC LIMIT 20`, joined to `users` for name/photo.
   - Communities: one aggregate query joining `community_members` to the same
     ledger window, `GROUP BY community_id`, joined to `communities` for
     name/member_count, `LIMIT 20`. (A user in two communities counts toward
     both — acceptable and simplest; note it in the contract.)
   - `me`: the caller's own 7-day sum + rank via a COUNT of users with a
     higher sum (single query). Rank is null if they earned 0 this week.
2. Route: JWT-protected (`get_current_user`).
3. Mock parity: `getRanks()` in `client.js` returning a `MOCK_RANKS` fixture
   (build it from existing mock names; put `MOCK_USER` at a visible rank).
4. `test_ranks.py` (SQLite-pattern script): seed 3 users + 2 communities +
   ledger rows inside and outside the 7-day window; assert ordering, window
   exclusion, `me` rank correctness, and a community sum equaling its
   members' sums.
**Acceptance:** backend test green; contract documented.

### Task 5.2 — Community tab "Ranks" UI
**File:** `frontend/src/pages/CommunityList.jsx` (tab state at ~line 15:
`'explore' | 'joined' | 'circles'` — add `'ranks'`).
**Steps:**
1. Fourth chip `Ranks` (Icon `trophy`). On activation fetch `getRanks()`.
2. Layout: a small segmented toggle `Communities | Individuals`.
   - Communities list: rank number (🥇🥈🥉 for top 3 — medals are an approved
     emoji use; `#4`+ after), name, member count, `{weekly_points} pts this
     week`. Tapping row → `/community/{id}`.
   - Individuals list: same medal treatment, avatar (Icon `user` fallback),
     name, weekly points. Highlight the row where `user_id === me` (border
     `var(--brand-primary)`), and if `me` isn't in the top 20, pin a footer
     row "You — #{me.rank} · {points} pts this week".
3. Loading skeletons + empty state ("No points earned this week yet — check
   in to get on the board").
4. Test `frontend/src/test/CommunityRanks.test.jsx`: tab renders both lists
   from mock, medals on top 3, own-row highlight/footer.
**Acceptance:** tests pass; dev: tab loads instantly from mock.

---

## Phase 6 — Feedback system: bug reports + health-app wishlist (owner items 13 & 11)

### Task 6.1 — Backend feedback table + endpoints
**Files:** new `backend/app/models/feedback.py`, registered in
`models/__init__.py`; new `backend/alembic/versions/011_feedback.py` +
`backend/apply_feedback_migration.py`; new `backend/app/api/feedback.py`
registered in `main.py`; admin additions in `backend/app/api/admin.py`;
`docs/API_CONTRACT.md`; new `backend/app/tests/test_feedback.py`.
**Model:**
```python
class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(30), nullable=False)      # 'bug' | 'health_app_request' | 'suggestion'
    message = Column(Text, nullable=False)
    context = Column(JSONB, nullable=True)         # { route, error, app_version, user_agent }
    status = Column(String(20), nullable=False, default="new")  # new | reviewed | resolved
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```
**Endpoints:**
- `POST /api/feedback` (JWT): `{ type, message, context? }` → 201 `{ id }`.
  Validate type against the enum; message 1–2000 chars.
- `GET /api/admin/feedback?type=&status=&page=` (super admin): paginated
  list newest-first with user name/handle joined (one query).
- `PATCH /api/admin/feedback/{id}` (super admin): `{ status }`.
**Steps:** migration + apply script; mock parity (`submitFeedback`,
`getAdminFeedback`, `updateFeedbackStatus` in `client.js` with in-memory mock
behavior); contract; test script covering create/list/status-change/authz
(non-admin GET → 403).
**Acceptance:** backend test green.

### Task 6.2 — Admin "Feedback" tab
**Files:** `frontend/src/pages/admin/AdminLayout.jsx` (TABS array, ~line 4),
new `frontend/src/pages/admin/AdminFeedback.jsx`, route in
`frontend/src/App.jsx` under the `/admin` group, smoke test entry.
**Steps:** table/list of feedback rows (type badge, message, user, route from
context, date, status select `new/reviewed/resolved` wired to the PATCH),
filter chips by type. Follow `AdminProducts.jsx` styling conventions.
**Acceptance:** `/admin/feedback` renders in mock mode; added to
`routes.smoke.test.jsx`; status change fires and toasts.

### Task 6.3 — In-app bug reporting (owner item 13)
**Files:** new `frontend/src/components/BugReportSheet.jsx`,
`frontend/src/components/ErrorBoundary.jsx`,
`frontend/src/pages/ProfileScreen.jsx`, `frontend/src/api/client.js`.
**Steps:**
1. `BugReportSheet`: bottom-sheet/overlay (same local-overlay pattern as the
   Phase 3.4 modal) with a textarea ("What went wrong?"), auto-collected
   context shown as fine print ("We'll include: current screen, error
   details"), Submit → `submitFeedback({ type: 'bug', message, context })` →
   success toast "Thanks — we're on it." Context = `{ route:
   window.location.pathname, error: props.error?.message ?? null, user_agent:
   navigator.userAgent }`.
2. **Appears when an issue arises:** in `ErrorBoundary.jsx`'s fallback card,
   add a secondary button "Report this problem" that opens `BugReportSheet`
   pre-wired with the caught error (store the error object in state in
   `componentDidCatch`). This is the primary "seamless on failure" surface.
3. Also catch API failures: in `client.js`'s central `request()` error path,
   remember the last error (`export let lastApiError` or a tiny module-level
   store) so the sheet can include it; do NOT auto-popup on every failed
   request (toasts already handle messaging) — the boundary + profile entry
   are the surfaces.
4. **Profile entry:** "SUPPORT" section row "Report a bug" (Icon
   `message-circle`) opening the same sheet with no error context.
5. Tests: sheet renders, submit calls the client fn with type `'bug'` and the
   route in context (component test); ErrorBoundary fallback shows the report
   button.
**Acceptance:** tests pass; dev: crash a screen (temporarily) or use Profile
entry → submit → mock success toast; admin tab lists it (mock).

### Task 6.4 — Health app → "Coming soon" + wishlist (owner item 11)
**File:** `frontend/src/pages/ProfileScreen.jsx`.
**Steps:**
1. Replace the current connect/disconnect toggle behavior in the HEALTH &
   ACTIVITY section: the row shows a `Coming soon` badge (chip style) instead
   of toggling a fake connection. Remove the mock "connected" state writes
   (leave `MOCK_HEALTH_METRICS` display if currently shown — display only).
2. Under it: "Which app should we support first?" — a `<select>` with
   `Apple Health, Google Fit, Samsung Health, Fitbit, Garmin, Strava,
   Huawei Health, Other…`; choosing `Other…` reveals a text input. Submit
   button → `submitFeedback({ type: 'health_app_request', message: <app name
   or free text> })` → success toast "Noted — we'll prioritize it." and the
   control collapses to "Thanks for voting: {app}" for the session.
3. Remove/adjust any test asserting the old toggle behavior.
**Acceptance:** tests pass; dev flow works; requests appear in the admin
Feedback tab (mock).

---

## Phase 7 — AI concierge quick-request chips (owner item 10)

**File:** `frontend/src/components/AskWellCircle.jsx`,
`frontend/src/i18n.js`.
**Steps:**
1. Above the chat input (visible when the conversation has ≤1 message, i.e.
   just the greeting), render 4 tappable chips (owner can edit copy later —
   keep them in a single const at the top of the file):
   - `Affordable gyms around me`
   - `Best-rated spas`
   - `Yoga classes this week`
   - `Nutrition coaching options`
2. Chip tap behavior:
   - If the chip is location-dependent (the "around me" one — mark chips with
     `needsLocation: true`) AND `user.location_neighborhood` is set → send
     immediately as a user message with the area substituted:
     `Affordable gyms around Bole`.
   - If location-dependent and NO neighbourhood → prefill the input with
     `Affordable gyms around ` and focus it so the user types their area in
     chat (exactly the owner's requirement); do not auto-send.
   - Non-location chips send immediately.
3. Reuse the existing send pathway (find the submit handler that POSTs to the
   concierge microservice — do not duplicate fetch logic).
4. Track `concierge_chip_click { chip }` via `analytics.track`.
5. Component test: chips render on fresh conversation; location chip with
   neighbourhood sends substituted text (assert on the messages state /
   fetch mock); without neighbourhood it prefills the input instead.
**Acceptance:** tests pass; dev: chips behave as specced against the live
concierge (or mock).

---

## Phase 8 — Final verification & docs

1. Frontend: `npm run build` ✅, full `npm test` ✅ (run twice if a smoke
   test flakes under parallel load — known environment flake; a green
   isolated run of the flaked file is acceptable proof).
2. Backend: run ALL test scripts (`test_integration`, `test_points_economy`,
   `test_presale_reentry`, `test_engagement_loop`, `test_circle_activity`,
   `test_ranks`, `test_feedback`, plus `pytest app/tests/test_sheets.py`).
   `app.main` must import cleanly (route count will grow past 101).
3. `docs/API_CONTRACT.md` covers: user prefs fields, `/api/ranks`,
   `/api/feedback` + admin feedback endpoints.
4. Append a new phase entry to `docs/HANDOFF.md` following the established
   format (summary, bugs found in passing, verification numbers, files list).
5. Manual dev pass (mock mode): onboarding passion-hint → Home nudge → set
   neighbourhood → Near-you section → Explore Near-me → book multi-day with
   different times in AM/PM → phone validation error then success → request
   sent → call-provider button → Profile shows phone + time format → ranks
   tab → report a bug → health-app vote → concierge chips.

**Out of scope for this plan (tracked separately by the owner):** the major
UI redesign via Claude design — a screenshot pack of every screen is being
produced separately as design input; do not restyle screens beyond what the
tasks above require.
