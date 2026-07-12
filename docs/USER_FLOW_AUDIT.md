# User-Flow Audit & Analytics Decision (Mon Jul 13)

Owner: Anteneh · Sprint: Jul 13–19 · Deliverable: annotated user-flow map + analytics tool decision.
Walked the real code path (`frontend/src/pages/*`) as a first-time guest would experience it.

## Analytics decision: PostHog Cloud

**Chosen tool: PostHog Cloud (free tier, 1M events/mo).**

Why: works inside the Telegram WebView (plain JS snippet, no cookie/ad-tech dependency), supports arbitrary custom events with instant verification in the live-events view — which is exactly what Friday's checkpoint needs (Biniyam verifying promo view / redemption / re-entry events). Funnels and retention come built-in, mapping directly onto the sprint's success criteria (new customers → funnel conversion, repeat rate → retention). Zero backend work required, which matters on a 1-week sprint.

Rejected: GA4 (flaky in Telegram WebView, ~24h event processing kills same-week verification); in-house events table (data ownership is nice but we'd hand-build funnels — post-sprint option, PostHog events can be mirrored later).

**Tuesday's first events** (instrument in `frontend/src`, identify users by Telegram ID from `AuthContext`):

| Event | Where |
|---|---|
| `app_open` | `AuthContext` after successful auth |
| `explore_view` | `ExploreScreen` mount (props: view, category) |
| `booking_start` | `BookingFlow` mount (props: provider_id, source) |

Later in the week: `booking_step` (step index), `payment_initiated`, `booking_confirmed`, `payment_failed`, `promo_view`, `promo_redeemed`, `reentry_open` (for Biniyam's loop).

## Annotated user-flow map

```
Telegram → Splash (/)                      auth via initData, JWT stored
   ├─ no user → /onboarding
   └─ user    → /home
/home ────────────────────────────────────  greeting, points, hero provider,
   │                                        events carousel, featured providers,
   │                                        quick-join circles
   ├─ hero "Book Now" ───────────────► /booking/:id   (skips detail — F4)
   ├─ provider card ─────────────────► /provider/:id
   └─ "See all" ─────────────────────► /explore
/explore ─────────────────────────────────  studios/events tabs, search, category chips
   ├─ card tap ──────────────────────► /provider/:id
   └─ card "Book Now" ───────────────► /booking/:id   (skips detail — F4)
/provider/:id ────────────────────────────  gallery, services, community, events
   ├─ service row tap ───────────────► /booking/:id  (service pre-selected ✓)
   └─ "Book Now" CTA ────────────────► /booking/:id
/booking/:id ─────────────────────────────  3 steps: Service → Date & Time → Payment
   step 0  pick service   (skipped-look if pre-selected? no — still shown)
   step 1  pick date (7 day chips) + time (hardcoded mock slots — F1)
   step 2  order summary, Telebirr/M-Pesa, phone input (weak validation — F3)
   └─ Pay → processing (3s poll, 60s timeout — F2) → Confirmation screen
        Confirmation: ref, details, "+50 Legacy Points", Back to Home
```

## Friction points (ranked)

**F1 — Time slots are fake and identical for every provider.** `BookingFlow` step 1 renders `MOCK_TIME_SLOTS` from `src/data/mock.js` — every provider shows the same 13 hardcoded times regardless of real availability, and nothing blocks double-booking a taken slot. Also the date chips show only the weekday name ("Mon", "Tue") with no date number — two "Mon" chips would be indistinguishable if the range ever grows, and users can't tell which calendar date they picked until the summary. *Fix candidate for Wed: at minimum show "Mon 14" on chips; ideally serve slots from the provider record.*

**F2 — Payment processing dead-ends with no recovery.** On timeout/failure the user gets a toast and is dropped back to the payment step, but the booking was already created (`createBooking` succeeds before payment initiates). Retrying creates a duplicate booking; there's no "retry payment for this booking" path and no link to My Bookings to check what happened. Telebirr says "complete payment on your Telebirr app" but there's no deep link or cancel button during the 60s wait.

**F3 — Phone input barely validated.** `canNext()` only checks length ≥ 9; nothing enforces the 09XX (Telebirr) vs 254XXX (M-Pesa) formats the placeholder implies, so a typo only fails after payment initiation — the most expensive place to fail.

**F4 — "Book Now" on Home/Explore cards skips the provider detail page.** A first-time guest lands directly in the booking flow having never seen the description, photos, ratings detail, or full service list. Good for repeat users, risky for new-customer conversion (a sprint success criterion). Worth A/B-watching via `booking_start`'s `source` property before changing.

**F5 — Explore search fires an API call per keystroke.** No debounce on `search` in `ExploreScreen`'s effect — on Ethiopian mobile networks against a cold serverless backend this means laggy, out-of-order results. One-line fix (300ms debounce).

**F6 — Confirmation screen shows stale copy.** "+50 Legacy Points (Phase 2)" is hardcoded on the confirmation screen even though the points economy is live (`points_balance` on Home). Minor, but it's the last thing a guest sees and it reads as placeholder.

**Wednesday's "top 2 friction points" pick: F1 (date/slot clarity) and F2 (payment failure recovery)** — both sit at the bottom of the funnel where drop-off costs a paid booking. F5 and F6 are cheap enough to sweep in alongside.

## Trace to success criteria

- New customers → funnel events (`app_open` → `explore_view` → `booking_start` → `booking_confirmed`) quantify drop-off; F2/F3 fixes remove bottom-funnel losses.
- Repeat rate → PostHog retention on `app_open`; `reentry_open` ties into Biniyam's nudge loop.
- Services used → `explore_view`/`booking_start` props (category, provider_id) show service spread.
