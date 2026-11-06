"""Phase E — Circler continuity across linked Google/Telegram identities.

The backend proves in ``test_identity_end_to_end.py`` that both provider logins
produce a JWT with the same canonical ``sub``. This test proves the Circler
layer treats that subject as one owner: the same history/profile is returned
regardless of which provider issued the token, new turns are stored under the
canonical UUID, and anonymous/expired/invalid credentials never inherit it.
"""

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import auth
import config
import memory
import profile
from fake_supabase import FakeChatMemorySupabase

CANONICAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ANONYMOUS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _sign_user_token(subject: str, *, expires_in: int = 3600) -> str:
    """A backend-format HS256 user JWT (mirrors FastAPI ``_create_token``)."""
    now = int(time.time())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(
        json.dumps({"sub": subject, "iat": now, "exp": now + expires_in}, separators=(",", ":")).encode()
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    digest = hmac.new(config.JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(digest)}"


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeChatMemorySupabase(
        now=NOW,
        users={CANONICAL: {"name": "Canonical Account"}},
    )
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: fake)
    monkeypatch.setattr(profile, "_get_supabase_client", lambda: fake)
    return fake


def test_both_provider_tokens_share_history_profile_and_new_turns(fake_db):
    # The two tokens represent a Google login and a Telegram login that the
    # backend resolved to the same canonical user. JWT format carries no
    # provider claim; the common ``sub`` is the continuity guarantee.
    google_identity = auth.verify_user_token(_sign_user_token(CANONICAL))
    telegram_identity = auth.verify_user_token(_sign_user_token(CANONICAL))
    assert google_identity == telegram_identity
    assert google_identity.owner_type == "user"
    assert google_identity.owner_id == CANONICAL

    # A conversation started via one provider is readable via the other.
    memory.append_session_turn(
        "shared-session",
        "I prefer yoga",
        "Noted — yoga.",
        owner_type=google_identity.owner_type,
        owner_id=google_identity.owner_id,
        now=NOW,
    )
    state = memory.get_session_state(
        "shared-session",
        owner_type=telegram_identity.owner_type,
        owner_id=telegram_identity.owner_id,
        now=NOW,
    )
    assert state.status == "active"
    assert [m["content"] for m in state.messages] == ["I prefer yoga", "Noted — yoga."]

    # Preferences/name are keyed by the same canonical owner.
    profile.save_preferences(
        google_identity.owner_type,
        google_identity.owner_id,
        {"interests": ["yoga"], "budget_etb": 500},
        consent=True,
    )
    via_telegram = profile.get_profile(
        telegram_identity.owner_type, telegram_identity.owner_id
    )
    assert via_telegram.preferences == {"interests": ["yoga"], "budget_etb": 500}
    assert via_telegram.display_name == "Canonical Account"

    # A new turn through the other provider is stored under the canonical UUID.
    memory.append_session_turn(
        "telegram-started-session",
        "What gym is nearby?",
        "Try the nearby gym.",
        owner_type=telegram_identity.owner_type,
        owner_id=telegram_identity.owner_id,
        now=NOW,
    )
    assert fake_db.rows["telegram-started-session"]["owner_type"] == "user"
    assert fake_db.rows["telegram-started-session"]["owner_id"] == CANONICAL
    assert fake_db.rows["shared-session"]["owner_id"] == CANONICAL
    assert set(fake_db.profiles) == {("user", CANONICAL)}


def test_anonymous_session_cannot_read_canonical_history(fake_db):
    memory.append_session_turn(
        "canonical-session",
        "private user message",
        "private reply",
        owner_type="user",
        owner_id=CANONICAL,
        now=NOW,
    )
    anonymous_token = auth.create_anonymous_token(ANONYMOUS)
    anonymous = auth.verify_anonymous_token(anonymous_token)
    assert anonymous.owner_type == "anonymous"

    state = memory.get_session_state(
        "canonical-session",
        owner_type=anonymous.owner_type,
        owner_id=anonymous.owner_id,
        now=NOW,
    )
    assert state.status == "forbidden"
    assert state.messages == []

    memory.append_session_turn(
        "anonymous-session",
        "anonymous message",
        "anonymous reply",
        owner_type=anonymous.owner_type,
        owner_id=anonymous.owner_id,
        now=NOW,
    )
    assert fake_db.rows["anonymous-session"]["owner_id"] == ANONYMOUS
    assert fake_db.rows["canonical-session"]["owner_id"] == CANONICAL


def test_expired_history_is_hidden_but_not_deleted(fake_db):
    memory.append_session_turn(
        "old-session",
        "old message",
        "old reply",
        owner_type="user",
        owner_id=CANONICAL,
        now=NOW,
    )
    later = NOW + timedelta(hours=25)
    state = memory.get_session_state(
        "old-session",
        owner_type="user",
        owner_id=CANONICAL,
        now=later,
    )
    assert state.status == "expired"
    assert state.messages == []
    assert fake_db.rows["old-session"]["messages"]


def test_invalid_or_expired_jwt_never_falls_back_to_anonymous(fake_db):
    anonymous_token = auth.create_anonymous_token(ANONYMOUS)
    with pytest.raises(HTTPException) as invalid:
        auth.resolve_chat_identity(
            authorization="Bearer not-a-valid-jwt",
            anonymous_token=anonymous_token,
        )
    assert invalid.value.status_code == 401

    with pytest.raises(HTTPException) as expired:
        auth.resolve_chat_identity(
            authorization=f"Bearer {_sign_user_token(CANONICAL, expires_in=-1)}",
            anonymous_token=anonymous_token,
        )
    assert expired.value.status_code == 401

    # An anonymous credential presented as a bearer user token is also rejected.
    with pytest.raises(HTTPException) as wrong_type:
        auth.resolve_chat_identity(authorization=f"Bearer {anonymous_token}")
    assert wrong_type.value.status_code == 401
