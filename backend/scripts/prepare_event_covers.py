"""Prepare event cover photos from events/assets/ for provider banner images.

WS17 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md — maps the best
single photo from each events/assets/<folder>/ subfolder to a provider slug,
ready for upload via seed_upcoming_events.py's existing Cloudinary path.

Usage:
    cd backend && python scripts/prepare_event_covers.py                # preview mapping
    cd backend && python scripts/prepare_event_covers.py --copy         # copy to seed_assets/
    cd backend && python scripts/prepare_event_covers.py --copy --resize  # copy + resize to 1200x630

The mapping is deterministic: for each folder, pick the first .jpg file
that isn't a HEIC (those need manual conversion). The picked file is
copied to backend/seed_assets/event_covers/<provider_slug>.jpg, which is
where seed_upcoming_events.py's upload step already looks.
"""

import argparse
import os
import shutil
import sys

# events/assets/ folder → canonical provider name (from seed_upcoming_events.py)
FOLDER_TO_PROVIDER = {
    "boleburners": "Bole Burners",
    "satenaw_runclub": "Satenaw Runclub",
    "birtu_sew_running_club": "Bertusew Runningclub",
    "afroheatfitness": "AfroHeat Fitness",
    "lets_hike_ethiopia": "Let's Hike Ethiopia",
    "ereft_ethiopia": "Ereft Ethiopia",
    "sipandserve101": "Sip and Serve Tennis",
    "guzo_adwa_hiking_events": "Guzo Adwa Hiking",
}

# Provider name → slug for the output filename
def _slug(name: str) -> str:
    return name.lower().replace(" ", "_").replace("'", "")


def _pick_best_photo(folder_path: str) -> str | None:
    """Pick the best single photo from a folder.
    Prefer .jpg files; skip .HEIC (not web-servable). Prefer files
    without numbering (the 'hero' shot) over numbered variants."""
    candidates = []
    for f in sorted(os.listdir(folder_path)):
        lower = f.lower()
        if lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            candidates.append(f)

    if not candidates:
        return None

    # Prefer unnumbered (e.g., 'image.jpg' or '<name>.jpg') over '-01', '-02'
    for c in candidates:
        stem = os.path.splitext(c)[0].lower()
        if not any(stem.endswith(f"-{i:02d}") for i in range(20)):
            return c

    return candidates[0]


def main():
    parser = argparse.ArgumentParser(description="Map events/assets/ photos to provider covers")
    parser.add_argument("--copy", action="store_true", help="Copy picked photos to seed_assets/event_covers/")
    parser.add_argument("--resize", action="store_true", help="Resize to 1200x630 (requires Pillow)")
    args = parser.parse_args()

    # Resolve paths relative to the repo root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    repo_root = os.path.dirname(backend_dir)
    assets_dir = os.path.join(repo_root, "events", "assets")
    output_dir = os.path.join(backend_dir, "seed_assets", "event_covers")

    if not os.path.isdir(assets_dir):
        print(f"❌ events/assets/ not found at {assets_dir}")
        sys.exit(1)

    print(f"📂 Scanning {assets_dir}\n")

    mapping = []
    for folder_name, provider_name in sorted(FOLDER_TO_PROVIDER.items()):
        folder_path = os.path.join(assets_dir, folder_name)
        if not os.path.isdir(folder_path):
            print(f"  ⚠️  {folder_name}/ — folder not found, skipping")
            continue

        photo = _pick_best_photo(folder_path)
        if not photo:
            print(f"  ⚠️  {folder_name}/ — no suitable photo found, skipping")
            continue

        slug = _slug(provider_name)
        src = os.path.join(folder_path, photo)
        dest = os.path.join(output_dir, f"{slug}.jpg")

        print(f"  ✅ {folder_name}/{photo} → {slug}.jpg  ({provider_name})")
        mapping.append((src, dest, provider_name, slug))

    print(f"\n📊 {len(mapping)}/{len(FOLDER_TO_PROVIDER)} providers mapped\n")

    if args.copy and mapping:
        os.makedirs(output_dir, exist_ok=True)
        for src, dest, provider_name, slug in mapping:
            if args.resize:
                try:
                    from PIL import Image
                    img = Image.open(src).convert("RGB")
                    # Cover-fit to 1200x630
                    target_w, target_h = 1200, 630
                    img_ratio = img.width / img.height
                    target_ratio = target_w / target_h
                    if img_ratio > target_ratio:
                        new_h = target_h
                        new_w = int(img_ratio * target_h)
                    else:
                        new_w = target_w
                        new_h = int(target_w / img_ratio)
                    img = img.resize((new_w, new_h), Image.LANCZOS)
                    left = (new_w - target_w) // 2
                    top = (new_h - target_h) // 2
                    img = img.crop((left, top, left + target_w, top + target_h))
                    img.save(dest, "JPEG", quality=85, optimize=True)
                    print(f"  📐 Resized + saved: {dest}")
                except ImportError:
                    print("  ❌ Pillow not installed — run: pip install Pillow")
                    shutil.copy2(src, dest)
                    print(f"  📋 Copied (no resize): {dest}")
            else:
                shutil.copy2(src, dest)
                print(f"  📋 Copied: {dest}")

        print(f"\n✅ Done — {len(mapping)} covers ready in {output_dir}")
        print("   Run `seed_upcoming_events.py --apply` to upload to Cloudinary and update DB.")
    elif not args.copy:
        print("   (dry run — pass --copy to write files)")


if __name__ == "__main__":
    main()
