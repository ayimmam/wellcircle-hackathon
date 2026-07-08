"""C3: Sunday weekly circle digest — DMs every circle member the top scorer."""

import logging
from telegram.ext import ContextTypes

from bot.services.api_client import get_circle_digests
from bot.utils.messages import WEEKLY_DIGEST_MESSAGE

logger = logging.getLogger(__name__)


async def send_weekly_digest(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job callback: fetch this week's per-circle top scorer and DM every
    member. Runs Sundays via job_queue.run_daily."""
    try:
        data = await get_circle_digests()
        circles = data.get("circles", [])
        sent = 0

        for circle in circles:
            text = WEEKLY_DIGEST_MESSAGE.format(
                circle_name=circle["circle_name"],
                top_scorer=circle["top_scorer_name"],
                top_points=circle["top_scorer_points"],
            )
            for telegram_id in circle.get("member_telegram_ids", []):
                try:
                    await context.bot.send_message(
                        chat_id=telegram_id,
                        text=text,
                        parse_mode="HTML",
                    )
                    sent += 1
                except Exception as e:
                    # User may have blocked the bot
                    logger.warning(f"Could not send digest to {telegram_id}: {e}")

        logger.info(f"📊 Weekly digest: sent {sent} messages across {len(circles)} circles")

    except Exception as e:
        logger.error(f"Weekly digest job failed: {e}")
