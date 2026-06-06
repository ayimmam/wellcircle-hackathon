"""Keyboard layouts for Telegram bot."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from bot.config import MINI_APP_URL


def get_open_app_keyboard() -> InlineKeyboardMarkup:
    """Main button to open the Mini App."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="🟢 Open Well Circle",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )],
    ])
