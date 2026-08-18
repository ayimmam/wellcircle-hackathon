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


def start_otp(phone_raw: str, channel: str = "whatsapp") -> Optional[dict]:
    """Generate and send an OTP. Returns {request_id, expires_in} or None if rate-limited.

    If Twilio Verify credentials are configured in settings, delivers via Twilio Verify
    (channel='whatsapp' or 'sms'). Otherwise uses the secure in-process hashed store.
    """
    phone = _normalize_phone(phone_raw)

    if not _check_rate_limit(phone):
        return None

    # Record rate-limit hit
    _rate_limits.setdefault(phone, []).append(time.time())

    from app.config import settings

    # Check if Meta WhatsApp Cloud API is configured
    if settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_API_TOKEN:
        try:
            import httpx
            clean_to = phone.lstrip("+")
            url = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
            headers = {
                "Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}",
                "Content-Type": "application/json",
            }
            if getattr(settings, "WHATSAPP_OTP_TEMPLATE_NAME", ""):
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_to,
                    "type": "template",
                    "template": {
                        "name": settings.WHATSAPP_OTP_TEMPLATE_NAME,
                        "language": {"code": "en_US"},
                        "components": [
                            {
                                "type": "body",
                                "parameters": [{"type": "text", "text": code}],
                            },
                        ],
                    },
                }
            else:
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_to,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": f"Your Well Circle verification code is: {code}\n\nValid for 10 minutes. Do not share this code.",
                    },
                }

            resp = httpx.post(url, json=payload, headers=headers, timeout=10.0)
            if resp.status_code in (200, 201):
                logger.info("Sent WhatsApp OTP to %s via Meta Cloud API", phone)
            else:
                logger.error("Meta WhatsApp Cloud API error (%s): %s", resp.status_code, resp.text)
        except Exception as e:
            logger.exception("Failed to send WhatsApp message via Meta Cloud API: %s", e)

    # Check if Twilio Verify is configured
    elif settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID:
        try:
            import httpx
            url = f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications"
            resp = httpx.post(
                url,
                data={"To": phone, "Channel": channel},
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                request_id = data.get("sid", secrets.token_urlsafe(24))
                _store[request_id] = OTPRecord(
                    code_hash="",
                    phone_e164=phone,
                    created_at=time.time(),
                )
                logger.info("Sent Twilio Verify code to %s via %s (sid=%s)", phone, channel, request_id)
                return {"request_id": request_id, "expires_in": CODE_TTL_SECONDS}
            else:
                logger.error("Twilio Verify error (%s): %s", resp.status_code, resp.text)
        except Exception as e:
            logger.exception("Failed to call Twilio Verify API: %s", e)

    # Fallback / In-process store (dev & pilot mode)
    code = "".join([str(secrets.randbelow(10)) for _ in range(CODE_LENGTH)])
    request_id = secrets.token_urlsafe(24)

    _store[request_id] = OTPRecord(
        code_hash=_hash_code(code),
        phone_e164=phone,
        created_at=time.time(),
    )

    logger.info("OTP for %s: %s (request_id=%s)", phone, code, request_id)

    return {
        "request_id": request_id,
        "expires_in": CODE_TTL_SECONDS,
        "_dev_code": code if settings.ENVIRONMENT == "development" else None,
    }


def verify_otp(request_id: str, code: str) -> Optional[str]:
    """Verify an OTP. Returns the E.164 phone on success, None on failure.

    Checks Twilio Verify if configured, otherwise checks in-process hashed store.
    """
    record = _store.get(request_id)
    if not record:
        return None

    from app.config import settings

    # If Twilio Verify is configured and record was sent via Twilio
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID:
        if record.phone_e164 and not record.code_hash:
            try:
                import httpx
                url = f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck"
                resp = httpx.post(
                    url,
                    data={"To": record.phone_e164, "Code": code},
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    timeout=10.0,
                )
                if resp.status_code == 200 and resp.json().get("status") == "approved":
                    phone = record.phone_e164
                    del _store[request_id]
                    return phone
                else:
                    return None
            except Exception as e:
                logger.exception("Twilio verification check failed: %s", e)
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
    phone = record.phone_e164
    del _store[request_id]
    return phone
