# Well Circle — Points Economy, Provider Tools & Social Growth Plan

Architecture and prioritization document. No implementation code here — this is the review artifact before build work starts. Each part lists data-model changes, API endpoints (modify vs. new), frontend surfaces, and ends with sequencing and open questions.

---

## Part A — Market grounding (Addis Ababa wellness providers & events)

### What the research shows

- **Pricing anchor.** Average gym membership in Addis Ababa is ~2,200 ETB/month; day passes for pool/gym access run 950–1,250 ETB ([Expatistan](https://www.expatistan.com/price/gym/addis-ababa)). Premium facilities (Altius, TheBox Smart Gym, Bole Rock, Sweatbox) bundle gym + classes + spa services (steam, sauna, massage) ([Living Ethio](https://www.livingethio.com/site/blog/top-5-gyms-in-addis-ababa-for-2025-best-fitness-centers-in-ethiopia)). Spas (Boston Day Spa, Adona Spa Lodge) sell discrete services: massages, facials, mani/pedi, Morocco baths ([Tripadvisor](https://www.tripadvisor.com/Attractions-g293791-Activities-c40-Addis_Ababa.html)). New entrants explicitly market community/mind-body positioning ([Signature Wellness](https://signaturewellnesseth.com/), opened 2025).
- **How these businesses actually run sessions.** Gyms run **recurring weekly class schedules** (spinning, HIIT, circuit — multiple classes per day, per Living Ethio's facility descriptions). Spas sell **appointment slots**, not events. Pop-up wellness events (retreats, community runs) are one-offs.

### Where this changes the data model

1. **`ProviderEvent`'s one-active-event-per-provider constraint is unrealistic** for the gym/studio segment, which runs several classes per week concurrently. It only fits the pop-up/retreat case. **Recommendation:** lift the single-event restriction and add recurrence support — `recurrence_rule` (nullable string, weekly pattern like `MON,WED 18:00`), keep one row per *series* and materialize occurrences on read, or simply allow N concurrent events with distinct `starts_at`. The simpler "allow multiple events" change unblocks the segment now; full recurrence can wait (flagged in sequencing).
2. **Provider categories map cleanly to service structures**: gym/studio → recurring classes + membership; spa/salon → bookable service menu; practitioner (nutrition/therapy) → 1:1 appointments. The Part D1 point-cost recommendation engine should compare within these **category peer groups**, which the `Community` wellness-category linkage already gives us — no new taxonomy table needed.
3. The membership-heavy gym economics mean the highest-value provider feature is **bringing an existing member back more often** (retention proof to justify their membership fee) rather than one-off class sales — this weighted the Part C shortlist toward the provider CRM + provider-awarded points loop over marketing features.

---

## Part B — Redundancy & maintainability remediation

Verified against the codebase (not just restating the brief), ordered by risk-of-touching (lowest risk first — do these before Part D builds on top):

### B1. Scattered `points_balance` mutation → introduce a transaction ledger (blocking prerequisite for Part D)

`points_balance` is written directly in **12+ modules** (`crud/community.py`, `crud/booking.py`, `crud/product.py`, `crud/post.py`, `crud/circle.py`, `services/scheduler.py`, `api/auth.py`, seeds/tests). History is reconstructed from `CommunityFeedEvent` (`api/users.py:162-194`), which only captures community-scoped events — booking bonuses, gifts, and decay are already invisible to the history endpoint today, and Parts D/E add four more earning types. Auditing and reversal (required for provider-award abuse handling) are impractical without a ledger.

**New table `point_transactions`:**

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK users, indexed | |
| `amount` | Integer, signed | positive = mint/receive, negative = spend/decay/gift-out |
| `type` | String enum | `checkin`, `booking_bonus`, `challenge`, `gift_sent`, `gift_received`, `redemption`, `decay`, `event_participation`, `provider_award`, `admin_adjust`, `referral` |
| `provider_id` | UUID FK, nullable, indexed | set for `provider_award`, `redemption`, `event_participation` |
| `reference_id` | UUID, nullable | booking/challenge/evidence-submission/redemption id |
| `note` | Text, nullable | |
| `reversed_by` | UUID FK point_transactions, nullable | non-null = this row was reversed |
| `created_at` | timestamptz, indexed | |

**Approach:** keep `User.points_balance` as a cached denormalization (cheap reads on every auth call), but route **all** mutations through one service function — `app/services/points.py: apply_transaction(db, user, amount, type, ...)` — that inserts the ledger row and updates the balance in the same DB transaction. Migrate each of the 12 call sites to it mechanically. Rewrite `GET /users/me/points-history` to read the ledger instead of `CommunityFeedEvent`. Alembic migration `004`; no backfill needed (history before the migration stays best-effort from feed events).

### B2. `get_points_tier()` duplication — the `points_engine.py` copy is nearly dead

Confirmed: `crud/user.py:107` is the **real** implementation (imported by `api/auth.py`, `api/users.py`, `crud/community.py`); `points_engine.py`'s copy has **zero non-test importers** — only its decay constants are imported (`scheduler.py:13`). **Fix:** fold the constants and the single `get_points_tier` into the new `app/services/points.py`, delete `points_engine.py` (18 lines, self-labeled "Legacy"), update the two importers + integration test. Hardcoded earn amounts (+10 check-in in `crud/community.py`, +50 booking in `crud/booking.py:70`) move to named constants in the same module — a config table is **not** needed yet (no admin-tunable-rates requirement has materialized; a constants module unblocks Part D equally well at zero migration cost).

### B3. `price_etb` naming collision (points vs. real ETB)

`Product.price_etb` is a **points cost**; `ProviderEvent.price_etb` is **real ETB** charged via Telebirr/M-Pesa. Anyone touching pricing will eventually confuse them. **Fix:** Alembic migration renaming `products.price_etb → points_cost`; update `schemas/product.py` to expose `points_cost` while temporarily also accepting/emitting `price_etb` (deprecated alias) so the frontend and `docs/API_CONTRACT.md` migrate in the same release without a breaking deploy-order dependency across the three services. Remove the alias one release later.

### B4. Frontend polling that bypasses `usePolling` (CLAUDE.md rule violation)

- `Header.jsx:32` — **persistent 30s `setInterval`** that keeps waking cold serverless functions while the tab is hidden; highest-value fix, mechanical swap to `usePolling`.
- `BookingFlow.jsx:96`, `ProviderOnboard.jsx:82`, `ProviderDashboard.jsx:361` — raw payment-status polls. Short-lived so lower priority, but they don't stop on unmount-race/hidden-tab; converting them standardizes cleanup.

### B5. Not problems (checked, leaving alone)

The `check_*.py` / `fix_*.py` / `patch_*.py` scripts at backend root are documented one-off operational scripts (CLAUDE.md), not dead app code. The dual Alembic + ad-hoc-psycopg2 migration mechanisms are messy but consolidating them is high-risk/low-payoff right now — new migrations should just standardize on Alembic going forward.

---

## Part C — Competitive research → prioritized feature shortlist

### What comparable apps do

- **ClassPass** (credit-based class marketplace): credits are priced dynamically per class from studio rates + demand + time-of-day, with a guaranteed per-booking rate floor for partners ([ClassPass credits](https://classpass.com/blog/how-classpass-credits-work/), [payouts & pricing](https://classpass.com/partners/blog/classpass-payouts-pricing-policies-rates)). Key transferable ideas: **credit costs anchored to real service prices** (feeds Part D1) and **partners always knowing their floor** — provider trust comes from payout predictability, not from marketing.
- **Duolingo** (social habit engine): streaks drive 2.4x retention for 7+-day-streak users; leagues/leaderboards + friend quests stack social pressure on intrinsic progress; streak freezes reduce loss-aversion anxiety ([Lenny's Newsletter — How Duolingo reignited growth](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth), [Trophy case study](https://trophy.so/blog/duolingo-gamification-case-study)). Well Circle already has the raw ingredients (daily check-in ≈ streak, `Circle.weekly_points` ≈ league) but surfaces none of the psychology.
- **Loyalty-program design norms**: first reward should be reachable within 2–3 interactions or users disengage; state conversion plainly ("N points = X off") ([LoyaltyLion](https://loyaltylion.com/blog/calculating-loyalty-point-value), [Yotpo](https://www.yotpo.com/blog/how-are-loyalty-points-calculated/)). Points issued are a real liability for providers — caps matter (Part D3).

### Shortlist (impact ÷ cost, all free-tier compatible unless flagged)

| # | Feature | Gap it closes | Cost | Free tier? |
|---|---|---|---|---|
| C1 | **Provider customer list (mini-CRM)** — distinct users with a successful booking or check-in at that provider, with last-visit date and lifetime points redeemed | No CRM view exists; prerequisite UI for D3's award button | Low: one query endpoint + one dashboard tab | Yes |
| C2 | **Streak counter + streak freeze** on the existing daily check-in — show current streak in header; 1 freeze earned per 7-day streak | Check-in exists but has zero habit psychology attached; decay already punishes lapses, a freeze softens it (Duolingo's exact loss-aversion pairing) | Low: `current_streak`, `freeze_count` on User (or derive from ledger), surface in `Header.jsx` | Yes |
| C3 | **Weekly circle digest via bot** — the Railway bot already messages users; send each circle a Sunday summary ("Sara topped your circle with 120 pts") | `weekly_points` leaderboard exists but nobody sees it unless they open the app | Low: one bot job + one backend query endpoint | Yes |
| C4 | **"First reward" onboarding goal** — new users see one concrete near-term redemption target ("check in 5 more times → free steam session at X") | Points feel abstract; loyalty best practice says first reward within 2–3 interactions | Medium: pick cheapest in-category product, render progress bar on home | Yes |
| C5 | **Provider payout-predictability card** — analytics tab shows "points redeemed at your business this month = N customer visits" trend | Provider trust/retention; ClassPass's lesson is partners stay when value is legible | Low: aggregate ledger by provider_id (needs B1) | Yes |
| C6 | Dynamic/demand-based point pricing (ClassPass SmartRate style) | — | High; needs volume data that doesn't exist yet | Deferred — revisit post-beta |

C1 and C5 serve provider earnings/retention; C2–C4 serve user engagement. All are sequenced after B1 (ledger) because C4/C5 read from it.

---

## Part D — Point valuation & new earning mechanisms

### The valuation anchor (needed before all three mechanisms)

Nothing in the codebase ties points to ETB, but the earn side already implies a rate: a paid booking (typically a few hundred ETB) mints +50 points; a daily check-in mints +10 (~300/month ceiling from check-ins alone). Working anchor: **10 points ≈ 1 ETB of redemption value** — i.e., a complimentary service worth ~500 ETB (one gym day-pass ≈ 950–1,250 ETB, a basic spa add-on less) should cost ~3,000–5,000 points… which is unreachable. That mismatch is the real finding: **either earn rates rise ~10x or recommended point costs must value points generously (≈1 point ≈ 1 ETB)**. Recommendation: adopt **1 point ≈ 1 ETB** as the soft internal anchor (never shown to users as a guarantee, used only for recommendations), so a 500 ETB-value freebie costs ~400–600 points ≈ 6–10 weeks of engaged use plus a booking or two. This is a business decision — flagged in open questions with the alternative.

### D1. Recommended point costs for free/complimentary services

- **"Comparable" definition:** same wellness category (via the provider's `Community` category linkage — Part A confirmed categories map to real service structures), citywide (Addis is effectively one market at current scale; no geo-proximity machinery needed yet).
- **Computation:** median and P25–P75 range of `points_cost` across active in-category products, computed **on-demand** in a new endpoint — `GET /providers/me/products/price-suggestion?category=…` — with a plain SQL percentile query. No precomputation/cron needed at current data volume; falls back to the ETB anchor heuristic (service's real-world value × anchor rate) when fewer than 3 comparable products exist, which will be the common case early on.
- **Frontend:** in `ProviderDashboard.jsx`'s product-creation form, when the cost field focuses, show "Similar {category} providers charge 300–500 pts (median 400)" as a hint chip that fills the field on tap. Advisory only — providers keep full control (trust principle from ClassPass research: guide, don't override).

### D2. Evidence-based event participation points

- **Who is "responsible personnel":** recommend **provider-designated, per-event** — a `staff_user_id` (UUID FK users, nullable) on `ProviderEvent`, set by the provider when creating/editing the event. Justification against the existing role model: `User` has only an `is_provider` boolean plus env-var super-admins — there is **no role system to extend**, so a fixed community role would mean building role infrastructure for one feature. A per-event designation is one nullable column, matches how pop-up events actually staff (Part A), and the provider vouching for their own staff member fits the trust model.
- **New table `evidence_submissions`:** `id`, `event_id` FK, `submitter_user_id` FK, `telegram_file_id` (photo stays on Telegram's servers — free, no Supabase storage cost), `status` (`pending`/`approved`/`rejected`), `reviewed_by` (nullable FK), `reviewed_at`, `points_per_participant` (set at review), `created_at`. Deliberately **not** reusing `CommunityFeedEvent`.
- **Bot flow (`telegram-bot/bot/handlers/`):** new `/evidence` conversation handler — bot calls `GET /api/bot/staff-events?telegram_id=…` (X-Bot-API-Key) to list events where this user is the designated staff and the event has ended; user picks one, sends photo(s); bot POSTs `POST /api/bot/evidence` with the `telegram_file_id`. Replaces the ad-hoc "DM @anteneh_yimmam" idea with a structured queue, per the agreed bot-assisted-queue decision.
- **Admin review:** new admin dashboard page (route under the existing `AdminGuard`) listing pending submissions — photo rendered via a small backend proxy endpoint that exchanges `telegram_file_id` for a file URL using the bot token (`GET /admin/evidence/{id}/photo`). `POST /admin/evidence/{id}/review` with `approve|reject` + `points_per_participant`. **On approval, points are minted through `apply_transaction(type="event_participation", reference_id=submission.id)`** for every user with a successful `Booking` on that event — never a bare balance increment. Bot notifies awarded users.

### D3. Provider-initiated point awards to customers

- **Verified-interaction gate:** allow awarding to users with **either** a successful `Booking` with the provider **or** a check-in in that provider's `Community`. Booking-only would exclude the many providers whose customers engage via community check-ins rather than paid events; check-ins are backend-recorded (not user-claimable retroactively), so they're an honest interaction signal. This keeps friction low per the agreed direction — the gate is the guardrail, the action stays one-tap.
- **Endpoint:** `POST /providers/me/customers/{user_id}/award` `{points, note?}` — verifies the interaction gate, checks caps, then `apply_transaction(type="provider_award", provider_id=…)`. Customer list comes from C1's endpoint (`GET /providers/me/customers`), making C1 the natural UI host.
- **Caps (application-level checks against the ledger — a DB constraint can't express "sum over trailing window," and the ledger query is cheap on the `(provider_id, created_at)` index):**
  - Per customer: max **1 award/day** and **50 points/award** (≈ one week of check-ins — meaningful, not mintable-at-scale).
  - Per provider: max **300 points/day** total (≈ 6 full awards; enough for a busy day, cheap to raise later — start tight, loosen with data).
  - Every award is a ledger row, so admin audit/reversal (set `reversed_by`) comes free from B1.
- **Frontend:** "Customers" tab in `ProviderDashboard.jsx` (C1) — each row gets a one-tap "Give points" button with a small amount picker; show remaining daily allowance so the cap never surprises mid-flow.

### Decay composition (applies to all three)

`last_checkin_at`-driven decay is **wrong once earning diversifies**: a user who attends events and receives provider awards but skips community check-ins would bleed 5 pts/day despite being active. **Change decay eligibility to "days since last positive-amount ledger transaction"** — one query against `point_transactions (user_id, created_at)`, replacing the `last_checkin_at` check in `decay_points_job()`. Decay itself also becomes a ledger row (`type="decay"`), making it visible in points history for the first time. Keep `last_checkin_at` for streaks (C2).

---

## Part E — Social growth loops (priority order by impact ÷ effort)

Platform reality check first: **Telegram Mini Apps cannot read the phone's address book.** `requestContact` only asks the user to share *their own* phone number with the bot — not their contacts ([Telegram Mini Apps docs](https://core.telegram.org/bots/webapps)). What the platform *does* give us: `startapp` deep-link parameters delivered into the Mini App, `switchInlineQuery` (jump into a chat with a pre-filled inline query), and `shareMessage`/`savePreparedInlineMessage` (share a bot-prepared rich message into any chat) ([Bot API changelog](https://core.telegram.org/bots/api-changelog), [deep links](https://core.telegram.org/api/links)). Designs below use only these.

### E1. Circle invite links + referral credit (highest priority — completes the core loop)

- Deep link `https://t.me/{bot}?startapp=circle_{join_code}` — `Circle.join_code` already exists. `AuthContext` already runs on every entry route; add `start_param` parsing so a new user who opens the link lands in the circle-join flow immediately after auth.
- "Invite friends" button in the circle screen using `shareMessage` with a bot-prepared card (falls back to `switchInlineQuery`, then to copy-link, by client version).
- **Referral attribution:** new columns `User.referred_by` (UUID FK, nullable) + `Circle` join source; when the invitee completes their **first check-in** (not mere signup — resists farming), both sides get points via `apply_transaction(type="referral")` (suggest +30 each; capped at 10 credited referrals/user/month). Data-model addition beyond this: none — Telegram identity makes signup attribution free.

### E2. Social proof surfaces (uses existing `Circle.weekly_points` — no new leaderboard system)

- Home screen: "🔥 3 circle-mates checked in today" (one query over `CircleMember` ∩ today's check-in ledger rows).
- Post-check-in moment: show your rank movement in the circle's weekly leaderboard ("You passed Dawit — #2 this week").
- C3's weekly bot digest is the push-channel twin of this surface.
- New data needed: none — all derivable from `CircleMember.weekly_points` + ledger.

### E3. Friend recommendation nudges

- "People in your circles are also in {Community X}" — membership-overlap query across `CircleMember`/`CommunityMember`, surfaced as a card on community browse. No new data collected.
- Nudge circle owners with 1-member circles ("Circles with 3+ friends check in 2x more — invite someone") via the bot's existing re-engagement path (`GET /api/bot/inactive-users` pattern).

**Explicitly flagged as requiring data we don't collect (and recommend *not* collecting now):** any true contact-matching ("which of my phone contacts use Well Circle") would require harvesting users' own numbers via `requestContact` and matching inbound contacts — privacy-heavy, low incremental value over Telegram-native sharing, skip it.

---

## Sequencing & dependencies

1. **B1 ledger + B2 engine consolidation** — prerequisite for D (all minting), C4/C5, E1 (referral credit), and the decay change. Do first.
2. **B3 rename + B4 polling fixes** — independent, mechanical; slot alongside step 1.
3. **D3 provider awards + C1 customer list** (one feature in practice) and **decay-eligibility change** — first visible payoff of the ledger.
4. **D2 evidence flow** (bot handler + admin queue + `ProviderEvent.staff_user_id`) and **D1 price suggestions**.
5. **E1 invite deep links + referral credit**, then **E2/C2/C3 social-proof & streak surfaces**, then **C4/C5, E3**.
6. **Part A event-model change** (allow multiple concurrent events per provider) can ride with step 4; full recurrence rules deferred until providers ask.

Cross-service contract note: every new `/api/bot/*` endpoint and the renamed `points_cost` field must be reflected in `docs/API_CONTRACT.md` in the same PR.

## Open questions for the requester

1. **The valuation anchor is a business call:** adopt 1 point ≈ 1 ETB (freebies feel reachable; current earn rates stay) vs. 10 points ≈ 1 ETB (requires ~10x earn-rate inflation across check-ins/bookings to keep rewards reachable). Part D assumes 1:1 — confirm or redirect.
2. **D2 — who receives event-participation points:** this plan assumes the designated staff's approved evidence mints points for **all booked attendees**. If instead the *submitter alone* earns points (reading the original request literally), the queue design is unchanged but the minting fan-out is — which is intended?
3. **D2 participant source for free events:** attendance is currently inferred from *paid* bookings only. If free events (no booking) should also award participation points, we need a lightweight RSVP row — worth adding, or are points-bearing events always booked/paid for now?
4. **Referral reward size and the D3 cap values** (50/award, 300/provider/day, 10 referrals/month) are deliberately conservative starting numbers — fine to tune post-launch, but flag now if any feel wrong for the market.
5. **Legal/regulatory posture on loyalty points in Ethiopia** (whether points constitute stored value under NBE payment rules) — outside what code research can answer; worth a local check before points scale.
