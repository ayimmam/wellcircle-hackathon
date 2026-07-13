"""
Re-entry nudge builder tests (Biniyam sprint) — pure stdlib, no Telegram deps.
Run: cd telegram-bot && python -m bot.tests.test_nudges
"""
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.utils.nudges import build_reengagement_nudge, build_streak_nudge, _format_expiry


PROMO_USER = {
    "telegram_id": 111,
    "name": "Meron",
    "days_inactive": 9,
    "promo": {
        "provider_id": "aaaaaaaa-0000-0000-0000-000000000001",
        "provider_name": "Kuriftu Resort & Spa",
        "headline": "Presale: 20% off your first visit",
        "discount_pct": 20,
        "valid_until": "2026-07-26T23:59:59+00:00",
    },
}


def test_all():
    print("=" * 50)
    print("  WELL CIRCLE — RE-ENTRY NUDGE TESTS")
    print("=" * 50)

    # 1. Generic nudge when no promo
    nudge = build_reengagement_nudge({"name": "Meron", "promo": None}, bot_username="WellCircleBot")
    assert "We miss you" in nudge["text"]
    assert "Meron" in nudge["text"]
    assert nudge["deep_link"] is None
    assert nudge["button_text"] is None
    print("   ✅ generic nudge when no promo")

    # 2. Promo without a discount → still generic (nothing to redeem)
    nudge = build_reengagement_nudge(
        {"name": "Meron", "promo": {"headline": "Hi", "discount_pct": None}},
        bot_username="WellCircleBot",
    )
    assert nudge["deep_link"] is None
    print("   ✅ promo without discount falls back to generic")

    # 3. Promo-aware nudge references discount, provider, and expiry
    nudge = build_reengagement_nudge(PROMO_USER, bot_username="WellCircleBot")
    assert "20% off" in nudge["text"]
    assert "Kuriftu Resort & Spa" in nudge["text"]
    assert "before it expires" in nudge["text"]
    assert "Jul 26" in nudge["text"]
    assert nudge["button_text"] == "🏷 Claim 20% off"
    print("   ✅ promo nudge mentions discount, provider, expiry")

    # 4. Deep link carries the reentry_promo start_param
    assert nudge["deep_link"] == (
        "https://t.me/WellCircleBot?startapp=reentry_promo_aaaaaaaa-0000-0000-0000-000000000001"
    )
    print("   ✅ deep link uses reentry_promo_{provider_id} start_param")

    # 5. No bot username → promo text but no link (bot can't build t.me URL)
    nudge = build_reengagement_nudge(PROMO_USER, bot_username=None)
    assert "20% off" in nudge["text"]
    assert nudge["deep_link"] is None
    print("   ✅ missing bot username degrades to text-only nudge")

    # 6. Expiry formatting is defensive
    assert _format_expiry("2026-07-26T23:59:59Z") == "Sun, Jul 26"
    assert _format_expiry(None) == "soon"
    assert _format_expiry("not-a-date") == "soon"
    print("   ✅ expiry formatting (ISO, Z-suffix, garbage, None)")

    # 7. Missing name still renders
    nudge = build_reengagement_nudge({"promo": None})
    assert "there" in nudge["text"]
    print("   ✅ missing name falls back to 'there'")

    # 8. Streak nudge: loss-aversion copy with freezes surfaced
    nudge = build_streak_nudge(
        {"name": "Meron", "current_streak": 6, "freeze_count": 2},
        bot_username="WellCircleBot",
    )
    assert "6-day streak" in nudge["text"]
    assert "2 freezes" in nudge["text"]
    assert "Progress over perfection" in nudge["text"]
    assert nudge["button_text"] == "✨ Check in now"
    assert nudge["deep_link"] == "https://t.me/WellCircleBot?startapp=reentry_checkin"
    print("   ✅ streak nudge mentions streak, freezes, ethical copy, deep link")

    # 9. Streak nudge without freezes omits the freeze line; singular freeze
    nudge = build_streak_nudge({"name": "Meron", "current_streak": 3, "freeze_count": 0})
    assert "freeze" not in nudge["text"].lower()
    assert nudge["deep_link"] is None  # no bot username → text-only
    nudge = build_streak_nudge({"name": "Meron", "current_streak": 3, "freeze_count": 1})
    assert "1 freeze " in nudge["text"] or "1 freeze " in nudge["text"] or "1 freeze" in nudge["text"]
    assert "1 freezes" not in nudge["text"]
    print("   ✅ freeze line omitted at zero, singular at one")

    print("\n" + "=" * 50)
    print("  ALL NUDGE TESTS PASSED ✅")
    print("=" * 50)


if __name__ == "__main__":
    test_all()
