"""End-to-end ownership tests through the real FastAPI endpoint.

Only Groq and Supabase are faked. Credential parsing, ownership checks, the
memory layer, and the endpoint error mapping all run for real.
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
ANON_1 = "88888888-8888-4888-8888-888888888888"
ANON_2 = "99999999-9999-4999-8999-999999999999"


class FakeGroqClient:
    def __init__(self, reply):
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


@pytest.fixture
def client():
    return TestClient(main.app)


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


def _user_headers(subject: str = USER_1, **kwargs) -> dict:
    return {"Authorization": f"Bearer {_sign_user_token(subject, **kwargs)}"}


def _anon_headers(subject: str) -> dict:
    token = auth.create_anonymous_token(subject)
    return {auth.ANONYMOUS_HEADER: token}


def _setup(monkeypatch, fake=None):
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


def _model(monkeypatch, reply="ok"):
    fake = FakeGroqClient(reply)
    monkeypatch.setattr(main, "groq_client", fake)
    return fake


def _row(messages, updated_at, *, owner_type, owner_id):
    return {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


def test_valid_user_owns_the_session_and_receives_no_anonymous_token(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)
    model = _model(monkeypatch, "user reply")

    response = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "hello"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["anonymous_token"] is None
    session_id = body["session_id"]
    assert fake_db.rows[session_id]["owner_type"] == "user"
    assert fake_db.rows[session_id]["owner_id"] == USER_1

    second_model = _model(monkeypatch, "second reply")
    second = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "continue", "session_id": session_id},
    )

    assert second.status_code == 200
    sent = json.dumps(second_model.calls[0]["messages"])
    assert "hello" in sent
    assert "user reply" in sent
    assert fake_db.rows[session_id]["owner_id"] == USER_1


def test_invalid_user_token_is_401_and_never_calls_the_model(client, monkeypatch):
    _setup(monkeypatch)
    model = _model(monkeypatch)

    response = client.post(
        "/ai/concierge",
        headers={"Authorization": "Bearer not-a-token"},
        json={"message": "hello"},
    )

    assert response.status_code == 401
    assert model.calls == []


def test_expired_user_token_is_401_and_never_falls_back_to_anonymous(
    client, monkeypatch
):
    _setup(monkeypatch)
    model = _model(monkeypatch)

    response = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1, expires_in=-1),
        json={"message": "hello"},
    )

    assert response.status_code == 401
    assert model.calls == []
    assert "anonymous_token" not in response.json()


def test_anonymous_identity_is_created_reused_and_bound_to_the_row(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)
    _model(monkeypatch, "first reply")

    first = client.post("/ai/concierge", json={"message": "first"})
    assert first.status_code == 200
    first_body = first.json()
    anon_id = auth.verify_anonymous_token(first_body["anonymous_token"]).owner_id
    session_id = first_body["session_id"]

    assert first_body["anonymous_token"]
    assert fake_db.rows[session_id]["owner_type"] == "anonymous"
    assert fake_db.rows[session_id]["owner_id"] == anon_id

    second_model = _model(monkeypatch, "second reply")
    second = client.post(
        "/ai/concierge",
        headers={auth.ANONYMOUS_HEADER: first_body["anonymous_token"]},
        json={"message": "second", "session_id": session_id},
    )

    assert second.status_code == 200
    assert second.json()["anonymous_token"] is None
    sent = json.dumps(second_model.calls[0]["messages"])
    assert "first" in sent
    assert "first reply" in sent
    assert fake_db.rows[session_id]["owner_id"] == anon_id


def test_tampered_anonymous_credential_is_401_and_never_calls_the_model(
    client, monkeypatch
):
    _setup(monkeypatch)
    model = _model(monkeypatch)
    token = auth.create_anonymous_token(ANON_1)
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")

    response = client.post(
        "/ai/concierge",
        headers={auth.ANONYMOUS_HEADER: tampered},
        json={"message": "hello"},
    )

    assert response.status_code == 401
    assert model.calls == []


def test_cross_user_session_id_is_403_and_history_is_not_sent(
    client, monkeypatch
):
    fake_db = _setup(monkeypatch)
    _model(monkeypatch, "owner one reply")

    first = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "OWNER_ONE_SECRET", "session_id": "shared-session"},
    )
    assert first.status_code == 200

    model_two = _model(monkeypatch, "intruder reply")
    second = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_2),
        json={"message": "steal", "session_id": "shared-session"},
    )

    assert second.status_code == 403
    assert model_two.calls == []
    assert fake_db.rows["shared-session"]["owner_id"] == USER_1
    assert "OWNER_ONE_SECRET" not in json.dumps(second.json())


def test_cross_anonymous_session_id_is_403(client, monkeypatch):
    _setup(monkeypatch)
    _model(monkeypatch, "anon one reply")

    first = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_1),
        json={"message": "anon secret", "session_id": "shared-anon"},
    )
    assert first.status_code == 200

    model_two = _model(monkeypatch, "anon two reply")
    second = client.post(
        "/ai/concierge",
        headers=_anon_headers(ANON_2),
        json={"message": "steal", "session_id": "shared-anon"},
    )

    assert second.status_code == 403
    assert model_two.calls == []


def test_legacy_row_is_403_and_cannot_be_claimed(client, monkeypatch):
    fake_db = _setup(
        monkeypatch,
        FakeChatMemorySupabase(
            rows={
                "legacy": _row(
                    [{"role": "user", "content": "legacy secret"}],
                    datetime.now(timezone.utc) - timedelta(minutes=1),
                    owner_type="legacy",
                    owner_id="legacy",
                )
            }
        ),
    )
    model = _model(monkeypatch)

    response = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "claim", "session_id": "legacy"},
    )

    assert response.status_code == 403
    assert model.calls == []
    assert fake_db.rows["legacy"]["owner_type"] == "legacy"


def test_authenticated_to_anonymous_credential_confusion_is_rejected(
    client, monkeypatch
):
    _setup(monkeypatch)
    model = _model(monkeypatch)
    user_token = _sign_user_token(USER_1)
    anon_token = auth.create_anonymous_token(ANON_1)

    user_as_anon = client.post(
        "/ai/concierge",
        headers={auth.ANONYMOUS_HEADER: user_token},
        json={"message": "hello"},
    )
    assert user_as_anon.status_code == 401

    anon_as_user = client.post(
        "/ai/concierge",
        headers={"Authorization": f"Bearer {anon_token}"},
        json={"message": "hello"},
    )
    assert anon_as_user.status_code == 401

    invalid_user_valid_anon = client.post(
        "/ai/concierge",
        headers={
            "Authorization": "Bearer invalid",
            auth.ANONYMOUS_HEADER: anon_token,
        },
        json={"message": "hello"},
    )
    assert invalid_user_valid_anon.status_code == 401

    assert model.calls == []


def test_ownership_race_at_append_is_403_not_a_successful_write(
    client, monkeypatch
):
    owner_two_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    fake_db = FakeChatMemorySupabase()
    _setup(monkeypatch, fake_db)
    _model(monkeypatch, "racing reply")

    def claim_for_other_owner(fake):
        fake.rows["race"] = _row(
            [{"role": "user", "content": "other owner"}],
            owner_two_at,
            owner_type="user",
            owner_id=USER_2,
        )

    fake_db.before_rpc = claim_for_other_owner

    response = client.post(
        "/ai/concierge",
        headers=_user_headers(USER_1),
        json={"message": "racing", "session_id": "race"},
    )

    assert response.status_code == 403
    assert fake_db.rows["race"]["owner_id"] == USER_2
    assert "racing reply" not in json.dumps(fake_db.rows["race"]["messages"])
