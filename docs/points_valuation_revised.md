# WellCircle Legacy Points — REVISED ETB Valuation
## (Check-in = streak only, no points)

**Date:** August 4, 2026  
**Revision reason:** Check-ins no longer earn points — they only maintain streaks/freezes and trigger challenge completions. This removes the single largest point source from the economy.

---

## 1. Revised Earn Rate Audit (from codebase)

### 1.1 Current Point Sources (verified against code)

| Source | Points | Frequency | Code Location | Status |
|---|---|---|---|---|
| ~~Daily check-in~~ | ~~+10~~ | ~~1/day~~ | `community.py:228` — `points_earned = 0` | ❌ **REMOVED** |
| Booking bonus | +50 | Per paid booking | `booking.py:88-92` | ✅ Active |
| Referral (both sides) | +30 | First check-in of invitee | `community.py:233-252` | ✅ Active (one-time) |
| Challenge completion | Variable (set by creator) | Per challenge | `community.py:313` | ✅ Active |
| Provider award | Up to +50 | 1/customer/day, max 300/provider/day | `provider.py:826` | ✅ Active |
| Event participation | Variable (set by admin) | Per approved event | `evidence.py:174` | ✅ Active |
| Welcome bonus | +20 | Once, at onboarding | `user.py:91` | ✅ Active |
| Admin adjust | Variable | Manual | `admin.py:157` | ✅ Active |
| Gift received | Variable | P2P transfer | `post.py:180` | ✅ Active (zero-sum) |
| **Decay** | **-5/day** | After 3 days of no positive txn | `scheduler.py:45` | ✅ Active |

### 1.2 What Changed

**Before (with check-in points):**
- Daily check-in was the **backbone** of earning — 300 pts/month for a daily user
- It was the most reliable, predictable, and frequent source
- All other sources were **supplementary**

**After (check-in = streak only):**
- The single largest, most frequent earn mechanism is gone
- Remaining sources are all **event-driven** (bookings, challenges, provider awards) — sporadic, not daily
- The only guaranteed points a user gets are the **welcome bonus (+20)**

---

## 2. Revised User Earning Profiles

### 2.1 Monthly Point Earning (realistic scenarios)

| User Type | Before (with check-in) | After (no check-in) | What Drives It |
|---|---|---|---|
| **Inactive** (onboarded, disengaged) | ~20 pts/mo | **20 pts total** (welcome, then 0) | Just welcome bonus |
| **Casual** (browses, 1 booking/mo) | ~180 pts/mo | **50 pts/mo** | 1 booking bonus |
| **Engaged** (2 bookings/mo, joins 1 challenge) | ~430 pts/mo | **130–180 pts/mo** | 2 bookings (100) + 1 challenge (~30-80) |
| **Power user** (2 bookings, challenges, referrals, provider awards) | ~600 pts/mo | **230–350 pts/mo** | 2 bookings (100) + challenge (50) + referrals (60) + provider award (50) + event participation (~30) |

### 2.2 Two-Month Accumulation (your month-2 redemption target)

| User Type | Month 1 | Month 2 Total | Notes |
|---|---|---|---|
| Casual | 70 (20 welcome + 50 booking) | **120** | Very slow |
| Engaged | 150–200 | **300–400** | Possible with consistent activity |
| Power user | 250–370 | **500–720** | Requires active participation across multiple sources |

> [!WARNING]
> **The casual user's earning is devastatingly slow.** Without check-in points, someone who books once a month accumulates only ~120 points in 2 months. That's a 60% drop from the previous model.

---

## 3. Impact on the 1:1 Anchor

### 3.1 The Problem

At **1 point = 1 ETB**:
- The cheapest redeemable product was set at 200–300 points
- Under the old model, an engaged user reached 300 pts in ~3 weeks ✅
- Under the new model, an engaged user reaches 300 pts in **~6–8 weeks** ⚠️
- A casual user reaches 300 pts in **~6 months** ❌

### 3.2 Your Month-2 Target Stress Test

You need **10 users reaching redemption level by month 2** out of **~200 monthly active users**.

At 1:1 with a 200-point minimum product:
- Power users (top ~5%, ~10 users): reach 500–720 pts by month 2 → ✅ comfortably
- Engaged users (top ~15%, ~30 users): reach 300–400 pts → ✅ reachable
- Casual users (majority, ~160 users): reach ~120 pts → ❌ won't make it

**Verdict: 10 users reaching 200+ points by month 2 is still achievable**, but barely — it now requires your most engaged segment rather than being easy for average users.

---

## 4. Revised Recommendation

### The Anchor Stays: **1 Point ≈ 1 ETB** — but with adjustments

The 1:1 ratio still works, but the **product pricing floor must drop** and you need a clear understanding that points are now a **premium reward for engaged behavior**, not a universal participation trophy.

> [!IMPORTANT]
> **Keep 1 point = 1 ETB.** But lower the cheapest redeemable product to **150 points** and introduce "micro-rewards" at 50–100 points.

### 4.1 Why Not Change the Anchor?

| If you change to... | Problem |
|---|---|
| **2 pts = 1 ETB** | A 300 ETB yoga class costs 600 pts → ~4+ months for engaged users → nobody redeems |
| **0.5 pts = 1 ETB** | A 300 ETB class costs 150 pts → great, but provider awards of 50 pts = 100 ETB which inflates provider liability |
| **Keep 1:1, adjust products** | ✅ No code changes to earn rates. Product pricing is already provider-configurable. Just set guidance lower. |

Changing the anchor creates cascading problems with provider award caps, decay rates, and welcome bonuses. It's much cleaner to **adjust the product side**.

### 4.2 Revised Product Pricing Tiers

| Tier | Points Cost | ETB Equivalent | Example Products | Who Reaches It (new model) |
|---|---|---|---|---|
| 🎁 **Micro** | 50–100 pts | ~50–100 ETB | Discount code (10–20% off next booking), free water/smoothie at partner, priority booking slot | Any user after 1 booking + welcome |
| 🌱 **Starter** | 150–250 pts | ~150–250 ETB | Sauna/steam add-on, yoga trial class, small wellness product sample | Engaged user in ~4–6 weeks |
| 🌿 **Mid** | 300–500 pts | ~300–500 ETB | Full yoga class, gym day pass, 30-min massage | Engaged user in ~2 months |
| 🌳 **Premium** | 600–1,000 pts | ~600–1,000 ETB | 60-min massage, spa package, nutrition consult | Power user in ~3–4 months |
| 🌲 **Elite** | 1,200–2,500 pts | ~1,200–2,500 ETB | Full spa day, couples session, monthly gym pass | Power user in ~6+ months |

### 4.3 The New "Micro-Reward" Tier Is Critical

Since check-ins no longer earn points, the **first reward must come from non-daily actions** that still happen early:

- **Welcome bonus (20 pts)** + **first booking (50 pts)** = **70 pts** after first week of engagement
- A micro-reward at **50–100 pts** (a discount code or small perk) gives the user their first "win" immediately after their first booking
- This replaces the psychological role that check-in points used to play

### 4.4 Provider Economics (still works)

The micro-rewards are essentially **discount codes** and **low-marginal-cost add-ons** — they cost providers almost nothing:
- A "10% off next booking" code at 50 pts → provider loses ~200 ETB of a 2,000 ETB booking = subsidized acquisition
- A free steam session add-on at 150 pts → provider's marginal cost is ~50–100 ETB (just utility costs)
- The more valuable freebies (full classes, massages) stay at 300–500+ pts, reachable only by genuinely engaged users

---

## 5. Month-2 Target Feasibility (10 redeemers)

### 5.1 With Micro-Rewards (50–100 pts)

| Segment | Est. Users (of 200) | Points by Month 2 | Can Redeem Micro? | Can Redeem Starter (150)? |
|---|---|---|---|---|
| Made 1+ booking | ~40–60 users | 70–120 pts | ✅ Yes (all) | ⚠️ Some |
| Made 2+ bookings | ~15–25 users | 120–220 pts | ✅ Yes | ✅ Yes |
| Engaged (bookings + challenges + referrals) | ~10–15 users | 300–700 pts | ✅ Yes | ✅ Yes |
| Power users | ~5–8 users | 500–720 pts | ✅ Yes | ✅ Yes |

**With micro-rewards at 50 pts, 40+ users could redeem by month 2.** Even with starter rewards at 150 pts, 15–25 users reach that. Your 10-user target is met comfortably.

### 5.2 Without Micro-Rewards (minimum 200 pts)

Only ~10–15 users (those with 2+ bookings AND at least one other earn event) reach 200+ by month 2. That's **right at the edge** of your target — risky.

> [!TIP]
> **The micro-reward tier is the difference between comfortably hitting and barely missing your month-2 target.** Strongly recommend adding it.

---

## 6. Updated Implementation Constants

```python
# ── Point Valuation Anchor ──────────────────────────────────────
# 1 Legacy Point ≈ 1 ETB of redemption value
# Internal anchor for price-suggestion engine and product pricing.
POINT_ETB_ANCHOR = 1.0  # 1 point = 1 ETB

# ── Recommended Product Pricing Bands (REVISED: no check-in earning) ──
PRODUCT_TIER_MICRO = (50, 100)       # After first booking (~1 week)
PRODUCT_TIER_STARTER = (150, 250)    # ~4-6 weeks engaged use
PRODUCT_TIER_MID = (300, 500)        # ~2 months engaged use
PRODUCT_TIER_PREMIUM = (600, 1000)   # ~3-4 months power use
PRODUCT_TIER_ELITE = (1200, 2500)    # ~6+ months power use

# ── First-Reward Target (REVISED) ──────────────────────────────
# Welcome (20) + first booking (50) = 70 pts minimum in first week
# Micro-rewards at 50 pts ensure first-booking users can redeem immediately
MIN_PRODUCT_POINTS_COST = 50
```

---

## 7. Specific Product Suggestions (Revised)

| Product | Points Cost | Real-World Value | Provider Cost | Tier |
|---|---|---|---|---|
| **10% off next booking** discount code | 50 pts | ~200 ETB off a 2,000 ETB service | ~200 ETB revenue forgo | 🎁 Micro |
| **Free water/juice** at partner café | 75 pts | ~75–100 ETB | ~30 ETB cost | 🎁 Micro |
| **Priority booking** for next event | 100 pts | Intangible — perception of VIP | ~0 ETB cost | 🎁 Micro |
| **Steam/sauna add-on** (single) | 150 pts | ~200–400 ETB | ~50–100 ETB marginal | 🌱 Starter |
| **Yoga trial class** | 200 pts | ~300–500 ETB (Khul-tier) | ~100 ETB marginal | 🌱 Starter |
| **Gym day pass** | 400 pts | ~500–800 ETB | ~200 ETB marginal | 🌿 Mid |
| **30-minute massage** | 400 pts | ~600–800 ETB | ~300 ETB marginal | 🌿 Mid |
| **Full yoga workshop** | 500 pts | ~700–1,000 ETB | ~300 ETB marginal | 🌿 Mid |
| **60-minute deep tissue massage** | 800 pts | ~1,000–1,500 ETB | ~500 ETB marginal | 🌳 Premium |
| **Moroccan bath experience** | 1,000 pts | ~1,200–1,600 ETB | ~600 ETB marginal | 🌳 Premium |
| **Full spa day** | 2,000 pts | ~2,500–4,000 ETB | ~1,200 ETB marginal | 🌲 Elite |

---

## 8. Summary of Changes from Original Report

| Aspect | Original (with check-in pts) | Revised (no check-in pts) |
|---|---|---|
| **ETB Anchor** | 1 point = 1 ETB | **Same: 1 point = 1 ETB** |
| **Cheapest product** | 200 points | **50 points** (micro-reward tier added) |
| **Starter tier floor** | 200 points | **150 points** |
| **Engaged user monthly earn** | ~380 pts | **~130–180 pts** |
| **Time to first redeem (engaged)** | ~2 weeks | **~1 week** (micro) / **~6 weeks** (starter) |
| **Month-2 redeemers** | 30+ users easily | **40+ with micro / 15–25 with starter** |
| **Key risk** | Inflation from easy earning | **Slow earning → disengagement** |
| **Mitigation** | Caps and decay | **Micro-rewards for early wins; decay less impactful since balances are lower** |

> [!IMPORTANT]
> ### Final Decision
> **1 point = 1 ETB**, with a new **micro-reward tier at 50–100 points** to compensate for the removal of check-in earning. The anchor doesn't change; the product floor does. No code changes needed to earn rates — only product pricing guidance for providers.

---

## Sources
All sources from the original report remain valid. Key sources driving the recalculation:
- Codebase: `backend/app/crud/community.py:228` — `points_earned = 0` (check-in earns no points)
- Codebase: `backend/app/services/points.py:23-26` — POINTS_CHECKIN retained for legacy, not used
- LoyaltyLion [loyaltylion.com] — first reward reachable in 2–3 interactions
- Yotpo [yotpo.com] — loyalty point calculation best practices
- StampMe [stampme.com] — "10 visits = 1 free" fitness industry norm
- Ethiopian market data — service pricing 200–2,000 ETB (see original report §1)
