"""WhatsApp/SMS OTP service — rate limiting, code generation, hashed storage.

Production deploys against a BSP (e.g. Twilio Verify). This module provides
the in-process store and verification logic; the delivery transport is pluggable.
"""

import hashlib
import hmac
import os
import re
import secrets
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from app.utils.logger import get_logger

logger = get_logger(__name__)

# ── Configuration ─────────────────────────────────────────────
CODE_LENGTH = 6
CODE_TTL_SECONDS = 600        # 10 minutes
MAX_ATTEMPTS = 5
# Per-phone: max N requests per window
RATE_LIMIT_WINDOW = 60        # 1 minute
RATE_LIMIT_MAX_PER_WINDOW = 2


@dataclass
class OTPRecord:
    """A single OTP challenge. The code is stored hashed (SHA-256)."""
    code_hash: str
    phone_e164: str
    created_at: float
    attempts: int = 0
    used: bool = False


# ── In-process store (swap for Redis in production) ───────────
_store: Dict[str, OTPRecord] = {}
_rate_limits: Dict[str, list] = {}  # phone → [timestamps]


def _normalize_phone(raw: str) -> str:
    """Normalize to E.164 so 0911…, 911…, and +251911… are one account."""
    digits = re.sub(r"[^0-9+]", "", raw)
    if digits.startswith("+251"):
        return digits
    if digits.startswith("0") and len(digits) == 10:
        return "+251" + digits[1:]
    if (digits.startswith("9") or digits.startswith("7")) and len(digits) == 9:
        return "+251" + digits
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def _check_rate_limit(phone: str) -> bool:
    """Returns True if the phone is within rate limits."""
    now = time.time()
    timestamps = _rate_limits.get(phone, [])
    # Prune old entries
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    _rate_limits[phone] = timestamps
    return len(timestamps) < RATE_LIMIT_MAX_PER_WINDOW


def start_otp(phone_raw: str) -> Optional[dict]:
    """Generate and 'send' an OTP. Returns {request_id, expires_in} or None if rate-limited.

    In production the code is delivered via the BSP (Twilio Verify /
    WhatsApp Business Cloud API). For development the code is logged.
    """
    phone = _normalize_phone(phone_raw)

    if not _check_rate_limit(phone):
        return None

    # Record rate-limit hit
    _rate_limits.setdefault(phone, []).append(time.time())

    code = "".join([str(secrets.randbelow(10)) for _ in range(CODE_LENGTH)])
    request_id = secrets.token_urlsafe(24)

    _store[request_id] = OTPRecord(
        code_hash=_hash_code(code),
        phone_e164=phone,
        created_at=time.time(),
    )

    # TODO: replace with actual BSP delivery (Twilio Verify / WhatsApp Cloud API)
    logger.info("OTP for %s: %s (request_id=%s) — replace with BSP in production", phone, code, request_id)

    return {
        "request_id": request_id,
        "expires_in": CODE_TTL_SECONDS,
        # DEV ONLY — remove before production:
        "_dev_code": code if os.getenv("ENVIRONMENT", "development") == "development" else None,
    }


def verify_otp(request_id: str, code: str) -> Optional[str]:
    """Verify an OTP. Returns the E.164 phone on success, None on failure.

    The code is single-use, expired after TTL, and limited to MAX_ATTEMPTS.
    All comparisons are constant-time.
    """
    record = _store.get(request_id)
    if not record:
        return None

    # Expired?
    if time.time() - record.created_at > CODE_TTL_SECONDS:
        del _store[request_id]
        return None

    # Already used?
    if record.used:
        return None

    # Too many attempts?
    record.attempts += 1
    if record.attempts > MAX_ATTEMPTS:
        del _store[request_id]
        return None

    # Constant-time comparison
    if not _constant_time_compare(_hash_code(code), record.code_hash):
        return None

    # Success — mark used
    record.used = True
    del _store[request_id]
    return record.phone_e164
