# Well Circle — UI Design Pack

Screenshots of **every screen and tab** of the Well Circle Telegram Mini App,
captured for the UI redesign. Hand any subset of these to Claude design (or a
designer) as the reference for the current UI.

## Capture parameters
- Viewport: **375 × 812 @2x** (iPhone-class; the app is a Telegram Mini App
  rendered in a mobile WebView — design to this frame).
- Every screen exists in **light** (`NN-name.png`) and **dark**
  (`NN-name-dark.png`). The app theme-switches via `data-theme` on `<html>`;
  the redesign must cover both.
- Data is the app's mock/seed dataset (`VITE_USE_MOCK=true`) — names, points,
  and photos are representative, not real.
- **Known capture artifact:** screenshots are full-page (taller than one
  viewport). Fixed chrome — the bottom tab bar and the floating chat button —
  renders once at the original scroll position, so on tall screens it appears
  "mid-page." In the real app it is pinned to the bottom of the viewport.

## App chrome (on almost every screen)
- **Header**: logo + wordmark, notification bell, burger menu.
- **Bottom nav** (4 tabs): Home · Explore · Community · Profile.
- **Floating chat button** (bottom-right): opens the AI concierge.
- Toasts appear top-center; success = green check icon, error = red x.

## Screen index

| # | File | Route | What it is / key elements |
|---|------|-------|---------------------------|
| 01 | `01-onboarding-name` | `/onboarding` (step 1/5) | Signup: name entry. Onboarding keeps its playful emoji per product decision. |
| 02 | `02-onboarding-interest` | `/onboarding` (step 3/5) | Multi-select passions (chips). Drives circle suggestions. |
| 03 | `03-onboarding-circles` | `/onboarding` (step 5/5) | Circles explainer + suggested/joinable circles + create-your-own + invite. |
| 04 | `04-home` | `/home` | Greeting, 🔥 streak + points chips, social-proof banner, daily check-in card, first-reward progress card, hero provider banner, featured providers rail, join-a-circle list. |
| 05 | `05-explore-studios` | `/explore` | Studios view: category chips + provider cards (rating, price range, promo badge). |
| 06 | `06-explore-events` | `/explore` (Events) | Events view: upcoming event cards with spots-left. |
| 07 | `07-community-explore` | `/community` | Community tab, Explore sub-tab: joinable communities. |
| 08 | `08-community-joined` | `/community` (Joined) | User's joined communities. |
| 09 | `09-community-circles` | `/community` (My Circles) | User-created circles list + create-circle form (public/private + join code). |
| 10 | `10-circle-activity` | `/circle/:id` (Activity) | Strava-style feed: composer (+ optional run/walk stats), posts with activity stat strips, comments with one-level replies, 🔥 reactions + coin-icon point gifting. Shown just-joined state with pre-filled intro post. |
| 11 | `11-circle-leaderboard` | `/circle/:id` (Leaderboard) | Weekly leaderboard, 🥇🥈🥉 medals for top 3. |
| 12 | `12-circle-members` | `/circle/:id` (Members) | Member list with points. |
| 13 | `13-community-detail-feed` | `/community/:id` (Live Feed) | Community header, check-in button, live activity feed. |
| 14 | `14-community-detail-posts` | `/community/:id` (Posts) | Same PostFeed component as circles. |
| 15 | `15-provider-detail` | `/provider/:id` | Provider page: photo gallery, rating, promo banner, services list, community join, Book Now. |
| 16 | `16-booking-step1-service` | `/booking/:providerId` (step 1) | Service selection + "pay after service" note. 3-step indicator: Service → Date & Time → Confirm. |
| 17 | `17-booking-step2-datetime` | step 2 | Multi-select date chips + time-slot grid. |
| 18 | `18-booking-step3-confirm` | step 3 | Order summary (promo discount + anchored price), "our team will call you" note, phone number field, Send Booking Request. |
| 19 | `19-booking-request-sent` | post-submit | Confirmation: reference, per-line summary, total (pay on-site), View My Bookings / Back to Home. |
| 20 | `20-booking-direct-contact` | phone-booked services | Kuriftu-style direct-contact screen: Call / Email buttons instead of in-app booking. |
| 21 | `21-my-bookings` | `/my-bookings` | Upcoming/past bookings (empty state shown — mock returns none). |
| 22 | `22-notifications` | `/notifications` | Notification inbox (empty state shown). |
| 23 | `23-products-store` | `/products` | Legacy Points store: balance, search, filters, product grid. |
| 24 | `24-product-detail` | `/products/:id` | Product page: gallery, points price, terms, Redeem CTA. |
| 25 | `25-product-redeem` | `/products/:id/redeem` | Redemption confirm (and voucher-code success state after). |
| 26 | `26-my-redemptions` | `/users/me/redemptions` | Redemption history with status. |
| 27 | `27-profile` | `/profile` | Profile: tier badge, points stats, recent activity ledger, appearance (light/dark), language, local alerts, joined circles, bookings link, health app, redeem points. |
| 28 | `28-provider-dashboard-analytics` | `/provider-dashboard` | Provider KPIs, points-redeemed trend, communities, live activity, recent bookings table. |
| 29–33 | `29…-events/products/customers/promotions/subscriptions` | dashboard tabs | Event management + boost, product management, customer list with point awards, promotion creation, subscription plans. |
| 34 | `34-provider-onboard` | `/provider-onboard` | 5-step provider application (invite code first). |
| 35–38 | `35…-admin-analytics/providers/products/reports` | `/admin/*` | Super-admin dashboard (desktop-ish layout, still mobile frame). |
| 39 | `39-burger-menu` | overlay | Slide-in menu: all destinations. |
| 40 | `40-ai-concierge` | overlay | AI chat ("Circler"): greeting message, provider deep-link pills, input bar. |

## Redesign constraints (tell the designer/Claude design)
1. **Telegram Mini App**: single-column 375px frame, no browser chrome;
   respects `--tg-viewport-height`; must feel native inside Telegram.
2. **Both themes required** — every component must work in light and dark.
3. **Emoji policy** (deliberate, keep): UI chrome uses SVG line icons
   (`Icon.jsx`, 24px grid, 1.75 stroke). Emoji are reserved for: onboarding
   screens, feed reactions (🔥/👏), the 🔥 streak chip, 🥇🥈🥉 leaderboard
   medals, tier badges (🌱🌿🌳🌲), category tags.
4. **Key user loops to keep prominent**: daily check-in + streak (Home),
   points balance → store redemption, circle activity feed, booking
   request → staff-calls-to-confirm (no in-app payment).
5. Lazy-loaded routes: skeleton loading states exist and need designs too.
6. Localized (EN/Amharic/French/Italian) — leave room for longer strings.

## Regenerating this pack
Dev server: `cd frontend && VITE_MOCK_SUPER_ADMIN=true npm run dev`
(mock mode + admin screens). Capture script: puppeteer-core against system
Chrome, 375×812@2x, `data-theme` toggled per shot — see the session scratchpad
`capture.js`, or rebuild from this index (routes + clicks are all listed
above). Planned functional changes that will alter some screens are specced in
`docs/FEATURE_PLAN_V2_UX_UPGRADES.md` — re-shoot affected screens after that
plan lands.
