"""Re-engagement service — sends push notifications to inactive users."""

import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.services.api_client import get_inactive_users, mark_reengagement_sent
from bot.utils.nudges import build_reengagement_nudge

logger = logging.getLogger(__name__)


async def schedule_reengagement(context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Job callback: check for users inactive 7+ days and send them a message.
    Runs weekly via job_queue. Promo-aware: when the backend attaches an
    applicable promotion to a user, the nudge references the discount and
    deep-links back into the Mini App (tracked as `reentry_open`).
    """
    try:
        data = await get_inactive_users(days=7)
        users = data.get("inactive_users", [])
        bot_username = context.bot.username
        sent = 0

        for user in users:
            telegram_id = user.get("telegram_id")

            try:
                nudge = build_reengagement_nudge(user, bot_username=bot_username)
                reply_markup = None
                if nudge["deep_link"]:
                    reply_markup = InlineKeyboardMarkup([
                        [InlineKeyboardButton(text=nudge["button_text"], url=nudge["deep_link"])],
                    ])
                await context.bot.send_message(
                    chat_id=telegram_id,
                    text=nudge["text"],
                    reply_markup=reply_markup,
                    parse_mode="HTML",
                )
                await mark_reengagement_sent(telegram_id)
                sent += 1
            except Exception as e:
                # User may have blocked the bot
                logger.warning(f"Could not message {telegram_id}: {e}")

        logger.info(f"📬 Re-engagement: sent {sent}/{len(users)} messages")

    except Exception as e:
        logger.error(f"Re-engagement job failed: {e}")
