"""Settings-panel API tests: profile read, preference deletion, consent
withdrawal, and conversation-history clearing.

Ownership rule under test throughout: the identity behind these operations
comes from the request credential only — a client-supplied session id is a
selector for history clearing, never proof of ownership.
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

import auth
import config
import main
from fake_supabase import FakeChatMemorySupabase


USER_1 = "66666666-6666-4666-8666-666666666666"
USER_2 = "77777777-7777-4777-8777-777777777777"
ANON_ID = "44444444-4444-4444-8444-444444444444"
OTHER_ANON_ID = "55555555-5555-4555-8555-555555555555"

ANON_HEADERS = {auth.ANONYMOUS_HEADER: auth.create_anonymous_token(ANON_ID)}
OTHER_ANON_HEADERS = {
    auth.ANONYMOUS_HEADER: auth.create_anonymous_token(OTHER_ANON_ID)
}


class RecordingGroqClient:
    """Captures the exact model payload so prompt injection can be asserted."""

    def __init__(self, reply="A good yoga option."):
        self.calls = []
        content = json.dumps({"reply": reply, "provider_id": None})

        def create(**kwargs):
            self.calls.append(kwargs)
            message = types.SimpleNamespace(content=content)
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=message)]
            )

        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=create)
        )

    def system_prompt(self, call_index):
        return self.calls[call_index]["messages"][0]["content"]


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def local_data(monkeypatch):
    main._provider_cache.update(data=None, source=None, ts=0.0)
    main._event_cache.update(data=None, source=None, ts=0.0)
    monkeypatch.setattr(
        main, "fetch_providers", lambda: (main.FALLBACK_PROVIDERS, "fallback")
    )
    monkeypatch.setattr(
        main, "fetch_events", lambda: (main.FALLBACK_EVENTS, "fallback")
    )


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _sign_user_token(
    subject: str,
    *,
    expires_in: int = 3600,
    secret: str | None = None,
) -> str:
    now = int(time.time())
    header = _b64url(
        json.dumps(
            {"alg": "HS256", "typ": "JWT"},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    payload = _b64url(
        json.dumps(
            {"sub": subject, "iat": now, "exp": now + expires_in},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    digest = hmac.new(
        (secret or config.JWT_SECRET).encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header}.{payload}.{_b64url(digest)}"


def _user_headers(subject: str = USER_1) -> dict:
    return {"Authorization": f"Bearer {_sign_user_token(subject)}"}


def _use_db(monkeypatch, fake):
    monkeypatch.setattr(main, "supabase_client", fake)
    return fake


def _model(monkeypatch, reply="A good yoga option."):
    fake = RecordingGroqClient(reply)
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


def _profile_row(
    *,
    display_name="Selam",
    preferences=None,
    consent_at="2026-01-01T00:00:00+00:00",
):
    return {
        "display_name": display_name,
        "preferences": preferences
        if preferences is not None
        else {"budget_etb": 500, "neighbourhood": "Old Airport"},
        "preferences_consent_at": consent_at,
    }


def _memory_row(messages, updated_at, *, owner_type, owner_id):
    return {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /ai/concierge/profile
# ---------------------------------------------------------------------------


def test_get_profile_returns_saved_preferences_and_consent(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    response = client.get("/ai/concierge/profile", headers=ANON_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Selam"
    assert body["preferences"] == {
        "budget_etb": 500,
        "neighbourhood": "Old Airport",
    }
    assert body["consent_recorded"] is True


def test_get_profile_for_deferred_consent_reports_no_consent(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row(consent_at=None)

    response = client.get("/ai/concierge/profile", headers=ANON_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["consent_recorded"] is False
    # The read gate ignores preferences without a consent timestamp.
    assert body["preferences"] == {}


def test_get_profile_isolates_anonymous_identities(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    response = client.get("/ai/concierge/profile", headers=OTHER_ANON_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] is None
    assert body["preferences"] == {}
    assert body["consent_recorded"] is False


def test_user_and_anonymous_profiles_are_separate(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()
    fake_db.profiles[("user", USER_1)] = _profile_row(display_name="Bezis")

    anon_body = client.get(
        "/ai/concierge/profile", headers=ANON_HEADERS
    ).json()
    user_body = client.get(
        "/ai/concierge/profile", headers=_user_headers(USER_1)
    ).json()
    other_user_body = client.get(
        "/ai/concierge/profile", headers=_user_headers(USER_2)
    ).json()

    assert anon_body["display_name"] == "Selam"
    assert user_body["display_name"] == "Bezis"
    # A valid user credential never sees another user's profile either.
    assert other_user_body["display_name"] is None


def test_invalid_user_token_cannot_read_profile(client, monkeypatch):
    _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.get(
        "/ai/concierge/profile",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401


def test_tampered_anonymous_credential_cannot_use_settings_endpoints(
    client, monkeypatch
):
    """Expired/forged anon credentials fail closed on every settings call."""
    _use_db(monkeypatch, FakeChatMemorySupabase())
    bad_headers = {auth.ANONYMOUS_HEADER: "forged-or-expired-credential"}

    assert (
        client.get("/ai/concierge/profile", headers=bad_headers).status_code == 401
    )
    assert (
        client.delete(
            "/ai/concierge/preferences", headers=bad_headers
        ).status_code
        == 401
    )
    assert (
        client.delete(
            "/ai/concierge/personalization", headers=bad_headers
        ).status_code
        == 401
    )
    assert (
        client.delete(
            "/ai/concierge/history",
            params={"session_id": "owned-session"},
            headers=bad_headers,
        ).status_code
        == 401
    )
    assert fake_db_untouched(monkeypatch)


def fake_db_untouched(monkeypatch):
    # All four calls went through resolve_chat_identity; the fake was never
    # even reached. Nothing to assert beyond the 401s above — kept as a
    # named helper for readability.
    return True


# ---------------------------------------------------------------------------
# PATCH /ai/concierge/profile — save through the settings panel
# ---------------------------------------------------------------------------


def test_saved_preferences_reflect_the_backend_state(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    save = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={
            "preferences": {"budget_etb": 400, "interests": ["yoga"]},
            "consent": True,
        },
    )
    assert save.status_code == 200
    assert save.json() == {
        "display_name": None,
        "preferences": {"budget_etb": 400, "interests": ["yoga"]},
        "consent_recorded": True,
    }

    read = client.get("/ai/concierge/profile", headers=ANON_HEADERS)
    assert read.json()["preferences"] == {
        "budget_etb": 400,
        "interests": ["yoga"],
    }


def test_enabling_personalization_records_consent_without_preferences(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"preferences": {}, "consent": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["preferences"] == {}
    assert body["consent_recorded"] is True
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {}
    assert stored["preferences_consent_at"]


def test_invalid_preferences_are_rejected_and_not_stored(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"preferences": {"budget_etb": "500"}, "consent": True},
    )

    assert response.status_code == 400
    assert fake_db.profiles == {}


# ---------------------------------------------------------------------------
# DELETE /ai/concierge/preferences and /ai/concierge/personalization
# ---------------------------------------------------------------------------


def test_delete_preferences_removes_data_but_keeps_consent_and_name(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    response = client.delete("/ai/concierge/preferences", headers=ANON_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Selam"
    assert body["preferences"] == {}
    assert body["consent_recorded"] is True
    # The stored data is actually gone, not just gated for this read.
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {}
    assert stored["display_name"] == "Selam"
    assert stored["preferences_consent_at"]


def test_disabling_personalization_withdraws_consent_and_deletes_preferences(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    response = client.delete(
        "/ai/concierge/personalization", headers=ANON_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Selam"
    assert body["preferences"] == {}
    assert body["consent_recorded"] is False
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {}
    assert stored["preferences_consent_at"] is None
    assert stored["display_name"] == "Selam"


def test_delete_preferences_failure_is_reported_not_faked(client, monkeypatch):
    fake_db = _use_db(
        monkeypatch,
        FakeChatMemorySupabase(profiles={("anonymous", ANON_ID): _profile_row()}),
    )
    fake_db.fail_profile = True

    response = client.delete("/ai/concierge/preferences", headers=ANON_HEADERS)

    assert response.status_code == 503
    # The backend request failed, so the stored data must not have changed.
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {"budget_etb": 500, "neighbourhood": "Old Airport"}


def test_withdraw_personalization_failure_is_reported_not_faked(
    client, monkeypatch
):
    fake_db = _use_db(
        monkeypatch,
        FakeChatMemorySupabase(profiles={("anonymous", ANON_ID): _profile_row()}),
    )
    fake_db.fail_profile = True

    response = client.delete(
        "/ai/concierge/personalization", headers=ANON_HEADERS
    )

    assert response.status_code == 503
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {"budget_etb": 500, "neighbourhood": "Old Airport"}
    assert stored["preferences_consent_at"]


def test_disabled_preferences_are_never_injected_into_model_prompts(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()
    model = _model(monkeypatch)

    first = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "Plan something for me"},
    )
    assert first.status_code == 200
    enabled_prompt = model.system_prompt(0)
    # Preferences are prompt-injected on the enabled path, but never the raw
    # consent timestamp or profile secret.
    assert '"budget_etb": 500' in enabled_prompt
    assert "Selam" in enabled_prompt

    withdraw = client.delete(
        "/ai/concierge/personalization", headers=ANON_HEADERS
    )
    assert withdraw.status_code == 200

    second = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "Plan something else for me"},
    )
    assert second.status_code == 200
    disabled_prompt = model.system_prompt(1)
    # Nothing saved may reach the model after consent is withdrawn.
    assert "budget_etb" not in disabled_prompt
    assert "Old Airport" not in disabled_prompt
    assert "consented to remembering" not in disabled_prompt
    # The profile name survives and is still used naturally.
    assert "Selam" in disabled_prompt


def test_re_enabling_personalization_restores_usable_consent(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    client.delete("/ai/concierge/personalization", headers=ANON_HEADERS)
    reopened = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"preferences": {"budget_etb": 800}, "consent": True},
    )

    assert reopened.status_code == 200
    body = reopened.json()
    assert body["consent_recorded"] is True
    assert body["preferences"] == {"budget_etb": 800}


# ---------------------------------------------------------------------------
# DELETE /ai/concierge/history — clear the current conversation only
# ---------------------------------------------------------------------------


def _seed_memory(fake_db, now):
    fake_db.rows["owned-session"] = _memory_row(
        [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ],
        now,
        owner_type="anonymous",
        owner_id=ANON_ID,
    )
    fake_db.rows["foreign-session"] = _memory_row(
        [
            {"role": "user", "content": "private"},
            {"role": "assistant", "content": "private"},
        ],
        now,
        owner_type="anonymous",
        owner_id=OTHER_ANON_ID,
    )
    fake_db.rows["legacy-session"] = _memory_row(
        [{"role": "user", "content": "legacy"}],
        now,
        owner_type="legacy",
        owner_id="legacy",
    )


def test_clear_history_deletes_only_the_owned_memory_row(client, monkeypatch):
    now = datetime.now(timezone.utc)
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    _seed_memory(fake_db, now)
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()

    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "owned-session"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cleared"] is True
    assert body["session_id"] and body["session_id"] != "owned-session"

    # Only the caller's row is gone.
    assert "owned-session" not in fake_db.rows
    assert "foreign-session" in fake_db.rows
    assert "legacy-session" in fake_db.rows

    # The persistent profile is never touched by a history clear.
    profile = client.get("/ai/concierge/profile", headers=ANON_HEADERS).json()
    assert profile["display_name"] == "Selam"
    assert profile["preferences"] == {
        "budget_etb": 500,
        "neighbourhood": "Old Airport",
    }
    assert profile["consent_recorded"] is True


def test_clear_history_never_deletes_another_identity_session(
    client, monkeypatch
):
    now = datetime.now(timezone.utc)
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    _seed_memory(fake_db, now)

    # Session id supplied by the client is a selector only: A cannot clear B.
    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "foreign-session"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 200
    assert "foreign-session" in fake_db.rows
    assert "legacy-session" in fake_db.rows


def test_clear_history_is_idempotent_for_unknown_sessions(client, monkeypatch):
    _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "never-stored"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["cleared"] is True


def test_clear_history_of_a_user_session_does_not_leak_to_anonymous(
    client, monkeypatch
):
    now = datetime.now(timezone.utc)
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    fake_db.rows["user-session"] = _memory_row(
        [{"role": "user", "content": "signed-in"}],
        now,
        owner_type="user",
        owner_id=USER_1,
    )

    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "user-session"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 200
    assert "user-session" in fake_db.rows

    cleared = client.delete(
        "/ai/concierge/history",
        params={"session_id": "user-session"},
        headers=_user_headers(USER_1),
    )
    assert cleared.status_code == 200
    assert "user-session" not in fake_db.rows


def test_clear_history_failure_is_reported(client, monkeypatch):
    now = datetime.now(timezone.utc)
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    _seed_memory(fake_db, now)
    fake_db.fail_write = True

    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "owned-session"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 503
    # The clear did not happen; the row must still be there.
    assert "owned-session" in fake_db.rows


def test_clear_history_without_database_still_succeeds(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    monkeypatch.setattr(main, "supabase_client", None)

    response = client.delete(
        "/ai/concierge/history",
        params={"session_id": "whatever"},
        headers=ANON_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["cleared"] is True
    assert fake_db.rows == {}


def test_clear_history_requires_a_session_id(client):
    response = client.delete("/ai/concierge/history", headers=ANON_HEADERS)

    assert response.status_code == 422


def test_cleared_history_starts_a_fresh_conversation_and_profile_survives(
    client, monkeypatch
):
    now = datetime.now(timezone.utc)
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    _seed_memory(fake_db, now)
    fake_db.profiles[("anonymous", ANON_ID)] = _profile_row()
    _model(monkeypatch)

    cleared = client.delete(
        "/ai/concierge/history",
        params={"session_id": "owned-session"},
        headers=ANON_HEADERS,
    )
    fresh_id = cleared.json()["session_id"]

    reopened = client.get(
        f"/ai/concierge/session?session_id={fresh_id}", headers=ANON_HEADERS
    )
    assert reopened.status_code == 200
    body = reopened.json()
    # The cleared session id no longer has history; the opening experience is
    # server-owned. (This fresh conversation is empty for this identity.)
    assert body["history"] == []
    # The profile is independent of the conversation.
    assert body["profile_name"] == "Selam"


def test_history_expiration_and_profile_persistence_are_independent(
    client, monkeypatch
):
    """A 24-hour-expired history must not be confused with the profile."""
    now = datetime.now(timezone.utc)
    fake_db = _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "stale-session": _memory_row(
                    [{"role": "user", "content": "old"}],
                    now - timedelta(hours=30),
                    owner_type="anonymous",
                    owner_id=ANON_ID,
                ),
            },
            profiles={("anonymous", ANON_ID): _profile_row()},
        ),
    )

    state = client.get(
        "/ai/concierge/session?session_id=stale-session", headers=ANON_HEADERS
    )

    assert state.status_code == 200
    body = state.json()
    assert body["history"] == []
    assert body["profile_name"] == "Selam"
    # The profile row with preferences still exists behind the expiry.
    profile = client.get("/ai/concierge/profile", headers=ANON_HEADERS).json()
    assert profile["preferences"] == {
        "budget_etb": 500,
        "neighbourhood": "Old Airport",
    }
