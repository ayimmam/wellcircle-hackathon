# Sprint Team Handoff — Jul 13–19, 2026

For Bezi, Yoni, and Biniyam to pick up their own tracks from
`docs/WellCircle_Dev_Timeline.docx`. This isn't a repeat of the timeline —
it's what already exists in the codebase that changes or shortens each
person's remaining tasks, found while doing Anteneh's own Mon–Wed work
(full detail in `HANDOFF.md`'s "Phase 6" section and `docs/USER_FLOW_AUDIT.md`).

General notes that apply to everyone:
- `main` was just updated (PR #6) with a Supabase connection-pooling fix
  that matters if your task involves hitting the backend under any kind of
  load or bulk operation — see the "Scaling" note at the bottom.
- PostHog is wired up (`frontend/src/analytics.js`, `track(event, props)`).
  If your Friday deliverable involves confirming analytics events fire
  (Biniyam), follow that file's pattern rather than adding a second
  tracking library.

---

## Bezi — Kuriftu audit, service list, gap analysis, Explore QA

**A placeholder Kuriftu provider already exists in production** —
`backend/seed_kuriftu_placeholder.py` inserted "Kuriftu Resort & Spa"
(`is_featured=TRUE`, 3 made-up services, description prefixed
`[Placeholder — replace with Bezi's Tue Jul 14 service audit]`) so the
front-page ordering fix (below) was demoable before your real data landed.

**When your structured service list (Tue) is ready: edit that row in
place, or delete it and reseed — don't insert a second Kuriftu-named
provider.** `backend/mark_kuriftu_featured.py` (also new this session)
finds "the Kuriftu provider" by `name ILIKE '%kuriftu%'` to flag it
`is_featured` and boost its events; two matching rows makes that ambiguous.
`providers.services` is a JSONB array of `{name, price, duration}` — see
either script for the exact shape SQLAlchemy expects.

**Kuriftu now leads the front page automatically.** `HomeScreen.jsx` used
to re-sort providers by rating only, silently undoing the backend's
`is_featured`-first ordering — fixed, so once your seed sets
`is_featured=TRUE` (or reuses the placeholder row), Kuriftu takes the hero
banner, the featured carousel, and (via `provider_events.is_boosted`) the
"Happening Soon" events carousel with zero extra work on your end.

**For Wednesday's gap list** (Kuriftu's booking steps vs. the app's), start
from `docs/USER_FLOW_AUDIT.md` — it already documents the app's actual
3-step booking flow (`BookingFlow.jsx`: service → date/time → payment) and
found gaps from the app side (F1: time slots are a fixed mock list, not
real per-provider availability; no add-ons/room-selection concept exists
at all in the schema). Your audit is the other half — where does Kuriftu's
real flow have a step (deposit, room selection, add-ons) the app's 3-step
flow has no field for at all.

**For Thursday's Explore sign-off:** `ExploreScreen.jsx` already renders a
"Featured" badge over `is_featured` providers and shows
`active_promotion.headline` inline if one's set (`provider_promotions`
table — see Biniyam's section, you may end up QA'ing his promo copy here
too).

---

## Yoni — Sheets integration

**Hook the write at payment success, not booking creation.** A booking row
is created in `POST /api/bookings` (`app/api/bookings.py`) *before* payment
is attempted — `docs/HANDOFF.md`'s Phase 6 section documents a bug where a
failed/timed-out payment left that booking orphaned. If the Sheet write
fires on creation, you'll log bookings that never actually got paid. The
better hook is wherever payment status flips to `success`:
`app/crud/booking.py`'s `update_booking_payment()`, called from the
Telebirr/M-Pesa webhook handlers and the status-poll path in
`app/api/payments.py`. That's also naturally where "booking id, guest,
service, date/time, status" are all available on one row.

**Known gap for Thursday's task:** there is currently **no
cancellation or reschedule endpoint** on bookings — `app/api/bookings.py`
only has `POST` (create). "Status-update logic tested (cancellations,
reschedules, conflicts)" assumes those flows exist in the app; right now
the only status transitions a booking actually goes through are
`pending → success` / `pending → failed` via payment. Worth a quick check
with the team on whether cancellation/reschedule needs to be built this
week too, or whether Thursday's scope narrows to payment-status changes
only.

**Auth for the Sheets service account:** doesn't intersect with anything
built this session — your Monday scoping (auth method, field mapping) is
independent, just flagging there's no existing precedent in this repo for
a third-party service-account integration to pattern-match against; you're
first.

---

## Biniyam — pre-sale promo + re-entry triggers

**The promotions backend already exists — you're extending, not building
from scratch.** `POST /providers/me/promotions` (`app/api/providers.py`)
already accepts `{headline, discount_pct, valid_until}` and writes to the
`provider_promotions` table (`app/models/provider_promotion.py`, from an
earlier phase's event-boosting work). `app/services/promotion_service.py`'s
`get_active_promotion()` already picks the current active one per provider
and it's already wired into `GET /api/providers`'s response
(`active_promotion` field) and rendered on Explore cards
(`ExploreScreen.jsx` shows `🏷 {headline}` on the provider image). **What's
missing for Tuesday's "flat % discount tied to early sign-up" is the
tie-in logic** — right now any provider can create any promotion at any
time; there's no concept of "this promo only applies to first-time
visitors" or auto-creation on signup. That's the actual net-new piece.

**The re-entry nudge engine already exists too.**
`telegram-bot/bot/services/reengagement.py` runs a job that finds users
inactive 7+ days (`GET /api/bot/inactive-users`) and DMs them — this is
your Wednesday/Thursday "re-entry trigger," already built and running, not
a sketch. What's missing is making it **promo-aware**: the timeline's own
example message — *"come back and use your discount before it expires"* —
needs the reengagement message to look up the recipient's applicable
promotion (via `get_active_promotion`) and reference it, rather than
sending generic copy. You may also want a *separate*, faster trigger for
"browsed but never booked" (hours, not 7 days) distinct from the general
dormant-user job — worth deciding with the team whether that's this week's
scope or a fast-follow.

**For Friday's analytics confirmation:** follow `frontend/src/analytics.js`'s
`track(event, properties)` pattern (already used for `booking_start` etc. —
see `HANDOFF.md` Phase 6). Suggested events to add:
`promo_view` (Explore card render / provider detail), `promo_redeemed` (on
booking with an active promotion applied), `reentry_open` (app open via the
bot's re-engagement message — Telegram deep links carry a `start_param`,
same mechanism `AuthContext.jsx`'s `handleStartParam` already uses for
circle-invite links, worth reusing rather than inventing a second scheme).

---

## Scaling note (relevant if anyone's task involves bulk operations)

This session load-tested the app at ~200 concurrent users and found (then
fixed) two real bugs: a serverless connection-pool misconfiguration and an
N+1 query pattern in the providers/communities list endpoints. Both fixes
are on `migration/backend`; the pool fix is merged to `main`, the query fix
is not yet (see `HANDOFF.md` Phase 6 "Known Gaps"). If your work this week
adds a new endpoint that lists/loops over many rows (e.g. Yoni's Sheets
sync touching every booking, Bezi's bulk service seed), batch lookups
rather than querying per-row in a loop — the two fixed functions
(`get_all_providers` in `app/crud/provider.py`, `get_all_communities` in
`app/crud/community.py`) are a template for the pattern (fetch the list,
then one or two `IN (...)`-clause queries for anything you'd otherwise look
up per row, joined in Python via a dict).
