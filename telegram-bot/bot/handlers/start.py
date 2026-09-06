"""/start command handler — shows the Mini App button immediately, registers
the user via the backend API in the background so a cold Vercel function
never delays the user's first interaction."""

import logging

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from bot.services.api_client import register_user
from bot.utils.messages import WELCOME_MESSAGE
from bot.config import MINI_APP_URL, BOT_TOKEN, BACKEND_URL

logger = logging.getLogger(__name__)


async def _register_in_background(telegram_id: int, telegram_handle, user) -> None:
    """Profile-photo fetch + backend registration — both Telegram/HTTP round
    trips that must never block the welcome message. Registration failure
    already degrades gracefully (the Mini App button was shown regardless),
    so failures here are logged, never surfaced to the user."""
    photo_url = None
    try:
        photos = await user.get_profile_photos(limit=1)
        if photos.total_count > 0:
            file = await photos.photos[0][0].get_file()
            if file.file_path:
                # Use backend proxy instead of exposing BOT_TOKEN directly
                photo_url = f"{BACKEND_URL}/api/bot/photo/{file.file_path}"
    except Exception:
        pass

    try:
        result = await register_user(
            telegram_id=telegram_id,
            telegram_handle=telegram_handle,
            photo_url=photo_url,
        )
        is_new = result.get("created", False)
        logger.info(f"{'New' if is_new else 'Returning'} user: @{telegram_handle} ({telegram_id})")
    except Exception as e:
        logger.error(f"Backend registration failed: {e}")


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /start command:
    1. Show welcome message + Open Well Circle button immediately
    2. Register the user (and fetch their profile photo) in the background
    """
    user = update.effective_user
    if not user:
        return

    telegram_id = user.id
    telegram_handle = user.username

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="🟢 Open Well Circle",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )],
    ])

    welcome_text = WELCOME_MESSAGE.format(name=user.first_name or telegram_handle or f"User {telegram_id}")

    await update.message.reply_text(
        text=welcome_text,
        reply_markup=keyboard,
        parse_mode="HTML",
    )

    # Fire-and-forget: the bot's own event loop owns this task's lifecycle,
    # so it keeps running after this handler returns.
    context.application.create_task(
        _register_in_background(telegram_id, telegram_handle, user)
    )
