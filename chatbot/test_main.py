"""Tests for the Well Circle Concierge.

The Groq and Supabase clients are replaced with lightweight fakes so the suite
runs fast, offline, and deterministically. The emphasis is on the two things
that matter most for this service: that it never invents providers
(low hallucination) and that it always degrades to a friendly reply on failure.
"""

import json
import types

import pytest
from fastapi.testclient import TestClient

import main


# --- Test doubles ----------------------------------------------------------
class FakeGroqResponse:
    def __init__(self, content):
        message = types.SimpleNamespace(content=content)
        self.choices = [types.SimpleNamespace(message=message)]


class FakeGroqClient:
    """Returns a canned JSON string, or raises, to simulate the model."""

    def __init__(self, content=None, raises=None):
        self._content = content
        self._raises = raises
        self.calls = []

        def create(**kwargs):
            self.calls.append(kwargs)
            if self._raises:
                raise self._raises
            return FakeGroqResponse(self._content)

        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=create)
        )


@pytest.fixture(autouse=True)
def reset_provider_cache():
    """Each test starts with a cold provider cache."""
    main._provider_cache.update(data=None, source=None, ts=0.0)
    yield


@pytest.fixture
def client():
    return TestClient(main.app)


def _use_fallback_providers(monkeypatch):
    """Force the local fallback dataset (no live Supabase)."""
    monkeypatch.setattr(main, "supabase_client", None)


def _set_model_reply(monkeypatch, payload=None, raises=None):
    content = json.dumps(payload) if payload is not None else None
    fake = FakeGroqClient(content=content, raises=raises)
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


# --- Health ----------------------------------------------------------------
def test_health_ok(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "well-circle-concierge"


# --- First-message handshake ----------------------------------------------
def test_first_message_is_silent(client, monkeypatch):
    fake = _set_model_reply(monkeypatch, {"reply": "should not be used"})
    res = client.post("/ai/concierge", json={"message": "__init__", "is_first_message": True})
    assert res.status_code == 200
    body = res.json()
    assert body["reply"] == ""
    assert body["data_source"] == "n/a"
    # The model must not even be called for the silent init turn.
    assert fake.calls == []


# --- Low-hallucination guards ---------------------------------------------
def test_unknown_provider_id_is_dropped(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, {
        "reply": "Try journaling to manage stress.",
        "provider_id": "does-not-exist-999",
        "provider_name": "Totally Made Up Studio",
    })
    res = client.post("/ai/concierge", json={"message": "I'm stressed"})
    body = res.json()
    assert body["reply"].startswith("Try journaling")
    assert body["provider_id"] is None
    assert body["provider_name"] is None


def test_provider_name_is_canonicalized_from_id(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    # Model returns a REAL id but a WRONG name — we must override the name.
    _set_model_reply(monkeypatch, {
        "reply": "A calm yoga session could help.",
        "provider_id": "fb-002",
        "provider_name": "Wrong Name The Model Invented",
    })
    res = client.post("/ai/concierge", json={"message": "yoga near Kazanchis"})
    body = res.json()
    assert body["provider_id"] == "fb-002"
    assert body["provider_name"] == "Serenity Yoga Studio"  # authoritative name


@pytest.mark.parametrize("null_value", [None, "null", "none", "", "  "])
def test_null_like_provider_ids_become_none(client, monkeypatch, null_value):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, {
        "reply": "Stay hydrated.",
        "provider_id": null_value,
        "provider_name": "anything",
    })
    res = client.post("/ai/concierge", json={"message": "general tip"})
    body = res.json()
    assert body["provider_id"] is None
    assert body["provider_name"] is None


def test_valid_provider_passes_through(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, {
        "reply": "Bole Wellness Hub has great group classes.",
        "provider_id": "fb-001",
        "provider_name": "Bole Wellness Hub",
    })
    res = client.post("/ai/concierge", json={"message": "gym in Bole"})
    body = res.json()
    assert body["provider_id"] == "fb-001"
    assert body["provider_name"] == "Bole Wellness Hub"
    assert body["data_source"] == "fallback"


def test_only_allowlisted_fields_sent_to_model(client, monkeypatch):
    """Internal/extra provider columns must not leak into the prompt."""
    extra = dict(main.FALLBACK_PROVIDERS[0], secret_owner_phone="0911000000")
    monkeypatch.setattr(main, "supabase_client", None)
    monkeypatch.setattr(main, "fetch_providers", lambda: ([extra], "fallback"))
    fake = _set_model_reply(monkeypatch, {"reply": "ok", "provider_id": None, "provider_name": None})
    client.post("/ai/concierge", json={"message": "hi"})
    system_prompt = fake.calls[0]["messages"][0]["content"]
    assert "secret_owner_phone" not in system_prompt
    assert "0911000000" not in system_prompt


# --- Graceful degradation --------------------------------------------------
def test_model_error_returns_graceful_reply(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, raises=RuntimeError("groq exploded"))
    res = client.post("/ai/concierge", json={"message": "anything"})
    assert res.status_code == 200  # never surface a 500 to the user
    body = res.json()
    assert "trouble matching" in body["reply"]
    assert body["provider_id"] is None
    # Internal error text must not leak to the client.
    assert "groq exploded" not in body["reply"]


def test_non_json_model_output_returns_graceful_reply(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    fake = FakeGroqClient(content="Sorry, here is some prose, not JSON.")
    monkeypatch.setattr(main, "groq_client", fake)
    res = client.post("/ai/concierge", json={"message": "anything"})
    assert res.status_code == 200
    assert "trouble matching" in res.json()["reply"]


def test_empty_reply_is_replaced_with_fallback(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, {"reply": "   ", "provider_id": None, "provider_name": None})
    res = client.post("/ai/concierge", json={"message": "anything"})
    assert "trouble matching" in res.json()["reply"]


# --- Caching / performance -------------------------------------------------
def test_providers_are_cached_between_requests(client, monkeypatch):
    calls = {"n": 0}

    def counting_fetch():
        calls["n"] += 1
        return main.FALLBACK_PROVIDERS, "fallback"

    monkeypatch.setattr(main, "fetch_providers", counting_fetch)
    _set_model_reply(monkeypatch, {"reply": "ok", "provider_id": None, "provider_name": None})

    client.post("/ai/concierge", json={"message": "one"})
    client.post("/ai/concierge", json={"message": "two"})

    # Two chat turns, but Supabase fetched only once thanks to the TTL cache.
    assert calls["n"] == 1


def test_fallback_dataset_used_when_supabase_unavailable(client, monkeypatch):
    _use_fallback_providers(monkeypatch)
    _set_model_reply(monkeypatch, {"reply": "ok", "provider_id": None, "provider_name": None})
    res = client.post("/ai/concierge", json={"message": "anything"})
    assert res.json()["data_source"] == "fallback"
