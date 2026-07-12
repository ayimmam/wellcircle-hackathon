"""Builds real, HMAC-signed Telegram Mini App initData for load testing.

Mirrors app/services/telegram_auth.py's validate_init_data() exactly, so
requests exercise the actual production auth path (not the ENVIRONMENT==
"development" bypass) — including the HMAC verification cost itself, which
is part of what we're load-testing.
"""
import hashlib
import hmac
import json
import time
import urllib.parse


def build_init_data(bot_token: str, telegram_id: int, first_name: str, username: str) -> str:
    user_json = json.dumps(
        {"id": telegram_id, "first_name": first_name, "username": username},
        separators=(",", ":"),
    )
    params = {
        "user": user_json,
        "auth_date": str(int(time.time())),
        "query_id": f"LOADTEST{telegram_id}",
    }
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    params["hash"] = computed_hash
    return urllib.parse.urlencode(params)
