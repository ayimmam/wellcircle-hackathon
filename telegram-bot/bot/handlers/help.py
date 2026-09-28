"""Help command handler — /help."""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from bot.config import MINI_APP_URL

HELP_MESSAGE = """
🟢 <b>Well Circle Bot Help</b>

Here's what I can do for you:
/start - Open the Well Circle Mini App
/evidence - Submit a photo for event participation (if you're staff)
/help - Show this message

I'll also send you reminders about your streaks, upcoming bookings, and when you've been inactive for a while.

Tap the button below to jump right back in!
"""

async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="🟢 Open Well Circle",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )],
    ])

    message = update.effective_message
    if not message:
        return

    await message.reply_text(
        text=HELP_MESSAGE,
        reply_markup=keyboard,
        parse_mode="HTML",
    )
