# Well Circle — Text-to-Video Prompts (Early Previz Cut)

Companion to `docs/VIDEO_SCRIPT_MVP_WALKTHROUGH.md` (the live-shoot script/shot list). This version reformats the same story into short, paste-ready blocks for producing a **rough animatic before the real shoot** — to test pacing, VO timing, and story order cheaply.

## Tool routing (read this first)

Generative text-to-video tools (Pika, Luma, etc.) **cannot reliably reproduce real app UI** — don't waste credits asking them to generate a "Telegram Mini App screen." Split the work instead:

| Shot type | Tool | Why |
|---|---|---|
| Real app screens (onboarding, booking, dashboard) | **Google Vids** — import actual screenshots (take them from the app in mock mode, `VITE_USE_MOCK=true`, no backend needed) and use its pan/zoom + AI narrator | Free, unlimited, gets the real UI on screen, not a hallucinated one |
| Cinematic / metaphor shots (cold open, cutaways, closing card) | **Pika** (free 80 credits/mo) → fall back to **Luma** if credits run out | These have no real UI to be faithful to — generation quality actually matters more than accuracy here |
| Voiceover | Google Vids' built-in AI narrator, or paste VO lines into any free TTS if you want a separate track to mix in later | Keeps this a zero-cost previz pass |

Each shot below is sized to a single generation (~4–10s), since most free tools cap clip length. Stitch them in order inside Google Vids' timeline.

---

## PIKA / LUMA PROMPTS (cinematic shots — paste as-is)

### Shot A — Cold open, left half
```
Split-screen composition, left panel only: a smartphone screen close-up showing a cluttered messaging app thread — overlapping chat bubbles, blurry payment screenshot thumbnails, a red question mark icon, warm indoor lighting, slightly frustrated mood, muted desaturated colors, static handheld camera, realistic mobile UI mockup, 4 seconds, no text overlay, no logos.
```
**On-screen text (add in Google Vids):** *No CRM. No booking system. No data.*

### Shot B — Cold open, right half transition
```
A smartphone screen fading from black into a clean minimal mobile app splash screen, soft teal and white color palette, a simple circular logo mark pulsing gently, calm confident lighting, smooth ease-in animation, 3 seconds, no readable text, no watermark.
```

### Shot C — Cutaway: Sheets export (Act 3)
```
Close-up of a spreadsheet interface on a laptop screen, a new row of data appearing and highlighting briefly in light green, columns for name, phone number, date, and service visible but blurred/illegible, clean office desk background softly out of focus, calm professional lighting, 4 seconds, no watermark.
```

### Shot D — Montage transition into close (Act 5→Close)
```
Quick rhythmic montage of four different smartphone screens flashing in sequence, each showing a different simple colored UI card (teal, coral, gold, deep green), fast cuts on a beat, energetic but clean, minimal motion blur, 6 seconds, no readable text, no watermark.
```

### Shot E — Closing card background
```
Soft gradient background transitioning slowly between warm sunset orange and calm teal, gentle floating particles suggesting community and wellness, serene and aspirational mood, very slow camera drift, 5 seconds, empty center third of frame reserved for text overlay, no watermark.
```
**On-screen text (add in Google Vids, centered):**
> **Well Circle**
> Your tribe, your wellness. Right where you chat.
> *Pilot partner: Kuriftu African Village*

---

## GOOGLE VIDS BLOCKS — screenshot + narration (paste VO into narrator field per block)

Each block = one screenshot (or short screen-capture) + a VO line. Take screenshots from the running app first (`npm run dev` with `VITE_USE_MOCK=true`, per `CLAUDE.md`), then import.

### Block 1 — Bot link → auto-auth
**Screenshot needed:** Telegram chat with bot `/start` button, then splash screen.
**VO:** "One tap from a Telegram chat. No download, no password — Well Circle authenticates instantly using the Telegram account the user is already signed into."
**On-screen text:** *Auto-auth via Telegram · Zero-friction entry*

### Block 2 — Onboarding: multi-passion + frequency
**Screenshot needed:** `OnboardingFlow.jsx` interest toggle grid + frequency step.
**VO:** "Onboarding takes under a minute. Users pick more than one passion, and the app arrives with a smart default already selected — Next is never a dead end."

### Block 3 — Onboarding: circles
**Screenshot needed:** Circles step — suggested communities, "Available Circles," "Or start your own."
**VO:** "Before they've even seen the home screen, they can join a circle other members already started — or create their own and invite friends."

### Block 4 — WelcomeBanner
**Screenshot needed:** `WelcomeBanner.jsx` on Home.
**VO:** "And the app gives something back immediately — twenty welcome points, and a first-visit offer from our pilot partner, Kuriftu."

### Block 5 — Kuriftu featured + provider detail
**Screenshot needed:** Home carousel with Kuriftu first, then Kuriftu provider detail page with promo banner.
**VO:** "Kuriftu leads the home screen — real photos, real confirmed pricing, a live presale offer."

### Block 6 — Direct-contact booking
**Screenshot needed:** Service tagged "Book directly" → contact screen with tel/mailto links.
**VO:** "Kuriftu doesn't run fixed online slots for most services — so instead of forcing a payment flow that doesn't fit, the guest gets a direct line to call or email, pay on-site, no fiction."

### Block 7 — Multi-day booking
**Screenshot needed:** Date chips multi-select, discount row, combined total.
**VO:** "For services that are bookable online, a guest can book several days in one flow with one combined payment."

### Block 8 — Confirmation
**Screenshot needed:** Booking confirmation card with reference code.
**VO:** "Confirmed — and the booking exports straight into Kuriftu's own spreadsheet in the background." *(cut to Shot C here)*

### Block 9 — Check-in + streak + social proof
**Screenshot needed:** `CheckinCard`, streak badge, `SocialProofBanner`.
**VO:** "This is the part a booking app alone can't do. Daily check-ins, streaks with a freeze so one missed day doesn't wreck your progress, and a circle that notices when you show up."

### Block 10 — Circle chat / leaderboard
**Screenshot needed:** `CircleDetailScreen` — Chat / Leaderboard / Members tabs.
**VO:** "Points are redeemable against real partner products — not just cosmetic."

### Block 11 — Provider Dashboard: KPIs + live feed
**Screenshot needed:** Provider Dashboard top KPI cards + live feed.
**VO:** "And on the other side, Kuriftu sees every one of those moments land here — live. Not a monthly report. A real customer list, and a booking they can trace."

### Block 12 — Customers tab + award button
**Screenshot needed:** Customers tab, "🎁 +25 pts" button.
**VO:** "They can even reward a regular directly from the dashboard."

---

## Assembly order (paste into Google Vids timeline)

1. Shot A → Shot B (cold open, ~7s)
2. Block 1 (~8s)
3. Block 2 (~8s)
4. Block 3 (~8s)
5. Block 4 (~6s)
6. Block 5 (~8s)
7. Block 6 (~8s)
8. Block 7 (~8s)
9. Block 8 (~5s) → Shot C (~4s)
10. Block 9 (~8s)
11. Block 10 (~6s)
12. Block 11 (~8s)
13. Block 12 (~6s)
14. Shot D (~6s) → Shot E + closing text (~5s)

**Total previz runtime:** ~2:45–3:15 (intentionally shorter than the 5–6 min live-shoot target — this cut is for pacing/story validation, not final runtime).

## Disclose in the previz too (carry over from the live-shoot script)
- Payments are demo/auto-approve, not live Telebirr/M-Pesa yet.
- Health & Activity metrics are UI-mock.
- Neighbourhood alert banners are hardcoded copy.

Once this animatic is approved, produce the real cut using `docs/VIDEO_SCRIPT_MVP_WALKTHROUGH.md`'s full shot list on a real device inside Telegram.
