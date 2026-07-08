import os
import logging
from threading import Thread

import httpx

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "mock_token")

logger = logging.getLogger(__name__)

def _send_message_sync(chat_id: int, text: str):
    if TELEGRAM_BOT_TOKEN == "mock_token":
        logger.info(f"Mock Telegram Notification to {chat_id}: {text}")
        return
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    try:
        response = httpx.post(url, json=payload, timeout=5.0)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to send Telegram notification to {chat_id}: {str(e)}")


def send_telegram_notification(chat_id: int, text: str):
    """Send a text message via Telegram Bot API asynchronously."""
    if not chat_id:
        return
    Thread(target=_send_message_sync, args=(chat_id, text)).start()


def fetch_telegram_file(file_id: str) -> tuple[bytes, str]:
    """Resolve a Telegram file_id to bytes + content-type via the Bot API.

    Keeps the bot token server-side only (D2 admin evidence photo proxy) —
    the frontend never sees a token-bearing URL.
    """
    if TELEGRAM_BOT_TOKEN == "mock_token":
        raise RuntimeError("No Telegram bot token configured")

    get_file_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile"
    resp = httpx.get(get_file_url, params={"file_id": file_id}, timeout=10.0)
    resp.raise_for_status()
    file_path = resp.json()["result"]["file_path"]

    download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
    file_resp = httpx.get(download_url, timeout=15.0)
    file_resp.raise_for_status()

    content_type = file_resp.headers.get("content-type", "image/jpeg")
    return file_resp.content, content_type
