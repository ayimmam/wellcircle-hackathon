"""Well Circle Telegram Bot — entry point."""

import asyncio
import logging
from datetime import datetime

from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, ContextTypes

from bot.handlers.start import start_handler
from bot.services.reengagement import schedule_reengagement
from bot.config import BOT_TOKEN

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(application: Application) -> None:
    """Set bot commands after initialization."""
    await application.bot.set_my_commands([
        BotCommand("start", "Open Well Circle"),
    ])
    logger.info("🟢 Well Circle Bot started")


def main():
    """Start the bot."""
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_handler))

    # Schedule re-engagement check (daily)
    job_queue = app.job_queue
    if job_queue:
        job_queue.run_repeating(
            schedule_reengagement,
            interval=86400,  # 24 hours
            first=10,        # 10 seconds after startup
            name="reengagement",
        )
        logger.info("📅 Re-engagement job scheduled (every 24h)")

    # Start polling
    logger.info("🤖 Bot polling started...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
