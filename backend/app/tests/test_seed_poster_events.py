"""
Well Circle — seed_upcoming_events.py poster-event tests (Phase 23, WS6).
Run: cd backend && python -m app.tests.test_seed_poster_events

Pure-function tests, no DB: resolve_provider()/resolved_events()/
plan_changes() just take plain data in and return plans out.
"""
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")  # repo root's seed_upcoming_events.py, not app/
from seed_upcoming_events import (
    PROVIDERS, SUPERSEDED, resolve_provider, resolved_events, plan_changes,
    CAPACITY,
)

EAT = timezone(timedelta(hours=3))


def test_all():
    print("=" * 50)
    print("  SEED POSTER EVENTS TESTS")
    print("=" * 50)

    # === 1. Every alias resolves to its canonical name; unknown names raise
    print("\n1. Alias resolution")
    for canonical, meta in PROVIDERS.items():
        assert resolve_provider(canonical) == canonical
        for alias in meta["aliases"]:
            assert resolve_provider(alias) == canonical
        # Case-insensitive.
        assert resolve_provider(canonical.upper()) == canonical
    try:
        resolve_provider("Some Random Club Nobody Posted")
        raise AssertionError("expected ValueError for an unknown provider")
    except ValueError:
        pass
    print(f"   ✅ every alias across {len(PROVIDERS)} canonical providers resolves; unknown names raise")

    # === 2. 24 rows, no duplicate (provider, starts_at), all tz-aware EAT-derived
    print("\n2. Final event list shape")
    events = resolved_events()
    assert len(events) == 24, len(events)
    keys = [(e["provider"], e["starts_at"]) for e in events]
    assert len(keys) == len(set(keys)), "duplicate (provider, starts_at) in resolved_events()"
    for e in events:
        assert e["starts_at"].tzinfo is not None
        assert e["ends_at"] > e["starts_at"]
    print("   ✅ 24 rows, no duplicate (provider, starts_at), every starts_at timezone-aware")

    # === 3. Superseded rows are exactly the three listed; Bertusew Aug 23
    #        07:00 is an update, not an insert (shares its key with an event).
    print("\n3. Superseded rows and the Bertusew update-not-insert case")
    assert len(SUPERSEDED) == 3
    superseded_names = {name for name, _ in SUPERSEDED}
    assert superseded_names == {"AfroHeat Fitness", "Bole Burners", "Satenaw Runclub"}

    bertusew_aug23 = (
        resolve_provider("Bertusew Runningclub"),
        datetime(2026, 8, 23, 7, 0, tzinfo=EAT).astimezone(timezone.utc),
    )
    assert bertusew_aug23 in keys, "Bertusew Aug 23 07:00 must be one of the 24 resolved events"
    assert bertusew_aug23 not in {
        (resolve_provider(n), dt.astimezone(timezone.utc)) for n, dt in SUPERSEDED
    }
    print("   ✅ exactly 3 superseded rows; Bertusew's Aug 23 07:00 key is shared with an event, not cancelled")

    # === 4. plan_changes() against an empty DB inserts everything, cancels
    #        the 3 superseded rows that exist as live, and a re-run against
    #        the applied state plans nothing (idempotency).
    print("\n4. plan_changes() — empty DB, then idempotent re-run")
    existing_empty = {
        (resolve_provider(name), dt.astimezone(timezone.utc)): {"is_cancelled": False}
        for name, dt in SUPERSEDED
    }
    # Bertusew's pre-existing Aug 23 07:00 row, distinct fields so it's
    # detected as needing an update the first time through.
    existing_empty[bertusew_aug23] = {
        "is_cancelled": False, "service_name": "CMC Morning Run", "description": "old",
        "location_text": "old", "ends_at": datetime(2026, 8, 23, 8, 30, tzinfo=timezone.utc),
        "price_etb": 0, "capacity": CAPACITY, "spots_remaining": 26,
    }

    plan1 = plan_changes(existing_empty)
    assert set(plan1["cancel"]) == set(existing_empty.keys()) - {bertusew_aug23}
    assert len(plan1["insert"]) == 23, len(plan1["insert"])  # 24 events minus the 1 pre-existing update
    assert len(plan1["update"]) == 1
    assert plan1["update"][0]["provider"] == resolve_provider("Bertusew Runningclub")
    print(f"   ✅ empty-DB plan: {len(plan1['cancel'])} cancel, {len(plan1['insert'])} insert, {len(plan1['update'])} update")

    # Simulate applying plan1: build the post-seed `existing` state and
    # confirm a second plan_changes() call against it is a no-op.
    post_seed = {}
    for key in plan1["cancel"]:
        post_seed[key] = {**existing_empty[key], "is_cancelled": True}
    for event in plan1["insert"] + plan1["update"]:
        key = (event["provider"], event["starts_at"])
        post_seed[key] = {
            "is_cancelled": False, "service_name": event["service_name"],
            "description": event["description"], "location_text": event["location_text"],
            "ends_at": event["ends_at"], "price_etb": event["price_etb"],
            "capacity": event["capacity"], "spots_remaining": event["spots_remaining"],
        }
    plan2 = plan_changes(post_seed)
    assert plan2 == {"cancel": [], "insert": [], "update": []}
    print("   ✅ a second run against the post-seed state plans nothing")

    # === 5. All new providers are is_coming_soon-eligible (per PROVIDERS'
    #        exists=False), all prices 0 with the "Confirm price" description.
    print("\n5. New-provider flagging and price/description convention")
    new_providers = {name for name, meta in PROVIDERS.items() if not meta["exists"]}
    assert len(new_providers) == 10, sorted(new_providers)
    for e in events:
        assert e["price_etb"] == 0
        assert e["description"].endswith("Confirm price with the host.")
    print(f"   ✅ {len(new_providers)} new providers flagged; every event is price_etb=0 with the confirm-price description")

    # === 6. No event has spots_remaining < capacity ======================
    print("\n6. No invented attendance")
    for e in events:
        assert e["spots_remaining"] == e["capacity"] == CAPACITY
    print("   ✅ every event seeds at full capacity, no invented attendance")

    print("\n" + "=" * 50)
    print("  ALL SEED POSTER EVENTS TESTS PASSED ✅")
    print("=" * 50)


if __name__ == "__main__":
    test_all()
