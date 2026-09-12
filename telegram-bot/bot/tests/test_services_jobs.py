"""
Tests for bot background jobs and recurring services:
- bot.services.keep_warm (serverless ping)
- bot.services.streak_nudge (evening streak-at-risk DMs)
- bot.services.reengagement (7-day dormant user re-entry)
- bot.services.weekly_digest (Sunday circle top-scorer wrap-up)

Verifies message dispatch, API interactions, deep-link button generation,
and graceful degradation when users block the bot or backend endpoints fail.
"""

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram import InlineKeyboardMarkup
from telegram.ext import ContextTypes

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.config import BACKEND_URL
from bot.services.keep_warm import ping_backend
from bot.services.reengagement import schedule_reengagement
from bot.services.streak_nudge import send_streak_nudges
from bot.services.weekly_digest import send_weekly_digest


def _create_mock_context(bot_username="WellCircleBot"):
    """Helper to create a mock ContextTypes.DEFAULT_TYPE."""
    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)
    context.bot = MagicMock()
    context.bot.username = bot_username
    context.bot.send_message = AsyncMock()
    return context


# ==============================================================================
# 1. keep_warm
# ==============================================================================

def test_keep_warm_ping_backend_success():
    """Verify ping_backend performs GET /health with 15s timeout."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    client_inst = AsyncMock()
    client_inst.get = AsyncMock(return_value=mock_resp)

    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client_inst)
    client_context.__aexit__ = AsyncMock(return_value=None)

    context = _create_mock_context()

    with patch("bot.services.keep_warm.httpx.AsyncClient", return_value=client_context) as mock_cls:
        asyncio.run(ping_backend(context))

        mock_cls.assert_called_once_with(timeout=15, follow_redirects=True)
        client_inst.get.assert_awaited_once_with(f"{BACKEND_URL}/health")


def test_keep_warm_ping_backend_network_error():
    """Verify ping_backend catches network exceptions without failing."""
    client_inst = AsyncMock()
    client_inst.get = AsyncMock(side_effect=Exception("Connection refused"))

    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client_inst)
    client_context.__aexit__ = AsyncMock(return_value=None)

    context = _create_mock_context()

    with patch("bot.services.keep_warm.httpx.AsyncClient", return_value=client_context):
        # Must not raise
        asyncio.run(ping_backend(context))


# ==============================================================================
# 2. streak_nudge
# ==============================================================================

def test_send_streak_nudges_success():
    """Verify streak nudges are sent to users at risk with deep links."""
    users_at_risk = [
        {"telegram_id": 101, "name": "Abebe", "current_streak": 4, "freeze_count": 1},
        {"telegram_id": 102, "name": "Sara", "current_streak": 2, "freeze_count": 0},
    ]

    context = _create_mock_context(bot_username="WellCircleBot")

    with patch("bot.services.streak_nudge.get_streaks_at_risk", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = {"users": users_at_risk}

        asyncio.run(send_streak_nudges(context))

        assert context.bot.send_message.await_count == 2

        # Check call 1
        call1_kwargs = context.bot.send_message.await_args_list[0].kwargs
        assert call1_kwargs["chat_id"] == 101
        assert "4-day streak" in call1_kwargs["text"]
        assert "1 freeze" in call1_kwargs["text"]
        assert isinstance(call1_kwargs["reply_markup"], InlineKeyboardMarkup)
        assert call1_kwargs["reply_markup"].inline_keyboard[0][0].url == "https://t.me/WellCircleBot?startapp=reentry_checkin"

        # Check call 2
        call2_kwargs = context.bot.send_message.await_args_list[1].kwargs
        assert call2_kwargs["chat_id"] == 102
        assert "2-day streak" in call2_kwargs["text"]
        assert "freeze" not in call2_kwargs["text"].lower()


def test_send_streak_nudges_user_blocked_bot_handled():
    """Verify loop continues even if a user has blocked the bot."""
    users_at_risk = [
        {"telegram_id": 201, "name": "BlockedUser", "current_streak": 3, "freeze_count": 0},
        {"telegram_id": 202, "name": "ActiveUser", "current_streak": 5, "freeze_count": 1},
    ]

    context = _create_mock_context(bot_username="WellCircleBot")
    # First user throws (blocked), second succeeds
    context.bot.send_message = AsyncMock(side_effect=[Exception("Forbidden: bot was blocked by the user"), None])

    with patch("bot.services.streak_nudge.get_streaks_at_risk", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = {"users": users_at_risk}

        asyncio.run(send_streak_nudges(context))

        assert context.bot.send_message.await_count == 2


def test_send_streak_nudges_api_failure():
    """Verify failure to fetch streaks at risk logs and degrades cleanly."""
    context = _create_mock_context()

    with patch("bot.services.streak_nudge.get_streaks_at_risk", new_callable=AsyncMock) as mock_api:
        mock_api.side_effect = Exception("Backend timeout")

        asyncio.run(send_streak_nudges(context))
        context.bot.send_message.assert_not_called()


# ==============================================================================
# 3. reengagement
# ==============================================================================

def test_schedule_reengagement_promo_and_generic():
    """Verify re-engagement sends promo-aware or generic nudges and marks sent."""
    inactive_users = [
        # Promo user
        {
            "telegram_id": 301,
            "name": "Meron",
            "days_inactive": 8,
            "promo": {
                "provider_id": "p-100",
                "provider_name": "Kuriftu Resort & Spa",
                "headline": "20% off massage",
                "discount_pct": 20,
                "valid_until": "2026-09-30T23:59:59Z",
            },
        },
        # Generic user
        {
            "telegram_id": 302,
            "name": "Dawit",
            "days_inactive": 10,
            "promo": None,
        },
    ]

    context = _create_mock_context(bot_username="WellCircleBot")

    with patch("bot.services.reengagement.get_inactive_users", new_callable=AsyncMock) as mock_get_users, \
         patch("bot.services.reengagement.mark_reengagement_sent", new_callable=AsyncMock) as mock_mark_sent:

        mock_get_users.return_value = {"inactive_users": inactive_users}

        asyncio.run(schedule_reengagement(context))

        assert context.bot.send_message.await_count == 2
        assert mock_mark_sent.await_count == 2
        mock_mark_sent.assert_any_await(301)
        mock_mark_sent.assert_any_await(302)

        # Promo message checks
        promo_call = context.bot.send_message.await_args_list[0].kwargs
        assert promo_call["chat_id"] == 301
        assert "20% off" in promo_call["text"]
        assert "Kuriftu Resort & Spa" in promo_call["text"]
        assert "reentry_promo_p-100" in promo_call["reply_markup"].inline_keyboard[0][0].url

        # Generic message checks
        generic_call = context.bot.send_message.await_args_list[1].kwargs
        assert generic_call["chat_id"] == 302
        assert "We miss you at Well Circle" in generic_call["text"]
        assert generic_call["reply_markup"] is None


def test_schedule_reengagement_send_failure_skips_mark_sent():
    """Verify mark_reengagement_sent is not called if message delivery fails."""
    inactive_users = [
        {"telegram_id": 303, "name": "BlockedUser", "promo": None},
    ]

    context = _create_mock_context(bot_username="WellCircleBot")
    context.bot.send_message.side_effect = Exception("Bot blocked")

    with patch("bot.services.reengagement.get_inactive_users", new_callable=AsyncMock) as mock_get_users, \
         patch("bot.services.reengagement.mark_reengagement_sent", new_callable=AsyncMock) as mock_mark_sent:

        mock_get_users.return_value = {"inactive_users": inactive_users}

        asyncio.run(schedule_reengagement(context))

        context.bot.send_message.assert_awaited_once()
        mock_mark_sent.assert_not_called()


# ==============================================================================
# 4. weekly_digest
# ==============================================================================

def test_send_weekly_digest_success():
    """Verify Sunday digest formats top scorer and DMs all circle members."""
    circles_data = [
        {
            "circle_name": "Bole Yoga Tribe",
            "top_scorer_name": "Bethlehem",
            "top_scorer_points": 85,
            "member_telegram_ids": [401, 402],
        },
        {
            "circle_name": "Entoto Trail Walkers",
            "top_scorer_name": "Ermias",
            "top_scorer_points": 110,
            "member_telegram_ids": [403],
        },
    ]

    context = _create_mock_context()

    with patch("bot.services.weekly_digest.get_circle_digests", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = {"circles": circles_data}

        asyncio.run(send_weekly_digest(context))

        # 2 members in circle 1 + 1 member in circle 2 = 3 DMs
        assert context.bot.send_message.await_count == 3

        # Call 1 & 2 (Circle 1)
        call1 = context.bot.send_message.await_args_list[0].kwargs
        assert call1["chat_id"] == 401
        assert "Bole Yoga Tribe" in call1["text"]
        assert "Bethlehem topped your circle with 85 pts" in call1["text"]

        call2 = context.bot.send_message.await_args_list[1].kwargs
        assert call2["chat_id"] == 402

        # Call 3 (Circle 2)
        call3 = context.bot.send_message.await_args_list[2].kwargs
        assert call3["chat_id"] == 403
        assert "Entoto Trail Walkers" in call3["text"]
        assert "Ermias topped your circle with 110 pts" in call3["text"]


def test_send_weekly_digest_blocked_member_handled():
    """Verify loop handles blocked members gracefully and messages the rest."""
    circles_data = [
        {
            "circle_name": "Bole Yoga Tribe",
            "top_scorer_name": "Bethlehem",
            "top_scorer_points": 85,
            "member_telegram_ids": [501, 502],
        },
    ]

    context = _create_mock_context()
    context.bot.send_message.side_effect = [Exception("User blocked bot"), None]

    with patch("bot.services.weekly_digest.get_circle_digests", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = {"circles": circles_data}

        asyncio.run(send_weekly_digest(context))

        assert context.bot.send_message.await_count == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
