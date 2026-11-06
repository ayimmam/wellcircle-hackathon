"""Credential verification and identity-resolution tests."""

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import auth
import config


NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
USER_ID = "44444444-4444-4444-8444-444444444444"
ANON_ID = "55555555-5555-4555-8555-555555555555"


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _sign_user_token(
    subject: str = USER_ID,
    *,
    expires_in: int = 3600,
    secret: str | None = None,
    include_exp: bool = True,
    token_type: str | None = None,
) -> str:
    header = _b64url(
        json.dumps(
            {"alg": "HS256", "typ": "JWT"},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    payload = {"sub": subject, "iat": int(NOW.timestamp())}
    if include_exp:
        payload["exp"] = int(
            (NOW + timedelta(seconds=expires_in)).timestamp()
        )
    if token_type is not None:
        payload["typ"] = token_type
    payload_segment = _b64url(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header}.{payload_segment}".encode("ascii")
    digest = hmac.new(
        (secret or config.JWT_SECRET).encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header}.{payload_segment}.{_b64url(digest)}"


def test_valid_user_token_resolves_to_backend_user_id():
    token = _sign_user_token()

    identity = auth.verify_user_token(token, now=NOW)

    assert identity.owner_type == "user"
    assert identity.owner_id == USER_ID
    assert identity.is_authenticated is True
    assert identity.anonymous_token is None


def test_expired_user_token_is_rejected():
    token = _sign_user_token(expires_in=-1)

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_user_token_without_expiry_is_rejected():
    token = _sign_user_token(include_exp=False)

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_user_token_with_bad_signature_is_rejected():
    token = _sign_user_token(secret="not-the-backend-secret")

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_user_token_subject_must_be_a_uuid():
    token = _sign_user_token(subject="telegram:12345")

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_anonymous_token_round_trip():
    token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)

    identity = auth.verify_anonymous_token(token, now=NOW)

    assert identity.owner_type == "anonymous"
    assert identity.owner_id == ANON_ID
    assert identity.is_authenticated is False


def test_tampered_anonymous_token_is_rejected():
    token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)
    header, payload, signature = token.split(".")
    tampered = (
        f"{header}.{payload}."
        f"{('A' if signature[0] != 'A' else 'B') + signature[1:]}"
    )

    with pytest.raises(auth.CredentialError):
        auth.verify_anonymous_token(tampered, now=NOW)


def test_expired_anonymous_token_is_rejected():
    token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=-1)

    with pytest.raises(auth.CredentialError):
        auth.verify_anonymous_token(token, now=NOW)


def test_user_token_is_not_accepted_as_an_anonymous_token():
    token = _sign_user_token()

    with pytest.raises(auth.CredentialError):
        auth.verify_anonymous_token(token, now=NOW)


def test_anonymous_token_is_not_accepted_as_a_user_token():
    token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_user_token_with_anonymous_type_claim_is_rejected_as_user():
    token = _sign_user_token(token_type=auth.ANONYMOUS_TOKEN_TYPE)

    with pytest.raises(auth.CredentialError):
        auth.verify_user_token(token, now=NOW)


def test_resolve_prefers_valid_user_and_never_returns_anonymous_credential(monkeypatch):
    # resolve_chat_identity verifies without an explicit `now`, so freeze the
    # auth clock at the same instant used to sign these fixtures.
    monkeypatch.setattr(auth.time, "time", lambda: NOW.timestamp())
    user_token = _sign_user_token()
    anon_token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)

    identity = auth.resolve_chat_identity(
        authorization=f"Bearer {user_token}",
        anonymous_token=anon_token,
    )

    assert identity.owner_type == "user"
    assert identity.owner_id == USER_ID
    assert identity.anonymous_token is None


def test_resolve_rejects_invalid_user_even_with_valid_anonymous_credential():
    anon_token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)

    with pytest.raises(HTTPException) as exc_info:
        auth.resolve_chat_identity(
            authorization="Bearer definitely-not-a-jwt",
            anonymous_token=anon_token,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired authentication token"


def test_resolve_rejects_malformed_authorization_scheme():
    with pytest.raises(HTTPException) as exc_info:
        auth.resolve_chat_identity(
            authorization="Basic abc", anonymous_token=None
        )

    assert exc_info.value.status_code == 401


def test_resolve_reuses_valid_anonymous_identity(monkeypatch):
    monkeypatch.setattr(auth.time, "time", lambda: NOW.timestamp())
    anon_token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)

    identity = auth.resolve_chat_identity(
        authorization=None, anonymous_token=anon_token
    )

    assert identity.owner_type == "anonymous"
    assert identity.owner_id == ANON_ID
    assert identity.anonymous_token is None


def test_resolve_issues_new_anonymous_identity_when_no_credential_is_sent():
    identity = auth.resolve_chat_identity(
        authorization=None, anonymous_token=None
    )

    assert identity.owner_type == "anonymous"
    assert identity.is_authenticated is False
    assert identity.anonymous_token
    verified = auth.verify_anonymous_token(identity.anonymous_token)
    assert verified.owner_id == identity.owner_id


def test_resolve_rejects_tampered_anonymous_credential():
    token = auth.create_anonymous_token(ANON_ID, now=NOW, ttl_hours=1)
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")

    with pytest.raises(HTTPException) as exc_info:
        auth.resolve_chat_identity(
            authorization=None, anonymous_token=tampered
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired anonymous session"
