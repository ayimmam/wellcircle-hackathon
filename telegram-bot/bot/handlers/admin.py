"""Admin command handler — /admin for super admins only."""

import logging

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from bot.config import FRONTEND_URL, is_super_admin
from bot.services.api_client import check_admin_access

logger = logging.getLogger(__name__)


async def _user_is_super_admin(telegram_id: int) -> bool:
    """Check env list first, then backend DB flag."""
    if is_super_admin(telegram_id):
        return True
    try:
        result = await check_admin_access(telegram_id)
        return result.get("is_super_admin", False)
    except Exception as e:
        logger.warning("Admin access check failed for %s: %s", telegram_id, e)
        return False


async def admin_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send admin dashboard Mini App button to super admins only."""
    user = update.effective_user
    if not user:
        return

    if not await _user_is_super_admin(user.id):
        await update.message.reply_text(
            "You don't have permission to access the admin dashboard.\n\n"
            "If you should have access, ask the platform owner to set "
            "`is_super_admin = true` on your user record or add your Telegram ID "
            "to `SUPER_ADMIN_TELEGRAM_IDS`."
        )
        return

    admin_url = f"{FRONTEND_URL.rstrip('/')}/admin"
    text = (
        "📊 Admin Dashboard\n\n"
        "Use the button below to open the admin panel in Well Circle:\n"
        "• Approve/reject provider applications\n"
        "• Manage products inventory\n"
        "• View platform analytics\n"
        "• Export reports"
    )
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="📊 Open Admin Dashboard",
            web_app=WebAppInfo(url=admin_url),
        )],
    ])
    await update.message.reply_text(text, reply_markup=keyboard)
