"""Offer a one-time bonus after the user says they pinned the bot chat."""

import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.services.api_client import claim_pin_bot_bonus, register_user

logger = logging.getLogger(__name__)

PIN_BONUS_TEXT = (
    "📌 <b>Pin Well Circle and get 200 Legacy Points</b>\n\n"
    "Pin this conversation from your Telegram chat list. Then come back and "
    "tap the button below to claim your one-time bonus."
)


def pin_bonus_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("📌 I pinned it — claim 200 points", callback_data="claim_pin_bonus")
    ]])


async def pin_bonus_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or update.effective_chat.type != "private":
        await update.effective_message.reply_text("Open my private chat to claim the pin bonus.")
        return
    await update.effective_message.reply_text(
        PIN_BONUS_TEXT, reply_markup=pin_bonus_keyboard(), parse_mode="HTML"
    )


async def pin_bonus_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not update.effective_user:
        return
    if not update.effective_chat or update.effective_chat.type != "private":
        await query.answer("Open my private chat to claim this bonus.", show_alert=True)
        return
    await query.answer()
    user = update.effective_user
    try:
        # /start registration runs in the background; the user can tap before
        # it finishes. This makes the claim path safe on a fresh chat.
        await register_user(user.id, user.username)
        result = await claim_pin_bot_bonus(user.id)
    except Exception:
        logger.exception("Pin bonus claim failed for Telegram user %s", user.id)
        await query.message.reply_text("Couldn't claim the bonus yet. Try again in a moment.")
        return
    if result["awarded"]:
        await query.message.reply_text(
            f"🎉 200 Legacy Points added. Your balance is {result['points_balance']} points."
        )
    else:
        await query.message.reply_text("You've already claimed the pin bonus.")
