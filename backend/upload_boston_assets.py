"""Upload the Boston Day Spa image assets (extracted from the official PDF) to
Cloudinary and print the resulting URLs — `seed_boston_day_spa.py` consumes
these. Idempotent: each file gets a fixed public_id, so re-running overwrites
the same Cloudinary asset instead of creating duplicates.

Usage: cd backend && python upload_boston_assets.py
Requires CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
in the environment (see app/config.py).
"""
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
from app.services.cloudinary_service import upload_file  # noqa: E402

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "design", "boston-day-spa")

# filename (without extension) -> Cloudinary public_id
FILES = [
    "cover-hero",
    "gallery-01", "gallery-02", "gallery-03", "gallery-04", "gallery-05", "gallery-06",
    "service-hair-salon", "service-steam-sauna-jacuzzi", "service-massage-cave",
    "service-mani-pedi", "service-facial", "service-wax", "service-barber",
]


def upload_all(verbose=True):
    """Upload every Boston Day Spa asset, returning {name: url}.
    Idempotent — fixed public_id per file, safe to call repeatedly
    (seed_boston_day_spa.py imports this directly so it always has fresh URLs).
    """
    urls = {}
    for name in FILES:
        path = os.path.join(ASSETS_DIR, f"{name}.jpg")
        if not os.path.exists(path):
            if verbose:
                print(f"Missing asset, skipping: {path}")
            continue
        with open(path, "rb") as f:
            file_bytes = f.read()
        result = upload_file(file_bytes, "providers", "image/jpeg", public_id=f"boston-day-spa/{name}")
        urls[name] = result["url"]
        if verbose:
            print(f"Uploaded {name} -> {result['url']}")
    return urls


def main():
    urls = upload_all()
    print("\n--- URLs (paste into seed_boston_day_spa.py if regenerated) ---")
    print(json.dumps(urls, indent=2))


if __name__ == "__main__":
    main()
