# Biniyam — Presale Promo + Re-entry Loop (Sprint Jul 13–19, 2026)

Owner: Biniyam · Track: pre-sale promo + re-entry triggers + analytics confirmation.
This is Monday's "one-page sketch" deliverable **plus** the implementation map for
the rest of the week. Context: `docs/SPRINT_TEAM_HANDOFF.md` (Biniyam section),
`docs/WellCircle_Dev_Timeline.docx`. Success criterion served: **repeat rate**
(and presale conversion for new customers).

---

## The one-page sketch (Mon Jul 13)

### Who creates a promo, and what it does

```
Provider (dashboard → Promotions tab)
   └─ POST /api/providers/me/promotions
      {headline, discount_pct, valid_until, audience}
         audience = "all"         → shows to everyone, discounts everyone
         audience = "first_time"  → PRESALE: shows to everyone, but the
                                    discount only applies to guests with no
                                    prior successful booking at this provider
```

The promotions table (`provider_promotions`) already existed from the
event-boosting phase — this sprint added the `audience` column and the
eligibility logic around it. **Nothing is promo-coded or claimed manually:**
eligibility is derived from booking history, so the promo "triggers
automatically for first-time visitors" (Wed deliverable) simply by them
booking while it's active.

### Where the guest sees it

1. **Explore card** — `🏷 {headline}` over the provider image (already existed;
   now fires `promo_view`).
2. **Provider detail** — promo banner with expiry + "Applied automatically at
   checkout" (or "you have already booked here" for consumed presales).
   The detail response carries `active_promotion.user_eligible` for *this* user.
3. **Booking payment step** — discount line item and reduced total. The client
   only *predicts*; it always sends the **undiscounted** amount and the backend
   applies the discount (`bookings.promotion_id` + `discount_etb` record it).

### What nudges bring users back

```
                    (weekly job, telegram-bot Railway worker)
GET /api/bot/inactive-users            ── users inactive 7+ days, each with
   └─ promo: soonest-expiring active      an applicable promo attached (or null)
      discount promo the user is
      still eligible for
        │
        ▼
bot/utils/nudges.py  build_reengagement_nudge(user)
   ├─ no promo   → existing generic "we miss you" message
   └─ promo      → "You still have {pct}% off waiting at {provider} — come
                    back and use your discount before it expires on {date}"
                    + button → https://t.me/{bot}?startapp=reentry_promo_{provider_id}
        │
        ▼
Mini App opens → AuthContext.handleStartParam sees `reentry_promo_…`
   ├─ track('reentry_open', {provider_id})        ← closes the analytics loop
   └─ navigate to /provider/{id}                  ← lands on the promo banner
```

Deep link reuses the same `start_param` mechanism as circle-invite links
(`circle_{join_code}`), per the handoff's recommendation — no second scheme.

**Deliberately deferred (decide with team):** a faster "browsed but never
booked" trigger (hours, not 7 days). The current loop reuses the existing
weekly inactive-users job; a faster trigger needs its own activity signal and
job cadence — flagged as a fast-follow, not built this week.

---

## Day-by-day map (what shipped where)

### Tue Jul 14 — promotion endpoint + data model + UI stub
- `backend/app/models/provider_promotion.py` — `audience` column (`all` | `first_time`).
- `backend/app/schemas/promotion.py` — `audience` on create/response (pattern-validated).
- `backend/app/api/providers.py` `POST /me/promotions` — accepts `audience`;
  422 when a presale promo has no `discount_pct`.
- Migrations: `backend/alembic/versions/005_presale_promo.py` **and** the
  idempotent `backend/apply_presale_migration.py` (repo has both mechanisms).
- UI stub: `frontend/src/components/PromotionForm.jsx`, mounted in a new
  **Promotions** tab in `ProviderDashboard.jsx`.

### Wed Jul 15 — promo live in test + auto-trigger for first-time visitors
- `backend/app/services/promotion_service.py` — `user_is_first_time`,
  `get_eligible_promotion`, `compute_discount_etb`.
- `POST /api/bookings` auto-applies the eligible promo **server-side** (client
  sends undiscounted amount); booking rows record `promotion_id`/`discount_etb`.
- Provider detail exposes `active_promotion.user_eligible`.
- Nudge draft: `REENGAGEMENT_PROMO_MESSAGE` in `telegram-bot/bot/utils/messages.py`.
- Test seed: `backend/seed_presale_promo.py` (idempotent, targets the Kuriftu
  provider — coordinate with Bezi's placeholder-row rules in the handoff).

### Thu Jul 16 — end-to-end presale + re-entry loop
- `GET /api/bot/inactive-users` — each user now carries `promo` (batched lookup,
  `get_reengagement_promos`, per the scaling note: two queries total, no N+1).
- `telegram-bot/bot/utils/nudges.py` + rewired
  `bot/services/reengagement.py` — promo-aware message + deep-link button.
- `frontend/src/context/AuthContext.jsx` — `reentry_promo_{provider_id}`
  start_param → `reentry_open` + redirect to the provider page.
- BookingFlow shows the discount line and confirmation shows the server-applied
  discount → the full loop (nudge → open → book → discount) works in test.

### Fri Jul 17 — analytics events confirmed
All via the existing `track()` wrapper (`frontend/src/analytics.js`) — no second
tracking library, per the handoff:

| Event | Fires | Props |
|---|---|---|
| `promo_view` | Explore card render (once per provider per visit) + provider detail | `provider_id`, `surface`, `discount_pct`, `audience` (+ `user_eligible` on detail) |
| `promo_redeemed` | payment success on a booking with a promotion applied | `provider_id`, `promotion_id`, `discount_pct`, `discount_etb` |
| `reentry_open` | Mini App opened from a bot nudge deep link | `source: bot_nudge`, `provider_id` |

These names match the "later in the week" list in `docs/USER_FLOW_AUDIT.md`, so
they slot into Anteneh's PostHog funnels (retention on `app_open` ×
`reentry_open` proves the loop).

### Sat Jul 18 — punch-list walk (with Bezi)
Walk Explore → promo banner → booking → confirmation as a first-time Kuriftu
guest; verify the four PostHog events above appear; log rough edges.

---

## Tests (all green as of this commit)

| Suite | Run | Covers |
|---|---|---|
| `backend/app/tests/test_presale_reentry.py` | `cd backend && python -m app.tests.test_presale_reentry` | audience validation, first-time eligibility (pending vs paid bookings), server-side discount + fallback after presale consumed, batched re-engagement promos, inactive-users payload |
| `backend/app/tests/test_integration.py` | `cd backend && python -m app.tests.test_integration` | pre-existing suite (still passing; stale auto-approve assertion fixed) |
| `telegram-bot/bot/tests/test_nudges.py` | `cd telegram-bot && python -m bot.tests.test_nudges` | generic vs promo nudge, deep-link format, expiry formatting, degraded modes |
| Frontend Vitest | `cd frontend && npm test` | promo math parity, PromotionForm payloads, `promo_view` on Explore, `reentry_open` deep links, BookingFlow discount pricing (+ all pre-existing tests) |

## Deploy notes

1. Run `python apply_presale_migration.py` (or `alembic upgrade head`) against
   Supabase **before** deploying the backend — the code reads the new columns.
2. Optionally `python seed_presale_promo.py` to put the Kuriftu presale promo up.
3. Redeploy backend (Vercel), frontend (Vercel), bot (Railway — keep 1 replica).
   The bot change is backward-compatible: with an old backend it just sends the
   generic nudge (no `promo` field → generic branch).
