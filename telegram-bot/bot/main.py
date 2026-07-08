"""Well Circle Telegram Bot — entry point."""

import asyncio
import logging
from datetime import datetime, time

from telegram import Update, BotCommand
from telegram.error import Conflict
from telegram.ext import Application, CommandHandler, ContextTypes

from bot.handlers.start import start_handler
from bot.handlers.admin import admin_handler
from bot.handlers.evidence import evidence_conversation
from bot.services.reengagement import schedule_reengagement
from bot.services.weekly_digest import send_weekly_digest
from bot.config import BOT_TOKEN

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log polling errors; Conflict means another bot instance is running."""
    err = context.error
    if isinstance(err, Conflict):
        logger.warning(
            "Telegram polling conflict — another getUpdates instance is active. "
            "Stop duplicate bot processes and keep Railway at 1 replica."
        )
        return
    logger.error("Unhandled bot error: %s", err, exc_info=err)


async def post_init(application: Application) -> None:
    """Set bot commands after initialization."""
    commands = [BotCommand("start", "Open Well Circle")]
    # /admin is registered globally; visibility is enforced in the handler
    commands.append(BotCommand("admin", "Access admin dashboard"))
    commands.append(BotCommand("evidence", "Submit event participation proof"))
    await application.bot.set_my_commands(commands)
    logger.info("🟢 Well Circle Bot started")


def main():
    """Start the bot."""
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("admin", admin_handler))
    app.add_handler(evidence_conversation)
    app.add_error_handler(error_handler)

    # Schedule re-engagement check (weekly)
    job_queue = app.job_queue
    if job_queue:
        job_queue.run_repeating(
            schedule_reengagement,
            interval=604800,  # 7 days
            first=60,         # 1 minute after startup
            name="reengagement",
        )
        logger.info("📅 Re-engagement job scheduled (every 7 days)")

        # C3: weekly circle digest, Sundays at 18:00 UTC
        job_queue.run_daily(
            send_weekly_digest,
            time=time(hour=18, minute=0),
            days=(6,),  # 0=Monday ... 6=Sunday
            name="weekly_digest",
        )
        logger.info("📊 Weekly digest job scheduled (Sundays 18:00 UTC)")

    # Start polling
    logger.info("🤖 Bot polling started...")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
