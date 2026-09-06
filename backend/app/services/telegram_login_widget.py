"""Telegram Login Widget HMAC authentication.

Distinct from telegram_auth.py: that module validates Mini App `initData`
(HMAC key = HMAC-SHA256("WebAppData", bot_token)). The Login Widget
(https://core.telegram.org/widgets/login) is a separate product used to sign
in from a normal browser tab — its check-string is built the same way but
the HMAC secret key is SHA256(bot_token) directly, with no "WebAppData"
prefix step.
"""

import hmac
import hashlib
import time
from typing import Optional, Dict

from app.config import settings

# Telegram's own reference implementation recommends rejecting stale logins.
MAX_AUTH_AGE_SECONDS = 86400


def validate_login_widget_data(data: Dict[str, Optional[str]]) -> Optional[Dict]:
    """
    Validate the payload returned by the Telegram Login Widget's callback.
    Returns parsed identity fields if valid, None if invalid or expired.
    """
    try:
        received_hash = data.get("hash")
        if not received_hash:
            return None

        check_pairs = [
            f"{key}={value}"
            for key, value in data.items()
            if key != "hash" and value is not None
        ]
        check_pairs.sort()
        data_check_string = "\n".join(check_pairs)

        secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, str(received_hash)):
            return None

        auth_date = data.get("auth_date")
        if auth_date is None:
            return None
        if time.time() - int(auth_date) > MAX_AUTH_AGE_SECONDS:
            return None

        telegram_id = int(data["id"])
        return {
            "telegram_id": telegram_id,
            "username": data.get("username"),
            "first_name": data.get("first_name"),
            "last_name": data.get("last_name"),
            "photo_url": data.get("photo_url"),
        }
    except Exception:
        return None
