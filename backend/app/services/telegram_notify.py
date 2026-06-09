"""Send Telegram messages via Bot API (approval/rejection notifications)."""

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_telegram_message(telegram_id: int, text: str) -> bool:
    """Send a message to a Telegram user. Returns True on success."""
    if not settings.TELEGRAM_BOT_TOKEN or not telegram_id:
        logger.warning("Telegram message skipped: missing token or chat_id")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                url,
                json={
                    "chat_id": telegram_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
            )
            if res.status_code == 200:
                return True
            logger.warning("Telegram API error %s: %s", res.status_code, res.text)
    except Exception as e:
        logger.warning("Failed to send Telegram message: %s", e)
    return False


def build_approval_message(provider_name: str, frontend_url: Optional[str] = None) -> str:
    base = frontend_url or settings.FRONTEND_URL
    return (
        f"✅ PROVIDER APPROVED\n\n"
        f'Your application for "{provider_name}" has been approved!\n\n'
        f"Your provider dashboard is now live. You can:\n"
        f"• Manage your community\n"
        f"• Create product listings\n"
        f"• View analytics and bookings\n\n"
        f"Start here: {base}/provider-dashboard\n\n"
        f"Welcome aboard! 🎉"
    )


def build_rejection_message(provider_name: str, reason: str) -> str:
    return (
        f"❌ APPLICATION NOT APPROVED\n\n"
        f'Your application for "{provider_name}" requires revision.\n\n'
        f"Reason:\n"
        f'"{reason}"\n\n'
        f"You can reapply by contacting: admin@wellcircle.et\n\n"
        f"We look forward to welcoming you soon! 💚"
    )
