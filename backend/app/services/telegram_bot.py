import os
import requests
import logging
from threading import Thread

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
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to send Telegram notification to {chat_id}: {str(e)}")


def send_telegram_notification(chat_id: int, text: str):
    """Send a text message via Telegram Bot API asynchronously."""
    if not chat_id:
        return
    Thread(target=_send_message_sync, args=(chat_id, text)).start()
