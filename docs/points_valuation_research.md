# WellCircle Legacy Points — ETB Valuation Research Report

**Date:** August 4, 2026  
**Objective:** Establish a data-driven ETB valuation for WellCircle's Legacy Points system

---

## 1. Ethiopian Wellness Market Pricing (Addis Ababa)

### 1.1 Named Competitors

| Provider | Category | Price Range (ETB) | Source |
|---|---|---|---|
| **Khul Wholeness Center** | Yoga, meditation, holistic workshops | 200–500 per session | TripTap [^1], Hotspot.et [^2] |
| **Tilla Spa & Fitness** | Gym + spa | ~6,666/mo (19,999/3mo package reported) | Tilla.com [^3], Welcome2Addis [^4] |
| **Practical Wellness** (generic category) | Counseling, corporate wellness | Custom-priced; individual sessions 600–1,000 ETB | Addis Fortune [^5], FitretCounseling [^6] |

### 1.2 Broader Addis Ababa Wellness Market

| Service Type | Price Range (ETB) | Source |
|---|---|---|
| Gym monthly membership (mid-range) | 2,700–4,500 | Welcome2Addis [^4] |
| Gym monthly membership (premium: Altius, SweatBox) | 6,950–7,000 | Market research [^7] |
| Day pass (pool/gym/sauna) | 950–1,400 | Expatistan [^8], Hotel listings [^9] |
| Yoga/fitness class (single session) | 200–1,000 | Khul [^1], Addis Fortune [^5] |
| Massage (60 min, mid-range spa) | 600–1,500 | Signature Spa [^10], Market data [^9] |
| Massage (luxury hotel) | 2,000–4,000 | Hotel spa listings [^9] |
| Moroccan bath / facial | 1,600–4,500 | Welcome2Addis [^4], Avocado Luxury Spa [^11] |
| Couple spa package | 3,800–12,000 | Avocado Luxury Spa [^11] |

### 1.3 Key Findings
- **Most services sit at 500–2,000 ETB** — aligns perfectly with your stated average of ~2,000 ETB
- The **"complimentary service"** a provider would agree to give away likely sits at the **low end**: a basic yoga class (~300–500 ETB), a steam/sauna session (~500–800 ETB), or a basic massage add-on (~600–1,000 ETB)
- Your target user (>35,000 ETB income) can comfortably afford 2,000 ETB services — the points system is a **perk**, not a lifeline

---

## 2. Comparable Loyalty Program Analysis

### 2.1 ClassPass (Credit-based fitness marketplace)

| Metric | Value | Source |
|---|---|---|
| Credit value | ~$1.60–$2.75 USD per credit | LowerMySubs [^12], ClassPass blog [^13] |
| Starter plan | ~8 credits for $19–22/mo | ClassPass [^13] |
| Credits per class | Dynamic (3–15+), varies by demand/time | ClassPass [^14] |
| Key design principle | Credits anchored to real service prices; providers always know their floor payout | ClassPass Partners Blog [^15] |

**Takeaway:** ClassPass ties credit costs to real service value. A $25 class costs ~10–12 credits. The ratio is roughly **1 credit = 5–15% of a class value**.

### 2.2 Starbucks Rewards

| Metric | Value | Source |
|---|---|---|
| Earn rate | 1 Star per $1 spent | Starbucks.com [^16] |
| Redemption: 100 Stars | Up to $6 value (brewed coffee) | Starbucks.com [^16] |
| Redemption: 200 Stars | Up to $10 value (handcrafted drink) | Starbucks.com [^16] |
| Effective reward rate | ~5% ($1 earned per $20 spent) | The Points Guy [^17] |

**Takeaway:** Starbucks targets a **~5% effective reward rate**. Spend $100, get ~$5 back. With WellCircle, engagement (not spend) is the primary earn mechanism, but the **redemption value ratio** is instructive.

### 2.3 Safaricom Bonga Points (Kenya — closest African parallel)

| Metric | Value | Source |
|---|---|---|
| Earn rate | 1 point per KES 10 spent (~$0.08) | Safaricom [^18] |
| Redemption value | 1 point = KES 0.20 (5 points = KES 1) | Calculator.co.ke [^19], Safaricom [^18] |
| Effective reward rate | ~2% (spend 10, earn 0.20 back) | Derived |

**Takeaway:** Bonga uses a **high-volume, low-value** approach (many points earned, each worth little). This works for telecom with daily micro-transactions. WellCircle's engagement model (daily check-ins, not daily spending) means you earn fewer points — so each point must be worth **more** to feel meaningful.

### 2.4 Duolingo (Engagement-driven gamification)

| Mechanic | Design | Source |
|---|---|---|
| XP (experience points) | Pure progression metric — no monetary value | Trophy.so [^20], Orizon.co [^21] |
| Gems (virtual currency) | Earned through daily activity; spent on streak freezes, power-ups | Duolingo wiki [^22] |
| Streak psychology | 2.4x retention for 7+ day streaks | Lenny's Newsletter [^23] |

**Takeaway:** Duolingo proves that points *don't need* high monetary value to drive engagement — what matters is that the **first reward is reachable** and the **progress feels tangible**. WellCircle's tiers already use this, but the redemption layer adds a monetary dimension that Duolingo avoids.

### 2.5 Fitness Industry Punch-Card Models

| Model | Structure | Source |
|---|---|---|
| Standard gym loyalty | 10 sessions → 1 free class (10% reward rate) | StampMe [^24], EarnRedeemCheer [^25] |
| Points-based studio | 100 pts/class, 1000 pts → free class | ClubPilates [^26], ClassPoints [^27] |
| Tiered gym loyalty | Bronze/Silver/Gold based on visit frequency | VantageFit [^28], TrueLoyal [^29] |

**Takeaway:** The **"10 visits = 1 free"** model (10% reward rate) is the industry standard. This is directly applicable to WellCircle's check-in model.

---

## 3. Mathematical Modeling

### 3.1 Current Earn Rates (from codebase)

| Action | Points | Frequency | Monthly Ceiling |
|---|---|---|---|
| Daily check-in | +10 | 1/day | 300/mo |
| Booking bonus | +50 | Per paid booking | ~50–100/mo (1–2 bookings) |
| Referral (both sides) | +30 | Per referral | 300/mo (capped at 10) |
| Challenge completion | Variable | Per challenge | ~50–100/mo |
| Provider award | Up to +50 | 1/customer/day | ~50–150/mo |
| Welcome bonus | +20 | Once | 20 (one-time) |
| **Decay** | **-5/day** | After 3 days inactive | **-150/mo worst case** |

### 3.2 Realistic User Earning Profiles

| User Type | Monthly Earn | Description |
|---|---|---|
| **Casual** (checks in 3x/week) | ~130 pts/mo | 12 check-ins (120) + minor activity |
| **Engaged** (daily + 1 booking) | ~380 pts/mo | 30 check-ins (300) + booking (50) + challenge (30) |
| **Power user** (daily + bookings + referrals) | ~550 pts/mo | 300 + 100 + 90 + 60 |

### 3.3 The Critical Question: Time-to-First-Reward

Loyalty best practice says the **first reward must be reachable within 2–3 weeks** of normal engagement [[LoyaltyLion](https://loyaltylion.com/blog/calculating-loyalty-point-value) [^30], [Yotpo](https://www.yotpo.com/blog/how-are-loyalty-points-calculated/) [^31]].

For an **engaged user** (380 pts/mo):
- 2 weeks of engagement ≈ **190 points**
- 3 weeks ≈ **285 points**
- 1 month ≈ **380 points**

For a **casual user** (130 pts/mo):
- 1 month ≈ **130 points**
- 2 months ≈ **260 points**

---

## 4. The Valuation Decision

### 4.1 Option A: 1 Point = 1 ETB

| Metric | Result |
|---|---|
| Cheapest redeemable service (yoga class, ~300 ETB) | 300 points → ~3 weeks for engaged user |
| Median service (steam session, ~700 ETB) | 700 points → ~2 months for engaged user |
| Average service (massage, ~1,500 ETB) | 1,500 points → ~4 months for engaged user |
| Provider liability per freebie | Provider gives away a 300 ETB service; 300 points were minted through ~30 check-ins (1 month of daily use) |

### 4.2 Option B: 10 Points = 1 ETB

| Metric | Result |
|---|---|
| Cheapest redeemable service | 3,000 points → ~8 months for engaged user |
| Median service | 7,000 points → ~18 months |
| Average service | 15,000 points → ~3+ years |

### 4.3 Option C (Hybrid): 5 Points = 1 ETB *(new option)*

| Metric | Result |
|---|---|
| Cheapest redeemable service (300 ETB → 1,500 pts) | 1,500 points → ~4 months for engaged user |
| Median service (700 ETB → 3,500 pts) | 3,500 points → ~9 months |
| Average service (1,500 ETB → 7,500 pts) | Unreachable for most users |

---

## 5. Recommendation: **1 Point ≈ 1 ETB**

> [!IMPORTANT]
> **Adopt 1 Legacy Point = 1 ETB of redemption value** as the internal anchor.

### 5.1 Why 1:1

| Criteria | 1:1 | 10:1 | 5:1 |
|---|---|---|---|
| First reward reachable in 2–3 weeks? | ✅ Yes (engaged user reaches ~190 pts) | ❌ No (would need 19 ETB worth = trivial) | ⚠️ Borderline (38 ETB worth) |
| Matches "10 visits = 1 free" industry norm? | ✅ 30 check-ins ≈ 300 pts ≈ 1 yoga class | ❌ 30 check-ins ≈ 30 ETB = nothing | ⚠️ 30 check-ins ≈ 60 ETB = weak |
| Provider liability manageable? | ✅ Provider gives 1–2 low-end freebies/mo | ✅ Barely anyone redeems | ⚠️ Low redemption |
| Drives engagement & retention? | ✅ Feels achievable and rewarding | ❌ Feels impossible → disengagement | ⚠️ Sluggish |
| Your target (10 users redeem by month 2)? | ✅ Engaged users reach 300+ pts | ❌ Nobody reaches 3,000 in 2 months | ❌ Nobody reaches 1,500 in 2 months |

### 5.2 The Decisive Factor: Your Month-2 Target

You want **10 users to reach redemption level by month 2**. Let's work backwards:

- An engaged user earns ~380 pts/month → **760 pts by month 2**
- A casual user earns ~130 pts/month → **260 pts by month 2**
- With the welcome bonus (+20), a mix of users will cluster between **280–780 points** by month 2

**At 1:1**, the cheapest redeemable product should cost **200–300 points** → ✅ easily reachable by engaged users, borderline for casual users (drives them to engage more).

**At 10:1**, you'd need products at 2,000–3,000 points → ❌ nobody gets there in 2 months.

**At 5:1**, you'd need products at 1,000–1,500 points → ❌ only power users barely get there.

**The 1:1 ratio is the only option that hits your month-2 target.**

---

## 6. Recommended Product Pricing Tiers

Based on the 1:1 anchor and the Addis Ababa market data:

### 6.1 Tier Structure

| Tier | Points Cost | ETB Equivalent | Example Products | Who Reaches It |
|---|---|---|---|---|
| 🌱 **Starter** | 200–350 pts | ~200–350 ETB | Steam/sauna session, yoga class add-on, smoothie voucher, 15-min chair massage | Engaged user in ~2–3 weeks |
| 🌿 **Mid** | 400–700 pts | ~400–700 ETB | Full yoga class, gym day pass, 30-min massage, spa treatment add-on | Engaged user in ~4–6 weeks |
| 🌳 **Premium** | 800–1,500 pts | ~800–1,500 ETB | Full 60-min massage, spa half-day package, couple yoga session, nutrition consult | Power user in ~2–3 months |
| 🌲 **Elite** | 1,500–3,000 pts | ~1,500–3,000 ETB | Full spa day, Moroccan bath + massage combo, monthly gym pass discount, retreat voucher | Power user in ~4–6 months |

### 6.2 Specific Product Suggestions (per competitor research)

| Product | Points Cost | Real-World Value | Provider Type |
|---|---|---|---|
| Sauna/steam single session | 250 pts | ~250–400 ETB | Gym/Spa |
| Single yoga/meditation class | 300 pts | ~300–500 ETB (Khul-tier) | Yoga studio |
| Basic smoothie/juice voucher | 200 pts | ~200–300 ETB | Wellness café |
| Gym day pass | 500 pts | ~500–800 ETB | Gym |
| 30-minute Swedish massage | 500 pts | ~600–800 ETB | Spa |
| Full yoga workshop | 700 pts | ~700–1,000 ETB | Yoga studio |
| 60-minute deep tissue massage | 1,000 pts | ~1,000–1,500 ETB | Spa |
| Moroccan bath experience | 1,200 pts | ~1,200–1,600 ETB | Spa |
| Gym monthly pass (basic) | 2,000 pts | ~2,700–4,500 ETB | Gym |

### 6.3 Provider Economics Validation

With 4 providers and ~200 monthly users:
- If each provider agrees to give **2–3 low-end freebies/month** (steam sessions, yoga classes)
- Each freebie costs the provider ~300–500 ETB of marginal service cost
- Total monthly provider liability: **600–1,500 ETB per provider** (tiny vs. their membership revenue)
- In return, WellCircle is **funneling leads** worth far more than a single gym ad campaign
- This makes the 1:1 ratio **sustainable for providers** — they're giving away low-marginal-cost services in exchange for verified, engaged customers

---

## 7. Implementation Constants

Based on this research, here are the recommended constants for your codebase:

```python
# ── Point Valuation Anchor ──────────────────────────────────────
# 1 Legacy Point ≈ 1 ETB of redemption value
# This is an INTERNAL anchor used for price-suggestion engine (D1)
# and product pricing guidance. Never exposed to users as a guarantee.
POINT_ETB_ANCHOR = 1.0  # 1 point = 1 ETB

# ── Recommended Product Pricing Bands ───────────────────────────
PRODUCT_TIER_STARTER = (200, 350)    # ~2-3 weeks engagement
PRODUCT_TIER_MID = (400, 700)        # ~4-6 weeks engagement  
PRODUCT_TIER_PREMIUM = (800, 1500)   # ~2-3 months engagement
PRODUCT_TIER_ELITE = (1500, 3000)    # ~4-6 months engagement

# ── First-Reward Target ────────────────────────────────────────
# Cheapest product should be reachable in ~2 weeks of engaged use
# 14 days × 10 pts/day = 140 pts + welcome (20) = 160 pts minimum
# Set floor at 200 to require slightly more than minimum effort
MIN_PRODUCT_POINTS_COST = 200
```

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Point inflation** if earn rates increase later | The anchor is internal; product prices can be adjusted independently. Keep earn rates conservative (current values are good). |
| **Provider pushback** on giving away services | Frame as CAC (customer acquisition cost): a 300 ETB steam session freebie is cheaper than any Telegram ad. Provider agrees on monthly freebie quota upfront. |
| **NBE regulatory risk** (points as stored value) | Points are strictly non-cashable, non-purchasable, and expire via decay. This keeps them firmly in "loyalty reward" territory, not "e-money." [^32] |
| **Users gaming the system** (farming check-ins) | D3 caps (50 pts/award, 300/provider/day) and the decay mechanic already handle this. Referral cap of 10/month also limits farming. |
| **Inflation of ETB** eroding point value | Since points are earned via engagement (not purchased with ETB), and redeemed for services (not cash), ETB inflation affects provider service prices, not point value. Re-anchor annually if needed. |

---

## 9. Summary Decision

> **1 Legacy Point = 1 ETB of redemption value.**
>
> - Cheapest product: **200 points** (reachable in ~2 weeks of engaged use)
> - Target "first free" product: **300 points** (a yoga class or steam session)
> - Your month-2 target of 10 redeemers: ✅ achievable (engaged users will have 380–760 pts)
> - Provider liability: minimal (2–3 low-end freebies/month ≈ 600–1,500 ETB)
> - No earn-rate changes needed — current constants (10 pts/check-in, 50 pts/booking, etc.) are perfectly calibrated for this ratio

---

## Sources

[^1]: TripTap — Khul Wholeness Center listing. [triptap.com](https://triptap.com)
[^2]: Hotspot.et — Khul Wholeness Center. [hotspot.et](https://hotspot.et)
[^3]: Tilla — Gym & Spa official site. [tilla.com](https://tilla.com)
[^4]: Welcome2Addis — Gym pricing and wellness in Addis Ababa. [welcome2addis.com](https://welcome2addis.com)
[^5]: Addis Fortune — Yoga/fitness class pricing in Addis Ababa. [addisfortune.news](https://addisfortune.news)
[^6]: Fitret Counseling — Corporate wellness pricing. [fitretcounseling.com](https://fitretcounseling.com)
[^7]: Market research — Altius, SweatBox gym membership rates via local listings and user reports.
[^8]: Expatistan — Cost of living, gym membership in Addis Ababa. [expatistan.com](https://expatistan.com/price/gym/addis-ababa)
[^9]: Hotel spa listings — Magnolia Hotel, Hilton Addis, Hyatt Regency day pass and spa pricing.
[^10]: Signature Salon and Spa — Addis Ababa spa pricing. [signaturespaaddis.com](https://signaturespaaddis.com)
[^11]: Avocado Luxury Spa — Couple and premium spa packages. [avocadoluxuryspa.com](https://avocadoluxuryspa.com)
[^12]: LowerMySubs — ClassPass credit value analysis. [lowermysubs.com](https://lowermysubs.com)
[^13]: ClassPass — How credits work. [classpass.com/blog/how-classpass-credits-work/](https://classpass.com/blog/how-classpass-credits-work/)
[^14]: ClassPass — Dynamic credit pricing. [classpass.com](https://classpass.com)
[^15]: ClassPass Partners Blog — Payouts and pricing policies. [classpass.com/partners/blog/classpass-payouts-pricing-policies-rates](https://classpass.com/partners/blog/classpass-payouts-pricing-policies-rates)
[^16]: Starbucks Rewards — Earning and redemption tiers (2026). [starbucks.com](https://starbucks.com)
[^17]: The Points Guy — Starbucks Star valuation. [thepointsguy.com](https://thepointsguy.com)
[^18]: Safaricom — Bonga Points program. [safaricom.co.ke](https://safaricom.co.ke)
[^19]: Calculator.co.ke — Bonga Points value converter. [calculator.co.ke](https://calculator.co.ke)
[^20]: Trophy.so — Duolingo gamification case study. [trophy.so/blog/duolingo-gamification-case-study](https://trophy.so/blog/duolingo-gamification-case-study)
[^21]: Orizon.co — Duolingo gamification psychology. [orizon.co](https://orizon.co)
[^22]: Duolingo Wiki (Fandom) — Gems earn/spend. [fandom.com](https://fandom.com)
[^23]: Lenny's Newsletter — How Duolingo reignited user growth. [lennysnewsletter.com](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
[^24]: StampMe — Gym loyalty punch card models. [stampme.com](https://stampme.com)
[^25]: EarnRedeemCheer — Fitness loyalty program design. [earnredeemcheer.com](https://earnredeemcheer.com)
[^26]: Club Pilates — Points-based studio loyalty. [clubpilates.com](https://clubpilates.com)
[^27]: ClassPoints — Studio point systems. [classpoints.com](https://classpoints.com)
[^28]: VantageFit — Tiered gym loyalty programs. [vantagefit.io](https://vantagefit.io)
[^29]: TrueLoyal — Fitness industry loyalty design. [trueloyal.com](https://trueloyal.com)
[^30]: LoyaltyLion — Calculating loyalty point value. [loyaltylion.com/blog/calculating-loyalty-point-value](https://loyaltylion.com/blog/calculating-loyalty-point-value)
[^31]: Yotpo — How are loyalty points calculated. [yotpo.com/blog/how-are-loyalty-points-calculated/](https://www.yotpo.com/blog/how-are-loyalty-points-calculated/)
[^32]: POINTS_ECONOMY_PLAN.md — Open question #5 re: NBE payment rules and loyalty points in Ethiopia.
[^33]: XE — USD/ETB exchange rate, August 2026 (~161.65 ETB). [xe.com](https://xe.com)
[^34]: Living Ethio — Top 5 Gyms in Addis Ababa for 2025. [livingethio.com](https://www.livingethio.com/site/blog/top-5-gyms-in-addis-ababa-for-2025-best-fitness-centers-in-ethiopia)
[^35]: TripAdvisor — Addis Ababa spa & wellness activities. [tripadvisor.com](https://www.tripadvisor.com/Attractions-g293791-Activities-c40-Addis_Ababa.html)
[^36]: Signature Wellness — New entrant wellness center (opened 2025). [signaturewellnesseth.com](https://signaturewellnesseth.com/)
