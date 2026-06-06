"""Telegram initData HMAC authentication service."""

import hmac
import hashlib
import json
from typing import Optional, Dict
from urllib.parse import parse_qs, unquote

from app.config import settings


def validate_init_data(init_data: str) -> Optional[Dict]:
    """
    Validate Telegram Mini App initData using HMAC-SHA256.
    Returns parsed user data if valid, None if invalid.

    See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        parsed = parse_qs(init_data)
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return None

        # Build data-check-string: sorted key=value pairs, excluding hash
        data_pairs = []
        for key, values in parsed.items():
            if key == "hash":
                continue
            data_pairs.append(f"{key}={values[0]}")
        data_pairs.sort()
        data_check_string = "\n".join(data_pairs)

        # HMAC-SHA256 with secret key derived from bot token
        secret_key = hmac.new(
            b"WebAppData",
            settings.TELEGRAM_BOT_TOKEN.encode(),
            hashlib.sha256,
        ).digest()

        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        # Parse user object
        user_data_str = parsed.get("user", [None])[0]
        if not user_data_str:
            return None

        user_data = json.loads(unquote(user_data_str))
        return {
            "telegram_id": user_data.get("id"),
            "username": user_data.get("username"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
            "photo_url": user_data.get("photo_url"),
        }
    except Exception:
        return None


def validate_init_data_dev(init_data: str) -> Optional[Dict]:
    """
    DEV ONLY: Skip HMAC validation for local testing.
    Parses the user data from initData without signature check.
    """
    try:
        parsed = parse_qs(init_data)
        user_data_str = parsed.get("user", [None])[0]
        if user_data_str:
            user_data = json.loads(unquote(user_data_str))
            return {
                "telegram_id": user_data.get("id"),
                "username": user_data.get("username"),
                "first_name": user_data.get("first_name"),
                "last_name": user_data.get("last_name"),
                "photo_url": user_data.get("photo_url"),
            }
        # Also accept raw JSON for testing
        data = json.loads(init_data)
        return {
            "telegram_id": data.get("id") or data.get("telegram_id"),
            "username": data.get("username"),
            "first_name": data.get("first_name", ""),
            "last_name": data.get("last_name", ""),
            "photo_url": data.get("photo_url"),
        }
    except Exception:
        return None
