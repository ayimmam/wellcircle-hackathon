"""/start command handler — registers user via backend API and shows Mini App button."""

import logging

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from bot.services.api_client import register_user
from bot.utils.messages import WELCOME_MESSAGE
from bot.config import MINI_APP_URL

logger = logging.getLogger(__name__)


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /start command:
    1. Capture telegram_id + handle
    2. Register via backend API
    3. Show welcome message + Open Well Circle button
    """
    user = update.effective_user
    if not user:
        return

    telegram_id = user.id
    telegram_handle = user.username
    photo_url = None

    # Try to get profile photo URL
    try:
        photos = await user.get_profile_photos(limit=1)
        if photos.total_count > 0:
            file = await photos.photos[0][0].get_file()
            photo_url = file.file_path
    except Exception:
        pass

    # Register user via backend API
    try:
        result = await register_user(
            telegram_id=telegram_id,
            telegram_handle=telegram_handle,
            photo_url=photo_url,
        )
        is_new = result.get("created", False)
        name = result.get("telegram_handle") or f"User {telegram_id}"
        logger.info(f"{'New' if is_new else 'Returning'} user: @{telegram_handle} ({telegram_id})")
    except Exception as e:
        logger.error(f"Backend registration failed: {e}")
        # Still show the app even if registration fails
        is_new = True
        name = telegram_handle or f"User {telegram_id}"

    # Build Mini App button
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="🟢 Open Well Circle",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )],
    ])

    welcome_text = WELCOME_MESSAGE.format(name=user.first_name or name)

    await update.message.reply_text(
        text=welcome_text,
        reply_markup=keyboard,
        parse_mode="HTML",
    )
