"""
Well Circle — set_boston_only_live.py plan_updates() tests (Phase 23, WS5).
Run: cd backend && python -m app.tests.test_set_boston_only_live

Pure-function tests, no DB needed: plan_updates() just takes
(id, name, is_coming_soon) rows and returns what should change.
"""
import sys

sys.path.insert(0, ".")  # repo root's set_boston_only_live.py, not app/
from set_boston_only_live import plan_updates


def test_all():
    print("=" * 50)
    print("  SET BOSTON ONLY LIVE — plan_updates() TESTS")
    print("=" * 50)

    # 1. Exactly one Boston match, everyone else already live -> flips
    #    everyone except Boston to coming-soon.
    providers = [
        ("boston-id", "Boston Day Spa", False),
        ("p1", "Lifestyle Fitness Center", False),
        ("p2", "Shanti Yoga Addis", False),
    ]
    boston_id, changes = plan_updates(providers)
    assert boston_id == "boston-id"
    assert {(c[0], c[3]) for c in changes} == {("p1", True), ("p2", True)}
    print("   ✅ flips every non-Boston provider to coming_soon=True")

    # 2. Already in the desired state -> no changes (idempotent).
    providers2 = [
        ("boston-id", "Boston Day Spa", False),
        ("p1", "Lifestyle Fitness Center", True),
        ("p2", "Shanti Yoga Addis", True),
    ]
    boston_id2, changes2 = plan_updates(providers2)
    assert changes2 == []
    print("   ✅ a second run against the post-apply state plans nothing")

    # 3. Matches by 'kuriftu' too (the row's original name before the
    #    seed_boston_day_spa.py rename).
    providers3 = [("k-id", "Kuriftu Resort & Spa", False), ("p1", "Other Gym", False)]
    boston_id3, changes3 = plan_updates(providers3)
    assert boston_id3 == "k-id"
    print("   ✅ 'kuriftu' in the name also matches")

    # 4. Zero matches -> aborts (not seeded yet).
    try:
        plan_updates([("p1", "Some Gym", False), ("p2", "Some Spa", False)])
        raise AssertionError("expected ValueError for zero Boston matches")
    except ValueError as exc:
        assert "found 0" in str(exc)
    print("   ✅ zero Boston matches aborts with ValueError")

    # 5. Two matches -> aborts (ambiguous).
    try:
        plan_updates([
            ("a", "Boston Day Spa Downtown", False),
            ("b", "Boston Day Spa Bole", False),
        ])
        raise AssertionError("expected ValueError for ambiguous Boston matches")
    except ValueError as exc:
        assert "found 2" in str(exc)
    print("   ✅ two Boston matches aborts with ValueError")

    # 6. Boston itself already coming_soon=True gets flipped back to live too.
    providers6 = [("boston-id", "Boston Day Spa", True), ("p1", "Other", False)]
    _, changes6 = plan_updates(providers6)
    assert ("boston-id", "Boston Day Spa", True, False) in changes6
    print("   ✅ Boston itself is corrected to is_coming_soon=False if needed")

    print("=" * 50)
    print("  ALL set_boston_only_live TESTS PASSED")
    print("=" * 50)


if __name__ == "__main__":
    test_all()
