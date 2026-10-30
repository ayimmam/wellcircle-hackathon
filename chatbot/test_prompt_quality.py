"""Repetition-prevention evaluation for the concierge turn pipeline.

Cases simulate two-turn conversations with a scripted model to prove that:

* a reply verbatim-identical to the previous assistant message triggers
  exactly one bounded retry carrying an explicit variation instruction,
* a still-repeating retry never loops and never invents text,
* grounding, payload validation, and the graceful failure path apply to the
  retried call exactly like the first call,
* the prompt keeps both the new variation/acknowledgement rule (1b) and the
  non-negotiable wellness scope / exact-data rules (anti-weakening guard).

The model is always scripted (ScriptedGroqClient), so the suite is
deterministic and needs no credentials.
"""

import json
import types

import pytest
from fastapi.testclient import TestClient

import main
from main import _last_assistant_content
from prompt import SYSTEM_PROMPT_PREFIX


class FakeGroqResponse:
    def __init__(self, content):
        message = types.SimpleNamespace(content=content)
        self.choices = [types.SimpleNamespace(message=message)]


class ScriptedGroqClient:
    """Pops a canned JSON payload per create() call and records the messages."""

    def __init__(self, payloads):
        self._payloads = list(payloads)
        self.calls = []

        def create(**kwargs):
            self.calls.append(kwargs["messages"])
            if not self._payloads:
                raise AssertionError("unexpected extra model call")
            return FakeGroqResponse(json.dumps(self._payloads.pop(0)))

        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=create)
        )

    @property
    def call_count(self):
        return len(self.calls)


def _concierge_payload(reply: str) -> dict:
    return {
        "reply": reply,
        "provider_id": None,
        "provider_name": None,
        "event_id": None,
        "event_name": None,
    }


@pytest.fixture
def client():
    return TestClient(main.app)


def _force_local_data(monkeypatch):
    monkeypatch.setattr(main, "supabase_client", None)


# --- Guard helper -----------------------------------------------------------
def test_last_assistant_content_helper():
    history = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "Same reply."},
        {"role": "user", "content": "again"},
    ]
    assert _last_assistant_content(history) == "Same reply."
    assert _last_assistant_content([]) is None
    assert _last_assistant_content([{"role": "user", "content": "x"}]) is None
    assert _last_assistant_content(None) is None


# --- Repetition triggers exactly one retry ----------------------------------
def test_identical_reply_triggers_one_variation_retry(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("Tell me what you'd like to improve — sleep, fitness, or nutrition?"),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    different = "Fair enough — let's keep it useful. Want sleep, fitness, or nutrition ideas?"
    fake = ScriptedGroqClient([
        _concierge_payload(first["reply"]),   # repeats the previous turn
        _concierge_payload(different),        # varied second attempt wins
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    second = client.post(
        "/ai/concierge",
        json={"message": "Isn't it obvious?", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    assert second.status_code == 200
    assert second.json()["reply"] == different
    assert fake.call_count == 2


def test_retry_receives_variation_instruction(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("First turn reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    fake = ScriptedGroqClient([
        _concierge_payload(first["reply"]),
        _concierge_payload("Second, varied reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    client.post(
        "/ai/concierge",
        json={"message": "again", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    assert fake.call_count == 2
    first_call, retry_call = fake.calls
    # Initial call: system + full stored history + user (turn 1's reply already
    # persisted); retry call: system prompt + variation note first, then same
    # conversation tail.
    assert first_call[0]["role"] == "system"
    assert {"role": "user", "content": "hello"} in first_call
    assert {"role": "assistant", "content": "First turn reply."} in first_call
    assert retry_call[0]["role"] == "system"
    assert retry_call[1]["role"] == "system"
    assert "repeat an assistant message" in retry_call[1]["content"]
    assert "Do not invent providers, events, prices, or availability" in retry_call[1]["content"]


def test_retry_that_repeats_again_is_not_looping(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("Same reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    same = "Same reply."
    fake = ScriptedGroqClient([
        _concierge_payload(same),
        _concierge_payload(same),  # retry repeats again
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    second = client.post(
        "/ai/concierge",
        json={"message": "again", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    assert second.status_code == 200
    assert second.json()["reply"] == same  # first reply stands, nothing invented
    assert fake.call_count == 2


# --- Different reply: no retry at all ---------------------------------------
def test_varied_reply_makes_no_extra_call(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("First turn reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    fake = ScriptedGroqClient([
        _concierge_payload("Completely different reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    second = client.post(
        "/ai/concierge",
        json={"message": "now", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    assert second.status_code == 200
    assert fake.call_count == 1


# --- First turn can never trigger the guard ---------------------------------
def test_first_turn_has_no_previous_reply(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("Whatever first reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    res = client.post("/ai/concierge", json={"message": "hello"})

    assert res.status_code == 200
    assert fake.call_count == 1


# --- A failing retry keeps the first reply ----------------------------------
def test_retry_failure_keeps_first_reply(client, monkeypatch):
    """A failing retried model call must not degrade into the fallback text."""
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("First turn reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    class ExplodingRetry:
        def __init__(self, first_reply):
            self.first_reply = first_reply
            self.calls = 0

        def create(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return FakeGroqResponse(json.dumps(_concierge_payload(self.first_reply)))
            raise RuntimeError("network blip on retry")

    exploding = ExplodingRetry(first["reply"])
    monkeypatch.setattr(
        main,
        "groq_client",
        types.SimpleNamespace(
            chat=types.SimpleNamespace(
                completions=types.SimpleNamespace(create=exploding.create)
            )
        ),
    )
    second = client.post(
        "/ai/concierge",
        json={"message": "again", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    assert second.status_code == 200
    # The first (repeated) reply stands; no FALLBACK_REPLY substitution.
    assert second.json()["reply"] == first["reply"]
    assert exploding.calls == 2


# --- Grounding still applies to the retried reply ---------------------------
def test_retried_reply_still_grounding_guarded(client, monkeypatch):
    _force_local_data(monkeypatch)
    fake = ScriptedGroqClient([
        _concierge_payload("First turn reply."),
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    first = client.post("/ai/concierge", json={"message": "hello"}).json()

    fake = ScriptedGroqClient([
        _concierge_payload(first["reply"]),
        # The varied attempt lies about a price for a real listing: grounding
        # must replace it the same as it would on a first call.
        {
            "reply": "Bole Wellness Hub costs only 100 ETB. Want details?",
            "provider_id": "fb-001",
            "provider_name": "Bole Wellness Hub",
            "event_id": None,
            "event_name": None,
        },
    ])
    monkeypatch.setattr(main, "groq_client", fake)
    second = client.post(
        "/ai/concierge",
        json={"message": "how much?", "session_id": first["session_id"]},
        headers={"X-Circler-Anonymous-Token": first["anonymous_token"]},
    )

    body = second.json()
    assert body["reply"] != "Bole Wellness Hub costs only 100 ETB. Want details?"
    assert body["provider_id"] == "fb-001"
    assert "ETB 800-2500" in body["reply"]
    assert "100 ETB" not in body["reply"]
    assert fake.call_count == 2


# --- Prompt-content anti-weakening guard ------------------------------------
def test_prompt_keeps_variation_rule():
    prefix = SYSTEM_PROMPT_PREFIX
    assert "1b. CONVERSATION SENSE" in prefix
    assert "acknowledge" in prefix
    assert "do NOT send a second redirect" in prefix


def test_prompt_keeps_scope_and_grounding_rules():
    """The wellness scope, exact-data, and no-invention rules must survive."""
    prefix = SYSTEM_PROMPT_PREFIX
    assert "1. WELLNESS SCOPE" in prefix
    assert "politely redirect" in prefix
    assert "quote price_range EXACTLY" in prefix
    assert "Never round, estimate, or invent" in prefix
    assert "spots_remaining EXACTLY" in prefix
    assert "Never invent providers, events, prices, or availability" in prefix
    assert "OUTPUT FORMAT: Return ONLY a single JSON object" in prefix
