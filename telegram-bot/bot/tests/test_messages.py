"""
Tests for bot.utils.messages and bot.utils.keyboards.

Verifies copy formatting, variable interpolation, pluralization,
and inline keyboard construction for the Mini App launch button.
"""

import sys
import pytest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.config import MINI_APP_URL
from bot.utils import keyboards, messages


def test_welcome_message_formatting():
    """Verify WELCOME_MESSAGE renders user name and expected value props."""
    rendered = messages.WELCOME_MESSAGE.format(name="Yoni")
    assert "<b>Welcome to Well Circle, Yoni!</b>" in rendered
    assert "Discover wellness providers" in rendered
    assert "Join community circles" in rendered
    assert "Legacy Points" in rendered
    assert "Book and pay" in rendered


def test_reengagement_message_formatting():
    """Verify dormant user re-engagement message."""
    rendered = messages.REENGAGEMENT_MESSAGE.format(name="Meron")
    assert "Hey Meron!" in rendered
    assert "points paused while you were away" in rendered
    assert "Tap /start to jump back in" in rendered


def test_streak_nudge_with_and_without_freezes():
    """Verify streak nudge formatting for singular, plural, and zero freezes."""
    # Singular freeze
    single_freeze = messages.STREAK_NUDGE_FREEZE_LINE.format(freeze_count=1, plural="")
    assert "1 freeze if life gets in the way" in single_freeze
    rendered_single = messages.STREAK_NUDGE_MESSAGE.format(
        name="Abebe", streak=3, freeze_line=single_freeze
    )
    assert "3-day streak" in rendered_single
    assert "1 freeze if life gets in the way" in rendered_single
    assert "Progress over perfection" in rendered_single

    # Plural freezes
    plural_freeze = messages.STREAK_NUDGE_FREEZE_LINE.format(freeze_count=2, plural="s")
    assert "2 freezes if life gets in the way" in plural_freeze
    rendered_plural = messages.STREAK_NUDGE_MESSAGE.format(
        name="Abebe", streak=10, freeze_line=plural_freeze
    )
    assert "10-day streak" in rendered_plural
    assert "2 freezes if life gets in the way" in rendered_plural

    # Zero freezes (empty string injected)
    rendered_no_freeze = messages.STREAK_NUDGE_MESSAGE.format(
        name="Abebe", streak=1, freeze_line=""
    )
    assert "freeze" not in rendered_no_freeze.lower()
    assert messages.STREAK_NUDGE_BUTTON == "✨ Check in now"


def test_reengagement_promo_message_and_button():
    """Verify promo re-engagement copy and action button text."""
    rendered = messages.REENGAGEMENT_PROMO_MESSAGE.format(
        name="Sara",
        headline="Exclusive Welcome Back Offer",
        discount_pct=25,
        provider_name="Boston Day Spa",
        expires_on="Sun, Sep 20",
    )
    assert "Hey Sara!" in rendered
    assert "Exclusive Welcome Back Offer" in rendered
    assert "25% off" in rendered
    assert "Boston Day Spa" in rendered
    assert "expires on Sun, Sep 20" in rendered

    btn_text = messages.REENGAGEMENT_PROMO_BUTTON.format(discount_pct=25)
    assert btn_text == "🏷 Claim 25% off"


def test_evidence_messages():
    """Verify evidence submission copy for staff workflows."""
    assert "You're not the designated staff" in messages.NO_STAFF_EVENTS_MESSAGE
    assert "proof of participation" in messages.EVIDENCE_ASK_PHOTO_MESSAGE
    assert "That's not a photo" in messages.EVIDENCE_NOT_A_PHOTO_MESSAGE
    assert "cancelled" in messages.EVIDENCE_CANCELLED_MESSAGE.lower()

    submitted = messages.EVIDENCE_SUBMITTED_MESSAGE.format(event_name="Sunset Vinyasa Yoga")
    assert "<b>Sunset Vinyasa Yoga</b>" in submitted
    assert "admin will review it" in submitted


def test_weekly_digest_message():
    """Verify weekly circle wrap-up digest format."""
    rendered = messages.WEEKLY_DIGEST_MESSAGE.format(
        circle_name="Addis Morning Runners",
        top_scorer="Dawit",
        top_points=120,
    )
    assert "<b>Addis Morning Runners</b> — weekly wrap-up" in rendered
    assert "Dawit topped your circle with 120 pts" in rendered
    assert "leaderboard" in rendered.lower()


def test_open_app_keyboard():
    """Verify get_open_app_keyboard returns an InlineKeyboardMarkup with WebAppInfo."""
    kb = keyboards.get_open_app_keyboard()
    assert len(kb.inline_keyboard) == 1
    assert len(kb.inline_keyboard[0]) == 1

    button = kb.inline_keyboard[0][0]
    assert button.text == "🟢 Open Well Circle"
    assert button.web_app is not None
    assert button.web_app.url == MINI_APP_URL


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
