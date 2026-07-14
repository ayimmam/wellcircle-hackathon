# Well Circle — UX Psychology Growth Loop (4-Stage Workflow)

Implements a sticky/high-converting user workflow from first download to
"premium" conversion, applying only the UX psychology principles that fit
this app's actual MVP rather than all six requested principles everywhere.
See `HANDOFF.md`'s **Phase 8** entry for the file-by-file change list and
verification results — this doc is the *why* and the principle-by-principle
map.

## The filled-in blanks

- **Target audience:** urban Ethiopian consumers (persona "Meron," 28, Addis
  Ababa HR manager) discovering verified wellness providers (yoga / gym /
  spa / nutrition / therapy / running) inside Telegram; the second side is
  the providers themselves.
- **Core value proposition:** "Your Telegram community becomes your gym
  buddy, accountability group, and wellness wallet — without leaving the
  app" — discovery + booking + accountability circles + gamified Legacy
  Points.
- **Monetization model:** no consumer premium tier exists. Revenue is the 2%
  platform fee on paid bookings, provider subscriptions (Starter 500 /
  Growth 1,500 / Pro 3,000 ETB/mo), and the presale-promo system (Phase 7).
  So Stage 4 "conversion" means **first paid booking** for consumers and
  **subscription upsell** for providers — there is no consumer paywall to
  anchor against.

## Principles applied — and why the others don't fit

Applied: Smart Defaults, Goal Gradient (as endowed progress), Reciprocity,
Loss Aversion (bounded — see guardrails below), Contrast/Anchoring.

**IKEA effect, adapted.** Telegram auth is automatic — there is no signup
wall to place labor *before*. So it maps instead to labor invested *during*
onboarding (choosing goal/interest/frequency/circles) being reflected back
at completion (`WelcomeBanner`), with optional data (neighbourhood, health
connect) asked only *after* that investment — progressive profiling, not a
gate.

Research grounding: simplified onboarding measurably lifts retention;
7-day streaks make users meaningfully more likely to return the next day;
endowed progress and honest-expiry urgency are standard, ethical growth
practice, not dark patterns. (UX Design Institute onboarding guide; Learning
Loop's goal-gradient writeup; Smashing Magazine's streak-design piece;
Scientific American on streak psychology; Monetag's Telegram Mini App
metrics/success-factor pieces.)

## Stage 1 — Onboarding (Smart Defaults · Goal Gradient · IKEA)

- **Smart default:** the frequency step arrives pre-selected (most-popular
  option, "Most popular" chip) so Next is never dead on that step. Interest
  is deliberately **not** defaulted — it drives circle suggestions in the
  next step, and a wrong default there poisons Stage 2.
- **Endowed progress:** the name step's progress dot renders as already
  done ("1 of 5 already done ✓") since Telegram supplied the name for free.
  Backend awards **+20 welcome points** on first onboarding (ledger-backed,
  idempotent), so the existing `FirstRewardCard` bar on Home starts
  part-filled instead of at zero — the classic "your car wash card already
  has two stamps" effect.

## Stage 2 — First value loop (Reciprocity) & peer connection

- **The gift, before any ask:** right after onboarding, Home shows a
  one-time `WelcomeBanner` that (a) reflects the plan the user just built
  back at them (IKEA) and (b) surfaces the first provider promo they're
  eligible for — reusing Phase 7's presale system end to end, so a
  first-time visitor sees a real, redeemable discount before being asked
  for anything else.
- **First habit nudge:** a check-in card appears on Home for anyone with
  joined circles, starting the habit loop immediately rather than requiring
  a detour into a community page.

## Stage 3 — Daily habit loop (Loss aversion, ethically bounded)

- Daily check-in now lives on Home (not just inside community detail),
  sharing one hook (`useCheckin`) so toasts/milestones/analytics behave
  identically everywhere.
- **Streak-at-risk nudges** (in-app amber dot + a daily bot DM) tell a user
  their live streak needs today's check-in. Guardrails, deliberately:
  always mention freezes when the user has any, cap at one nudge/day (the
  job only runs once daily), and keep "progress over perfection" copy —
  never shame-based. Points *decay* does **not** get its own alarm message;
  it stays folded into the existing weekly re-engagement DM.
- **Bug fixed in passing:** streak freezes were being earned but never
  actually consumed, so "miss a day without losing your streak" was false
  advertising. Fixed so a freeze now covers exactly one missed day.

## Stage 4 — Conversion (Loss aversion · Anchoring)

- **Consumers → first paid booking:** the original price is shown
  struck-through beside the promo-discounted total (anchoring), and promo
  expiries under 7 days read as an honest countdown ("⏳ Expires in 3
  days") — real dates only, no fabricated urgency timers.
- **Providers → subscription upsell:** plans are shown priciest-first so
  Pro (3,000 ETB) anchors the set and makes Growth (1,500 ETB) look like
  the reasonable middle choice; Growth is badged "⭐ Most popular"; and
  each plan adds a per-day reframing ("≈ 50 ETB/day") to shrink the
  perceived ask.

## What was deliberately left out (documented, not silently skipped)

- A faster "browsed but never booked" nudge (hours, not days) — the
  existing weekly/daily job cadences are reused rather than building a new
  trigger; worth a fast-follow if the pilot needs tighter timing.
- A first-post / "say hi" prompt in community detail — lower expected
  leverage than the Home check-in card and welcome gift, deferred.
- Provider-side subscription-expiry loss-aversion nudges — the provider
  count is small enough at hackathon scale that this isn't yet worth the
  bot-job overhead.

## Verification

See `HANDOFF.md` Phase 8 for the full test list. In short: backend
`test_engagement_loop.py` (new, 9/9) plus `test_integration.py` re-verified;
bot `test_nudges.py` extended for the streak nudge; frontend 74/74 Vitest
passing across 4 new test files and 2 extended ones; `npm run build` clean.
No live browser/screenshot pass was done in this sandbox — recommended
before shipping to real users.
