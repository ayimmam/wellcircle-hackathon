# Kuriftu Booking Flow — Gap Analysis
 **Date:** Wed Jul 15 · **Source:** `docs/USER_FLOW_AUDIT.md` + direct call with Kuriftu African Village (booking@kurifturesorts.com)

## Purpose
Compare the app's current booking flow (`BookingFlow.jsx`) against Kuriftu's real-world booking process, to surface where the app's assumptions don't match how Kuriftu actually operates — before the feature goes live.

## App's current flow (from `USER_FLOW_AUDIT.md`)
3 steps: **Service → Date & Time → Payment**
- Step 1: date (7-day chips) + time (hardcoded mock slots — F1, same for every provider)
- Step 2: order summary, phone number, Telebirr/M-Pesa payment required before confirmation

## Kuriftu's real process — two distinct paths

### Path A: Standalone wellness/spa (no room stay)
- Booking method: **phone call only** — no online booking system for this
- **No deposit required**
- **Payment happens after the service is used**, on-site
- Timing/availability: flexible, no fixed time slots
- Applies to both individual services and standalone packages (see below)

### Path B: Wellness bundled with a room stay
- Booked through Kuriftu's **online Reserve flow** (property → guests → dates → room selection)
- **Payment happens online, upfront** — this path actually matches the app's payment model
- No standalone spa-only booking exists inside this flow; it's tied to the room reservation

## Gap table

| # | Kuriftu's real process | App's `BookingFlow.jsx` | Gap |
|---|---|---|---|
| G1 | Standalone spa booked by phone call — no online path | Fully digital 3-step self-serve flow | App assumes online self-serve booking; Kuriftu's standalone path is entirely phone-based |
| G2 | No room stay required for standalone services | App already treats services as independently bookable | ✅ Aligned — no gap |
| G3 | **Standalone spa:** no deposit, pay *after* service | App requires Telebirr/M-Pesa payment *before* confirmation | Mismatch — applies specifically to standalone bookings |
| G4 | No fixed time slots for standalone bookings — flexible | Fixed mock time slots, identical for every provider (F1) | App's fake slot system has no real equivalent for Kuriftu's standalone path |
| G5 | Bundled packages exist and are bookable standalone (see pricing below) | No add-on/package concept anywhere in schema | Schema gap — no field to represent bundled offerings |
| G6 | Standalone payment collected on-site, after service — can be via mobile payment apps (e.g. Telebirr), not necessarily cash-only | App hardcodes Telebirr/M-Pesa as the only payment method, collected *before* confirmation | Payment **method** may actually overlap (both can use Telebirr); the real mismatch is **timing** — app charges upfront, Kuriftu charges after service is rendered |
| G7 | **Room + wellness bundle:** booked online, paid upfront | App has no concept of "room" or room+service bundling at all | Schema gap — app can't represent this booking type, even though its payment model would actually fit here |

## Headline finding
Kuriftu has **two distinct wellness booking paths**, not one:

1. **Standalone spa/wellness** — booked by phone, no deposit, pay after use (possibly via the same mobile payment apps the app uses, like Telebirr — so the *method* may overlap, but the *timing* doesn't). This is a fundamental mismatch with the app's pay-upfront digital flow (G1, G3, G4, G6).
2. **Wellness bundled with a room stay** — booked online, paid upfront. This actually *aligns* with the app's payment model — but the app has no schema concept of "room" or "room+service bundle" at all, so it can't represent this booking type either (G7).

**Conclusion:** the app isn't universally wrong about payment timing — it's wrong for standalone spa bookings, and structurally unable to represent the room-bundle case. Neither path is fully supported by the current schema/flow as-is.

## Confirmed pricing data (Kuriftu African Village wellness — for reference)

| Service | Duration | Price (ETB) |
|---|---|---|
| Aroma Massage | 90 min | 5,500 |
| Aroma Massage | 50 min | 4,000 |
| Swedish Massage | 90 min | 4,500 |
| Swedish Massage | 30 min | 2,000 |
| Deep Tissue Massage | 50 min | 3,000 |
| Steam & Sauna | 2 hours | 2,500 |
| Morocco Bath | 90 min | 5,000 |
| Pedicure (Normal) | — | 2,000 |
| Pedicure (Special) | — | 2,600 |
| Manicure (Normal) | — | 600 |
| Manicure (Special) | — | 800 |
| Swim + Steam & Sauna (package, standalone) | — | 3,600 |
| Massage + Steam & Sauna (package, standalone) | — | 4,950 |

## Implementation status (This Session)

Scoped fix: **G1/G3/G4/G6** (standalone phone-booking) addressed together, in
place of the fixed-slot online-payment flow. G5 (packages) is represented as
plain service line items — no schema change needed, since the existing
`{name, price, duration}` shape already fits a named line item. **G7 (room +
wellness bundle) is not built** — it needs a "room" concept that doesn't
exist anywhere in the app and was explicitly out of scope for this pass.

- `providers.services[].booking_method`: `"online"` (default) or `"phone"`.
  A `"phone"` service isn't booked or paid in the app at all.
- New `providers.contact_phone` / `contact_email` columns for the guest to
  reach the provider directly. **Kuriftu's row only gets `contact_email`**
  (`booking@kurifturesorts.com`) — the Jul 15 call surfaced an email, not a
  phone number, and none is fabricated here.
- `BookingFlow.jsx`: phone-booked services show a "Book directly" tag; on
  selection, the flow skips straight to a contact screen (`tel:`/`mailto:`
  links, "no deposit, pay on-site after your visit" copy) instead of the
  date/time and payment steps.
- Kuriftu's row reseeded with the confirmed pricing table above (all 13
  entries, all `booking_method: "phone"`) via `backend/update_kuriftu_services.py`
  — idempotent, edits the existing row per this doc's own headline finding.

Full file list and test results: `HANDOFF.md`'s **Phase 9** entry.

## 2026-08-09 update: owner reversed the pay-on-site default (For You / Boston Day Spa pilot)

**G3/G6 above record that the partner collects payment on-site, after the
service — the entire phone-booking flow this doc describes was built around
that finding.** In the For You / Boston Day Spa pilot planning session, the
owner reversed this: **in-app payment is back in scope**, Telebirr first,
because the backend rail (`POST /api/payments/telebirr/initiate`, the
callback webhook, `GET /api/payments/{booking_id}/status`) already exists
end-to-end from an earlier build and only needs switching on service-by-service.

**Do not "fix" this back to phone-booking-only** — the reversal is
deliberate, not a regression. What's still blocking it from shipping (see
`docs/FEATURE_PLAN_FOR_YOU_AND_PILOT_FOCUS.md` Phase 7):

- **B1 — no confirmed price list for Boston Day Spa.** The official PDF this
  pilot's data comes from has no prices; all 7 seeded services carry
  `price: null` and stay `booking_method: "phone"` until the owner confirms
  a price per service. `BookingFlow.jsx` cannot charge in-app for a null
  price, so the online-payment step has no real service to exercise yet.
- **Real Telebirr merchant credentials.** `services/telebirr_payment.py`
  returns a mock `to_pay_url` whenever `TELEBIRR_MERCHANT_CODE` is unset.
  Production needs `TELEBIRR_MERCHANT_CODE`, `TELEBIRR_APP_KEY`, and a
  publicly reachable `TELEBIRR_NOTIFY_URL` — confirm with whoever holds the
  Telebirr merchant account before wiring these in, since charging upfront
  changes the partner's on-site collection process operationally, not just
  in the app.

Once a service's price is confirmed, flip only that service's
`booking_method` to `"online"` (services can go online one at a time — the
phone-booking path documented above stays correct for every service that
hasn't been priced yet) and restore `BookingFlow.jsx`'s payment step:
create booking → `initiateTelebirr` → `window.Telegram.WebApp.openLink(to_pay_url)`
→ poll `GET /api/payments/{booking_id}/status` → confirmation, with explicit
failure/abandoned/timeout states so a stuck `pending` booking stays
recoverable from `MyBookings` instead of wedging the screen.
