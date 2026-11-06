"""Conversation experience tests: first visit, returning, expired, and names."""

from datetime import datetime, timedelta, timezone
import types

import pytest
from fastapi.testclient import TestClient

import auth
import main
from experience import EXPIRED, FIRST_VISIT, RETURNING, SUGGESTION_CARDS, build_welcome
from fake_supabase import FakeChatMemorySupabase


ANON_ID = "44444444-4444-4444-8444-444444444444"
ANON_HEADERS = {auth.ANONYMOUS_HEADER: auth.create_anonymous_token(ANON_ID)}
OTHER_ANON_ID = "55555555-5555-4555-8555-555555555555"


class CountingGroqClient:
    def __init__(self, reply="ok"):
        self.calls = []
        content = '{"reply": "%s", "provider_id": null}' % reply

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


def _row(messages, updated_at, *, owner_type="anonymous", owner_id=ANON_ID):
    return {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


def _use_db(monkeypatch, fake):
    monkeypatch.setattr(main, "supabase_client", fake)
    return fake


def _model(monkeypatch, reply="ok"):
    fake = CountingGroqClient(reply)
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


def test_build_welcome_is_none_for_returning_and_named_for_expired():
    assert build_welcome(RETURNING, "Selam") is None

    expired = build_welcome(EXPIRED, "Selam")
    assert expired is not None
    assert "Welcome back, Selam!" in expired.text
    assert len(expired.cards) == 4
    assert expired.cards == SUGGESTION_CARDS


def test_first_visit_get_returns_full_intro_and_four_cards_without_model_call(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    model = _model(monkeypatch)

    response = client.get("/ai/concierge/session", headers=ANON_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["experience"] == FIRST_VISIT
    assert body["history"] == []
    assert body["welcome"]["text"].startswith("🌿 Welcome to Well Circle")
    assert len(body["welcome"]["cards"]) == 4
    assert body["session_id"]
    assert body["anonymous_token"] is None
    # Opening the chat is not a turn: no model call, no memory row.
    assert model.calls == []
    assert fake_db.rows == {}


def test_returning_within_window_restores_history_without_greeting(
    client, monkeypatch
):
    messages = [
        {"role": "user", "content": "I prefer yoga in Bole"},
        {"role": "assistant", "content": "Try Serenity Yoga Studio."},
    ]
    fake_db = _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "recent": _row(
                    messages,
                    datetime.now(timezone.utc) - timedelta(hours=2),
                )
            }
        ),
    )
    model = _model(monkeypatch)

    response = client.get(
        "/ai/concierge/session?session_id=recent", headers=ANON_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["experience"] == RETURNING
    assert body["welcome"] is None
    assert body["history"] == messages
    assert model.calls == []
    assert fake_db.rows["recent"]["messages"] == messages


def test_expired_conversation_returns_short_welcome_and_cards_without_history(
    client, monkeypatch
):
    _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "old": _row(
                    [
                        {"role": "user", "content": "EXPIRED_SECRET"},
                        {"role": "assistant", "content": "EXPIRED_REPLY"},
                    ],
                    datetime.now(timezone.utc) - timedelta(hours=25),
                )
            }
        ),
    )

    response = client.get(
        "/ai/concierge/session?session_id=old", headers=ANON_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["experience"] == EXPIRED
    assert body["history"] == []
    assert "Welcome back" in body["welcome"]["text"]
    assert len(body["welcome"]["cards"]) == 4
    assert "EXPIRED_SECRET" not in response.text


def test_profile_name_survives_history_expiry(client, monkeypatch):
    _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "old": _row(
                    [{"role": "user", "content": "old conversation"}],
                    datetime.now(timezone.utc) - timedelta(hours=25),
                )
            },
            profiles={
                ("anonymous", ANON_ID): {
                    "owner_type": "anonymous",
                    "owner_id": ANON_ID,
                    "display_name": "Selam",
                    "preferences": {},
                }
            },
        ),
    )

    response = client.get(
        "/ai/concierge/session?session_id=old", headers=ANON_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["experience"] == EXPIRED
    assert body["profile_name"] == "Selam"
    assert "Welcome back, Selam!" in body["welcome"]["text"]


def test_memory_outage_does_not_repeat_first_visit_onboarding(
    client, monkeypatch
):
    _use_db(monkeypatch, FakeChatMemorySupabase(fail_read=True))
    _model(monkeypatch)

    response = client.get(
        "/ai/concierge/session?session_id=unknown", headers=ANON_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["experience"] == RETURNING
    assert body["welcome"] is None
    assert body["history"] == []
    assert body["memory_available"] is False


def test_session_get_is_403_for_another_owners_session(client, monkeypatch):
    _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "someone-elses": _row(
                    [{"role": "user", "content": "private"}],
                    datetime.now(timezone.utc) - timedelta(minutes=1),
                    owner_id=OTHER_ANON_ID,
                )
            }
        ),
    )

    response = client.get(
        "/ai/concierge/session?session_id=someone-elses", headers=ANON_HEADERS
    )

    assert response.status_code == 403
    assert "private" not in response.text


def test_first_chat_turn_then_open_restores_the_persisted_history(
    client, monkeypatch
):
    _use_db(monkeypatch, FakeChatMemorySupabase())
    _model(monkeypatch, "A good yoga option.")

    first = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "I prefer yoga"},
    )
    assert first.status_code == 200
    session_id = first.json()["session_id"]

    reopened = client.get(
        f"/ai/concierge/session?session_id={session_id}", headers=ANON_HEADERS
    )

    assert reopened.status_code == 200
    body = reopened.json()
    assert body["experience"] == RETURNING
    assert body["welcome"] is None
    assert body["history"] == [
        {"role": "user", "content": "I prefer yoga"},
        {"role": "assistant", "content": "A good yoga option."},
    ]


def test_profile_patch_requires_explicit_consent(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"preferences": {"budget_etb": 500}, "consent": False},
    )

    assert response.status_code == 400
    assert fake_db.profiles == {}


def test_profile_patch_rejects_invalid_name_with_400(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"display_name": "12345", "consent": True},
    )

    assert response.status_code == 400
    assert fake_db.profiles == {}


def test_profile_patch_rejecting_preferences_does_not_persist_the_name(
    client, monkeypatch
):
    """A valid name must not survive an invalid-preferences rejection: the
    endpoint validates every field before writing, so a 400 leaves the
    profile untouched."""
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={
            "display_name": "Selam",
            "preferences": {"budget_etb": "way too much"},
            "consent": True,
        },
    )

    assert response.status_code == 400
    assert fake_db.profiles == {}


def test_profile_patch_reports_storage_outage_with_503(client, monkeypatch):
    fake_db = _use_db(
        monkeypatch, FakeChatMemorySupabase(fail_profile=True)
    )

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={"display_name": "Selam", "consent": True},
    )

    assert response.status_code == 503
    assert fake_db.profiles == {}


def test_profile_patch_stores_name_and_preferences_with_consent(
    client, monkeypatch
):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())

    response = client.patch(
        "/ai/concierge/profile",
        headers=ANON_HEADERS,
        json={
            "display_name": "Selam",
            "preferences": {"budget_etb": 500, "neighbourhood": "Bole"},
            "consent": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Selam"
    assert body["preferences"] == {"budget_etb": 500, "neighbourhood": "Bole"}
    assert body["consent_recorded"] is True
    assert fake_db.profiles[("anonymous", ANON_ID)]["display_name"] == "Selam"


def test_consented_preferences_are_sent_to_the_model(client, monkeypatch):
    _use_db(
        monkeypatch,
        FakeChatMemorySupabase(
            profiles={
                ("anonymous", ANON_ID): {
                    "owner_type": "anonymous",
                    "owner_id": ANON_ID,
                    "display_name": "Selam",
                    "preferences": {"budget_etb": 500},
                    "preferences_consent_at": "2026-01-01T00:00:00+00:00",
                }
            }
        ),
    )
    model = _model(monkeypatch, "Here is a budget option.")

    response = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "What do you recommend?"},
    )

    assert response.status_code == 200
    system_prompt = model.calls[0]["messages"][0]["content"]
    assert "Selam" in system_prompt
    assert "budget_etb" in system_prompt
    assert "500" in system_prompt
    assert "do not invent preferences" in system_prompt


def test_chat_endpoint_remembers_explicit_name_outside_history(client, monkeypatch):
    fake_db = _use_db(monkeypatch, FakeChatMemorySupabase())
    _model(monkeypatch, "Nice to meet you.")

    response = client.post(
        "/ai/concierge",
        headers=ANON_HEADERS,
        json={"message": "Hi, my name is Selam."},
    )

    assert response.status_code == 200
    assert response.json()["profile_name"] == "Selam"
    assert fake_db.profiles[("anonymous", ANON_ID)]["display_name"] == "Selam"

    # The name remains available even if the conversation history is expired
    # or a completely different session is opened.
    profile = main.get_profile("anonymous", ANON_ID)
    assert profile.display_name == "Selam"
