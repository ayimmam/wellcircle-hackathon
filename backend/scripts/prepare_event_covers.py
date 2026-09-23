"""Prepare provider cover photos from the WellCircle image collection.

WS17 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md — maps the best
single photo from each image-collection subfolder to a provider slug, then
produces two artefacts from it:

    seed_assets/event_covers/<slug>.jpg   1200x630, for upload_provider_covers.py
    ../frontend/public/providers/<slug>.webp  ~640px, committed for mock mode

The Cloudinary copy is what production serves. The committed thumb is what
mock mode and the Vitest suite render, so what you see locally is the same
subject matter as production without the mock layer needing the network —
the whole point of `VITE_USE_MOCK`.

Source folders are looked for in docs/wellcircle_image_collection/ first,
falling back to events/assets/ (the two hold identical content; the docs
copy is the one the team maintains).

Usage:
    cd backend && python scripts/prepare_event_covers.py                   # preview mapping
    cd backend && python scripts/prepare_event_covers.py --copy --resize   # 1200x630 covers
    cd backend && python scripts/prepare_event_covers.py --thumbs          # frontend webp thumbs
    cd backend && python scripts/prepare_event_covers.py --copy --resize --thumbs   # both

The mapping is deterministic: for each folder, prefer the unnumbered "hero"
photo, skipping .HEIC (not web-servable, needs manual conversion).
"""

import argparse
import os
import shutil
import sys

# Image-collection folder → canonical provider name (from seed_upcoming_events.py)
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


def _best_window(img, target_w, target_h):
    """Pick the crop window with the most visual detail.

    Every source here is a tall phone photo of a group being cropped to a
    wide banner, and the subjects sit anywhere in the frame — centred in one
    shot, along the bottom under a big sky in the next. A fixed centre or
    rule-of-thirds crop gets one of those right and beheads the other, so
    instead: score each candidate offset by edge energy (people and terrain
    carry detail, flat sky and pavement do not) and take the densest window.
    """
    from PIL import ImageFilter

    # Edge magnitude on a small greyscale copy — this only has to rank
    # offsets, not look at anything, so the downscale keeps it cheap.
    scale = 200 / max(img.width, img.height)
    small = img.convert("L").resize(
        (max(1, int(img.width * scale)), max(1, int(img.height * scale))))
    edges = small.filter(ImageFilter.FIND_EDGES)
    px = edges.load()

    def energy_rows():
        return [sum(px[x, y] for x in range(edges.width)) for y in range(edges.height)]

    def energy_cols():
        return [sum(px[x, y] for y in range(edges.height)) for x in range(edges.width)]

    def best_offset(energies, full_len, window_len, small_len):
        """Slide a window over the energy profile; return the offset in
        full-resolution pixels whose window scores highest."""
        if window_len >= full_len:
            return 0
        window_small = max(1, round(window_len * small_len / full_len))
        if window_small >= small_len:
            return 0
        prefix = [0]
        for e in energies:
            prefix.append(prefix[-1] + e)
        best_i, best_score = 0, -1
        for i in range(small_len - window_small + 1):
            score = prefix[i + window_small] - prefix[i]
            if score > best_score:
                best_i, best_score = i, score
        offset = round(best_i * full_len / small_len)
        return max(0, min(offset, full_len - window_len))

    top = best_offset(energy_rows(), img.height, target_h, edges.height)
    left = best_offset(energy_cols(), img.width, target_w, edges.width)
    return left, top


def _cover_fit(img, target_w, target_h):
    """Scale to cover the target box, then crop to its densest window."""
    from PIL import Image

    img_ratio = img.width / img.height
    target_ratio = target_w / target_h
    if img_ratio > target_ratio:
        new_w, new_h = int(img_ratio * target_h), target_h
    else:
        new_w, new_h = target_w, int(target_w / img_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left, top = _best_window(img, target_w, target_h)
    return img.crop((left, top, left + target_w, top + target_h))


def _source_dir(repo_root: str) -> str | None:
    """The docs collection is the maintained copy; events/assets/ is the
    older duplicate of the same files."""
    for candidate in (
        os.path.join(repo_root, "docs", "wellcircle_image_collection"),
        os.path.join(repo_root, "events", "assets"),
    ):
        if os.path.isdir(candidate):
            return candidate
    return None


def main():
    parser = argparse.ArgumentParser(description="Map collection photos to provider covers")
    parser.add_argument("--copy", action="store_true", help="Copy picked photos to seed_assets/event_covers/")
    parser.add_argument("--resize", action="store_true", help="Resize covers to 1200x630 (requires Pillow)")
    parser.add_argument("--thumbs", action="store_true",
                        help="Also write ~640px webp thumbs to frontend/public/providers/ (requires Pillow)")
    args = parser.parse_args()

    # Resolve paths relative to the repo root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    repo_root = os.path.dirname(backend_dir)
    assets_dir = _source_dir(repo_root)
    output_dir = os.path.join(backend_dir, "seed_assets", "event_covers")
    thumbs_dir = os.path.join(repo_root, "frontend", "public", "providers")

    if not assets_dir:
        print("❌ No image collection found — looked for docs/wellcircle_image_collection/ and events/assets/")
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

        print(f"  ✅ {folder_name}/{photo} → {slug}  ({provider_name})")
        mapping.append((src, dest, provider_name, slug))

    print(f"\n📊 {len(mapping)}/{len(FOLDER_TO_PROVIDER)} providers mapped\n")

    if not mapping:
        sys.exit(1)

    if args.copy:
        os.makedirs(output_dir, exist_ok=True)
        for src, dest, _provider_name, _slug_ in mapping:
            if args.resize:
                try:
                    from PIL import Image
                    _cover_fit(Image.open(src).convert("RGB"), 1200, 630).save(
                        dest, "JPEG", quality=85, optimize=True)
                    print(f"  📐 Resized + saved: {dest}")
                    continue
                except ImportError:
                    print("  ❌ Pillow not installed — run: pip install Pillow")
            shutil.copy2(src, dest)
            print(f"  📋 Copied: {dest}")

        print(f"\n✅ {len(mapping)} covers ready in {output_dir}")
        print("   Next: python upload_provider_covers.py --apply")

    if args.thumbs:
        try:
            from PIL import Image
        except ImportError:
            print("  ❌ Pillow not installed — run: pip install Pillow")
            sys.exit(1)

        os.makedirs(thumbs_dir, exist_ok=True)
        total = 0
        for src, _dest, _provider_name, slug in mapping:
            out = os.path.join(thumbs_dir, f"{slug}.webp")
            # 640x336 keeps the 1200x630 framing at a size that is cheap to
            # commit — these ship in the repo, unlike the Cloudinary copies.
            _cover_fit(Image.open(src).convert("RGB"), 640, 336).save(
                out, "WEBP", quality=72, method=6)
            size_kb = os.path.getsize(out) // 1024
            total += size_kb
            print(f"  🖼️  {out}  ({size_kb} KB)")
        print(f"\n✅ {len(mapping)} thumbs in {thumbs_dir} — {total} KB total")
        print("   Referenced by frontend/src/data/mock.js as /providers/<slug>.webp")

    if not args.copy and not args.thumbs:
        print("   (dry run — pass --copy and/or --thumbs to write files)")


if __name__ == "__main__":
    main()
