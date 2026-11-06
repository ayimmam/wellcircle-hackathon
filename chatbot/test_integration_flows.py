"""End-to-end integration flows through the real FastAPI handler.

Only the external Supabase/PostgREST client and Groq are faked. Credential
verification, session bootstrap, ownership checks, memory expiry, profile
persistence, grounding, and response persistence all run for real.

These tests deliberately use the same session id and credential across several
requests so a regression in any one layer (auth -> memory -> model -> grounding
-> persistence -> session restore) fails the flow.
"""

from __future__ import annotations

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
from experience import EXPIRED, FIRST_VISIT, RETURNING
from fake_supabase import FakeChatMemorySupabase


USER_1 = "11111111-1111-4111-8111-111111111111"
ANON_1 = "33333333-3333-4333-8333-333333333333"
ANON_2 = "44444444-4444-4444-8444-444444444444"


class FakeGroqClient:
    """Return a canned concierge payload and record each prompt."""

    def __init__(
        self,
        reply: str = "ok",
        *,
        provider_id: str | None = None,
        event_id: str | None = None,
    ):
        self.calls = []
        payload = {
            "reply": reply,
            "provider_id": provider_id,
            "provider_name": None,
            "event_id": event_id,
            "event_name": None,
        }
        content = json.dumps(payload)

        def create(**kwargs):
            self.calls.append(kwargs)
            message = types.SimpleNamespace(content=content)
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=message)]
            )

        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=create)
        )


@pytest.fixture
def client():
    return TestClient(main.app)


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _sign_user_token(subject: str) -> str:
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
            {"sub": subject, "iat": now, "exp": now + 3600},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    digest = hmac.new(
        config.JWT_SECRET.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header}.{payload}.{_b64url(digest)}"


def _user_headers(subject: str = USER_1) -> dict:
    return {"Authorization": f"Bearer {_sign_user_token(subject)}"}


def _anon_headers(subject: str = ANON_1) -> dict:
    return {auth.ANONYMOUS_HEADER: auth.create_anonymous_token(subject)}


def _row(messages, updated_at, *, owner_type: str, owner_id: str) -> dict:
    return {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


def _setup(monkeypatch, fake: FakeChatMemorySupabase | None = None):
    fake = fake or FakeChatMemorySupabase()
    monkeypatch.setattr(main, "supabase_client", fake)
    monkeypatch.setattr(
        main, "fetch_providers", lambda: (main.FALLBACK_PROVIDERS, "fallback")
    )
    monkeypatch.setattr(
        main, "fetch_events", lambda: (main.FALLBACK_EVENTS, "fallback")
    )
    main._provider_cache.update(data=None, source=None, ts=0.0)
    main._event_cache.update(data=None, source=None, ts=0.0)
    return fake


def _model(
    monkeypatch,
    reply: str = "ok",
    *,
    provider_id: str | None = None,
    event_id: str | None = None,
):
    fake = FakeGroqClient(reply, provider_id=provider_id, event_id=event_id)
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


def test_anonymous_bootstrap_chat_and_returning_flow(client, monkeypatch):
    fake_db = _setup(monkeypatch)
    model = _model(monkeypatch, "A steady yoga plan would help.")

    # Opening the chat with no credential issues the anonymous identity and a
    # session id, but must not create a row or call the model.
    opened = client.get("/ai/concierge/session")
    assert opened.status_code == 200
    first = opened.json()
    assert first["experience"] == FIRST_VISIT
    assert first["history"] == []
    assert len(first["welcome"]["cards"]) == 4
    assert first["anonymous_token"]
    assert first["session_id"]
    assert model.calls == []
    assert fake_db.rows == {}

    anonymous_id = auth.verify_anonymous_token(first["anonymous_token"]).owner_id
    session_id = first["session_id"]

    chatted = client.post(
        "/ai/concierge",
        headers={auth.ANONYMOUS_HEADER: first["anonymous_token"]},
        json={"message": "I need beginner yoga", "session_id": session_id},
    )
    assert chatted.status_code == 200
    chat = chatted.json()
    assert chat["anonymous_token"] is None
    assert chat["session_id"] == session_id
    assert chat["reply"] == "A steady yoga plan would help."

    row = fake_db.rows[session_id]
    assert row["owner_type"] == "anonymous"
    assert row["owner_id"] == anonymous_id
    assert row["messages"] == [
        {"role": "user", "content": "I need beginner yoga"},
        {"role": "assistant", "content": "A steady yoga plan would help."},
    ]

    # Reopening with the same credential/session restores history and never
    # repeats the greeting or calls the model again.
    reopened = client.get(
        f"/ai/concierge/session?session_id={session_id}",
        headers={auth.ANONYMOUS_HEADER: first["anonymous_token"]},
    )
    assert reopened.status_code == 200
    returning = reopened.json()
    assert returning["experience"] == RETURNING
    assert returning["welcome"] is None
    assert returning["history"] == row["messages"]
    assert returning["anonymous_token"] is None
    assert len(model.calls) == 1


def test_authenticated_bootstrap_chat_and_history_restore(client, monkeypatch):
    fake_db = _setup(monkeypatch)
    model = _model(monkeypatch, "A gym in Bole fits.")

    opened = client.get(
        "/ai/concierge/session",
        headers=_user_headers(USER_1),
    )
    assert opened.status_code == 200
    first = opened.json()
    assert first["experience"] == FIRST_VISIT
    assert first["anonymous_token"] is None
    assert first["session_id"]
    assert model.calls == []

    session_id = first["session_id"]
    chatted = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "gym in Bole", "session_id": session_id},
    )
    assert chatted.status_code == 200
    assert chatted.json()["anonymous_token"] is None
    assert fake_db.rows[session_id]["owner_type"] == "user"
    assert fake_db.rows[session_id]["owner_id"] == USER_1

    reopened = client.get(
        f"/ai/concierge/session?session_id={session_id}",
        headers=_user_headers(USER_1),
    )
    assert reopened.status_code == 200
    returning = reopened.json()
    assert returning["experience"] == RETURNING
    assert returning["welcome"] is None
    assert returning["history"] == fake_db.rows[session_id]["messages"]
    assert len(model.calls) == 1


def test_expired_conversation_is_fresh_but_profile_name_survives(
    client, monkeypatch
):
    old_time = datetime.now(timezone.utc) - timedelta(hours=25)
    fake_db = _setup(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "expired-session": _row(
                    [
                        {"role": "user", "content": "OLD_CONVERSATION_SECRET"},
                        {"role": "assistant", "content": "OLD_REPLY_SECRET"},
                    ],
                    old_time,
                    owner_type="anonymous",
                    owner_id=ANON_1,
                )
            },
            profiles={
                ("anonymous", ANON_1): {
                    "owner_type": "anonymous",
                    "owner_id": ANON_1,
                    "display_name": "Selam",
                    "preferences": {},
                }
            },
        ),
    )

    opened = client.get(
        "/ai/concierge/session?session_id=expired-session",
        headers=_anon_headers(ANON_1),
    )
    assert opened.status_code == 200
    expired = opened.json()
    assert expired["experience"] == EXPIRED
    assert expired["history"] == []
    assert "Welcome back, Selam!" in expired["welcome"]["text"]
    assert len(expired["welcome"]["cards"]) == 4
    assert "OLD_CONVERSATION_SECRET" not in opened.text
    assert "OLD_REPLY_SECRET" not in opened.text

    model = _model(monkeypatch, "Fresh goal, fresh plan.")
    chatted = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "new goal", "session_id": "expired-session"},
    )
    assert chatted.status_code == 200
    assert chatted.json()["reply"] == "Fresh goal, fresh plan."

    sent = json.dumps(model.calls[0]["messages"])
    assert "OLD_CONVERSATION_SECRET" not in sent
    assert "OLD_REPLY_SECRET" not in sent
    assert "Selam" in sent

    row = fake_db.rows["expired-session"]
    assert row["messages"] == [
        {"role": "user", "content": "new goal"},
        {"role": "assistant", "content": "Fresh goal, fresh plan."},
    ]
    assert fake_db.profiles[("anonymous", ANON_1)]["display_name"] == "Selam"

    reopened = client.get(
        "/ai/concierge/session?session_id=expired-session",
        headers=_anon_headers(ANON_1),
    )
    assert reopened.status_code == 200
    assert reopened.json()["experience"] == RETURNING
    assert reopened.json()["history"] == row["messages"]


def test_chat_message_is_not_preference_consent_and_name_is_not_preferences(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)
    _model(monkeypatch, "Nice to meet you.")

    chatted = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={
            "message": "my name is Selam and my budget is 500 ETB",
            "session_id": "name-only",
        },
    )
    assert chatted.status_code == 200
    assert fake_db.profiles[("anonymous", ANON_1)]["display_name"] == "Selam"
    assert "preferences" not in fake_db.profiles[("anonymous", ANON_1)]

    # A completely new session isolates the next prompt from the previous
    # conversation history, so only persisted profile data can appear.
    model = _model(monkeypatch, "What would you like to try?")
    client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "What do you suggest?", "session_id": "new-session"},
    )
    system_prompt = model.calls[0]["messages"][0]["content"]
    assert "Selam" in system_prompt
    assert "budget_etb" not in system_prompt
    assert "explicitly consented to remembering" not in system_prompt


def test_preferences_are_used_only_after_explicit_consent(client, monkeypatch):
    fake_db = _setup(monkeypatch)

    refused = client.patch(
        "/ai/concierge/profile",
        headers=_anon_headers(ANON_1),
        json={"preferences": {"budget_etb": 500}, "consent": False},
    )
    assert refused.status_code == 400
    assert fake_db.profiles == {}

    accepted = client.patch(
        "/ai/concierge/profile",
        headers=_anon_headers(ANON_1),
        json={
            "display_name": "Selam",
            "preferences": {"budget_etb": 500, "neighbourhood": "Bole"},
            "consent": True,
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["preferences"] == {
        "budget_etb": 500,
        "neighbourhood": "Bole",
    }

    model = _model(monkeypatch, "Here is a Bole option.")
    chatted = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "What fits my budget?", "session_id": "profile-session"},
    )
    assert chatted.status_code == 200
    system_prompt = model.calls[0]["messages"][0]["content"]
    assert "Selam" in system_prompt
    assert "budget_etb" in system_prompt
    assert '"budget_etb": 500' in system_prompt
    assert "Bole" in system_prompt


def test_cross_identity_session_and_chat_are_rejected(client, monkeypatch):
    fake_db = _setup(monkeypatch)
    _model(monkeypatch, "private reply")

    first = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "PRIVATE_CONTEXT", "session_id": "private-session"},
    )
    assert first.status_code == 200

    intruder_model = _model(monkeypatch, "intruder reply")
    chat = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_2),
        json={"message": "steal", "session_id": "private-session"},
    )
    assert chat.status_code == 403
    assert intruder_model.calls == []

    opened = client.get(
        "/ai/concierge/session?session_id=private-session",
        headers=_anon_headers(ANON_2),
    )
    assert opened.status_code == 403
    assert "PRIVATE_CONTEXT" not in opened.text
    assert fake_db.rows["private-session"]["owner_id"] == ANON_1


def test_grounded_event_reply_is_returned_and_persisted(client, monkeypatch):
    fake_db = _setup(monkeypatch)
    _model(
        monkeypatch,
        "Sunrise HIIT is only 50 ETB with 2 spots left.",
        event_id="fe-001",
    )

    response = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "events this weekend", "session_id": "event-session"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["event_id"] == "fe-001"
    assert body["event_name"] == "Sunrise HIIT at Bole Wellness Hub"
    assert "ETB 250" in body["reply"]
    assert "8 spots remaining" in body["reply"]
    assert "50 ETB" not in body["reply"]
    assert "2 spots left" not in body["reply"]

    stored = fake_db.rows["event-session"]["messages"]
    assert stored[-1]["role"] == "assistant"
    assert stored[-1]["content"] == body["reply"]

    reopened = client.get(
        "/ai/concierge/session?session_id=event-session",
        headers=_anon_headers(ANON_1),
    )
    assert reopened.json()["history"][-1]["content"] == body["reply"]


def test_provider_fetch_failure_still_uses_safe_fallback_data(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)

    def provider_failure():
        raise RuntimeError("provider query exploded")

    monkeypatch.setattr(main, "get_providers", provider_failure)
    model = _model(
        monkeypatch,
        "Bole Wellness Hub has group classes.",
        provider_id="fb-001",
    )

    response = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "gym in Bole", "session_id": "provider-failure"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data_source"] == "fallback"
    assert body["provider_id"] == "fb-001"
    assert body["provider_name"] == "Bole Wellness Hub"
    assert "Bole Wellness Hub" in model.calls[0]["messages"][0]["content"]
    assert fake_db.rows["provider-failure"]["messages"][-1]["content"] == body["reply"]


def test_event_fetch_failure_cannot_return_an_invented_event_reply(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)

    def event_failure():
        raise RuntimeError("event query exploded")

    monkeypatch.setattr(main, "get_events", event_failure)
    model = _model(
        monkeypatch,
        "Sunrise HIIT at Bole Wellness Hub is a great event.",
        event_id="fe-001",
    )

    response = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "events this weekend", "session_id": "event-failure"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["event_id"] is None
    assert body["event_name"] is None
    assert body["event_provider_id"] is None
    assert body["reply"] == main.UNVERIFIED_EVENT_REPLY
    assert "Sunrise HIIT" not in body["reply"]
    assert "Available Upcoming Events: []" in model.calls[0]["messages"][0]["content"]
    assert fake_db.rows["event-failure"]["messages"][-1]["content"] == body["reply"]


def test_memory_read_failure_never_exposes_another_owners_history(
    client, monkeypatch
):
    secret_row = _row(
        [
            {"role": "user", "content": "OTHER_OWNER_SECRET"},
            {"role": "assistant", "content": "OTHER_OWNER_REPLY"},
        ],
        datetime.now(timezone.utc) - timedelta(minutes=5),
        owner_type="anonymous",
        owner_id=ANON_2,
    )
    fake_db = _setup(
        monkeypatch,
        FakeChatMemorySupabase(rows={"shared": secret_row}, fail_read=True),
    )

    opened = client.get(
        "/ai/concierge/session?session_id=shared",
        headers=_anon_headers(ANON_1),
    )
    assert opened.status_code == 200
    session = opened.json()
    assert session["experience"] == RETURNING
    assert session["history"] == []
    assert session["memory_available"] is False
    assert "OTHER_OWNER_SECRET" not in opened.text
    assert "OTHER_OWNER_REPLY" not in opened.text

    model = _model(monkeypatch, "Safe answer without history.")
    chatted = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "hello", "session_id": "shared"},
    )
    assert chatted.status_code == 200
    assert chatted.json()["reply"] == "Safe answer without history."
    sent = json.dumps(model.calls[0]["messages"])
    assert "OTHER_OWNER_SECRET" not in sent
    assert "OTHER_OWNER_REPLY" not in sent
    # The failed read skips persistence, so the unknown row is untouched.
    assert fake_db.rows["shared"] == secret_row
