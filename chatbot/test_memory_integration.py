"""Integration tests: the real memory layer through the FastAPI endpoint.

Only the external Supabase and Groq clients are faked. The request handler,
expiry checks, RPC call shape, response validation, and cache updates all run
for real.
"""

from datetime import datetime, timedelta, timezone
import json
import logging
import types

import pytest
from fastapi.testclient import TestClient

import auth
import main
from fake_supabase import FakeChatMemorySupabase


ANON_ID = "33333333-3333-4333-8333-333333333333"
ANON_TOKEN = auth.create_anonymous_token(ANON_ID)
ANON_HEADERS = {auth.ANONYMOUS_HEADER: ANON_TOKEN}


def _row(messages, updated_at, *, owner_type="anonymous", owner_id=ANON_ID):
    return {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


class FakeGroqClient:
    def __init__(self, content):
        self.calls = []

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


def _use_fake_memory(monkeypatch, fake):
    """Use the fake for memory while keeping provider/event data local."""
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


def _set_model_reply(monkeypatch, reply):
    fake = FakeGroqClient(json.dumps({"reply": reply, "provider_id": None}))
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


def test_endpoint_persists_and_reloads_server_history(client, monkeypatch):
    fake_db = _use_fake_memory(monkeypatch, FakeChatMemorySupabase())
    model = _set_model_reply(monkeypatch, "First reply")

    first = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "I prefer yoga"},
    )

    assert first.status_code == 200
    session_id = first.json()["session_id"]
    assert session_id
    assert fake_db.rows[session_id]["owner_type"] == "anonymous"
    assert fake_db.rows[session_id]["owner_id"] == ANON_ID
    assert fake_db.rows[session_id]["messages"] == [
        {"role": "user", "content": "I prefer yoga"},
        {"role": "assistant", "content": "First reply"},
    ]

    second_model = _set_model_reply(monkeypatch, "Second reply")
    second = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "Show me another option", "session_id": session_id},
    )

    assert second.status_code == 200
    assert second.json()["session_id"] == session_id

    sent = second_model.calls[0]["messages"]
    assert {"role": "user", "content": "I prefer yoga"} in sent
    assert {"role": "assistant", "content": "First reply"} in sent
    assert {"role": "user", "content": "Show me another option"} in sent

    assert fake_db.rows[session_id]["messages"] == [
        {"role": "user", "content": "I prefer yoga"},
        {"role": "assistant", "content": "First reply"},
        {"role": "user", "content": "Show me another option"},
        {"role": "assistant", "content": "Second reply"},
    ]


def test_expired_server_history_is_not_sent_and_row_is_reset(client, monkeypatch):
    expired_at = datetime.now(timezone.utc) - timedelta(hours=25)
    fake_db = _use_fake_memory(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "expired": _row(
                    [
                        {"role": "user", "content": "EXPIRED_CONTEXT"},
                        {"role": "assistant", "content": "EXPIRED_REPLY"},
                    ],
                    expired_at,
                )
            }
        ),
    )
    model = _set_model_reply(monkeypatch, "Fresh reply")

    response = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "fresh request", "session_id": "expired"},
    )

    assert response.status_code == 200
    sent_text = json.dumps(model.calls[0]["messages"])
    assert "EXPIRED_CONTEXT" not in sent_text
    assert "EXPIRED_REPLY" not in sent_text

    assert fake_db.rows["expired"]["messages"] == [
        {"role": "user", "content": "fresh request"},
        {"role": "assistant", "content": "Fresh reply"},
    ]
    new_timestamp = datetime.fromisoformat(fake_db.rows["expired"]["updated_at"])
    assert new_timestamp > expired_at


def test_client_history_cannot_seed_a_new_session(client, monkeypatch):
    fake_db = _use_fake_memory(monkeypatch, FakeChatMemorySupabase())
    model = _set_model_reply(monkeypatch, "ok")

    response = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={
            "message": "continue",
            "history": [{"role": "user", "content": "CLIENT_RESURRECTION"}],
        },
    )

    assert response.status_code == 200
    assert "CLIENT_RESURRECTION" not in json.dumps(model.calls[0]["messages"])

    session_id = response.json()["session_id"]
    assert fake_db.rows[session_id]["messages"] == [
        {"role": "user", "content": "continue"},
        {"role": "assistant", "content": "ok"},
    ]


def test_rpc_failure_is_graceful_and_does_not_persist(client, monkeypatch):
    fake_db = _use_fake_memory(
        monkeypatch, FakeChatMemorySupabase(fail_write=True)
    )
    _set_model_reply(monkeypatch, "answered anyway")

    response = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "hello", "session_id": "write-failure"},
    )

    assert response.status_code == 200
    assert response.json()["reply"] == "answered anyway"
    assert fake_db.rows == {}


def test_concurrent_history_change_is_reported_as_stale(client, monkeypatch, caplog):
    old_timestamp = datetime.now(timezone.utc) - timedelta(minutes=1)
    fake_db = FakeChatMemorySupabase(
        rows={
            "racing": _row(
                [{"role": "user", "content": "shared"}], old_timestamp
            )
        }
    )

    def other_request_wins(fake):
        # Simulate another request updating the row after this request read it
        # but before this request appends its own turn.
        fake.rows["racing"]["updated_at"] = (
            datetime.now(timezone.utc) + timedelta(minutes=1)
        ).isoformat()

    fake_db.before_rpc = other_request_wins
    _use_fake_memory(monkeypatch, fake_db)
    _set_model_reply(monkeypatch, "reply from stale history")

    with caplog.at_level(logging.WARNING, logger="concierge"):
        response = client.post(
            "/ai/concierge",
            headers=ANON_HEADERS,
            json={"message": "hello", "session_id": "racing"},
        )

    assert response.status_code == 200
    assert response.json()["reply"] == "reply from stale history"
    assert "Stale conversation turn appended" in caplog.text
