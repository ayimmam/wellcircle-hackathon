"""Streak-at-risk nudge — evening DM to users one missed check-in from
losing (or freezing) a live streak. Runs once daily, so the 1-nudge/day
cap is inherent in the cadence; audience is disjoint from the weekly
re-engagement job (a live streak means the user checked in yesterday)."""

import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.services.api_client import get_streaks_at_risk
from bot.utils.nudges import build_streak_nudge

logger = logging.getLogger(__name__)


async def send_streak_nudges(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job callback: DM everyone whose streak is at risk today."""
    try:
        data = await get_streaks_at_risk()
        users = data.get("users", [])
        bot_username = context.bot.username
        sent = 0

        for user in users:
            telegram_id = user.get("telegram_id")
            try:
                nudge = build_streak_nudge(user, bot_username=bot_username)
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
                sent += 1
            except Exception as e:
                # User may have blocked the bot
                logger.warning(f"Could not send streak nudge to {telegram_id}: {e}")

        logger.info(f"🔥 Streak nudges: sent {sent}/{len(users)}")

    except Exception as e:
        logger.error(f"Streak nudge job failed: {e}")
