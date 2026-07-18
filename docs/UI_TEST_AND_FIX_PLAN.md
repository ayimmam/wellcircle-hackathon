# UI Test & Fix Plan — Circle/Post/Concierge workflow bugs

Standalone instructions for an implementation agent. Goal: reproduce each bug in the
browser, fix it, and verify the fix — **without changing business rules** (bookings stay
pending/staff-confirmed with no in-app payment; points economy, ranks, and feedback rules
are untouched).

## 0. Environment setup

```bash
cd frontend
npm install
npm run dev -- --port 5174        # http://localhost:5174
```

- The app runs in **mock mode** by default (`VITE_USE_MOCK=true` via vite config /
  `test.env`) — all data comes from `frontend/src/data/mock.js` through
  `frontend/src/api/client.js`. No backend needed.
- Test at **375×812** viewport (Telegram Mini App frame). Outside Telegram the app
  falls back to a mock login automatically (`AuthContext` uses `'mock-init-data'`).
- Theme: Profile → Appearance has Light/Dark plus an accent-color picker
  (`data-theme` + `data-accent` on `<html>`). Verify every fix in **light and dark**.
- Regression gates after each fix: `npm test` (Vitest; `routes.smoke.test.jsx` must stay
  green) and `npm run build`. Run a single file with
  `npx vitest run src/test/<file>`. Note: the full parallel `npm test` run sometimes
  flakes on a lazy-chunk timeout in `routes.smoke.test.jsx`; re-run that file in
  isolation before concluding a fix broke it.

## Conventions (do not violate)

- New UI strings go through `t('...')` with a key added to the `en` block of
  `frontend/src/i18n.js` (mirror into am/fr/it where practical).
- SVG icons via `frontend/src/components/Icon.jsx` (`<Icon name="..." />`) — no new
  decorative emoji. Kept emoji: 🔥 streak/reactions, 🥇🥈🥉 medals, 🌱🌿🌳🌲 tiers,
  onboarding, feed reactions.
- Toasts: `showToast(message, 'success'|'error'|undefined)` from
  `components/Toast.jsx` — never an emoji in the message.
- New routes need an entry in `src/test/routes.smoke.test.jsx` (`ROUTES` array).
- Styling uses the CSS-variable design system in `src/index.css` (accent tint scale
  `--tint-accent-*`, `--shadow-card`, `.cell`/`.avatar`/`.feed` primitives). Reuse these
  instead of inline styles or hardcoded colors.

## Bug 1 — Joining a circle doesn't land on Activity with the pre-filled intro post

**Expected:** clicking **Join** on a circle takes the user straight to that circle's
**Activity (Post)** tab with the composer pre-filled with an intro draft
("Hi I'm <name>, I'm glad to join you guys!").

**What already exists:** `frontend/src/pages/CircleDetailScreen.jsx` implements this
*within* the detail screen: `handleJoin()` → `joinCircle(id, joinCode)` →
`setJoined(true); setJustJoined(true); setActiveTab('chat')`, and passes
`initialDraft` into `<PostFeed>` (which consumes it once via `onDraftConsumed`).

**Repro steps:**
1. Go to `/community` → the circles listing (Explore/My Circles tabs) — e.g. "Lifestyle
   Fit Squad". Click its **Join** button *from the list card*.
2. Also test: open a circle detail page (`/circle/:id`) as a non-member and click
   **Join Circle** there.
3. Also test the Home screen "Join a Circle" section's **Join** buttons.

**Likely root causes to investigate:**
- List-card Join handlers (Home screen join-a-circle list, `CommunityList.jsx` circles
  tab) call `joinCircle()` and show a toast but **never navigate** to
  `/circle/:id`, so the detail-screen intro logic never runs. Fix: after a successful
  join from any list, `navigate('/circle/' + id, { state: { justJoined: true } })` and
  have `CircleDetailScreen` read `location.state?.justJoined` to seed its existing
  `justJoined`/`activeTab('chat')` flow (it currently only sets these from its own
  button).
- In mock mode `getCircles()` may return `is_joined` statically, so after joining the
  detail screen's `loadCircle()` can overwrite `joined` back to `false`. Make the mock
  layer stateful (see the `mockBookingsCreatedThisSession` pattern in
  `frontend/src/api/client.js` — `createBooking`/`getMyBookings` — added for exactly
  this class of bug) so `joinCircle()` flips the circle's `is_joined` for the session.

**Verify:** from each Join entry point, you land on the circle's Activity tab, the
composer contains the intro draft, and the draft appears only once (navigate away and
back — composer must not re-fill).

## Bug 2 — Creating a post does nothing

**Expected:** typing in the circle Activity composer and pressing **Post** shows the new
post at the top of the feed (with optional activity stats) and a success toast.

**Repro:** join any circle → Activity tab → type text → Post.

**Likely root cause:** same mock-statelessness class as Bug 1: in
`frontend/src/api/client.js`, `createPost()` in mock mode returns a synthesized post
object but **never stores it**, and `getPosts()` returns the static `MOCK_POSTS` from
`frontend/src/data/mock.js` — so `PostFeed.handlePost()`'s `loadPosts()` refresh wipes
the new post. Fix with a module-level session array exactly like
`mockBookingsCreatedThisSession`: `createPost` pushes (include `user` object with the
mock user's name/photo so `PostFeed` renders it), `getPosts` returns session posts merged
ahead of `MOCK_POSTS`, filtered by the `circleId`/`communityId` argument. Check
`reactToPost`/`commentOnPost` for the same problem while there — reactions and comments
should also survive a `loadPosts()` round-trip within the session.

**Verify:** post appears immediately at the correct position, survives switching tabs
(Leaderboard → Activity), reactions/comments/replies on it work, and
`npx vitest run src/test/PostFeed.test.jsx` stays green.

## Bug 3 — Circler AI concierge can't be started by typing

**Expected:** opening the AI concierge (floating chat button → `AskWellCircle`
overlay), the user can immediately type a message and send it. Suggestion chips are a
shortcut, not a gate.

**Repro:** click the floating chat button (bottom-right) → try typing into the input and
sending without clicking any chip/button first.

**Where to look:** `frontend/src/components/AskWellCircle.jsx` (tests:
`src/test/AskWellCircle.chips.test.jsx`). Find why free-text input is blocked before a
button press — likely the input or send button is `disabled` until a conversation-start
state is set by a chip click, or the submit handler early-returns when no
conversation/session id exists yet. Fix so a typed message initializes the conversation
the same way the chips do. Don't change the chips' behavior or the backend contract
(`docs/API_CONTRACT.md`) — in mock mode the reply can stay mocked.

**Verify:** type-first flow works; chip-first flow still works; input auto-focuses when
the overlay opens.

## Bug 4 — Tier legend overlaps the avatar header on Profile

**Repro:** `/profile` — the tier-ladder legend text (SEED/SPROUT/GROVE/FOREST bullets)
renders on top of the avatar, name, and tier chip at the top of the screen (seen in both
themes; screenshot evidence from a 375×812 dark-mode run).

**Where to look:** `frontend/src/pages/ProfileScreen.jsx` header region — likely an
absolutely-positioned tier-legend/tooltip that should be a toggled popover or in normal
flow. Fix the layout so the legend never overlaps the header (collapse it behind an
info toggle on the tier chip, or render it as a normal section below the header).

**Verify:** profile header is clean at 375×812 in both themes; the tier information is
still reachable.

## Bug 5 (sweep) — other mock-mode workflow dead-ends

The Bugs 1–2 root cause (mock write endpoints that don't persist) likely affects other
flows. Grep `frontend/src/api/client.js` for `if (USE_MOCK) return` on **write**
endpoints whose data has a matching **read** endpoint, and walk each UI flow:

- Circle creation (`/community` My Circles → create form) — does the new circle appear?
- Check-ins (Home daily check-in card) — does the streak/points chip update?
- Notifications mark-as-read, product redemption history, profile edits.

Fix only the ones that break a visible user flow, using the same session-array pattern.
Keep each fix minimal — no refactor of the mock layer.

## Final regression pass

1. `npm test` (re-run flaky files in isolation if needed) and `npm run build`.
2. Browser walkthrough at 375×812, light + dark, blue + one non-default accent:
   onboarding → home check-in → explore → provider → booking (3 steps → request sent →
   View My Bookings shows the booking) → community → join circle → post → react →
   leaderboard → profile → products → redeem → concierge type-first.
3. Anything intentionally not fixed: document it in `docs/HANDOFF.md`.
