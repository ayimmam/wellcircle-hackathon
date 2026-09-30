"""One-time return nudge for newly activated Telegram users."""

import asyncio
import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.services.api_client import get_day1_return_users, mark_day1_reminder_sent

logger = logging.getLogger(__name__)


async def send_day1_return_reminders(context: ContextTypes.DEFAULT_TYPE) -> None:
    try:
        users = (await get_day1_return_users()).get("users", [])
        bot_username = context.bot.username
        sent = 0
        for user in users:
            telegram_id = user.get("telegram_id")
            try:
                if telegram_id:
                    link = f"https://t.me/{bot_username}?startapp=reentry_checkin" if bot_username else None
                    markup = InlineKeyboardMarkup([[InlineKeyboardButton(text="Open Well Circle", url=link)]]) if link else None
                    await context.bot.send_message(
                        chat_id=telegram_id,
                        text=f"Hi {user.get('name', 'there')} — ready for your next wellness check-in? Your community is here when you are.",
                        reply_markup=markup,
                    )
                    reminder_key = str(telegram_id)
                else:
                    reminder_key = f"web-{user.get('user_id')}"
                await mark_day1_reminder_sent(reminder_key)
                sent += 1
                await asyncio.sleep(0.05)
            except Exception as exc:
                logger.warning("Could not send Day 1 return reminder to %s: %s", telegram_id, exc)
        logger.info("Day 1 return reminders: sent %s/%s", sent, len(users))
    except Exception as exc:
        logger.error("Day 1 return reminder job failed: %s", exc)
