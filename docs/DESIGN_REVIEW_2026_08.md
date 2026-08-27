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

### Carried over from the initial spot-check (nice-to-have)

- [ ] `FeedProviderCard.jsx` / hero-style cards — provider name / location text has no `truncate`/`line-clamp` guard; long values could overflow.
- [ ] `components/feed/FeedPostCard.jsx` — nested `role="button"` divs (card body + user row); consider restructuring so the user row is a real link that sits outside the outer clickable area instead of nested inside it.
- [ ] Repo-wide — `<button onClick={() => navigate(...)}>` is used for many "See all / Browse" style actions instead of `<Link>`. Not a hard violation (still keyboard/SR accessible) but loses native Cmd/Ctrl-click-to-new-tab. Lower priority than the clickable-`<div>` fixes already done. Note only, no blanket rewrite planned.

### Page-by-page review status

Format when adding findings: `path:line — issue`. Mark `✓` if a page was
checked and had nothing worth flagging.

- [ ] `pages/SplashScreen.jsx`
- [ ] `pages/OnboardingFlow.jsx`
- [ ] `pages/VisitScreen.jsx`
- [ ] `pages/ForYouScreen.jsx` (current Home)
- [ ] `pages/ExploreScreen.jsx`
- [ ] `pages/EventsScreen.jsx`
- [ ] `pages/AboutScreen.jsx`
- [ ] `pages/CommunityList.jsx`
- [ ] `pages/CircleDetailScreen.jsx`
- [ ] `pages/CommunityDetail.jsx`
- [ ] `pages/ProfileScreen.jsx`
- [ ] `pages/PublicProfile.jsx`
- [ ] `pages/FollowersList.jsx`
- [ ] `pages/NotificationsScreen.jsx`
- [ ] `pages/ProviderDetail.jsx`
- [ ] `pages/ProviderOnboard.jsx`
- [ ] `pages/ProviderDashboard.jsx`
- [ ] `pages/BookingFlow.jsx`
- [ ] `pages/MyBookings.jsx`
- [ ] `pages/ProductsStore.jsx`
- [ ] `pages/ProductDetail.jsx`
- [ ] `pages/ProductRedeem.jsx`
- [ ] `pages/MyRedemptions.jsx`
- [ ] `pages/TrainerVerification.jsx`
- [ ] `pages/admin/AdminLayout.jsx`
- [ ] `pages/admin/AdminAnalytics.jsx`
- [ ] `pages/admin/AdminFeedback.jsx`
- [ ] `pages/admin/AdminPaidCircles.jsx`
- [ ] `pages/admin/AdminPointsAward.jsx`
- [ ] `pages/admin/AdminProducts.jsx`
- [ ] `pages/admin/AdminProviders.jsx`
- [ ] `pages/admin/AdminReports.jsx`
- [ ] `pages/admin/AdminTrainerVerifications.jsx`
- [ ] `pages/provider-portal/ProviderPortalShell.jsx`
- [ ] `pages/provider-portal/ProviderPortalLogin.jsx`
- [ ] `pages/provider-portal/ProviderPortalOverview.jsx`
- [ ] `pages/provider-portal/ProviderPortalBookings.jsx`
- [ ] `pages/provider-portal/ProviderPortalEvents.jsx`
- [ ] `pages/provider-portal/ProviderPortalProducts.jsx`
- [ ] `pages/provider-portal/ProviderPortalPromotions.jsx`
- [ ] `pages/provider-portal/ProviderPortalSubscriptions.jsx`
- [ ] `pages/provider-portal/ProviderPortalCustomers.jsx`

## Rules of engagement for this branch

1. Work through the checklist top to bottom; check the box and note findings inline (or "✓ nothing found") as each page is reviewed.
2. Fix findings in the same pass when low-risk (a11y attributes, truncation, `<div onClick>` → keyboard-accessible or real element). Anything that would change visual layout or behavior materially — flag here instead of changing silently.
3. Don't touch backend/, telegram-bot/, or unrelated frontend files while on this branch.
4. Run `npx vitest run` before committing; the suite has known pre-existing flaky timeouts on `ForYouScreen.textFirst`/`ShareCard`-style tests unrelated to this work — a failure there alone is not a regression, but re-run to confirm before assuming that.
