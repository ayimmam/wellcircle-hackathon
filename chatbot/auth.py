"""Chat identity and credential handling for the Circler concierge.

The chatbot is a separate service from the main FastAPI backend. It therefore
validates the backend's existing HS256 user JWT directly, using the same
``JWT_SECRET`` and ``JWT_ALGORITHM`` settings. No new token format is invented
for signed-in users, and no user record is created for anonymous visitors.

Anonymous visitors receive a server-signed credential with a distinct claim
type and a distinct signing key (``ANON_SESSION_SECRET`` when configured, or a
domain-separated key derived from ``JWT_SECRET``). A user JWT is rejected when
presented as an anonymous credential, and an anonymous credential is rejected
when presented as a user JWT.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import math
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException, status

from config import (
    ANON_SESSION_SECRET,
    ANON_SESSION_TTL_HOURS,
    JWT_ALGORITHM,
    JWT_SECRET,
    logger,
)

ANONYMOUS_HEADER = "X-Circler-Anonymous-Token"
ANONYMOUS_TOKEN_TYPE = "circler_anon"
_BEARER_PREFIX = "bearer "
_MAX_TOKEN_LENGTH = 4096
_SUPPORTED_ALGORITHMS = {"HS256": hashlib.sha256}

# If no server secret is configured, anonymous credentials still work for this
# process, but they cannot survive a restart. Production must configure
# JWT_SECRET (and may optionally set ANON_SESSION_SECRET).
_process_anonymous_key = os.urandom(32)


class CredentialError(ValueError):
    """Raised when a credential is malformed, forged, expired, or wrong type."""


@dataclass(frozen=True)
class ChatIdentity:
    """The authenticated or anonymous owner of a chat session."""

    owner_type: str  # "user" | "anonymous"
    owner_id: str
    is_authenticated: bool
    # Only populated when a new anonymous identity is issued by this request.
    anonymous_token: str | None = None


def _anonymous_signing_key() -> bytes:
    if ANON_SESSION_SECRET:
        return ANON_SESSION_SECRET.encode("utf-8")
    if JWT_SECRET:
        # Domain separation keeps this key distinct from the user-token key
        # even when the operator does not set a separate anonymous secret.
        return hashlib.sha256(
            b"wellcircle-circler-anonymous-session-v1\x00"
            + JWT_SECRET.encode("utf-8")
        ).digest()
    return _process_anonymous_key


def _user_signing_key() -> bytes:
    if not JWT_SECRET:
        raise CredentialError("user authentication is not configured")
    return JWT_SECRET.encode("utf-8")


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    if not isinstance(value, str) or not value:
        raise CredentialError("malformed credential")
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode((value + padding).encode("ascii"))
    except (ValueError, binascii.Error, UnicodeEncodeError) as exc:
        raise CredentialError("malformed credential") from exc


def _canonical_uuid(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CredentialError("credential subject is missing")
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError) as exc:
        raise CredentialError("credential subject is invalid") from exc


def _utc_timestamp(now: datetime | None) -> float:
    if now is None:
        return time.time()
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc).timestamp()


def _encode_token(payload: dict, key: bytes) -> str:
    # Anonymous credentials always use HS256, independently of the backend's
    # user-token algorithm. The two credentials never share a key or type.
    algorithm = "HS256"
    header = {"alg": algorithm, "typ": "JWT"}
    header_segment = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_segment = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    digest = hmac.new(key, signing_input, _SUPPORTED_ALGORITHMS[algorithm]).digest()
    return f"{header_segment}.{payload_segment}.{_b64url_encode(digest)}"


def _decode_token(
    token: str,
    key: bytes,
    *,
    algorithm: str,
    required_type: str | None = None,
    rejected_type: str | None = None,
    now: datetime | None = None,
) -> dict:
    if not isinstance(token, str) or not token or len(token) > _MAX_TOKEN_LENGTH:
        raise CredentialError("malformed credential")

    parts = token.split(".")
    if len(parts) != 3:
        raise CredentialError("malformed credential")
    header_segment, payload_segment, signature_segment = parts

    try:
        header = json.loads(_b64url_decode(header_segment))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise CredentialError("malformed credential") from exc
    if not isinstance(header, dict):
        raise CredentialError("malformed credential")

    algorithm = algorithm.upper()
    if algorithm not in _SUPPORTED_ALGORITHMS:
        raise CredentialError("unsupported JWT algorithm")
    if header.get("alg") != algorithm:
        raise CredentialError("unexpected JWT algorithm")

    supplied_signature = _b64url_decode(signature_segment)
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(
        key, signing_input, _SUPPORTED_ALGORITHMS[algorithm]
    ).digest()
    if not hmac.compare_digest(expected_signature, supplied_signature):
        raise CredentialError("invalid credential signature")

    try:
        payload = json.loads(_b64url_decode(payload_segment))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise CredentialError("malformed credential") from exc
    if not isinstance(payload, dict):
        raise CredentialError("malformed credential")

    token_type = payload.get("typ")
    if required_type is not None and token_type != required_type:
        raise CredentialError("unexpected credential type")
    if rejected_type is not None and token_type == rejected_type:
        raise CredentialError("unexpected credential type")

    expires_at = payload.get("exp")
    if isinstance(expires_at, bool) or not isinstance(expires_at, (int, float)):
        raise CredentialError("credential has no expiry")
    if not math.isfinite(float(expires_at)):
        raise CredentialError("credential has an invalid expiry")
    if _utc_timestamp(now) >= float(expires_at):
        raise CredentialError("credential has expired")

    not_before = payload.get("nbf")
    if not_before is not None:
        if isinstance(not_before, bool) or not isinstance(not_before, (int, float)):
            raise CredentialError("credential has an invalid not-before")
        if _utc_timestamp(now) < float(not_before):
            raise CredentialError("credential is not active yet")

    _canonical_uuid(payload.get("sub"))
    return payload


def create_anonymous_token(
    owner_id: str | None = None,
    *,
    now: datetime | None = None,
    ttl_hours: float | None = None,
) -> str:
    """Issue a signed anonymous-session credential.

    ``owner_id`` is an opaque anonymous subject (a UUID). It is deliberately
    separate from the users table; no user row is created.
    """
    subject = _canonical_uuid(owner_id or str(uuid.uuid4()))
    issued_at = now or datetime.now(timezone.utc)
    if issued_at.tzinfo is None:
        issued_at = issued_at.replace(tzinfo=timezone.utc)
    ttl = ANON_SESSION_TTL_HOURS if ttl_hours is None else float(ttl_hours)
    expires_at = issued_at + timedelta(hours=ttl)
    payload = {
        "sub": subject,
        "typ": ANONYMOUS_TOKEN_TYPE,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return _encode_token(payload, _anonymous_signing_key())


def verify_anonymous_token(
    token: str, *, now: datetime | None = None
) -> ChatIdentity:
    payload = _decode_token(
        token,
        _anonymous_signing_key(),
        algorithm="HS256",
        required_type=ANONYMOUS_TOKEN_TYPE,
        now=now,
    )
    return ChatIdentity(
        owner_type="anonymous",
        owner_id=_canonical_uuid(payload.get("sub")),
        is_authenticated=False,
    )


def verify_user_token(token: str, *, now: datetime | None = None) -> ChatIdentity:
    payload = _decode_token(
        token,
        _user_signing_key(),
        algorithm=JWT_ALGORITHM,
        rejected_type=ANONYMOUS_TOKEN_TYPE,
        now=now,
    )
    return ChatIdentity(
        owner_type="user",
        owner_id=_canonical_uuid(payload.get("sub")),
        is_authenticated=True,
    )


def _auth_error(detail: str, *, scheme: bool = False) -> HTTPException:
    headers = {"WWW-Authenticate": "Bearer"} if scheme else None
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers=headers,
    )


def resolve_chat_identity(
    authorization: str | None = Header(default=None, alias="Authorization"),
    anonymous_token: str | None = Header(default=None, alias=ANONYMOUS_HEADER),
) -> ChatIdentity:
    """Resolve exactly one owner for a chat request.

    An ``Authorization`` header is authoritative. If it is present but invalid
    or expired, the request is rejected; it is never retried as anonymous.
    Anonymous credentials are accepted only when no Authorization header is
    present.
    """
    if authorization is not None:
        if not authorization.lower().startswith(_BEARER_PREFIX):
            raise _auth_error("Invalid or expired authentication token", scheme=True)
        token = authorization[len(_BEARER_PREFIX) :].strip()
        if not token:
            raise _auth_error("Invalid or expired authentication token", scheme=True)
        try:
            return verify_user_token(token)
        except CredentialError as exc:
            logger.info("Rejected invalid user credential: %s", exc)
            raise _auth_error(
                "Invalid or expired authentication token", scheme=True
            ) from exc

    if anonymous_token is not None:
        try:
            return verify_anonymous_token(anonymous_token)
        except CredentialError as exc:
            logger.info("Rejected invalid anonymous credential: %s", exc)
            raise _auth_error("Invalid or expired anonymous session") from exc

    token = create_anonymous_token()
    identity = verify_anonymous_token(token)
    return ChatIdentity(
        owner_type=identity.owner_type,
        owner_id=identity.owner_id,
        is_authenticated=False,
        anonymous_token=token,
    )
