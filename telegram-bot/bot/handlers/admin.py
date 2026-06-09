"""Admin command handler — /admin for super admins only."""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.config import FRONTEND_URL, is_super_admin

logger = logging.getLogger(__name__)


async def admin_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send admin dashboard link to super admins only."""
    user = update.effective_user
    if not user:
        return

    if not is_super_admin(user.id):
        await update.message.reply_text("You don't have permission to access the admin dashboard.")
        return

    admin_url = f"{FRONTEND_URL}/admin"
    text = (
        "📊 Admin Dashboard\n\n"
        f"{admin_url}\n\n"
        "Use this link to:\n"
        "• Approve/reject provider applications\n"
        "• Manage products inventory\n"
        "• View platform analytics\n"
        "• Manage user roles"
    )
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("Open Admin Dashboard", url=admin_url)]
    ])
    await update.message.reply_text(text, reply_markup=keyboard, disable_web_page_preview=True)
