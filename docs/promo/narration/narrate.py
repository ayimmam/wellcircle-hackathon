"""Narration for the promo videos with Kokoro-82M: open-source (Apache-2.0), free for commercial
use, runs locally on the CPU, no account or API key.

    python narration/narrate.py                    # every video in script.json
    python narration/narrate.py Booking            # one video
    python narration/narrate.py Booking am_michael # one video, another voice

Writes ../screens-video/audio/narration/<Video>/<id>.wav + manifest.json (start frames, durations).
Setup (once): see narration/README.md.
"""
import json
import pathlib
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "screens-video" / "audio" / "narration"
MODELS = HERE / "models"

script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
only = sys.argv[1] if len(sys.argv) > 1 else None
voice = sys.argv[2] if len(sys.argv) > 2 else script["voice"]

missing = [f for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin") if not (MODELS / f).exists()]
if missing:
    sys.exit(f"Missing model files in {MODELS}: {', '.join(missing)}. See narration/README.md, step 2.")

kokoro = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
for video, lines in script["videos"].items():
    if only and video != only:
        continue
    out = OUT / video
    out.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for line in lines:
        samples, rate = kokoro.create(line["text"], voice=voice, speed=script.get("speed", 1.0), lang=script.get("lang", "en-us"))
        samples = samples * (0.89 / max(1e-6, float(abs(samples).max())))  # peak-normalise to -1 dBFS: audible on phone speakers
        sf.write(out / f"{line['id']}.wav", samples, rate)
        seconds = round(len(samples) / rate, 3)
        manifest[line["id"]] = {"at": line["at"], "seconds": seconds, "text": line["text"]}
        print(f"OK {video}/{line['id']:<10} {seconds:4.1f}s  {line['text'][:64]}")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
