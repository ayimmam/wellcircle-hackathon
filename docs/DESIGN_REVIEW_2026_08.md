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

### Pages given a full manual pass (continued)

- [x] `pages/CircleDetailScreen.jsx` — fixed: unlabeled icon-only back button; leaderboard-row and members-row clickable divs (keyboard access); unlabeled monthly-price input. Flagged, not fixed: `prompt()` for private-circle join codes is a blocking native dialog (same anti-pattern as the `alert()` fixed in OnboardingFlow) but replacing it needs a small modal + state, not a one-line swap — left as a follow-up.
- [x] `pages/BookingFlow.jsx` — fixed: clickable service-selection div (keyboard access); `PhoneInput`'s national-number field had no accessible name and its validation error wasn't wired for screen readers (added `aria-label`, `aria-describedby`, `role="alert"` on the error, `autoComplete="tel-national"`). Noted, not fixed: the visual "Type your phone number…" `<label>` above `PhoneInput` isn't programmatically associated (the component renders two controls — a country-code select and the number field — so a single `htmlFor` doesn't map cleanly); the multi-day modal has no `role="dialog"`/focus trap, consistent with every other modal in the app (systemic, not specific to this file).
- Tests: `BookingFlow.phoneBooking`, `BookingFlow.multiDay`, `BookingFlow.promo`, `CircleDetailScreen.paid`, `CircleDetailScreen.preview`, `CircleStories` — all 24 tests pass after these changes.
- [x] `pages/CommunityDetail.jsx` — ✓ clean: back button already labeled, no clickable divs, feed/posts tabs have visible text (not icon-only), and it inherits the `FeedEvent`/`Leaderboard` a11y fixes from the earlier pass automatically.
- [x] `pages/ProviderDetail.jsx` — fixed: photo-gallery thumbnails were a bare `<img onClick>` (via `SmartImage`, which spreads `...rest` straight onto the `<img>`) — no button semantics, no keyboard access; wrapped each in a real `<button type="button" aria-pressed>`. Also fixed the service-list clickable div (same `clickableDivProps` pattern, only applied when the provider isn't `is_coming_soon`).
- Tests: `ProviderDetail.navigationTips`, `PublicProfile`, and the full 50-route `routes.smoke` suite — all pass, confirming the gallery-button change didn't break layout or any other screen.
- [x] `pages/ProfileScreen.jsx` (full pass, not just the clickable-divs from the earlier sweep) — fixed: "Joined Circles" list item was a clickable div (keyboard access added); the language `<select>` had no accessible name (added `aria-label`). Already fine: bio textarea has `aria-label`, radio/checkbox rows are properly `<label>`-wrapped, theme/accent toggles use `role="group"` + `aria-pressed`.
- [x] `pages/PublicProfile.jsx` — ✓ clean: no clickable divs, back button and connection counts are real labeled buttons, created-circles list uses `<button>` not `<div onClick>`.
- Tests: `ProfileScreen.location`, `ProfileScreen.healthApp`, `PublicProfile`, `FollowersList` — all 12 pass.
- [x] `pages/FollowersList.jsx` — fixed: avatar-only button had no accessible name (image inside has no alt); Followers/Following toggle used `role="tablist"` without proper `role="tab"`/tabpanel semantics — misuse of ARIA is worse than none, replaced with `role="group"` + `aria-pressed` (tried adding real `role="tab"` first but it flips the accessible role away from "button", breaking `FollowersList.test.jsx`'s `getByRole('button', ...)` assertion — reverted to the group/pressed pattern instead).
- [x] `pages/NotificationsScreen.jsx` — fixed: notification-card clickable div had no keyboard access (added `clickableDivProps`, made it always clickable rather than conditionally on `action_url` since marking read is meaningful either way); `transition: 'all 0.2s ease'` → `transition: 'transform 0.2s ease'`; `"Loading..."` → `t('Loading…')`.
- Tests: `FollowersList` + full 45-route smoke suite — all pass.
- [x] `pages/ProviderOnboard.jsx` — fixed: every input/select/textarea across all 5 steps had no `<label>` or `aria-label` (a screen reader would announce a bare textbox, or for the `<select>`s, nothing describing what's being chosen) — added `aria-label` to all of them; latitude/longitude fields got `type="number" inputMode="decimal"`; invite-code field got `autoComplete="off" spellCheck={false}`; `"Submitting..."` → `"Submitting…"`.
- Tests: full 43-route smoke suite — all pass.
- [x] `pages/MyBookings.jsx` — fixed: `"Loading..."` → `t('Loading…')`. Otherwise clean: no clickable divs, status conveyed by color + text label together (not color alone).
- [x] `pages/ProviderDashboard.jsx` — fixed: subscription-plan card was a clickable div (keyboard access added); every input/select across the product/event/challenge creation modals, the redemption-status editor, the booking-status filter, and the subscription payment form had no accessible name — added `aria-label` throughout, plus `type="tel"`/`inputMode` where appropriate. Already fine: the date-range filters (`From`/`To`) use real `<label>`-wrapped inputs.
- Tests: `ProviderDashboard.plans` + full 44-route smoke suite — all pass.
- [x] `pages/ProductsStore.jsx` — fixed: search input and type-filter select had no accessible name.
- [x] `pages/ProductDetail.jsx` — fixed: photo-carousel prev/next glyph buttons (`◀`/`▶`) had no `aria-label`.
- [x] `pages/ProductRedeem.jsx` — fixed: all 5 delivery-address inputs had no accessible name; phone field got `type="tel"`; `"Processing Payment..."` → `"Processing Payment…"`.
- [x] `pages/MyRedemptions.jsx` — ✓ clean: no clickable divs, filter chips have visible text, product thumbnail's `alt=""` is defensible since the adjacent heading already names the product for screen readers.
- [x] `pages/TrainerVerification.jsx` — ✓ clean: file inputs properly `<label>`-wrapped, all steps use real buttons.
- [x] `pages/AboutScreen.jsx` — ✓ clean: `Row` is a real `<button>`, decorative logo has `aria-hidden`.
- [x] `pages/EventsScreen.jsx` — ✓ clean (already uses `role="tab"`/`aria-selected` correctly, my earlier clickable-div fix already applied); noted, not changed: the tab pair has no `role="tabpanel"` or arrow-key navigation, a pre-existing minor gap not worth restructuring for two chips.
- [x] `pages/CommunityList.jsx` — fixed: a ranks-tab community row was a clickable div my first repo-wide sweep missed (grep matched `<div ... onClick` on the same line, but this one had it on a following line — worth knowing the sweep isn't 100% grep-proof); new-circle-name and join-code inputs had no accessible name.
- Tests: full 47-route smoke suite + `PostFeed` — all pass.

**Core pages review (task #1) — complete.** Every file under `pages/` (excluding `admin/` and `provider-portal/`) has now had a full manual pass, not just the two repo-wide sweeps.

### Admin pages (task #2) — complete

- [x] `pages/admin/AdminLayout.jsx` — ✓ clean: `NavLink` tabs render real `<a>` elements, native keyboard/Cmd-click support.
- [x] `pages/admin/AdminAnalytics.jsx` — ✓ clean: no inputs, no clickable divs, all buttons text-labeled.
- [x] `pages/admin/AdminFeedback.jsx` — fixed: status `<select>` per feedback item had no accessible name.
- [x] `pages/admin/AdminPaidCircles.jsx` — fixed: rejection-reason textarea had no accessible name.
- [x] `pages/admin/AdminPointsAward.jsx` — fixed: search input had no accessible name; "Points Amount"/"Note" `<label>`s looked associated but had no `htmlFor`/`id` pairing (added both, since the labels are outside the input, not wrapping it — cosmetic association isn't real association); `"Searching..."`/`"Awarding..."` → ellipsis.
- [x] `pages/admin/AdminProducts.jsx` — fixed: search input, status filter, redemption-status filter, and stock-adjustment input all had no accessible name.
- [x] `pages/admin/AdminProviders.jsx` — fixed: search input and the entire "Add Provider Directly" form (6 fields) had no accessible name; `"Generating..."` → ellipsis. Flagged, not fixed: `prompt()` for rejection reason is the same blocking-dialog anti-pattern noted in CircleDetailScreen — consistent, not a one-off.
- [x] `pages/admin/AdminReports.jsx` — ✓ clean: report cards are real buttons with visible titles.
- [x] `pages/admin/AdminTrainerVerifications.jsx` — fixed: rejection-reason textarea had no accessible name.
- Tests: full 48-route smoke suite + `AdminLaunchFeatures` + `AdminFeedback` — all pass.

### Provider-portal pages (task #3) — complete

- [x] `pages/provider-portal/ProviderPortalShell.jsx` — ✓ clean: `NavLink` tabs render real `<a>` elements.
- [x] `pages/provider-portal/ProviderPortalLogin.jsx` — ✓ clean, actually a model example: proper `htmlFor`/`id` label pairing on both fields.
- [x] `pages/provider-portal/ProviderPortalOverview.jsx` — fixed: navigation-tip and facility inputs had `id`s (for test targeting) but no `<label>` or `aria-label` — cosmetic-only, not real association.
- [x] `pages/provider-portal/ProviderPortalBookings.jsx` — fixed: status filter `<select>` had no accessible name.
- [x] `pages/provider-portal/ProviderPortalEvents.jsx` — fixed: same pattern as `ProviderDashboard.jsx`'s Events tab (this portal page duplicates that logic) — spots/staff inputs, boost-event select, and all 7 create-event modal fields had no accessible name; `"Processing Telebirr..."` → ellipsis.
- [x] `pages/provider-portal/ProviderPortalProducts.jsx` — fixed: same pattern as `ProviderDashboard.jsx`'s Products tab — redemption status/notes and all 4 create-product modal fields had no accessible name.
- [x] `pages/provider-portal/ProviderPortalPromotions.jsx` — ✓ clean (delegates to `PromotionForm`, not itself in scope).
- [x] `pages/provider-portal/ProviderPortalSubscriptions.jsx` — fixed: plan-selector card was a clickable div (keyboard access added, same as `ProviderDashboard.jsx`); payment method select and phone input had no accessible name, phone missing `type="tel"`.
- [x] `pages/provider-portal/ProviderPortalCustomers.jsx` — ✓ clean: real button, no clickable divs.
- Tests: full 43-route smoke suite — all pass. Full suite: 258/261 (3 pre-existing flaky failures, matches the established baseline — not a regression).

**Provider-portal pages review (task #3) — complete.**

## Rules of engagement for this branch

1. Work through the remaining-pages checklist top to bottom; check the box and note findings inline (or "✓ nothing found") as each page gets a full pass.
2. Fix findings in the same pass when low-risk (a11y attributes, truncation, `<div onClick>` → keyboard-accessible or real element). Anything that would change visual layout or behavior materially — flag here instead of changing silently.
3. Don't touch backend/, telegram-bot/, or unrelated frontend files while on this branch.
4. Run `npx vitest run` before committing; the suite has known pre-existing flaky timeouts (order-dependent, different file fails each run — confirmed by re-running twice with no code changes) — a failure there alone is not a regression, but re-run to confirm before assuming that.
