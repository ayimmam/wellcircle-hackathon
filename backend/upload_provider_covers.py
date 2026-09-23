"""Upload prepared provider covers to Cloudinary and point the DB at them.

The step `scripts/prepare_event_covers.py` stops short of: it takes the
1200x630 JPEGs that script writes to `seed_assets/event_covers/<slug>.jpg`,
uploads each through the app's own `cloudinary_service.upload_file` (so the
same folder rules and size limits apply as for any provider upload), and
sets `providers.cover_photo_url` to the returned secure URL.

Idempotent: the Cloudinary `public_id` is the provider slug with
`overwrite=True`, so re-running replaces the asset in place rather than
piling up copies, and a provider already pointing at the resulting URL is
left alone.

Unlike the other seed scripts this one goes through app.config — it needs
CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET, which live there — so run it
with the backend's normal environment loaded.

Usage:
    cd backend && python upload_provider_covers.py            # dry run
    cd backend && python upload_provider_covers.py --apply    # upload + write
"""
import argparse
import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

COVERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_assets", "event_covers")

# Provider slug (the filename prepare_event_covers.py writes) → the canonical
# provider name to match in the database. Mirrors that script's
# FOLDER_TO_PROVIDER, inverted through its _slug().
SLUG_TO_PROVIDER = {
    "bole_burners": "Bole Burners",
    "satenaw_runclub": "Satenaw Runclub",
    "bertusew_runningclub": "Bertusew Runningclub",
    "afroheat_fitness": "AfroHeat Fitness",
    "lets_hike_ethiopia": "Let's Hike Ethiopia",
    "ereft_ethiopia": "Ereft Ethiopia",
    "sip_and_serve_tennis": "Sip and Serve Tennis",
    "guzo_adwa_hiking": "Guzo Adwa Hiking",
}


def _covers() -> list:
    """(slug, provider_name, path) for every prepared cover on disk."""
    if not os.path.isdir(COVERS_DIR):
        return []
    found = []
    for slug, provider_name in sorted(SLUG_TO_PROVIDER.items()):
        path = os.path.join(COVERS_DIR, f"{slug}.jpg")
        if os.path.isfile(path):
            found.append((slug, provider_name, path))
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="upload and write (default: dry run)")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set.")
        return 1

    covers = _covers()
    if not covers:
        print(f"No prepared covers in {COVERS_DIR}.")
        print("Run: python scripts/prepare_event_covers.py --copy --resize")
        return 1

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    planned, missing = [], []
    for slug, provider_name, path in covers:
        cur.execute("SELECT id, name FROM providers WHERE lower(name) = lower(%s)", (provider_name,))
        row = cur.fetchone()
        if not row:
            missing.append(provider_name)
            continue
        planned.append((row[0], provider_name, slug, path))

    if missing:
        print(f"Not in the database ({len(missing)}):")
        for name in missing:
            print(f"  · {name}")
        print()

    if not planned:
        print("Nothing to upload — no prepared cover matched a provider row.")
        conn.close()
        return 0

    print(f"{'Uploading' if args.apply else 'Would upload'} {len(planned)} cover(s):")
    for _pid, provider_name, slug, path in planned:
        size_kb = os.path.getsize(path) // 1024
        print(f"  · {provider_name}  ←  {slug}.jpg ({size_kb} KB)")

    if not args.apply:
        print("\nDry run — re-run with --apply to upload and write.")
        conn.close()
        return 0

    # Imported here so a dry run needs no Cloudinary configuration at all.
    from app.services.cloudinary_service import upload_file

    written = 0
    for pid, provider_name, slug, path in planned:
        with open(path, "rb") as fh:
            result = upload_file(fh.read(), folder="providers",
                                 content_type="image/jpeg", public_id=slug)
        cur.execute(
            "UPDATE providers SET cover_photo_url = %s WHERE id = %s AND "
            "(cover_photo_url IS DISTINCT FROM %s)",
            (result["url"], pid, result["url"]),
        )
        written += cur.rowcount
        print(f"  ✅ {provider_name} → {result['url']}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone — {len(planned)} uploaded, {written} provider row(s) updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
