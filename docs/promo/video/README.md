# Promo videos (Remotion)

Code-built versions of the videos in `../PROMO_PLAN.md`. Frames come straight from
`../screens-video/`, so a UI change is: re-capture → re-render.

```bash
# frames (mock dev server on :5199, see ../capture.mjs header)
FRAME=video node docs/promo/capture.mjs

cd docs/promo/video
npm install
npm run studio             # live preview / scrub the timeline in the browser
npm run render             # → out/booking.mp4 + out/community.mp4 (1080×1920, 30fps)
npm run render:community   # just one
```

| Composition | Story | File |
|---|---|---|
| `Booking` (~21s) | "12 DMs…" → booked in three taps | `src/Booking.jsx` |
| `Community` (~30s) | "Running alone?" → find Bertusew → join → RSVP → check in (+10) → post the run (+10) → 🔥 / gift / comment → redeem a massage | `src/Community.jsx` |

`src/kit.jsx` holds the shared pieces (hook, ring wipe, iPhone, taps, callouts, points pops, CTA).
Each video is a `SCREENS` table: when each frame shows, its callout, taps and camera move.

**The phone is a true iPhone 15.** `FRAME=video` captures the 393×793pt app area *below* the 59pt
status bar; the kit draws the status bar, Dynamic Island (126×37pt, 11pt from the top), bezel, frame
and side buttons around it, so status bar + app = the real 393×852pt screen. (The default capture,
`../screens/` at 1170×2532, is the full-screen set for Framey-style mockups.)

**Taps are recorded, not measured.** `capture.mjs` writes where every tapped element was
(`screens-video/taps.json`) and `tap('c04-join-pre', 18, 'c04-join')` reads it back, so ripples stay
on the real button after UI changes.

**Cutting in real footage:** the community video goes straight from the RSVP (~11s) to the check-in,
which is the natural place for run footage, and the CTA at the end is where the crew's "Well Circle!"
shout fits.

**Narrated versions:** `BookingNarrated` and `CommunityNarrated` add an AI voice-over (Kokoro, free and
commercial-OK) and a licence-free Pixabay music bed that dips under the voice → `out/*-narrated.mp4`.
Words, voice and setup: `../narration/README.md`.

**Music on the silent cuts:** add the trending sound in CapCut/TikTok at upload. Platform-licensed tracks
can't be baked into the file.

Licence: Remotion is free for individuals and companies of up to 3 people; larger teams
need a company licence (remotion.dev/license).
