"""The bot credits the pin offer once and handles repeat taps plainly."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from bot.handlers.pin_bonus import pin_bonus_callback


def _callback_update():
    update = MagicMock()
    update.effective_chat.type = "private"
    update.effective_user.id = 123
    update.effective_user.username = "wellcircle_user"
    update.callback_query.answer = AsyncMock()
    update.callback_query.message.reply_text = AsyncMock()
    return update


def test_pin_bonus_claim_and_repeat():
    with patch("bot.handlers.pin_bonus.register_user", new_callable=AsyncMock), patch(
        "bot.handlers.pin_bonus.claim_pin_bot_bonus", new_callable=AsyncMock
    ) as claim:
        claim.side_effect = [
            {"awarded": True, "points_awarded": 200, "points_balance": 220},
            {"awarded": False, "points_awarded": 0, "points_balance": 220},
        ]
        first = _callback_update()
        asyncio.run(pin_bonus_callback(first, MagicMock()))
        assert "200 Legacy Points added" in first.callback_query.message.reply_text.await_args.args[0]

        repeat = _callback_update()
        asyncio.run(pin_bonus_callback(repeat, MagicMock()))
        assert "already claimed" in repeat.callback_query.message.reply_text.await_args.args[0]
        assert claim.await_count == 2
