# Narration + music for the promo videos

`BookingNarrated` and `CommunityNarrated` = the same videos with an AI voice-over and a music bed that dips
whenever the voice speaks. The silent `Booking` / `Community` cuts stay for uploads with a platform trending sound.

| Need | Tool | Licence |
|---|---|---|
| Voice-over | **Kokoro-82M** (`kokoro-onnx`), runs locally, no account or key | Apache-2.0: free, commercial use allowed |
| Music | `screens-video/audio/music.mp3`, a **Pixabay Music** track (the same one as the AgriData pitch) | Pixabay Content License: free, commercial use, no attribution |

Say "Voice-over: AI" in the post caption.

## Setup (once)

```bash
python -m pip install kokoro-onnx soundfile
cd docs/promo/narration && mkdir -p models && cd models          # ~340 MB, git-ignored
curl -L -o kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

## Make them

```bash
cd docs/promo
python narration/narrate.py                    # → screens-video/audio/narration/<Video>/*.wav + manifest.json
cd video
npx remotion render src/index.js BookingNarrated out/booking-narrated.mp4
npx remotion render src/index.js CommunityNarrated out/community-narrated.mp4
```

- **Words:** `narration/script.json`, one list per video. `at` = the frame (30fps) a line should start, matched to the
  video's beats (taps, points, CTA). A line never overlaps the one before it; rendering warns if one slips more than
  1.5s. About 2.7 words per second at the default speed (1.08).
- **Voice:** `af_heart` (default), `am_michael`, `bf_emma`, `bm_george`. Try one: `python narration/narrate.py Booking am_michael`.
- **Music:** swap `screens-video/audio/music.mp3` for another Pixabay track; levels (`MUSIC_LEVEL` 0.22,
  `DUCKED_LEVEL` 0.06) and `MUSIC = null` (voice only) are at the top of `video/src/audio.jsx`.
