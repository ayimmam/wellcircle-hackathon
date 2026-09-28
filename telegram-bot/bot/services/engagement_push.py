"""Engagement push service — DMs users who have unread likes/comments (WS14).

Runs every 6 hours via job_queue. Queries the backend's engagement-digest
endpoint for users with unread, un-pushed, push-worthy notifications, builds
a one-line "X reacted to your post — tap to see!" nudge, and sends it via
Telegram. Marks notifications as push-sent after each DM so they aren't
re-sent on the next run.
"""

import asyncio
import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.services.api_client import get_engagement_digest, mark_engagement_push_sent
from bot.utils.nudges import build_engagement_nudge

logger = logging.getLogger(__name__)


async def send_engagement_pushes(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job callback: send engagement digest pushes to users with unread activity."""
    try:
        data = await get_engagement_digest(since_hours=6)
        entries = data.get("digest", [])
        bot_username = context.bot.username
        sent = 0

        for entry in entries:
            telegram_id = entry.get("telegram_id")
            if not telegram_id:
                continue

            try:
                nudge = build_engagement_nudge(entry, bot_username=bot_username)
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
                await mark_engagement_push_sent(telegram_id)
                sent += 1
                await asyncio.sleep(0.05)  # throttle: ~20 msgs/sec
            except Exception as e:
                logger.warning(f"Could not send engagement push to {telegram_id}: {e}")

        logger.info(f"🔔 Engagement push: sent {sent}/{len(entries)} messages")

    except Exception as e:
        logger.error(f"Engagement push job failed: {e}")
