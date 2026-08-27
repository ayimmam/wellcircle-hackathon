# Design/accessibility review — Well Circle frontend

Tracking file for `/design-check` follow-up work. Keep this file in sync as
findings are fixed — don't let the branch drift from what's listed here.

Guideline source: Vercel Web Interface Guidelines
(`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`).

## Done on `main` (committed `28ae3e3`)

- [x] `Header.jsx` — brand/logo was a `<div onClick>`, no keyboard access → now a real `<button>`, added logo `width`/`height`.
- [x] `components/feed/FeedProviderCard.jsx` — clickable `<div>` card → added `role="button" tabIndex onKeyDown` via new `utils/a11y.js#clickableDivProps`.
- [x] `components/feed/FeedServiceCard.jsx` — same fix.
- [x] `components/feed/FeedPastEventCard.jsx` — same fix.
- [x] `components/feed/FeedEventBanner.jsx` — same fix.
- [x] `components/feed/FeedPostCard.jsx` — same fix on both the card body (source link) and the nested user row (profile link). Known compromise: this leaves a `role="button"` div nested inside another `role="button"` div, which is itself not ideal a11y — flagged below as a follow-up rather than restructuring PostCard's layout in the must-fix pass.

## This branch (`design-review/frontend-fixes`)

### Repo-wide sweeps completed (all files under `frontend/src`, not a sample)

- [x] **Clickable `<div>`/`<strong>` driving navigation or opening a sheet, with no keyboard access** — found and fixed everywhere via `grep` for `<div ... onClick` across `pages/` and `components/` (this covers `admin/` and `provider-portal/` too, since they're subdirectories of `pages/`). Fixed: `ExploreScreen.jsx` (provider card), `CommunityList.jsx` (2 circle cards), `ProductsStore.jsx` (ProductCard), `ProfileScreen.jsx` (neighbourhood card, bug-report row), `EventsScreen.jsx` (past-event row), `components/CommunityCard.jsx`, `components/PointsBadge.jsx`, `components/FeedEvent.jsx` (avatar + 3 inline name links), `components/PostFeed.jsx` (post user row, comment user row), `components/Leaderboard.jsx` (avatar + name). All use the shared `utils/a11y.js#clickableDivProps` helper.
  - **Deliberately left alone**: modal-backdrop `onClick={() => close()}` divs (`ProviderDashboard.jsx`, `CircleDetailScreen.jsx`, `admin/AdminProducts.jsx`, `admin/AdminProviders.jsx`, `provider-portal/ProviderPortalProducts.jsx`, `provider-portal/ProviderPortalEvents.jsx`, plus sheet overlays in `AskWellCircle.jsx`, `BurgerMenu.jsx`, `PointsInfoSheet.jsx`, `ShareCard.jsx`). This is the standard click-outside-to-dismiss pattern, not a broken interactive element — but none of these modals appear to close on `Escape`. That's a separate, real gap (see nice-to-have below), not the same bug class.
- [x] **`<img>` without explicit size (CLS risk)** — checked every raw `<img>` in `frontend/src` (most images go through `SmartImage`, which sizes explicitly). Fixed `Header.jsx`, `SplashScreen.jsx`, `VisitScreen.jsx` (added `width`/`height`). Left alone: `BurgerMenu.jsx`, `FeedEvent.jsx`'s inner `<img>`, `MyRedemptions.jsx`, `provider-portal/ProviderPortalLogin.jsx` — all already sized via CSS class or inline `style`, which reserves layout space just as well.

### Not exhaustively covered (scope limitation — be upfront about this)

The two sweeps above are repo-wide and mechanical (grep-verified), so they're complete. What's **not** done is a full line-by-line guideline audit of every page (form labels on every input, truncation on every text field, focus-visible states, etc.) — that's ~40 files of manual reading and was out of reach at this pass. If you want that level of depth on a specific page or flow (e.g. BookingFlow, the admin dashboards, or the provider portal), name it and it'll get the same depth as `OnboardingFlow`/`ExploreScreen` got below.

### Pages given a full manual pass (forms, labels, truncation, semantics — not just the two sweeps)

- [x] `pages/SplashScreen.jsx` — ✓ clean after img sizing fix.
- [x] `pages/OnboardingFlow.jsx` — fixed: 3 inputs missing `aria-label`/`autoComplete`; replaced blocking `alert()` on submit failure with the existing `showToast` pattern (consistent with the rest of the app, non-blocking, matches `aria-live` toast semantics).
- [x] `pages/VisitScreen.jsx` — ✓ clean after img sizing fix (already model behavior: real `<a>` tags for outbound links, `aria-pressed` on language toggle).
- [x] `pages/ForYouScreen.jsx` (current Home) — ✓ no direct DOM issues; delegates all card rendering to the already-fixed `components/feed/*`.
- [x] `pages/ExploreScreen.jsx` — fixed: search input missing `aria-label`/`autoComplete`; provider card clickable-div (see sweep above).

### Carried over from the initial spot-check (nice-to-have, not yet done)

- [ ] `FeedProviderCard.jsx` / hero-style cards — provider name / location text has no `truncate`/`line-clamp` guard; long values could overflow.
- [ ] `components/feed/FeedPostCard.jsx` — nested `role="button"` divs (card body + user row) after the a11y fix; consider restructuring so the user row sits outside the outer clickable area instead of nested inside it.
- [ ] Repo-wide — `<button onClick={() => navigate(...)}>` used for many "See all / Browse" actions instead of `<Link>`. Still keyboard/SR accessible, just loses native Cmd/Ctrl-click-to-new-tab. Low priority, no blanket rewrite planned.
- [ ] **New**: none of the modal/sheet overlays (list above) close on `Escape`. Worth a single shared `useDismissOnEscape` hook rather than fixing ~10 call sites individually.

### Remaining pages — not yet given a full manual pass (only covered by the two repo-wide sweeps above)

- [ ] `pages/CircleDetailScreen.jsx`
- [ ] `pages/CommunityDetail.jsx`
- [ ] `pages/ProfileScreen.jsx` (clickable-divs fixed; not fully audited otherwise)
- [ ] `pages/PublicProfile.jsx`
- [ ] `pages/FollowersList.jsx`
- [ ] `pages/NotificationsScreen.jsx`
- [ ] `pages/ProviderDetail.jsx`
- [ ] `pages/ProviderOnboard.jsx`
- [ ] `pages/ProviderDashboard.jsx`
- [ ] `pages/BookingFlow.jsx`
- [ ] `pages/MyBookings.jsx`
- [ ] `pages/ProductsStore.jsx` (clickable-div fixed; not fully audited otherwise)
- [ ] `pages/ProductDetail.jsx`
- [ ] `pages/ProductRedeem.jsx`
- [ ] `pages/MyRedemptions.jsx`
- [ ] `pages/TrainerVerification.jsx`
- [ ] `pages/AboutScreen.jsx`
- [ ] `pages/CommunityList.jsx` (clickable-divs fixed; not fully audited otherwise)
- [ ] `pages/EventsScreen.jsx` (clickable-div fixed; not fully audited otherwise)
- [ ] `pages/admin/*.jsx` (9 files)
- [ ] `pages/provider-portal/*.jsx` (9 files)

## Rules of engagement for this branch

1. Work through the remaining-pages checklist top to bottom; check the box and note findings inline (or "✓ nothing found") as each page gets a full pass.
2. Fix findings in the same pass when low-risk (a11y attributes, truncation, `<div onClick>` → keyboard-accessible or real element). Anything that would change visual layout or behavior materially — flag here instead of changing silently.
3. Don't touch backend/, telegram-bot/, or unrelated frontend files while on this branch.
4. Run `npx vitest run` before committing; the suite has known pre-existing flaky timeouts (order-dependent, different file fails each run — confirmed by re-running twice with no code changes) — a failure there alone is not a regression, but re-run to confirm before assuming that.
