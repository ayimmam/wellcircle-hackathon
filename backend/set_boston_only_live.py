"""Only Boston Day Spa is bookable — every other provider gets flipped to
is_coming_soon (WS5 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).

A data flip, not a hardcoded allowlist: matches Boston Day Spa by name the
same way mark_kuriftu_featured.py and seed_boston_day_spa.py already do
('%boston day spa%' or '%kuriftu%', since the pilot row was renamed from
Kuriftu — see seed_boston_day_spa.py's own docstring), and refuses to touch
anything unless exactly one provider matches. Coming-soon providers stay
fully visible everywhere (list, detail, feed) — they just lose the booking
CTA, which the backend already enforces (POST /api/bookings 400s against a
coming-soon provider) and the frontend now mirrors on event cards too.

Idempotent — a second run with no schema changes plans zero updates.

Usage:
    cd backend && python set_boston_only_live.py            # dry run (default, safe)
    cd backend && python set_boston_only_live.py --apply     # writes
"""
import argparse
import os
import sys


def _is_boston(name):
    n = (name or "").lower()
    return "boston day spa" in n or "kuriftu" in n


def plan_updates(providers):
    """`providers`: iterable of (id, name, is_coming_soon) rows.

    Returns (boston_id, changes) where `changes` is a list of
    (id, name, current_is_coming_soon, desired_is_coming_soon) for every row
    that isn't already in the desired state.

    Raises ValueError unless exactly one provider matches Boston Day Spa —
    zero means it hasn't been seeded yet (run seed_boston_day_spa.py first),
    more than one means the name match is ambiguous and needs a human to
    look, neither of which this script should silently plough through.
    """
    providers = list(providers)
    matches = [p for p in providers if _is_boston(p[1])]
    if len(matches) != 1:
        raise ValueError(
            f"expected exactly 1 provider matching Boston Day Spa, found {len(matches)}: "
            f"{[p[1] for p in matches]}"
        )
    boston_id = matches[0][0]

    changes = []
    for provider_id, name, is_coming_soon in providers:
        desired = provider_id != boston_id
        if bool(is_coming_soon) != desired:
            changes.append((provider_id, name, is_coming_soon, desired))
    return boston_id, changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        from dotenv import load_dotenv
        load_dotenv()
        database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set.")
        sys.exit(1)

    import psycopg2
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    cur.execute("SELECT id, name, is_coming_soon FROM providers")
    providers = cur.fetchall()

    try:
        boston_id, changes = plan_updates(providers)
    except ValueError as exc:
        print(f"Aborting: {exc}")
        cur.close()
        conn.close()
        sys.exit(1)

    print(f"Boston Day Spa provider: {boston_id}")
    if not changes:
        print("Nothing to change — already in the desired state.")
        cur.close()
        conn.close()
        return

    for provider_id, name, current, desired in changes:
        tag = "APPLY" if args.apply else "DRY RUN"
        print(f"{tag}: {name} ({provider_id}): is_coming_soon {current} -> {desired}")

    if args.apply:
        for provider_id, _, _, desired in changes:
            cur.execute("UPDATE providers SET is_coming_soon = %s WHERE id = %s", (desired, provider_id))
        conn.commit()
        print(f"Applied {len(changes)} update(s).")
    else:
        print(f"\n{len(changes)} update(s) would be applied. Re-run with --apply to write them.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
