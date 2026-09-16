"""
Tests for bot.handlers.start — covers /start handling and background registration.

Verifies:
- User presence validation and fallbacks (first_name -> username -> User <id>)
- Mini App WebApp button and HTML message reply
- Background registration task creation
- Profile photo retrieval and backend proxy URL construction
- Graceful degradation when photo fetch fails or backend API returns errors
"""

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram import InlineKeyboardMarkup, Update, User
from telegram.ext import ContextTypes

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.config import BACKEND_URL, MINI_APP_URL
from bot.handlers.start import _register_in_background, start_handler


def _create_mock_update_and_context(first_name="Yoni", username="yoni_dev", user_id=12345):
    """Helper to construct mock Telegram Update and Context objects."""
    update = MagicMock(spec=Update)
    message = AsyncMock()
    update.message = message

    if user_id is not None:
        user = MagicMock(spec=User)
        user.id = user_id
        user.first_name = first_name
        user.username = username
        user.get_profile_photos = AsyncMock()
        update.effective_user = user
    else:
        update.effective_user = None

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)
    context.application = MagicMock()
    context.application.create_task = MagicMock()

    return update, context


def test_start_handler_no_effective_user():
    """Verify handler terminates cleanly when effective_user is None."""
    update, context = _create_mock_update_and_context(user_id=None)

    asyncio.run(start_handler(update, context))

    update.message.reply_text.assert_not_called()
    context.application.create_task.assert_not_called()


def test_start_handler_success_with_first_name():
    """Verify welcome text, WebApp keyboard, and background task scheduling."""
    update, context = _create_mock_update_and_context(
        first_name="Yoni", username="yoni_dev", user_id=98765
    )

    fake_task = MagicMock()
    with patch(
        "bot.handlers.start._register_in_background",
        new_callable=MagicMock,
        return_value=fake_task,
    ) as mock_bg:
        asyncio.run(start_handler(update, context))

        update.message.reply_text.assert_awaited_once()
        call_kwargs = update.message.reply_text.await_args.kwargs
        assert "Welcome to Well Circle, Yoni!" in call_kwargs["text"]
        assert call_kwargs["parse_mode"] == "HTML"

        reply_markup = call_kwargs["reply_markup"]
        assert isinstance(reply_markup, InlineKeyboardMarkup)
        button = reply_markup.inline_keyboard[0][0]
        assert button.text == "🟢 Open Well Circle"
        assert button.web_app.url == MINI_APP_URL

        mock_bg.assert_called_once_with(98765, "yoni_dev", update.effective_user)
        context.application.create_task.assert_called_once_with(fake_task)


def test_start_handler_name_fallbacks():
    """Verify fallback to username or User <id> when first_name is missing."""
    with patch("bot.handlers.start._register_in_background", new_callable=MagicMock):
        # Fallback to username
        update, context = _create_mock_update_and_context(
            first_name=None, username="meron_runner", user_id=111
        )
        asyncio.run(start_handler(update, context))
        text = update.message.reply_text.await_args.kwargs["text"]
        assert "Welcome to Well Circle, meron_runner!" in text

        # Fallback to User <id>
        update2, context2 = _create_mock_update_and_context(
            first_name=None, username=None, user_id=555
        )
        asyncio.run(start_handler(update2, context2))
        text2 = update2.message.reply_text.await_args.kwargs["text"]
        assert "Welcome to Well Circle, User 555!" in text2


def test_register_in_background_with_profile_photo():
    """Verify profile photo lookup and backend proxy URL passed to register_user."""
    user = MagicMock()
    photo_file = MagicMock()
    photo_file.file_path = "photos/profile_999.jpg"

    photo_item = MagicMock()
    photo_item.get_file = AsyncMock(return_value=photo_file)

    photos_result = MagicMock()
    photos_result.total_count = 1
    photos_result.photos = [[photo_item]]

    user.get_profile_photos = AsyncMock(return_value=photos_result)

    with patch("bot.handlers.start.register_user", new_callable=AsyncMock) as mock_register:
        mock_register.return_value = {"created": True}

        asyncio.run(_register_in_background(telegram_id=999, telegram_handle="yoni", user=user))

        user.get_profile_photos.assert_awaited_once_with(limit=1)
        mock_register.assert_awaited_once_with(
            telegram_id=999,
            telegram_handle="yoni",
            photo_url=f"{BACKEND_URL}/api/bot/photo/photos/profile_999.jpg",
        )


def test_register_in_background_photo_exception_degrades_gracefully():
    """Verify photo lookup exceptions degrade to photo_url=None without halting registration."""
    user = MagicMock()
    user.get_profile_photos = AsyncMock(side_effect=Exception("Telegram Network Timeout"))

    with patch("bot.handlers.start.register_user", new_callable=AsyncMock) as mock_register:
        mock_register.return_value = {"created": False}

        asyncio.run(_register_in_background(telegram_id=999, telegram_handle="yoni", user=user))

        mock_register.assert_awaited_once_with(
            telegram_id=999,
            telegram_handle="yoni",
            photo_url=None,
        )


def test_register_in_background_api_failure_caught_and_logged():
    """Verify backend registration exceptions are caught and never crash the event loop."""
    user = MagicMock()
    user.get_profile_photos = AsyncMock(return_value=MagicMock(total_count=0))

    with patch("bot.handlers.start.register_user", new_callable=AsyncMock) as mock_register:
        mock_register.side_effect = Exception("Backend Database Connection Error")

        # Must not raise
        asyncio.run(_register_in_background(telegram_id=999, telegram_handle="yoni", user=user))

        mock_register.assert_awaited_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
