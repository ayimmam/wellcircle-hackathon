"""Re-engagement service — sends push notifications to inactive users."""

import logging
from telegram.ext import ContextTypes

from bot.services.api_client import get_inactive_users
from bot.utils.messages import REENGAGEMENT_MESSAGE

logger = logging.getLogger(__name__)


async def schedule_reengagement(context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Job callback: check for users inactive 7+ days and send them a message.
    Runs daily via job_queue.
    """
    try:
        data = await get_inactive_users(days=7)
        users = data.get("inactive_users", [])
        sent = 0

        for user in users:
            telegram_id = user.get("telegram_id")
            name = user.get("name", "there")

            try:
                message = REENGAGEMENT_MESSAGE.format(name=name)
                await context.bot.send_message(
                    chat_id=telegram_id,
                    text=message,
                    parse_mode="HTML",
                )
                sent += 1
            except Exception as e:
                # User may have blocked the bot
                logger.warning(f"Could not message {telegram_id}: {e}")

        logger.info(f"📬 Re-engagement: sent {sent}/{len(users)} messages")

    except Exception as e:
        logger.error(f"Re-engagement job failed: {e}")
