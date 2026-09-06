"""Sequential production baseline — one user at a time, no concurrency."""
import json
import time
import urllib.request

URL = "https://well-circle-concierge.vercel.app/ai/concierge"
MSGS = [
    "Wellness events this week",
    "Find a spa near Bole",
    "Yoga classes this week",
]

for msg in MSGS:
    payload = json.dumps({"message": msg, "history": []}).encode()
    req = urllib.request.Request(
        URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read())
        ms = (time.perf_counter() - start) * 1000
        fb = "trouble matching" in data.get("reply", "").lower()
        print(
            f"{msg!r}: {ms:.0f}ms fallback={fb} "
            f"provider={data.get('provider_id')} source={data.get('data_source')}"
        )
    except Exception as exc:
        print(f"{msg!r}: ERROR {exc}")
    time.sleep(8)
