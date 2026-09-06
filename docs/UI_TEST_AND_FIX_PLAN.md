# UI Test & Fix Plan — Circle/Post/Concierge workflow bugs

Standalone instructions for an implementation agent. Goal: reproduce each bug in the
browser, fix it, and verify the fix — **without changing business rules** (bookings stay
pending/staff-confirmed with no in-app payment; points economy, ranks, and feedback rules
are untouched).

**Status: Bugs 1–4 fixed and verified (commit `e7e469a` on `feature/ui-revamp`).**
Bug 5 (the mock-persistence sweep) is still open — see that section for what's left.

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
- **Mock state resets on hard reload.** Session-persisted mock data (joined circles,
  new posts, bookings) lives in JS module state (`frontend/src/api/client.js`), not
  `localStorage`. A hard page reload / typing a URL in the address bar re-evaluates the
  module and wipes it — that's expected and matches what a real backend wouldn't do.
  Verify persistence fixes with **in-app SPA navigation** (clicking links, back button,
  bottom nav), not the browser's reload/address bar.

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
- Mock write endpoints that have a matching read endpoint must persist by **mutating the
  seed record in place** (`c.user_joined = true`, not a copy) or pushing into
  `MOCK_POSTS`/a session array — see `createBooking`/`getMyBookings` and
  `joinCommunity`/`getCommunity` in `client.js` for the established pattern.

## Bug 1 — Joining a circle doesn't land on Activity with the pre-filled intro post [FIXED]

**Actual root cause:** the button labeled **"Join Circle"** that users actually hit on a
circle/community's own page lives in `frontend/src/pages/CommunityDetail.jsx` —
`CircleDetailScreen.jsx` (a separate screen, for user-created circles specifically)
already implemented this correctly and needed no change. `CommunityDetail.handleJoin`
joined but never switched `activeTab` to `'posts'` and never passed
`initialDraft`/`onDraftConsumed` to `<PostFeed>` at all. Fixed by mirroring
`CircleDetailScreen`'s pattern: `setActiveTab('posts'); setJustJoined(true);` on join,
and wiring `initialDraft`/`onDraftConsumed` into `<PostFeed communityId={id} .../>`.

List-card Join buttons (Home's "Join a Circle" section, `CommunityList.jsx`'s Explore
tab — both render `CommunityCard`) call `e.stopPropagation()` before joining, so they
never navigated anywhere after. Fixed by navigating to `/community/${id}` with
`{ state: { justJoined: true } }` after a successful join; `CommunityDetail` reads that
nav state in a new effect (mirrors `ProfileScreen`'s `openNeighbourhood` pattern) and
clears it with `replace: true` so navigating back doesn't re-trigger it.

Also fixed the mock-persistence bug this exposed: `joinCommunity`, `leaveCommunity`, and
`joinCircle` in `frontend/src/api/client.js` never mutated `MOCK_COMMUNITIES` /
`MOCK_CIRCLES`, so a subsequent `getCommunity()`/`getCircles()` reverted the join — same
root cause as the earlier booking-persistence fix. Now mutates the matching record
in place.

**Verified:** joining from `CommunityDetail`'s own button and from both list entry
points lands on Posts & Reactions with the pre-filled intro draft; the joined state
survives in-app navigation away and back.

## Bug 2 — Creating a post does nothing [FIXED]

**Root cause:** in `frontend/src/api/client.js`, `createPost()` returned an unused stub
object (no `content`/`user`/`created_at`) and never stored it, while `getPosts()` always
returned the static `MOCK_POSTS` array — so `PostFeed`'s post-submit `loadPosts()`
refresh wiped the new post immediately. Fixed by building a full post record (id,
content, `user` from `MOCK_USER`, timestamps, activity/photo fields, empty
`reactions`/`comments`) and `MOCK_POSTS.unshift(post)`-ing it so it's first in the feed.
`reactToPost`/`commentOnPost` had the identical bug (mutated nothing) — both now find the
target post in `MOCK_POSTS` and mutate its `reactions`/`total_points_gifted` or
`comments`/`replies` in place.

**Bonus bug found and fixed in the same spot:** `getPosts(communityId, circleId)` only
ever filtered on `circleId` — a call with only `communityId` (i.e. every community's
"Posts & Reactions" tab) returned *every* post in the app, including other circles'
seed posts, since no post in `MOCK_POSTS` even had a `community_id` field to match
against. Added the `community_id` filter branch.

**Verified:** posting in a circle shows the new post at the top immediately, survives
switching tabs and in-app navigation, and reactions/comments/replies persist the same
way. `npx vitest run src/test/PostFeed.test.jsx` — 4/4 passing.

## Bug 3 — Circler AI concierge can't be started by typing [FIXED]

**Root cause:** `frontend/src/components/AskWellCircle.jsx`'s send button was
`onClick={handleSend}` — React passes the click's `SyntheticEvent` as the handler's
first argument, so `handleSend`'s `const raw = override ?? input;` used the **event
object** (not `null`/`undefined`, so `??` didn't fall back to `input`) as the message
text, then threw on `raw.trim()` before anything was sent. Pressing **Enter** worked
fine (`handleKeyDown` calls `handleSend()` with zero arguments), and the suggestion
chips worked fine (`handleChipTap` calls `handleSend(chip.label)` explicitly) — only
clicking the paper-plane send button after typing was broken, which is exactly "won't
start with text from user, needs hitting button first" backwards (chip *buttons*
worked; the send *button* for typed text didn't). Fixed: `onClick={() => handleSend()}`.

**Verified:** typing a message and clicking send now appends the user bubble and calls
the concierge API correctly, with no console error.

## Bug 4 — Tier legend overlaps the avatar header on Profile [FIXED]

This turned out to be the same UI element referenced from an unrelated feature request
(moving the "How Legacy Points Work" explainer from Profile to Home) rather than a
layout bug to patch — `frontend/src/pages/ProfileScreen.jsx`'s inline `PointsTooltip`
used raw `position: absolute` with a fixed 250px width and no collision handling, which
is what overlapped the header when opened. It's been **removed entirely**: the same
content now lives in `frontend/src/components/PointsInfoSheet.jsx`, opened from the
points badge on Home via the shared `.sheet`/`.sheet-overlay` bottom-sheet pattern
(no absolute-positioning overlap risk), with a close (X) button. See commit `b6781cf`.

## Bug 5 (sweep) — other mock-mode workflow dead-ends [OPEN]

The pattern behind Bugs 1–2 (mock write endpoints that don't persist) has now been
fixed four times independently (bookings, community join/leave, circle join, posts/
reactions/comments) — it's very likely present elsewhere too. Grep
`frontend/src/api/client.js` for `if (USE_MOCK) return` on **write** endpoints whose
data has a matching **read** endpoint, and walk each UI flow with in-app navigation
(see the hard-reload caveat in section 0):

- Circle creation (`createCircle` in `CommunityList.jsx`'s My Circles tab) — does the
  new circle appear in the list afterward, and is it joined?
- Check-ins (`checkinCommunity`, Home's daily check-in card / `useCheckin` hook) — does
  the streak/points chip update and stay updated after navigating away and back?
- Notifications mark-as-read, product redemption history (`redeemProduct` /
  `getMyRedemptions`), profile edits (`updateProfile` already looked correct in earlier
  passes — recheck if time allows).

Fix only the ones that break a visible user flow, using the same in-place-mutation
pattern established above. Keep each fix minimal — no refactor of the mock layer.

## Final regression pass

1. `npm test` (re-run flaky files in isolation if needed) and `npm run build`.
2. Browser walkthrough at 375×812, light + dark, blue + one non-default accent (Profile
   → Appearance):
   onboarding → home check-in → points badge (opens/closes the Legacy Points sheet) →
   explore → provider → booking (3 steps → request sent → View My Bookings shows the
   booking) → join a community from a list card (lands on Posts, pre-filled) → join a
   community from its own detail page (same) → post → react → comment/reply →
   leaderboard → profile → products → redeem → concierge type-first send.
3. Anything intentionally not fixed: document it in `docs/HANDOFF.md`.
