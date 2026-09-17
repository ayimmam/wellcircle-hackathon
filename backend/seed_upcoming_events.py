"""Seed the 24 running/dance/hike/tennis events from the September 2026
`events/` poster photos (WS6 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md),
replacing the four-event August seed this file used to hold.

**Cover images for the 9 brand-new providers still need a human's visual
crop sign-off** (plan §15, point 9) — most posters have event text over the
scenery, so `cover_photo_url` is left `null` here rather than guessed at.
Once crops are approved, upload them through
`cloudinary_service.upload_file(folder="providers", public_id=<slug>)` and
`UPDATE providers SET cover_photo_url = ...` — not automated by this
script, since there is nothing to crop from until that sign-off happens.
Until then every new provider seeds with no cover — `FeedProviderCard`/
`FeedServiceCard` already handle a null cover.

Rules (see the plan's WS6 section for the full poster-by-poster trace):
    - All 24 events are already past as of today (2026-09-16) — Addis time
      (EAT, UTC+3) converted to UTC on write. They show as recaps, not
      upcoming sessions.
    - Latest poster wins: three rows from the OLD `seed_upcoming_events.py`
      (AfroHeat Zumba Aug 20, Bole Burners Aug 22, Satenaw Aug 23 06:30) are
      superseded and get `is_cancelled = TRUE` rather than deleted, so any
      existing booking/feed reference doesn't break. Bertusew's Aug 23
      07:00 row is unchanged by a newer poster and is simply updated in
      place — same (provider, starts_at) key as before.
    - Idempotent: providers match on canonical name or alias
      (`resolve_provider`); events match on (provider, starts_at)
      (`plan_changes`). A second run against the post-seed state plans
      nothing.
    - New providers seed `is_coming_soon = TRUE` (WS5), `price_range =
      "Price on request"`; every event's `price_etb = 0` with a
      description ending "Confirm price with the host." — none of these
      posters listed a firm price.
    - `capacity = 50`, `spots_remaining = capacity` for all 24 — no
      invented attendance; the recap card already hides a zero count.

Raw psycopg2, matching seed_boston_day_spa.py / seed_kuriftu_placeholder.py
— importing app.database pulls in app.config's Settings, which demands env
vars a data seed has no use for.

Usage:
    cd backend && DATABASE_URL=... python seed_upcoming_events.py               # dry run
    cd backend && DATABASE_URL=... python seed_upcoming_events.py --apply       # writes
"""
import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

EAT = timezone(timedelta(hours=3))
CAPACITY = 50
PRICE_NOTE = " Confirm price with the host."

# ─── Canonical providers + aliases (plan §8 table) ──────────────────────────
# `exists`: True for a provider seeded by the old version of this file or
# otherwise already in the DB under this exact name.
PROVIDERS = {
    "Bole Burners": {
        "aliases": ["Boleburners"], "category": "running", "exists": True,
    },
    "Satenaw Runclub": {
        "aliases": ["Satenaw Running Club", "Satenaw Run Club", "Satenaw Afterwork Run"],
        "category": "running", "exists": True,
    },
    "Bertusew Runningclub": {
        "aliases": ["Bertusew Running Club", "Birtu sew Running Club"],
        "category": "running", "exists": True,
    },
    "AfroHeat Fitness": {
        "aliases": [], "category": "gym", "exists": True,
    },
    "Zumba with Vahe": {
        "aliases": ["Zumba With Vahe"], "category": "gym", "exists": False,
    },
    "Zumba Dance Fitness": {
        "aliases": [], "category": "gym", "exists": False,
    },
    "SUP Studio": {
        "aliases": [
            "Sup Studio", "Sub Studio", "Sup Running Community",
            "Sub Running Community", "Enitewawek",
        ],
        "category": "gym", "exists": False,
    },
    "Great Ethiopian Run Team": {
        "aliases": ["Great Ethiopian run team"], "category": "running", "exists": False,
    },
    "Sip and Serve Tennis": {
        "aliases": [], "category": "other", "exists": False,
    },
    "Let's Hike Ethiopia": {
        "aliases": [], "category": "other", "exists": False,
    },
    "Guzo Adwa Hiking": {
        "aliases": ["Guzo_Adwa_Hiking"], "category": "other", "exists": False,
    },
    "Ereft Ethiopia": {
        "aliases": [], "category": "other", "exists": False,
    },
    "Sonder Running Club": {
        "aliases": [], "category": "running", "exists": False,
    },
}

# Rows from the OLD seed this poster batch supersedes — (provider, starts_at
# in EAT) of the pre-existing DB row to mark is_cancelled=TRUE. Bertusew's
# Aug 23 07:00 row is NOT here: it shares its (provider, starts_at) key with
# event #4 below, so plan_changes() naturally treats it as an update.
SUPERSEDED = [
    ("AfroHeat Fitness", datetime(2026, 8, 20, 18, 15, tzinfo=EAT)),
    ("Bole Burners", datetime(2026, 8, 22, 6, 0, tzinfo=EAT)),
    ("Satenaw Runclub", datetime(2026, 8, 23, 6, 30, tzinfo=EAT)),
]

# duration_minutes per the plan's §15.7 defaults, keyed by a short kind tag
# on each event below: run=90, dance/tennis=60, hike=240. "Ereft Ethiopia"'s
# overnight trip carries an explicit ends_at instead of a duration.
DURATIONS = {"run": 90, "dance": 60, "tennis": 60, "hike": 240}


# Every entry: provider (canonical or alias), service_name, starts_at (EAT),
# location_text, kind (duration bucket) OR explicit ends_at.
EVENTS = [
    {"provider": "Bole Burners", "service_name": "Bole Burners Evening Run",
     "starts_at": datetime(2026, 8, 20, 18, 0, tzinfo=EAT), "location_text": "Riverside Park", "kind": "run"},
    {"provider": "Satenaw Runclub", "service_name": "Satenaw Afterwork Run",
     "starts_at": datetime(2026, 8, 20, 17, 30, tzinfo=EAT), "location_text": "Friendship Park", "kind": "run"},
    {"provider": "Zumba with Vahe", "service_name": "Zumba with Vahe",
     "starts_at": datetime(2026, 8, 22, 18, 15, tzinfo=EAT), "location_text": "SUP Studio, Bole Matemiya", "kind": "dance"},
    {"provider": "Bertusew Runningclub", "service_name": "Bertusew Morning Run",
     "starts_at": datetime(2026, 8, 23, 7, 0, tzinfo=EAT), "location_text": "Yetebaberut Square Sport Center, CMC", "kind": "run"},
    {"provider": "Zumba Dance Fitness", "service_name": "Zumba Dance Fitness",
     "starts_at": datetime(2026, 8, 24, 18, 15, tzinfo=EAT), "location_text": "Armenian Club, 5 Kilo", "kind": "dance"},
    {"provider": "SUP Studio", "service_name": "AfroBeat Dance with Seble",
     "starts_at": datetime(2026, 8, 24, 18, 0, tzinfo=EAT), "location_text": "SUP Studio, Bole Matemiya", "kind": "dance"},
    {"provider": "Bole Burners", "service_name": "Bole Burners Evening Run",
     "starts_at": datetime(2026, 8, 26, 18, 0, tzinfo=EAT), "location_text": None, "kind": "run"},
    {"provider": "Satenaw Runclub", "service_name": "Satenaw Running Club",
     "starts_at": datetime(2026, 8, 26, 17, 30, tzinfo=EAT), "location_text": None, "kind": "run"},
    {"provider": "Great Ethiopian Run Team", "service_name": "Great Ethiopian Run Team",
     "starts_at": datetime(2026, 8, 26, 6, 0, tzinfo=EAT), "location_text": "Friendship Park", "kind": "run"},
    {"provider": "Zumba with Vahe", "service_name": "Zumba with Vahe",
     "starts_at": datetime(2026, 8, 26, 18, 15, tzinfo=EAT), "location_text": "SUP Studio", "kind": "dance"},
    {"provider": "Satenaw Runclub", "service_name": "Satenaw Running Club",
     "starts_at": datetime(2026, 8, 27, 17, 45, tzinfo=EAT), "location_text": "Friendship Park", "kind": "run"},
    {"provider": "Bertusew Runningclub", "service_name": "Bertusew Running Club",
     "starts_at": datetime(2026, 8, 30, 17, 30, tzinfo=EAT), "location_text": "Yetebaberut Square Sport Center, CMC", "kind": "run"},
    {"provider": "Sip and Serve Tennis", "service_name": "Sip and Serve Tennis",
     "starts_at": datetime(2026, 8, 29, 9, 0, tzinfo=EAT), "location_text": "Addis Sport Park, St. Urael", "kind": "tennis"},
    {"provider": "Let's Hike Ethiopia", "service_name": "Let's Hike Ethiopia",
     "starts_at": datetime(2026, 8, 30, 7, 30, tzinfo=EAT),
     "location_text": "Gullele Botanical Garden (meet: Sansuse Road)", "kind": "hike"},
    {"provider": "Guzo Adwa Hiking", "service_name": "Maru Waterfall Hike",
     "starts_at": datetime(2026, 8, 30, 6, 30, tzinfo=EAT), "location_text": "Maru Waterfall", "kind": "hike"},
    {"provider": "Zumba with Vahe", "service_name": "Zumba with Vahe",
     "starts_at": datetime(2026, 9, 2, 18, 15, tzinfo=EAT), "location_text": "SUP Studio", "kind": "dance"},
    {"provider": "Bole Burners", "service_name": "Break Your Record",
     "starts_at": datetime(2026, 9, 2, 18, 0, tzinfo=EAT), "location_text": "Riverside Park, Toto Grill parking", "kind": "run"},
    {"provider": "Satenaw Runclub", "service_name": "Satenaw Running Club",
     "starts_at": datetime(2026, 9, 2, 17, 45, tzinfo=EAT), "location_text": "Friendship Park", "kind": "run"},
    {"provider": "Ereft Ethiopia", "service_name": "Overnight Trip: Doho Lodge & Benuna Village",
     "starts_at": datetime(2026, 9, 5, 6, 0, tzinfo=EAT),
     "location_text": "Meet: Mexico, Wabi Shebele Hotel",
     "ends_at": datetime(2026, 9, 6, 18, 0, tzinfo=EAT)},
    {"provider": "Sonder Running Club", "service_name": "19km to Welcome 2019",
     "starts_at": datetime(2026, 9, 11, 6, 30, tzinfo=EAT), "location_text": "Bole Brass", "kind": "run"},
    {"provider": "Satenaw Runclub", "service_name": "Satenaw Run Club",
     "starts_at": datetime(2026, 9, 13, 6, 30, tzinfo=EAT), "location_text": "Filwuha Bridge", "kind": "run"},
    {"provider": "Bertusew Runningclub", "service_name": "Bertusew Running Club",
     "starts_at": datetime(2026, 9, 13, 6, 45, tzinfo=EAT), "location_text": "CMC Yetebaberut Adebabay", "kind": "run"},
    {"provider": "SUP Studio", "service_name": "Sup Running Community / Enitewawek",
     "starts_at": datetime(2026, 9, 13, 9, 30, tzinfo=EAT),
     "location_text": "Bole Mega, 50 m behind Makush Gallery, TM5 Apt", "kind": "run"},
    {"provider": "Zumba with Vahe", "service_name": "Zumba with Vahe",
     "starts_at": datetime(2026, 9, 14, 18, 15, tzinfo=EAT), "location_text": "Armenian Club", "kind": "dance"},
]


def resolve_provider(name: str) -> str:
    """Canonical or alias, case-insensitive. Raises ValueError on no match —
    an unrecognised host on a poster needs a human, not a silent skip."""
    needle = (name or "").strip().lower()
    for canonical, meta in PROVIDERS.items():
        if needle == canonical.lower():
            return canonical
        for alias in meta["aliases"]:
            if needle == alias.lower():
                return canonical
    raise ValueError(f"Unknown provider name: {name!r}")


def _ends_at(event: dict) -> datetime:
    if "ends_at" in event:
        return event["ends_at"]
    return event["starts_at"] + timedelta(minutes=DURATIONS[event["kind"]])


def _description(event: dict) -> str:
    where = f" at {event['location_text']}" if event.get("location_text") else ""
    return f"{event['service_name']}{where}.{PRICE_NOTE}"


def resolved_events() -> list:
    """EVENTS with `provider` normalized to its canonical name and
    `starts_at`/`ends_at` converted to UTC. Raises on an unknown provider or
    a duplicate (provider, starts_at) key within this batch."""
    out = []
    seen = set()
    for event in EVENTS:
        canonical = resolve_provider(event["provider"])
        starts_at = event["starts_at"].astimezone(timezone.utc)
        key = (canonical, starts_at)
        if key in seen:
            raise ValueError(f"duplicate (provider, starts_at) in EVENTS: {key}")
        seen.add(key)
        out.append({
            **event,
            "provider": canonical,
            "starts_at": starts_at,
            "ends_at": _ends_at(event).astimezone(timezone.utc),
            "description": _description(event),
            "price_etb": 0,
            "capacity": CAPACITY,
            "spots_remaining": CAPACITY,
        })
    return out


def superseded_keys() -> set:
    return {(canonical, dt.astimezone(timezone.utc)) for canonical, dt in
            ((resolve_provider(name), dt) for name, dt in SUPERSEDED)}


def plan_changes(existing: dict) -> dict:
    """`existing`: {(provider_canonical, starts_at_utc): row_dict} for every
    non-cancelled provider_events row currently in the DB, where row_dict
    has at least `is_cancelled` plus the same fields `resolved_events()`
    produces (service_name/description/location_text/ends_at/price_etb/
    capacity/spots_remaining) — enough to detect a no-op re-run.

    Returns {"cancel": [key, ...], "insert": [event, ...], "update": [event, ...]}.
    """
    events = resolved_events()
    event_keys = {(e["provider"], e["starts_at"]) for e in events}

    cancel = [
        key for key in superseded_keys()
        if key in existing and not existing[key].get("is_cancelled") and key not in event_keys
    ]

    insert, update = [], []
    compare_fields = ("service_name", "description", "location_text", "ends_at", "price_etb", "capacity", "spots_remaining")
    for event in events:
        key = (event["provider"], event["starts_at"])
        row = existing.get(key)
        if row is None:
            insert.append(event)
        elif row.get("is_cancelled") or any(row.get(f) != event[f] for f in compare_fields):
            update.append(event)
        # else: already applied, nothing to do — idempotent no-op.

    return {"cancel": cancel, "insert": insert, "update": update}


# ─── DB application (untested here — same psycopg2 style as the rest of
# backend/*.py seed scripts; plan_changes()/resolve_provider() above carry
# the logic the tests exercise) ──────────────────────────────────────────

PROVIDER_COLUMNS = ("name", "category", "description", "location_text", "price_range", "rating", "cover_photo_url", "services")


def _new_provider_row(canonical: str) -> dict:
    meta = PROVIDERS[canonical]
    return {
        "name": canonical,
        "category": meta["category"],
        "description": f"{canonical} — community group posted on the events/ posters.",
        "location_text": None,
        "price_range": "Price on request",
        "rating": None,
        # Left null until a cropped cover is approved — see this file's
        # module docstring and plan §15 point 9.
        "cover_photo_url": None,
        "services": [],
    }


def upsert_provider(cur, canonical: str) -> str:
    cur.execute("SELECT id FROM providers WHERE name = %s", (canonical,))
    row = cur.fetchone()
    if row:
        return row[0]

    spec = _new_provider_row(canonical)
    provider_id = str(uuid.uuid4())
    placeholders = ", ".join(["%s"] * len(PROVIDER_COLUMNS))
    cur.execute(
        f"""
        INSERT INTO providers
            (id, {", ".join(PROVIDER_COLUMNS)},
             status, onboarded_by_admin, is_featured, is_coming_soon,
             reviewed_at, created_at, updated_at)
        VALUES (%s, {placeholders}, 'active', TRUE, FALSE, TRUE, now(), now(), now())
        """,
        [provider_id] + [
            json.dumps(spec[c]) if c == "services" else spec[c] for c in PROVIDER_COLUMNS
        ],
    )
    print(f"  provider created (coming soon): {canonical} ({provider_id})")
    return provider_id


def ensure_community(cur, provider_id: str, name: str, category: str) -> None:
    cur.execute("SELECT id FROM communities WHERE provider_id = %s", (provider_id,))
    if cur.fetchone():
        return
    cur.execute(
        "INSERT INTO communities (id, provider_id, name, category, member_count, created_at) "
        "VALUES (%s, %s, %s, %s, 0, now())",
        (str(uuid.uuid4()), provider_id, name, category),
    )
    print(f"    community created: {name}")


def load_existing(cur) -> dict:
    cur.execute(
        "SELECT pe.provider_id, p.name, pe.starts_at, pe.is_cancelled, pe.service_name, "
        "pe.description, pe.location_text, pe.ends_at, pe.price_etb, pe.capacity, pe.spots_remaining "
        "FROM provider_events pe JOIN providers p ON p.id = pe.provider_id"
    )
    existing = {}
    for (provider_id, name, starts_at, is_cancelled, service_name, description,
         location_text, ends_at, price_etb, capacity, spots_remaining) in cur.fetchall():
        try:
            canonical = resolve_provider(name)
        except ValueError:
            continue
        existing[(canonical, starts_at)] = {
            "provider_id": provider_id, "is_cancelled": is_cancelled,
            "service_name": service_name, "description": description,
            "location_text": location_text, "ends_at": ends_at,
            "price_etb": price_etb, "capacity": capacity, "spots_remaining": spots_remaining,
        }
    return existing


def apply_plan(cur, plan: dict, existing: dict) -> None:
    for key in plan["cancel"]:
        row = existing[key]
        cur.execute("UPDATE provider_events SET is_cancelled = TRUE, updated_at = now() "
                    "WHERE provider_id = %s AND starts_at = %s", (row["provider_id"], key[1]))
        print(f"  cancelled: {key[0]} @ {key[1].isoformat()}")

    for event in plan["insert"] + plan["update"]:
        provider_id = upsert_provider(cur, event["provider"])
        ensure_community(cur, provider_id, event["provider"], PROVIDERS[event["provider"]]["category"])
        key = (event["provider"], event["starts_at"])
        if key in existing:
            cur.execute(
                "UPDATE provider_events SET service_name=%s, description=%s, location_text=%s, "
                "ends_at=%s, capacity=%s, spots_remaining=%s, price_etb=%s, is_cancelled=FALSE, "
                "is_boosted=TRUE, updated_at=now() WHERE provider_id=%s AND starts_at=%s",
                (event["service_name"], event["description"], event["location_text"], event["ends_at"],
                 event["capacity"], event["spots_remaining"], event["price_etb"], provider_id, key[1]),
            )
            action = "updated"
        else:
            cur.execute(
                "INSERT INTO provider_events (id, provider_id, service_name, description, location_text, "
                "starts_at, ends_at, capacity, spots_remaining, price_etb, is_cancelled, is_boosted, "
                "created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,TRUE,now(),now())",
                (str(uuid.uuid4()), provider_id, event["service_name"], event["description"], event["location_text"],
                 event["starts_at"], event["ends_at"], event["capacity"], event["spots_remaining"], event["price_etb"]),
            )
            action = "inserted"
        print(f"  event {action}: {event['service_name']} — {event['starts_at'].isoformat()}")


def main() -> int:
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
        return 1

    import psycopg2
    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()
        existing = load_existing(cur)
        plan = plan_changes(existing)

        total = len(plan["cancel"]) + len(plan["insert"]) + len(plan["update"])
        if total == 0:
            print("Nothing to change — already in the desired state.")
            return 0

        tag = "APPLY" if args.apply else "DRY RUN"
        print(f"{tag}: {len(plan['cancel'])} cancel, {len(plan['insert'])} insert, {len(plan['update'])} update")

        if args.apply:
            apply_plan(cur, plan, existing)
            conn.commit()
            print(f"Applied {total} change(s).")
        else:
            for key in plan["cancel"]:
                print(f"  would cancel: {key[0]} @ {key[1].isoformat()}")
            for event in plan["insert"]:
                print(f"  would insert: {event['provider']} — {event['service_name']} @ {event['starts_at'].isoformat()}")
            for event in plan["update"]:
                print(f"  would update: {event['provider']} — {event['service_name']} @ {event['starts_at'].isoformat()}")
            print(f"\n{total} change(s) would be applied. Re-run with --apply to write them.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
