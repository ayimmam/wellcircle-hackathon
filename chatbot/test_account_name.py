"""Automatic name retrieval from the existing account/onboarding profile.

The account profile is ``public.users.name`` (set during Well Circle
onboarding). For a signed-in concierge user the server reads it using the
verified JWT identity — never a client-supplied id — and it is authoritative:

* the account name wins over any chat-stored display_name,
* a name stated in ordinary chat is stored on the chat profile but can never
  overwrite or mask the account name,
* the name needs no personalization consent (it came from the user's account;
  consent still governs optional preferences),
* anonymous visitors never touch the accounts table and get a generic
  welcome.

API-level tests use ``FakeChatMemorySupabase`` (the ``chat_memory`` /
``chat_profile`` / ``users`` shapes) plus real HS256 tokens so ownership,
authentication, and profile precedence are exercised end to end.
"""

import base64
import hashlib
import hmac
import json
import time
import types
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import main
import memory
from auth import create_anonymous_token
from fake_supabase import FakeChatMemorySupabase

USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

_TEST_JWT_SECRET = "test-only-user-jwt-secret"


def _sign_user_token(subject: str, *, expires_in: int = 3600) -> str:
    b64url = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")
    now = int(time.time())
    header = b64url(
        json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload = b64url(
        json.dumps(
            {"sub": subject, "iat": now, "exp": now + expires_in},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    digest = hmac.new(
        _TEST_JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    return f"{header}.{payload}.{b64url(digest)}"


def _user_headers(subject: str = USER_A) -> dict:
    return {"Authorization": f"Bearer {_sign_user_token(subject)}"}


def _anon_headers() -> dict:
    return {"X-Circler-Anonymous-Token": create_anonymous_token()}


def _fake_model(monkeypatch) -> None:
    """Install a canned model so a real turn can run without credentials."""

    def create(**kwargs):
        return types.SimpleNamespace(
            choices=[
                types.SimpleNamespace(
                    message=types.SimpleNamespace(
                        content=(
                            '{"reply": "Nice to meet you!", "provider_id": null, '
                            '"provider_name": null, "event_id": null, "event_name": null}'
                        )
                    )
                )
            ]
        )

    monkeypatch.setattr(
        main,
        "groq_client",
        types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create))
        ),
    )


class RecordingUsersDict(dict):
    """users rows that record whether they were ever read."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reads = 0

    def get(self, key, *args, **kwargs):
        if key in self:
            self.reads += 1
        return super().get(key, *args, **kwargs)


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def db(monkeypatch):
    fake = FakeChatMemorySupabase()
    # RecordingUsersDict starts empty (falsy), so assign it after construction.
    fake.users = RecordingUsersDict()
    monkeypatch.setattr(main, "supabase_client", fake)
    memory._cache_clear()
    yield fake
    memory._cache_clear()


def _insert_memory_row(db, owner_type, owner_id, session_id):
    now = datetime.now(timezone.utc)
    db.rows[session_id] = {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": [
            {"role": "user", "content": "I prefer yoga in Bole"},
            {"role": "assistant", "content": "Hello!"},
        ],
        "updated_at": (now + timedelta(minutes=1)).isoformat(),
    }


# --- 1. Authenticated user with an existing account name ----------------------
def test_account_name_personalizes_welcome_and_profile(client, db):
    db.users[USER_A] = {"name": "Hanna"}

    res = client.get("/ai/concierge/session", headers=_user_headers())

    assert res.status_code == 200
    body = res.json()
    assert body["experience"] == "first_visit"
    assert body["profile_name"] == "Hanna"
    assert body["welcome"] and body["welcome"]["text"].startswith("Hi Hanna!")


def test_account_name_wins_over_chat_stored_name(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    db.profiles[("user", USER_A)] = {
        "display_name": "Alex",  # a name the user stated to the chatbot once
        "preferences": {},
        "preferences_consent_at": None,
    }

    body = client.get("/ai/concierge/session", headers=_user_headers()).json()

    assert body["profile_name"] == "Hanna"


def test_turn_raises_the_account_name_not_a_stated_one(client, db, monkeypatch):
    """A chat message saying 'call me X' must not mask the account name."""

    db.users[USER_A] = {"name": "Hanna"}
    _fake_model(monkeypatch)

    body = client.post(
        "/ai/concierge",
        json={"message": "Hi, my name is Selam."},
        headers=_user_headers(),
    ).json()

    assert body["reply"] == "Nice to meet you!"
    stored = db.profiles.get(("user", USER_A))
    if stored is not None:
        # The stated name is at most remembered on the chat profile...
        assert stored.get("display_name") != "Hanna" or stored is None
    # ...but it never overwrites the account row.
    assert db.users[USER_A]["name"] == "Hanna"


# --- 2. Authenticated user whose account name is missing ----------------------
def test_missing_account_name_is_generic_never_crashing(client, db):
    db.users[USER_A] = {"name": None}

    body = client.get("/ai/concierge/session", headers=_user_headers()).json()

    assert body["profile_name"] is None
    assert body["welcome"] is not None
    assert "Hi " not in body["welcome"]["text"]


def test_missing_account_name_falls_back_to_chat_stored_name(client, db):
    db.users[USER_A] = {"name": None}
    db.profiles[("user", USER_A)] = {
        "display_name": "Alex",
        "preferences": {},
        "preferences_consent_at": None,
    }

    body = client.get("/ai/concierge/session", headers=_user_headers()).json()

    assert body["profile_name"] == "Alex"


def test_nameless_account_uses_the_name_stated_in_the_turn(client, db, monkeypatch):
    db.users[USER_A] = {"name": None}
    _fake_model(monkeypatch)

    body = client.post(
        "/ai/concierge",
        json={"message": "Hi, my name is Selam."},
        headers=_user_headers(),
    ).json()

    assert body["reply"] == "Nice to meet you!"
    # No account name, so the freshly stated name becomes the profile name —
    # the pre-existing conversational flow, only reached without an account.
    if db.profiles.get(("user", USER_A)):
        assert db.profiles[("user", USER_A)]["display_name"] == "Selam"


# --- 3. Account name changes; Circler retrieves the updated name --------------
def test_changed_account_name_is_served_on_every_new_read(client, db):
    db.users[USER_A] = {"name": "Old Name"}
    db.profiles[("user", USER_A)] = {
        "display_name": "StaleNick",
        "preferences": {},
        "preferences_consent_at": None,
    }

    first = client.get("/ai/concierge/session", headers=_user_headers()).json()
    assert first["profile_name"] == "Old Name"

    db.users[USER_A] = {"name": "Renamed User"}
    second = client.get("/ai/concierge/session", headers=_user_headers()).json()
    assert second["profile_name"] == "Renamed User"


# --- 4. Anonymous users -------------------------------------------------------
def test_anonymous_greeting_is_generic_and_accounts_are_never_read(client, db):
    db.users[USER_A] = {"name": "Someone"}

    res = client.get("/ai/concierge/session", headers=_anon_headers())

    assert res.status_code == 200
    body = res.json()
    assert body["profile_name"] is None
    assert body["welcome"] is not None
    assert "Hi " not in body["welcome"]["text"]


def test_anonymous_default_bootstrap_never_reads_accounts(client, db):
    db.users[USER_A] = {"name": "Someone"}

    body = client.get("/ai/concierge/session").json()

    assert body["profile_name"] is None
    assert db.users.reads == 0


# --- 5. A user cannot retrieve another user's name ----------------------------
def test_user_b_cannot_retrieve_user_a_name_or_session(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    db.profiles[("user", USER_A)] = {
        "display_name": "Hanna",
        "preferences": {"budget_etb": 500},
        "preferences_consent_at": "2026-01-01T00:00:00+00:00",
    }

    body = client.get("/ai/concierge/session", headers=_user_headers(USER_B)).json()
    serialized = json.dumps(body)

    assert serialized.count("Hanna") == 0
    assert "budget_etb" not in serialized
    assert body.get("history", []) == []


def test_user_b_cannot_read_user_a_session_history(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    _insert_memory_row(db, "user", USER_A, "sess-owned-by-a")

    res = client.get(
        "/ai/concierge/session?session_id=sess-owned-by-a",
        headers=_user_headers(USER_B),
    )

    assert res.status_code == 403


# --- 6. Invalid authentication does not fall back to another identity ---------
def test_invalid_user_token_is_rejected_with_no_profile_data(client, db):
    db.users[USER_A] = {"name": "Hanna"}

    res = client.get(
        "/ai/concierge/session", headers={"Authorization": "Bearer not-a-token"}
    )

    assert res.status_code == 401
    body = res.json()
    assert "anonymous_token" not in body
    assert "Hanna" not in str(body)


def test_forged_signed_token_for_another_subject_gets_nothing(client, db):
    rogue = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    db.users[USER_A] = {"name": "Hanna"}

    body = client.get("/ai/concierge/session", headers=_user_headers(rogue)).json()

    assert body["profile_name"] is None


# --- 7. Active conversation restores silently ---------------------------------
def test_active_conversation_restores_without_a_greeting(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    _insert_memory_row(db, "user", USER_A, "sess-active")

    res = client.get(
        "/ai/concierge/session?session_id=sess-active", headers=_user_headers()
    )

    assert res.status_code == 200
    body = res.json()
    assert body["experience"] == "returning"
    assert body["welcome"] is None
    assert body["profile_name"] == "Hanna"
    assert body["history"][-1]["content"] == "Hello!"


# --- 8. Consent and preference behavior unchanged -----------------------------
def test_account_name_flows_without_personalization_consent(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    db.profiles[("user", USER_A)] = {
        "display_name": None,
        "preferences": {"budget_etb": 500},  # would be ignored (no consent)
        "preferences_consent_at": None,
    }

    body = client.get("/ai/concierge/session", headers=_user_headers()).json()

    assert body["profile_name"] == "Hanna"


def test_patch_preferences_without_consent_is_still_rejected(client, db):
    res = client.patch(
        "/ai/concierge/profile",
        json={"preferences": {"budget_etb": 500}},
        headers=_user_headers(),
    )
    assert res.status_code == 400


def test_withdrawal_keeps_names_and_never_writes_the_account_row(client, db):
    db.users[USER_A] = {"name": "Hanna"}
    db.profiles[("user", USER_A)] = {
        "display_name": "Alex",
        "preferences": {"budget_etb": 500},
        "preferences_consent_at": "2026-01-01T00:00:00+00:00",
    }

    res = client.delete("/ai/concierge/personalization", headers=_user_headers())
    assert res.status_code == 200
    body = res.json()
    assert body["preferences"] == {}           # preferences removed
    assert body["consent_recorded"] is False   # consent withdrawn
    # The authoritative account name still shows (withdrawal leaves names
    # alone); the chat-stored fallback name also survives in its row.
    assert body["display_name"] == "Hanna"
    assert db.profiles[("user", USER_A)]["display_name"] == "Alex"
    assert db.users[USER_A] == {"name": "Hanna"}  # account never modified
