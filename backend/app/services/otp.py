"""Durable WhatsApp/SMS verification with bounded retries and honest delivery errors.

Only the backend holds messaging tokens and verification state. Production never
falls back to an undelivered development code. Apply migration 027 before deploy.
"""
import hashlib
import hmac
import os
import re
import secrets
import time
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.otp_challenge import OTPChallenge
from app.utils.logger import get_logger

logger = get_logger(__name__)
CODE_LENGTH = 6
CODE_TTL_SECONDS = 600
MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_PER_WINDOW = 2
IP_RATE_LIMIT = 30


class OTPDeliveryUnavailable(Exception):
    """A code could not be accepted for delivery, or delivery is not configured."""


def _normalize_phone(raw: str) -> str:
    if not isinstance(raw, str) or not re.fullmatch(r"[+0-9\s()\-]+", raw):
        raise ValueError("Enter a valid phone number.")
    number = re.sub(r"[\s()\-]", "", raw)
    if number.startswith("0") and len(number) == 10:
        number = "+251" + number[1:]
    elif number.startswith(("9", "7")) and len(number) == 9:
        number = "+251" + number
    elif not number.startswith("+"):
        number = "+" + number
    if not re.fullmatch(r"\+[1-9][0-9]{5,14}", number):
        raise ValueError("Enter a valid phone number.")
    return number


def _digest(value: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()


def _provider(channel: str) -> str:
    meta = [settings.WHATSAPP_PHONE_NUMBER_ID, settings.WHATSAPP_API_TOKEN,
            settings.WHATSAPP_OTP_TEMPLATE_NAME, settings.WHATSAPP_API_VERSION]
    if channel == "whatsapp" and any(meta):
        if not all(meta) or not re.fullmatch(r"v[0-9]+\.[0-9]+", settings.WHATSAPP_API_VERSION):
            raise OTPDeliveryUnavailable("WhatsApp delivery is not fully configured.")
        return "meta"
    if all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_VERIFY_SERVICE_SID]):
        return "twilio"
    if settings.ENVIRONMENT == "development" and not os.getenv("VERCEL"):
        return "development"
    raise OTPDeliveryUnavailable("Verification delivery is not configured.")


def _lock_rate_limits(db: Session, keys: list[str]) -> None:
    # Transaction-scoped locks work with Supabase's transaction pooler. Serialize
    # reservations per phone AND IP so parallel serverless workers cannot bypass limits.
    if db.get_bind().dialect.name == "postgresql":
        for key in sorted(set(keys)):
            lock_id = int.from_bytes(bytes.fromhex(key)[:8], "big", signed=True)
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})


def _redact(record: OTPChallenge, state: str) -> None:
    record.status = state
    record.phone_e164 = None
    record.code_hash = None
    record.provider_request_id = None


def _send_meta(phone: str, code: str) -> None:
    payload = {
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": phone.lstrip("+"), "type": "template",
        "template": {
            "name": settings.WHATSAPP_OTP_TEMPLATE_NAME,
            "language": {"code": settings.WHATSAPP_OTP_TEMPLATE_LANGUAGE},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": code}]},
                {"type": "button", "sub_type": "url", "index": "0",
                 "parameters": [{"type": "text", "text": code}]},
            ],
        },
    }
    response = httpx.post(
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
        json=payload, headers={"Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}"}, timeout=10.0,
    )
    data = response.json()
    if (response.status_code not in (200, 201) or not isinstance(data, dict)
            or not data.get("messages") or not data["messages"][0].get("id")):
        logger.warning("Meta rejected OTP delivery (HTTP %s)", response.status_code)
        raise OTPDeliveryUnavailable("WhatsApp delivery failed.")


def start_otp(phone_raw: str, channel: str = "whatsapp", *, db: Session, ip: str = "unknown") -> Optional[dict]:
    if channel not in ("whatsapp", "sms"):
        raise ValueError("Choose WhatsApp or SMS.")
    phone = _normalize_phone(phone_raw)
    provider = _provider(channel)
    now = int(time.time())
    phone_hash, ip_hash = _digest("phone:" + phone), _digest("ip:" + ip)
    _lock_rate_limits(db, [phone_hash, ip_hash])
    db.query(OTPChallenge).filter(OTPChallenge.expires_at < now).delete(synchronize_session=False)
    recent = db.query(OTPChallenge).filter(OTPChallenge.created_at > now - RATE_LIMIT_WINDOW)
    if (recent.filter(OTPChallenge.phone_hash == phone_hash).count() >= RATE_LIMIT_MAX_PER_WINDOW
            or recent.filter(OTPChallenge.ip_hash == ip_hash).count() >= IP_RATE_LIMIT):
        db.rollback()
        return None
    code = "".join(str(secrets.randbelow(10)) for _ in range(CODE_LENGTH))
    request_id = secrets.token_urlsafe(32)
    record = OTPChallenge(
        id=request_id, phone_e164=phone, phone_hash=phone_hash, ip_hash=ip_hash,
        code_hash=_digest(request_id + ":" + code) if provider != "twilio" else None,
        provider=provider, status="pending", attempts=0,
        created_at=now, expires_at=now + CODE_TTL_SECONDS,
    )
    db.add(record)
    db.commit()  # Reserve the rate-limit slot before contacting the messaging provider.
    try:
        if provider == "meta":
            _send_meta(phone, code)
        elif provider == "twilio":
            response = httpx.post(
                f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications",
                data={"To": phone, "Channel": channel},
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN), timeout=10.0,
            )
            data = response.json()
            if response.status_code not in (200, 201) or not isinstance(data, dict) or not data.get("sid") or data.get("status") != "pending":
                raise OTPDeliveryUnavailable("Verification delivery failed.")
            record.provider_request_id = data["sid"]
        record.status = "sent"
        db.commit()
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError, OTPDeliveryUnavailable) as error:
        _redact(record, "failed")
        db.commit()
        # Never log a code, token, phone number or provider response body.
        logger.warning("OTP delivery failed (%s)", type(error).__name__)
        raise OTPDeliveryUnavailable("Verification delivery failed.") from error
    result = {"request_id": request_id, "expires_in": CODE_TTL_SECONDS, "retry_after": RATE_LIMIT_WINDOW}
    if provider == "development":
        result["_dev_code"] = code
    return result


def verify_otp(request_id: str, code: str, *, db: Session) -> Optional[str]:
    if not re.fullmatch(r"[0-9]{6}", code) or len(request_id) > 64:
        return None
    record = db.query(OTPChallenge).filter(OTPChallenge.id == request_id).with_for_update().first()
    if not record:
        return None
    if record.status != "sent" or record.expires_at <= int(time.time()) or record.attempts >= MAX_ATTEMPTS:
        if record.status == "sent":
            _redact(record, "expired" if record.expires_at <= int(time.time()) else "locked")
        db.commit()
        return None
    record.attempts += 1
    if record.provider == "twilio":
        try:
            response = httpx.post(
                f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck",
                data={"VerificationSid": record.provider_request_id, "Code": code},
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN), timeout=10.0,
            )
            if response.status_code >= 500 or response.status_code == 429:
                raise OTPDeliveryUnavailable("Verification is temporarily unavailable.")
            result = response.json()
            approved = response.status_code == 200 and isinstance(result, dict) and result.get("status") == "approved"
        except (httpx.HTTPError, ValueError, OTPDeliveryUnavailable):
            db.commit()
            raise OTPDeliveryUnavailable("Verification is temporarily unavailable.")
    else:
        approved = bool(record.code_hash) and hmac.compare_digest(_digest(record.id + ":" + code), record.code_hash)
    phone = record.phone_e164 if approved else None
    if approved:
        _redact(record, "used")
    elif record.attempts >= MAX_ATTEMPTS:
        _redact(record, "locked")
    db.commit()
    return phone
