# Well Circle — Short-Form Promo Plan (Reels / TikTok / Shorts)

Assets: `screens/` (light) and `screens-dark/` (dark), 25 frames each at
**1170×2532**, the native iPhone 13/14/15 screen. They drop into Framey's
iPhone frames 1:1. Regenerate any time with `capture.mjs` (header has the commands).
`03-home-tall` and `07-provider-tall` are full-page captures for vertical scroll pans.

---

## 0. The angle (my take)

Every wellness app sells "track more." Well Circle's real edge is different, and it
should be the spine of every video:

1. **Nothing to download.** It lives inside Telegram, which your audience already has open.
2. **You're not alone.** Circles are small accountability groups, with a leaderboard and a live "3 circle-mates checked in today."
3. **Showing up pays.** Streaks and points turn into real rewards at real Addis studios (a gym pass, a yoga class).
4. **Booking is three taps**, not twelve DMs and a payment screenshot.

So each hook names a *failure*. The showcase proves the matching pillar *first*, then
tours the rest quickly. Don't open on a feature list.

---

## 1. The hooks (0–2.5s)

Each hook is a text-on-screen line plus an optional voiceover (VO). Shoot the hook as **one of**: (a) bold text on a
solid brand-colour card, or (b) a 2s real-life clip (phone full of unused
apps, alarm snoozed at 5:30, a gym bag by the door). Text-on-card is fastest to batch.

| # | Failure | On-screen hook | Pays off with module |
|---|---|---|---|
| H1 | **Overwhelm / app fatigue** | "You downloaded 4 wellness apps this year. How many do you open?" | A → Onboarding |
| H2 | **No accountability** | "Nobody notices when you skip. That's the problem." | B → Circles |
| H3 | **Motivation dies on day 3** | "Day 3 is where every wellness plan dies." | C → Streak + rewards |
| H4 | **Booking friction** (local, very relatable) | "Booking a massage in Addis: 12 DMs, 1 payment screenshot, 0 confirmation." | D → Booking |
| H5 | **Effort with no payoff** | "You worked out 20 times this month. What did you get for it?" | E → Rewards store |

Amharic variants of H2 and H4 are worth A/B testing. Local-language hooks often
out-retain English ones in-market. Keep the on-screen English subtitle.

**Hook rules:** max 10 words on screen, visible by frame 1 (no fade-in), and one
pause beat (0.3s of silence) before the solution line.

---

## 2. Script & visual flow

Total runtime: **15–22s**. Build every video from three modules:

```
[Hook 2–2.5s] → [Solution bumper 2.5s, same in every video] → [Showcase module 7–10s] → [Tour tail 3s] → [CTA 2s]
```

### Part 2 — Solution bumper (reuse unchanged in all 5)

| Time | Visual | Text / VO |
|---|---|---|
| 0.0–0.4 | **Ring wipe.** A gold circle (the brand mark) expands from the centre and swallows the hook card. The "circle" is the brand, so the transition *is* the logo. | whoosh SFX |
| 0.4–1.4 | Logo lock-up on a warm off-white ground; "YOUR WELLNESS TRIBE" types in underneath | VO: "Meet Well Circle." |
| 1.4–2.5 | An iPhone rises from the bottom (ease-out, ~0.6s) showing `02-home`, then settles at 70% screen height | Text: **"Your wellness tribe — inside Telegram."** |

Why a fixed bumper: viewers who see 3 of your videos learn the ring-wipe =
Well Circle. Brand recall comes free.

### Part 3 — Showcase modules

Pacing: **one screen per 1.2–1.8s**, cut on the beat. Every cut gets **one** camera
move (never zoom *and* pan). Callout text sits in the top third and changes on every cut.

**Module A — "One app. Zero downloads." (pairs with H1)**
| Frame | Move | Callout |
|---|---|---|
| `23-onboarding-4-interests` | slow push-in on the selected cards | "Pick what you love" |
| `25-onboarding-6-circles` | tilt down from the "Joined!" toast | "Get matched to your circle" |
| `02-home` | zoom to the streak/points chips | "Done. You're in." |

**Module B — "Accountability that actually shows up" (H2)**
| `02-home` | zoom to the "3 circle-mates checked in today" banner | "Your circle sees you" |
| `15-circle-feed` | slow pan up (the tall feed reads as scrolling) | "They cheer you on" |
| `16-circle-leaderboard` | push-in on #1–#3 | "…and keep you honest" |

**Module C — "Day 21, not day 3" (H3)**
| `02-home` | punch-in (fast 1.15× zoom) to "21d streak" | "Streaks that stick" |
| `01-share-card` | device tilts 10° (3D), the card fills the frame | "Proof you showed up" |
| `17-profile` | zoom to the tier arc (🌲 Forest) | "Level up your tier" |

**Module D — "Booked in three taps" (H4)**. This is the strongest one, because the UI *is* the story:
| `06-provider-detail` | pan down the gallery | "Top studios in Addis" |
| `08-booking-1-service` | tap ripple on the selected service | "Tap 1" |
| `09-booking-2-datetime` | tap ripple on Thu 24 / 8:00 AM | "Tap 2" |
| `11-booking-sent` | zoom on "Total (pay on-site)" | "Tap 3. Pay at the studio." |

**Module E — "Showing up finally pays" (H5)**
| `02-home` | zoom to "Reward unlocked!" | "Your effort = points" |
| `18-products-store` | pan down the grid | "Spend them on real classes" |
| `19-product-detail` | push-in on the price in pts | "A free gym day, on us" |

**Tour tail (3s, same in every video):** three rapid cuts at 1s each (`04-explore-events` →
`12-community` → `05-explore-providers`), with the device sliding left each time (a carousel feel).
Text: "Events · Circles · Studios".

**CTA (2s):** the device slides away; the logo and "Open in Telegram → @wellcirclebot"
appear. Keep the handle on screen for ≥1.5s. People screenshot it.

---

## 3. Shot list (UI capture)

The 25 captured frames, and the module each one feeds:

| File | Screen | Used in |
|---|---|---|
| 01-share-card | "110 days in" shareable milestone card | C |
| 02-home | streak 21d, 1,240 pts, circle-mates banner, reward unlocked | bumper, A, B, C, E |
| 03-home-tall | full home (full-page) | long scroll pan / B-roll |
| 04-explore-events | events with "4 left out of 20" scarcity | tail |
| 05-explore-providers | provider cards | tail |
| 06/07-provider | Lifestyle Fitness Center (+ tall) | D |
| 08–11-booking | service → date/time → confirm → sent | D |
| 12/13-community | circles + ranks | tail, B |
| 14/15/16-circle | Zen Seekers header / feed / leaderboard | B |
| 17-profile | tier arc, personal records | C |
| 18/19-products | points store, product detail | E |
| 20–25-onboarding | name → goal → vibe → interests → frequency → circles | A |

**Worth adding later (not captured yet):**
- A real **Telegram chat → "Open Well Circle" button** screen recording (2s). It is the only
  honest way to show "no download," and it can't be faked from the mock app.
- The AI concierge sheet (floating chat button), if you want a 6th "ask anything" module.

---

## 4. Editing guidelines

### Layer 1: base UI
- Use the light set for daytime / energy videos and the dark set for evening / calm videos
  (sleep, therapy, spa). Don't mix the two themes in one video.
- Never scale a frame above 100%. For a zoom, crop the 1170px source rather than upscaling.

### Layer 2: motion (Framey or similar)
- **Device:** iPhone 15 in a neutral finish (Natural Titanium or White), not Black. Dark bezels
  fight the warm palette.
- **Canvas:** 1080×1920. The device fills 65–72% of the height and sits slightly low, leaving the top third for callouts.
- **Easing:** ease-in-out (cubic) on every move, 0.4–0.6s; hold 0.8s before the next cut.
  A cut every ~1.5s. On the "tap" frames, add a 0.25s 1.03× scale "press" on the device.
- **Background:** a soft radial gradient from warm cream (`#FBF6EE`) to light amber, *not* flat white.
  For dark videos, deep espresso (`#1A120B`) to brown. Add a subtle drifting blur-orb in amber for life.
- **Safe zones:** keep text and the device clear of the right 120px (the like/share rail) and the
  bottom 320px (caption and handle). The app's own bottom nav can sit in that zone, and that's fine.

### Layer 3: context (Canva / CapCut / FlexClip)
- **Palette** (pulled from the app): amber `#F5A623` for highlights and callout pills, burnt
  orange `#B5560F` for accents, near-black `#111` for text on cream, and green `#1E7A3C` for
  "success" beats (points, joined).
- **Type:** one heavy geometric sans for hooks (Inter Black / Montserrat ExtraBold), 64–80px,
  2 lines max. Callouts in the same family at Semibold 44px inside amber pills. Captions are
  auto-generated, with one keyword highlighted in amber.
- **Audio:** warm, positive, mid-tempo (100–120 BPM) afro-pop, amapiano-lite, or lo-fi house.
  Avoid aggressive gym-bro trap except on Module B/C gym cuts. Cut on the kick. Add soft UI SFX
  (tap and whoosh) at −18 dB under the music. VO, if used: calm, friendly, and not hype.
- **Emoji:** the app already uses 🔥🌲🥇, so reuse those as callout stickers instead of generic sparkles.

### Batching workflow
1. Build the bumper, tour tail, and CTA once, as a template.
2. Build 5 showcase modules, one per hook.
3. Export 5 videos in light, then re-export the calm ones (H3/H5) in dark. That's 7–10 videos from ~2 hours of editing.
4. After 48h, keep the winning hook and re-cut it with the other modules (hook × module testing).

---

## 5. Before these go public

- **All data is seed/mock data.** The faces (Hana, Dawit, Meron…) are stock/avatar photos and the
  names are invented. Add a small "Demo data" tag, or re-shoot against consenting real users. Don't let the feed and leaderboard read as real testimonials.
- **Real business names appear** (Lifestyle Fitness Center, Boston Day Spa, Shanti Yoga…).
  Get the partner's OK before an ad shows their name or offer (e.g. "20% off your first visit").
- **Don't overclaim payments.** Bookings are *request → call to confirm → pay on-site*. Say "book
  in 3 taps", not "pay in-app".
- The event cards show raw timestamps ("9/26/2026, 10:29:50 PM"). That's how the app formats
  them. Fix it in `EventCard` or avoid lingering on those cards.
