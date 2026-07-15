# Well Circle — MVP Walkthrough Video Script / Storyboard

**Purpose:** Pilot-readiness walkthrough for the Kuriftu African Village pilot and prospective wellness partners.
**Audience:** Wellness provider partners (Kuriftu decision-makers), potential investors, internal stakeholders.
**Runtime target:** ~5–6 minutes.
**Source of truth for what's actually built:** `docs/HANDOFF.md` (Phases 1–12) and `docs/API_CONTRACT.md`. This script supersedes the "Demo Script" in `docs/PRD.md` Section 10, which describes the original 1-day hackathon scope (points-display-only, no circles, no promos, no direct-contact booking) — a lot has shipped since.

**Story we're telling:** *Well Circle turns a Telegram-native wellness community into a measurable acquisition and retention channel for a real partner (Kuriftu) — with zero app download, real accountability loops, and a live dashboard the partner can point to as proof of ROI.*

**Recording notes:**
- Record on a real phone inside Telegram (WebView), not a browser tab — the "no download" beat only lands if it visibly opens inside Telegram chat.
- Use a seeded demo account with realistic history (existing points balance, streak, joined circle) for the "returning user" beats, and a fresh account for the onboarding beat — don't fake both from one account.
- Provider Dashboard should be screen-recorded on a laptop/tablet in parallel, ideally split-screen with the phone for Act 4.
- Where a feature is UI-mock-only (Health & Activity metrics) or demo-mode (Telebirr/M-Pesa auto-approve), say so briefly on screen — see `docs/HANDOFF.md` "Partially Implemented" table. Don't claim live payment rails that aren't live yet.

---

## Cold Open (0:00–0:15)

**Visual:** Split screen — left: a screenshot/recording of a chaotic Telegram DM/group thread (payment screenshots, "is this slot still open?", no confirmation). Right: black, waiting.

**VO:**
> "This is how most wellness businesses in Addis Ababa run today — bookings by DM, payments by screenshot, and zero way to know who's actually coming back."

**On-screen text:** *No CRM. No booking system. No data.*

**Cut:** Right side lights up with the Well Circle splash screen loading inside Telegram.

**VO:**
> "Well Circle fixes that — without asking anyone to leave the app they already live in."

---

## Act 1 — Getting In (0:15–0:45)

**Visual:** Real phone, real Telegram app. Tap a bot link (`@WellCircleBot` or pilot equivalent) → `/start` → "Open Well Circle" WebApp button → Mini App loads.

**Beats to show:**
1. Tap the bot link — no App Store, no install.
2. Splash screen → auto-auth (Telegram `initData` → JWT) happens silently, no login form.
3. Land on Home screen.

**VO:**
> "One tap from a Telegram chat. No download, no password — Well Circle authenticates instantly using the Telegram account the user is already signed into."

**On-screen text:** *Auto-auth via Telegram · Zero-friction entry*

---

## Act 2 — Onboarding: From Stranger to Member (0:45–1:45)

*Use the fresh demo account here.*

**Visual:** Walk the real `OnboardingFlow.jsx` steps in order:
1. Name step — pre-filled from Telegram, shown as "already done" (1 of 5 ✓).
2. **Multi-passion picker** — select 2–3 interests (e.g. Yoga + Spa) as a toggle grid, not a single radio.
3. Frequency step — arrives pre-selected on "Sometimes · Most popular" (smart default), still changeable.
4. Circles step — show the three sections in order:
   - Interest-matched **Community** suggestions (auto-join on submit)
   - **"Available Circles"** — join an existing real Circle with one tap
   - **"Or start your own"** — create a Circle live on camera
5. Submit → land on Home with the new `WelcomeBanner`.

**VO:**
> "Onboarding takes under a minute, and it does more than collect preferences — it gets the user into a real community immediately. They can pick more than one passion, join a circle other members already started, or create their own and invite friends — right here, before they've even seen the app's home screen."

**On-screen text:** *+20 welcome points · Endowed progress, not an empty account*

**Visual cutaway:** `WelcomeBanner.jsx` on Home — shows the plan just built (interests, frequency, circles joined, +20 pts) reflected back, plus a **welcome gift**: the user's first eligible Kuriftu promo.

**VO:**
> "And the app immediately gives something back — twenty welcome points, and a first-visit offer from our pilot partner, Kuriftu."

---

## Act 3 — Discovery & Booking: The Kuriftu Pilot (1:45–3:15)

*This is the commercial core of the video — spend the most time here.*

**Visual:**
1. Home screen — Kuriftu leads the featured carousel (pilot-partner-first ordering, not just highest-rated).
2. Tap into Kuriftu's provider page: photo gallery, real service list with confirmed ETB pricing, presale promo banner.
3. Show a service tagged **"Book directly"** — tap it.
4. **Direct-contact booking screen**: no fake time slots, no forced online payment — real `tel:`/`mailto:` links wired to Kuriftu's actual confirmed phone number and email, "no deposit, pay on-site after your visit" copy.
5. Cut to a second service that *is* online-bookable — show the date chips, now **multi-select** (book two or three consecutive days in one flow), the discount row noting "Applied to your first day only," and the combined total.
6. Confirm with Telebirr — note on screen: *demo/sandbox mode — auto-approves, live credentials pending.*
7. Confirmation screen — reference code, points earned.

**VO:**
> "Kuriftu doesn't run fixed time slots or online deposits for most of their wellness services — so instead of forcing a payment flow that doesn't match how they actually operate, Well Circle gives the guest a direct line: call or email, pay on-site, no fiction. For services that *are* bookable online, a guest can book several days in one flow with one combined payment. Either way, the booking — and the booking's contact details — land straight into Kuriftu's own booking sheet in the background, no manual re-entry."

**On-screen text:** *Built around how the partner actually operates — not the other way around.*

**Visual cutaway (2–3 seconds):** A Google Sheet row appearing live (or a mocked equivalent) — Name, Phone, Date & Time, Service Type, Service Name — right after the booking confirms.

**VO:**
> "Every Kuriftu booking exports automatically into their existing spreadsheet workflow — this pilot didn't ask them to change how they operate."

---

## Act 4 — The Accountability Loop (3:15–4:15)

*Use the seeded returning-user account here.*

**Visual:**
1. Home screen — `CheckinCard`: tap **Check In Today** → toast "+10 Legacy Points," streak badge increments.
2. `SocialProofBanner`: "🔥 4 circle-mates checked in today."
3. Navigate to a Circle detail screen → Chat / Leaderboard / Members tabs — show a couple of posts, a high-five reaction, the leaderboard.
4. Profile screen — points balance, tier badge (Seed → Sprout → Grove → Forest), streak-at-risk indicator if applicable.

**VO:**
> "This is the part a booking app alone can't do. Well Circle turns 'I should go to yoga' into a group habit — daily check-ins, streaks with a freeze so one missed day doesn't wreck your progress, and a circle that notices when you show up. Points aren't just cosmetic — they're redeemable against real partner products."

**On-screen text:** *Retention, not just a transaction.*

---

## Act 5 — Provider ROI: The Kuriftu Dashboard (4:15–5:15)

**Visual:** Switch to laptop/tablet — Provider Dashboard, logged in as Kuriftu.
1. KPI cards: total community members, new joins today, bookings this week, estimated revenue.
2. Live feed — the booking made in Act 3 appears in near-real time.
3. Customers tab (mini-CRM) — the demo user now appears with last-visit date; tap **"🎁 +25 pts"** to show provider-initiated rewards.
4. Promotions tab — the presale promo used in Act 3, with redemption count.
5. Analytics tab — 4-week points-redeemed / visits trend bars.

**VO:**
> "And on the other side, Kuriftu sees every one of those moments land here — live. Not a monthly report, not a guess about who's coming back. A real customer list, a booking they can trace, and the ability to reward a regular directly from the dashboard. This is the ROI proof a wellness partner has never had before in Ethiopia."

**On-screen text:** *No marketing agency. No ad spend. Just the community, instrumented.*

---

## Close — Where This Goes Next (5:15–5:45)

**Visual:** Quick montage (2–3 seconds each): onboarding, booking, check-in, dashboard — then fade to a simple roadmap card.

**VO:**
> "Today, this runs live with Kuriftu as our first pilot partner — real bookings, a real community, a real dashboard. Next: more partners, live payment rails, and the corporate wellness pipeline this was always built toward."

**On-screen text (final card):**
> **Well Circle**
> Your tribe, your wellness. Right where you chat.
> *Pilot partner: Kuriftu African Village*

---

## Appendix: Shot List / Checklist

| # | Scene | Screen/Device | Account state needed | Depends on |
|---|-------|---------------|----------------------|------------|
| 1 | Cold open contrast | Screenshot / phone | — | — |
| 2 | Bot link → auto-auth | Phone, Telegram | Fresh | Bot `/start`, `POST /auth/telegram` |
| 3 | Onboarding: name, multi-passion, frequency | Phone | Fresh | `OnboardingFlow.jsx` |
| 4 | Onboarding: circles (suggested / available / create) | Phone | Fresh | `Circle` model, `POST /circles` |
| 5 | WelcomeBanner + welcome gift | Phone | Fresh, just onboarded | Phase 8, Phase 7 promos |
| 6 | Kuriftu featured on Home | Phone | Either | `is_featured` ordering fix |
| 7 | Kuriftu provider detail + promo banner | Phone | Either | Phase 7 |
| 8 | Direct-contact booking (tel/email) | Phone | Either | Phase 9 |
| 9 | Multi-day online booking + combined payment | Phone | Either | Phase 10 |
| 10 | Booking confirmation | Phone | Either | — |
| 11 | Sheets row appears | Screen capture of Sheet, or mocked cut | — | Phase 12 (real creds required for a genuine capture) |
| 12 | Check-in + streak + social proof | Phone | Seeded returning user | Phase 8/5 |
| 13 | Circle chat / leaderboard | Phone | Seeded returning user | Phase 3/5 |
| 14 | Profile: points, tier, streak-at-risk | Phone | Seeded returning user | — |
| 15 | Provider Dashboard: KPIs + live feed | Laptop/tablet | Kuriftu provider login | — |
| 16 | Customers tab + provider award | Laptop/tablet | Kuriftu provider login | Phase 5 |
| 17 | Promotions tab | Laptop/tablet | Kuriftu provider login | Phase 7 |
| 18 | Analytics trend bars | Laptop/tablet | Kuriftu provider login | Phase 5 |
| 19 | Closing card | Graphic | — | — |

**Things to disclose on screen rather than hide (credibility over polish):**
- Telebirr/M-Pesa are in demo/auto-approve mode pending live sandbox credentials (`docs/HANDOFF.md` — "Partially Implemented").
- Health & Activity metrics are UI-mock, not real device data.
- Neighbourhood alert banners are hardcoded copy, not dynamic.

**Do not show (not shipped / out of scope):**
- B2B corporate portal, group wallet / Tribe Vault, points redemption marketplace beyond the existing Products Store — all deferred per `docs/HANDOFF.md` "Yet to Implement."
