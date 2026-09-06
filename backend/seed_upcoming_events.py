"""Seed the four community events from the August 2026 "Upcoming Wellness
Events" poster (docs/upcoming.png), plus the four clubs that host them.

None of the hosts existed as providers, so each event gets a real provider
row (and its community) rather than hanging off an umbrella "Well Circle
Events" account — that way the feed's event banner and the Past-tab recap
both carry the club's own name and link somewhere real.

Nothing here needs a "move it to past" job: /events and the For You feed
split upcoming vs. past by comparing starts_at to now (see
app/api/events.py query_upcoming_events / query_past_events), so once a
session's start time passes it stops being bookable and starts showing as a
recap with an attendee count on its own.

Idempotent — matches providers by name and events by (provider, starts_at),
so re-running updates in place instead of duplicating.

Raw psycopg2 rather than the ORM, matching seed_kuriftu_placeholder.py and
seed_boston_day_spa.py: importing app.database pulls in app.config, whose
Settings demands TELEGRAM_BOT_TOKEN and JWT_SECRET that a data seed has no
use for. Only DATABASE_URL is needed here.

Usage: cd backend && DATABASE_URL=... python seed_upcoming_events.py
"""
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv

load_dotenv()

# The poster prints local Addis Ababa times; starts_at is timezone-aware, so
# convert once here rather than leaving naive datetimes for the API to guess at.
EAT = timezone(timedelta(hours=3))

CAPACITY = 50

# (provider, event) pairs, in poster order.
#
# `spots_remaining` is seeded below capacity so the card isn't a wall of
# untouched inventory pre-event, and so the recap has a believable
# attendee_count (capacity - spots_remaining) the moment the session passes.
SEED = [
    {
        "provider": {
            "name": "AfroHeat Fitness",
            "category": "gym",
            "description": (
                "Dance-fitness studio in Welo Sefer running high-energy Zumba "
                "and cardio sessions for the Addis wellness community."
            ),
            "location_text": "Welo Sefer, Addis Ababa",
            "price_range": "ETB 1,000",
            "rating": 4.8,
            "cover_photo_url": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
            "services": [{"name": "Zumba Class", "price": 1000, "duration": "60 min"}],
        },
        "community_name": "AfroHeat Crew",
        "event": {
            "service_name": "Zumba with Vahe",
            "description": (
                "High-energy Zumba session with Vahe at AfroHeat Fitness, "
                "Welo Sefer, Addis Ababa, Ethiopia."
            ),
            "starts_at": datetime(2026, 8, 20, 18, 15, tzinfo=EAT),
            "duration_minutes": 60,
            "price_etb": 1000,
            "spots_remaining": 18,
        },
    },
    {
        "provider": {
            "name": "Bole Burners",
            "category": "running",
            "description": (
                "Free community run club meeting at Riverside Park for early "
                "morning group runs around Bole."
            ),
            "location_text": "Riverside Park, Addis Ababa",
            "price_range": "Free",
            "rating": 4.7,
            "cover_photo_url": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800",
            "services": [{"name": "Group Run", "price": 0, "duration": "90 min"}],
        },
        "community_name": "Bole Burners",
        "event": {
            "service_name": "Riverside Park Morning Run",
            "description": "Free morning group run with Bole Burners at Riverside Park, Addis Ababa.",
            "starts_at": datetime(2026, 8, 22, 6, 0, tzinfo=EAT),
            "duration_minutes": 90,
            "price_etb": 0,
            "spots_remaining": 20,
        },
    },
    {
        "provider": {
            "name": "Satenaw Runclub",
            "category": "running",
            "description": (
                "Riverside run club meeting at the Filwuha bridge for free "
                "weekend morning runs."
            ),
            "location_text": "Riverside, Filwuha bridge, Addis Ababa",
            "price_range": "Free",
            "rating": 4.8,
            "cover_photo_url": "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800",
            "services": [{"name": "Group Run", "price": 0, "duration": "90 min"}],
        },
        "community_name": "Satenaw Runclub",
        "event": {
            "service_name": "Filwuha Bridge Morning Run",
            "description": (
                "Free morning group run with Satenaw Runclub, starting at the "
                "Filwuha bridge, Riverside."
            ),
            "starts_at": datetime(2026, 8, 23, 6, 30, tzinfo=EAT),
            "duration_minutes": 90,
            "price_etb": 0,
            "spots_remaining": 12,
        },
    },
    {
        "provider": {
            "name": "Bertusew Runningclub",
            "category": "running",
            "description": (
                "CMC-based running club meeting at Yetebaberut Square Sport "
                "Center for free group runs."
            ),
            "location_text": "Yetebaberut Square Sport Center, CMC, Addis Ababa",
            "price_range": "Free",
            "rating": 4.6,
            "cover_photo_url": "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800",
            "services": [{"name": "Group Run", "price": 0, "duration": "90 min"}],
        },
        "community_name": "Bertusew Runningclub",
        "event": {
            "service_name": "CMC Morning Run",
            "description": (
                "Free morning group run with Bertusew Runningclub from "
                "Yetebaberut Square Sport Center, CMC, Addis Ababa."
            ),
            "starts_at": datetime(2026, 8, 23, 7, 0, tzinfo=EAT),
            "duration_minutes": 90,
            "price_etb": 0,
            "spots_remaining": 26,
        },
    },
]

PROVIDER_COLUMNS = (
    "name", "category", "description", "location_text",
    "price_range", "rating", "cover_photo_url", "services",
)


def upsert_provider(cur, spec: dict) -> str:
    values = dict(spec)
    values["services"] = json.dumps(values["services"])

    cur.execute("SELECT id FROM providers WHERE name = %s", (spec["name"],))
    row = cur.fetchone()

    if row:
        provider_id = row[0]
        assignments = ", ".join(f"{c} = %s" for c in PROVIDER_COLUMNS)
        cur.execute(
            f"UPDATE providers SET {assignments}, updated_at = now() WHERE id = %s",
            [values[c] for c in PROVIDER_COLUMNS] + [provider_id],
        )
        action = "updated"
    else:
        provider_id = str(uuid.uuid4())
        placeholders = ", ".join(["%s"] * len(PROVIDER_COLUMNS))
        cur.execute(
            f"""
            INSERT INTO providers
                (id, {", ".join(PROVIDER_COLUMNS)},
                 status, onboarded_by_admin, is_featured, is_coming_soon,
                 reviewed_at, created_at, updated_at)
            VALUES (%s, {placeholders},
                    'active', TRUE, FALSE, FALSE,
                    now(), now(), now())
            """,
            # These are real clubs whose sessions are open to walk-ups, so they
            # go live immediately — is_coming_soon would 400 every booking
            # attempt from the feed's event banner (app/api/bookings.py).
            [provider_id] + [values[c] for c in PROVIDER_COLUMNS],
        )
        action = "created"

    print(f"  provider {action}: {spec['name']} ({provider_id})")
    return provider_id


def ensure_community(cur, provider_id: str, name: str, category: str) -> None:
    cur.execute("SELECT id FROM communities WHERE provider_id = %s", (provider_id,))
    if cur.fetchone():
        return
    cur.execute(
        """
        INSERT INTO communities (id, provider_id, name, category, member_count, created_at)
        VALUES (%s, %s, %s, %s, 0, now())
        """,
        (str(uuid.uuid4()), provider_id, name, category),
    )
    print(f"    community created: {name}")


def upsert_event(cur, provider_id: str, spec: dict) -> None:
    starts_at = spec["starts_at"].astimezone(timezone.utc)
    ends_at = starts_at + timedelta(minutes=spec["duration_minutes"])

    cur.execute(
        "SELECT id FROM provider_events WHERE provider_id = %s AND starts_at = %s",
        (provider_id, starts_at),
    )
    row = cur.fetchone()

    # is_boosted is what puts an event into the For You feed's event pool —
    # see app/services/feed_service.py _build_event_items (boosted_only=True).
    if row:
        cur.execute(
            """
            UPDATE provider_events
               SET service_name = %s, description = %s, ends_at = %s,
                   capacity = %s, spots_remaining = %s, price_etb = %s,
                   is_cancelled = FALSE, is_boosted = TRUE, updated_at = now()
             WHERE id = %s
            """,
            (
                spec["service_name"], spec["description"], ends_at,
                CAPACITY, spec["spots_remaining"], spec["price_etb"], row[0],
            ),
        )
        action = "updated"
    else:
        cur.execute(
            """
            INSERT INTO provider_events
                (id, provider_id, service_name, description, starts_at, ends_at,
                 capacity, spots_remaining, price_etb, is_cancelled, is_boosted,
                 created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, TRUE, now(), now())
            """,
            (
                str(uuid.uuid4()), provider_id, spec["service_name"], spec["description"],
                starts_at, ends_at, CAPACITY, spec["spots_remaining"], spec["price_etb"],
            ),
        )
        action = "created"

    when = "upcoming" if starts_at > datetime.now(timezone.utc) else "past"
    print(f"  event {action}: {spec['service_name']} — {starts_at.isoformat()} ({when})")


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set (put it in backend/.env or pass it inline).")
        return 1

    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()
        for entry in SEED:
            provider_id = upsert_provider(cur, entry["provider"])
            ensure_community(cur, provider_id, entry["community_name"], entry["provider"]["category"])
            upsert_event(cur, provider_id, entry["event"])
        conn.commit()
        print(f"\nSeeded {len(SEED)} providers and {len(SEED)} events from docs/upcoming.png.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
