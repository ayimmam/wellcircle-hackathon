"""Seed the community channels each event host publishes, for the event RSVP
screen.

Source: `docs/Event Schedule & Bot Data  .docx` (Sep 23 - Oct 3 2026). An
event RSVP is a hand-off — WellCircle collects no money for events — so the
RSVP screen shows the price and the host's own channel for the guest to
arrange payment through. These are the channels the hosts put on their own
posters, so they are already public.

The hosts publish a mix: a phone number on almost all of them, a Telegram
channel on three, Instagram on four, a bare website on one. Columns match:
`contact_phone` (added by migration 006) plus `contact_telegram` /
`contact_instagram` / `contact_website` (migration 022). Handles are stored
without the leading '@' and the website without a scheme — the RSVP screen
owns how each is rendered as a link.

Only providers already in the database are touched. A name that resolves to
nothing is reported, not created: this script seeds contact details, it is
not an onboarding path.

Idempotent: every run writes the same values, and a column that already
holds the right value is left alone (reported as "unchanged").

Raw psycopg2, matching seed_upcoming_events.py — importing app.database
pulls in app.config's Settings, which demands env vars a data seed has no
use for.

Usage:
    cd backend && DATABASE_URL=... python seed_provider_contacts.py            # dry run
    cd backend && DATABASE_URL=... python seed_provider_contacts.py --apply    # writes
"""
import argparse
import os
import sys

import psycopg2

# Canonical provider name (or any alias below) → channels from the docx.
# `aliases` mirrors seed_upcoming_events.py's PROVIDERS table so a host that
# was seeded under a variant spelling is still found.
CONTACTS = {
    "Bertusew Runningclub": {
        "aliases": ["Bertusew Running Club", "Birtu sew Running Club", "Bertusew Fitness"],
        "phone": "0947537473",
        "telegram": "bertusewfitness",
    },
    "Zumba with Vahe": {
        "aliases": ["Zumba With Vahe"],
        "phone": "0911882287",
        "instagram": "vahetilbian",
    },
    "Debol Running Club": {
        "aliases": ["Debol Run Club"],
        # The only host that published no phone number — just the website.
        "website": "debolrunningclub.com",
    },
    "Khul Wholeness Center": {
        "aliases": ["Khul Wholeness", "Khul"],
        "phone": "0932333382",
        "telegram": "khulservice",
    },
    "Satenaw Runclub": {
        "aliases": ["Satenaw Running Club", "Satenaw Run Club", "Satenaw Afterwork Run"],
        "phone": "0941545953",
        "telegram": "satenaw_runclub",
    },
    "Ereft Ethiopia": {
        "aliases": ["Ereft Hiking", "Ereft"],
        # Two booking lines on the poster; the first is the one to lead with.
        "phone": "0927928407",
        "instagram": "ereft_ethiopia",
    },
    "Guzo Adwa Hiking": {
        "aliases": ["Guzo_Adwa_Hiking", "Guzo Adwa"],
        "phone": "0942545470",
        "instagram": "guzo_adwa_hiking",
    },
    "Borena Tour": {
        "aliases": ["Borena tour", "Borena"],
        "phone": "0939616163",
    },
    "Addis Hiking": {
        "aliases": [],
        "phone": "0920807230",
        "instagram": "addishiking",
    },
}

FIELDS = (("phone", "contact_phone"), ("telegram", "contact_telegram"),
          ("instagram", "contact_instagram"), ("website", "contact_website"))


def _names(canonical: str, meta: dict) -> list:
    return [canonical] + list(meta.get("aliases", []))


def plan_changes(cur) -> tuple[list, list]:
    """Returns (updates, missing). An update is (provider_id, name, {column: value})
    carrying only the columns whose current value differs."""
    updates, missing = [], []

    for canonical, meta in CONTACTS.items():
        names = [n.lower() for n in _names(canonical, meta)]
        cur.execute(
            "SELECT id, name, contact_phone, contact_telegram, contact_instagram, contact_website "
            "FROM providers WHERE lower(name) = ANY(%s)",
            (names,),
        )
        rows = cur.fetchall()
        if not rows:
            missing.append(canonical)
            continue

        for pid, name, phone, telegram, instagram, website in rows:
            current = {"contact_phone": phone, "contact_telegram": telegram,
                       "contact_instagram": instagram, "contact_website": website}
            changes = {
                column: meta[key]
                for key, column in FIELDS
                if meta.get(key) and current[column] != meta[key]
            }
            if changes:
                updates.append((pid, name, changes))

    return updates, missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set.")
        return 1

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    try:
        updates, missing = plan_changes(cur)
    except psycopg2.errors.UndefinedColumn:
        conn.rollback()
        print("providers is missing the community-channel columns.")
        print("Run: python apply_community_channels_migration.py  (or alembic upgrade 022)")
        return 1

    if missing:
        print(f"Not in the database ({len(missing)}) — no provider row matched these names:")
        for name in missing:
            print(f"  · {name}")
        print()

    if not updates:
        print("Nothing to do — every matched provider already has these channels.")
        conn.close()
        return 0

    print(f"{'Applying' if args.apply else 'Would apply'} {len(updates)} update(s):")
    for _pid, name, changes in updates:
        rendered = ", ".join(f"{col}={val}" for col, val in sorted(changes.items()))
        print(f"  · {name}: {rendered}")

    if not args.apply:
        print("\nDry run — re-run with --apply to write.")
        conn.close()
        return 0

    for pid, _name, changes in updates:
        assignments = ", ".join(f"{col} = %s" for col in sorted(changes))
        values = [changes[col] for col in sorted(changes)]
        cur.execute(f"UPDATE providers SET {assignments} WHERE id = %s", (*values, pid))

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone — {len(updates)} provider(s) updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
