"""Phase B — verified account linking (Telegram <-> Google, one canonical user).

Contract under test:

* linking is two-phase — JWT-authenticated challenge, fresh server-verified
  provider credential, then an explicit atomic confirmation;
* nothing client-supplied (user id, subject, email) is trusted;
* challenges are random, single-use, bound to (user, provider, verified
  subject), expire quickly, reject mismatched/reused/cross-account use, and
  cannot be confirmed twice (including under concurrent confirmation);
* identities owned by another account are never reassigned; the same owner is
  idempotent;
* after linking, both providers resolve to the same canonical ``users.id``
  and no duplicate account is created;
* existing Telegram/Google sign-ins keep working.

Run: cd backend && pytest app/tests/test_account_linking.py -q
"""

import asyncio
import threading
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Existing suite UUID/JSON adapters must be installed before model imports.
from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB  # noqa: F401

from app.api import auth
from app.crud.auth_identity import get_identity, resolve_user_by_telegram
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.account_link_challenge import AccountLinkChallenge
from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.schemas.user import (
    AuthResponse,
    FirebaseAuthRequest,
    TelegramAuthRequest,
    TelegramWidgetLoginRequest,
    UserResponse,
)
from app.services import account_linking as linking

GOOGLE_TOKENS = {
    "good-google": ("google-sub-1", "member@example.com"),
    "other-google": ("google-sub-2", "other@example.com"),
}
MINI_APP_ID = 777000111


# ── fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def api():
    """TestClient wired to one shared in-memory SQLite database."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    def override_get_db():
        yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app) as client:
            yield client, session
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
        session.close()
        engine.dispose()


@pytest.fixture
def google_verifier(monkeypatch):
    """Stand-in at the *service boundary*: signature checks have their own tests."""

    def verify(token):
        if token not in GOOGLE_TOKENS:
            raise ValueError("unknown Google token")
        subject, email = GOOGLE_TOKENS[token]
        return {
            "google_sub": subject,
            "email": email,
            "name": "Google member",
            "picture": None,
        }

    monkeypatch.setattr(linking, "verify_google_token", verify)


@pytest.fixture
def telegram_widget_verifier(monkeypatch):
    """Stand-in for the HMAC check; freshness itself stays in the code under test."""

    def validate(payload):
        if payload.get("hash") != "signed":
            return None
        return {"telegram_id": payload["id"], "username": payload.get("username")}

    monkeypatch.setattr(linking, "validate_login_widget_data", validate)


@pytest.fixture
def telegram_init_data(monkeypatch):
    """Development-mode Mini App proof, mirroring the login path's fallback."""

    def validate(raw):
        return {"telegram_id": int(raw.split(":")[1]), "username": "abebe"}

    monkeypatch.setattr(linking.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(linking, "validate_init_data_dev", validate)


# ── helpers ─────────────────────────────────────────────────────────────────


def _user(db, telegram_id=None, name=None):
    user = User(telegram_id=telegram_id, name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user):
    return {"Authorization": f"Bearer {auth._create_token(str(user.id))}"}


def _start(client, user, provider):
    return client.post(
        "/api/auth/linking/challenges",
        json={"provider": provider},
        headers=_headers(user),
    )


def _verify(client, user, challenge_id, **payload):
    return client.post(
        f"/api/auth/linking/challenges/{challenge_id}/verify",
        json=payload,
        headers=_headers(user),
    )


def _confirm(client, user, challenge_id):
    return client.post(
        f"/api/auth/linking/challenges/{challenge_id}/confirm",
        headers=_headers(user),
    )


def _widget(telegram_id, auth_date=None):
    return {
        "id": telegram_id,
        "first_name": "Abebe",
        "last_name": None,
        "username": "abebe",
        "photo_url": None,
        "auth_date": int(time.time()) if auth_date is None else auth_date,
        "hash": "signed",
    }


def _user_response(user, db):
    """Minimal profile payload; this module tests identity wiring, not profile."""
    return UserResponse(
        id=str(user.id),
        created_at=user.created_at or datetime.now(timezone.utc),
        phone_number=user.phone_number,
    )


def _google_link(client, user):
    """Start + verify a Google challenge; returns the challenge id (unconfirmed)."""
    started = _start(client, user, "google")
    assert started.status_code == 201, started.text
    challenge_id = started.json()["challenge_id"]
    verified = _verify(client, user, challenge_id, google_id_token="good-google")
    assert verified.status_code == 200, verified.text
    return challenge_id


def _complete_google_link(client, user):
    """Start + verify + confirm a Google link; returns the confirmation body."""
    challenge_id = _google_link(client, user)
    confirmed = _confirm(client, user, challenge_id)
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()


# ── successful linking, both directions ─────────────────────────────────────


def test_google_link_from_telegram_account(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=111)
    db.add(AuthIdentity(user_id=user.id, provider="telegram", subject="111"))
    db.commit()

    started = _start(client, user, "google")
    assert started.status_code == 201
    body = started.json()
    assert body["provider"] == "google"
    assert body["expires_in"] == linking.CHALLENGE_TTL_SECONDS == 300
    challenge_id = body["challenge_id"]

    verified = _verify(client, user, challenge_id, google_id_token="good-google")
    assert verified.status_code == 200
    proof = verified.json()
    assert proof["provider"] == "google"
    assert proof["subject"] == "google-sub-1"
    assert proof["email"] == "member@example.com"
    assert proof["requires_confirmation"] is True

    confirmed = _confirm(client, user, challenge_id)
    assert confirmed.status_code == 200
    result = confirmed.json()
    assert result["linked"] is True and result["already_linked"] is False
    assert result["user_id"] == str(user.id)
    assert {row["provider"] for row in result["identities"]} == {"telegram", "google"}

    identity = get_identity(db, "google", "google-sub-1")
    assert identity is not None and identity.user_id == user.id
    assert identity.email == "member@example.com"

    # The existing identities endpoint reflects the newly linked method.
    listed = client.get("/api/users/me/identities", headers=_headers(user))
    assert listed.status_code == 200
    assert {row["provider"] for row in listed.json()["identities"]} == {"telegram", "google"}


def test_telegram_link_from_google_account_then_both_logins_resolve(
    api, telegram_init_data, telegram_widget_verifier, monkeypatch
):
    client, db = api
    # Google-created account: no users.telegram_id yet.
    user = _user(db)
    db.add(AuthIdentity(user_id=user.id, provider="google", subject="google-origin"))
    db.commit()

    challenge_id = _start(client, user, "telegram").json()["challenge_id"]
    verified = _verify(client, user, challenge_id, telegram_init_data="dev:777")
    assert verified.status_code == 200
    assert verified.json()["subject"] == "777"

    confirmed = _confirm(client, user, challenge_id)
    assert confirmed.status_code == 200
    assert confirmed.json()["linked"] is True

    db.refresh(user)
    assert user.telegram_id == 777
    identity = get_identity(db, "telegram", "777")
    assert identity is not None and identity.user_id == user.id

    # Mini App login must resolve the linked canonical account, not create one.
    monkeypatch.setattr(auth.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(auth, "_build_response", _user_response)
    monkeypatch.setattr(
        auth,
        "validate_init_data_dev",
        lambda raw: {"telegram_id": 777, "username": "abebe", "photo_url": None},
    )
    mini = asyncio.run(auth.telegram_auth(TelegramAuthRequest(init_data="x"), db))
    assert isinstance(mini, AuthResponse)
    assert mini.user.id == str(user.id) and mini.is_new_user is False

    # Login Widget follows the same resolution.
    monkeypatch.setattr(auth, "validate_login_widget_data", lambda payload: {"telegram_id": 777})
    widget = asyncio.run(
        auth.telegram_widget_auth(
            TelegramWidgetLoginRequest(**_widget(777)), db
        )
    )
    assert widget.user.id == str(user.id) and widget.is_new_user is False

    # Identity-first resolver agrees with the legacy column.
    assert resolve_user_by_telegram(db, 777).id == user.id
    assert db.query(User).filter(User.telegram_id == 777).count() == 1


def test_google_login_resolves_telegram_linked_account(api, google_verifier, monkeypatch):
    client, db = api
    user = _user(db, telegram_id=222)
    db.add(AuthIdentity(user_id=user.id, provider="telegram", subject="222"))
    db.commit()
    _complete_google_link(client, user)

    monkeypatch.setattr(auth, "_build_response", _user_response)
    monkeypatch.setattr(
        auth,
        "verify_google_token",
        lambda token: {
            "google_sub": "google-sub-1",
            "email": "member@example.com",
            "name": "Google member",
            "picture": None,
        },
    )
    result = auth.firebase_auth(FirebaseAuthRequest(id_token="good-google"), db)
    assert result.is_new_user is False
    assert result.user.id == str(user.id)
    assert db.query(User).count() == 1


def test_repeat_link_is_idempotent(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=333)
    first = _complete_google_link(client, user)
    assert first["linked"] is True and first["already_linked"] is False

    second = _complete_google_link(client, user)
    assert second["linked"] is False and second["already_linked"] is True
    assert db.query(AuthIdentity).filter_by(provider="google", subject="google-sub-1").count() == 1


def test_telegram_link_via_login_widget(api, telegram_widget_verifier):
    client, db = api
    user = _user(db)
    db.add(AuthIdentity(user_id=user.id, provider="google", subject="google-origin"))
    db.commit()

    challenge_id = _start(client, user, "telegram").json()["challenge_id"]
    verified = _verify(client, user, challenge_id, telegram_login=_widget(888))
    assert verified.status_code == 200, verified.text
    assert verified.json()["subject"] == "888"

    confirmed = _confirm(client, user, challenge_id)
    assert confirmed.status_code == 200
    db.refresh(user)
    assert user.telegram_id == 888


# ── ownership conflicts: never reassign, never merge ────────────────────────


def test_identity_owned_by_another_account_conflicts(api, google_verifier):
    client, db = api
    caller = _user(db, telegram_id=444)
    other = _user(db, telegram_id=555)
    db.add(AuthIdentity(user_id=other.id, provider="google", subject="google-sub-1"))
    db.commit()

    challenge_id = _google_link(client, caller)
    confirmed = _confirm(client, caller, challenge_id)

    assert confirmed.status_code == 409
    assert "another" in confirmed.json()["detail"].lower()
    owner = get_identity(db, "google", "google-sub-1")
    assert owner.user_id == other.id
    assert get_identity(db, "google", "google-sub-1").user_id != caller.id
    assert db.query(AuthIdentity).filter_by(user_id=caller.id, provider="google").count() == 0
    record = db.query(AccountLinkChallenge).filter_by(id=challenge_id).one()
    assert record.status == "failed"


def test_telegram_column_owned_by_another_account_conflicts(
    api, telegram_widget_verifier
):
    client, db = api
    caller = _user(db)
    other = _user(db, telegram_id=999)
    db.add(AuthIdentity(user_id=caller.id, provider="google", subject="google-origin"))
    db.commit()

    challenge_id = _start(client, caller, "telegram").json()["challenge_id"]
    assert _verify(client, caller, challenge_id, telegram_login=_widget(999)).status_code == 200
    confirmed = _confirm(client, caller, challenge_id)

    assert confirmed.status_code == 409
    db.refresh(other)
    db.refresh(caller)
    assert other.telegram_id == 999
    assert caller.telegram_id is None
    assert get_identity(db, "telegram", "999") is None


# ── challenge security ──────────────────────────────────────────────────────


def test_client_supplied_identifiers_are_ignored(api, telegram_init_data):
    client, db = api
    caller = _user(db, telegram_id=1111)
    other = _user(db, telegram_id=2222)

    started = client.post(
        "/api/auth/linking/challenges",
        json={"provider": "telegram", "user_id": str(other.id), "subject": "5555"},
        headers=_headers(caller),
    )
    assert started.status_code == 201
    challenge_id = started.json()["challenge_id"]

    verified = _verify(
        client,
        caller,
        challenge_id,
        telegram_init_data="dev:777",
        user_id=str(other.id),
        subject="5555",
    )
    assert verified.status_code == 200
    assert verified.json()["subject"] == "777"

    assert _confirm(client, caller, challenge_id).status_code == 200
    assert get_identity(db, "telegram", "777").user_id == caller.id
    assert get_identity(db, "telegram", "5555") is None
    assert db.query(AuthIdentity).filter_by(user_id=other.id).count() == 0


def test_challenge_cannot_be_used_by_another_account(api, google_verifier):
    client, db = api
    owner = _user(db, telegram_id=666)
    attacker = _user(db, telegram_id=777)
    challenge_id = _start(client, owner, "google").json()["challenge_id"]

    assert _verify(client, attacker, challenge_id, google_id_token="good-google").status_code == 404
    assert _confirm(client, attacker, challenge_id).status_code == 404
    assert get_identity(db, "google", "google-sub-1") is None

    # The legitimate owner is unaffected.
    assert _verify(client, owner, challenge_id, google_id_token="good-google").status_code == 200
    assert _confirm(client, owner, challenge_id).status_code == 200


def test_expired_challenge_is_rejected(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=888)
    challenge_id = _start(client, user, "google").json()["challenge_id"]
    db.query(AccountLinkChallenge).filter_by(id=challenge_id).update(
        {"expires_at": int(time.time()) - 1}
    )
    db.commit()

    verified = _verify(client, user, challenge_id, google_id_token="good-google")
    assert verified.status_code == 400
    assert "expired" in verified.json()["detail"].lower()
    assert _confirm(client, user, challenge_id).status_code == 400
    assert db.query(AccountLinkChallenge).filter_by(id=challenge_id).one().status == "expired"
    assert get_identity(db, "google", "google-sub-1") is None


def test_consumed_challenge_is_rejected(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=9991)
    challenge_id = _google_link(client, user)
    assert _confirm(client, user, challenge_id).status_code == 200

    again = _confirm(client, user, challenge_id)
    assert again.status_code == 400
    assert "already been used" in again.json()["detail"].lower()
    assert _verify(client, user, challenge_id, google_id_token="good-google").status_code == 400


def test_confirm_requires_verified_challenge(api):
    client, db = api
    user = _user(db, telegram_id=9992)
    challenge_id = _start(client, user, "google").json()["challenge_id"]
    response = _confirm(client, user, challenge_id)
    assert response.status_code == 400
    assert "verify" in response.json()["detail"].lower()


def test_provider_proof_must_match_challenge(api, telegram_init_data, google_verifier):
    client, db = api
    user = _user(db, telegram_id=9993)
    google_challenge = _start(client, user, "google").json()["challenge_id"]
    mismatch = _verify(client, user, google_challenge, telegram_init_data="dev:777")
    assert mismatch.status_code == 400
    assert "does not match" in mismatch.json()["detail"].lower()

    telegram_challenge = _start(client, user, "telegram").json()["challenge_id"]
    mismatch = _verify(client, user, telegram_challenge, google_id_token="good-google")
    assert mismatch.status_code == 400


def test_invalid_google_credential_does_not_verify(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=9994)
    challenge_id = _start(client, user, "google").json()["challenge_id"]

    rejected = _verify(client, user, challenge_id, google_id_token="forged")
    assert rejected.status_code == 400
    record = db.query(AccountLinkChallenge).filter_by(id=challenge_id).one()
    assert record.status == "pending" and record.target_subject is None

    assert _verify(client, user, challenge_id, google_id_token="good-google").status_code == 200
    assert _confirm(client, user, challenge_id).status_code == 200


def test_verify_is_idempotent_for_the_same_identity(api, google_verifier):
    client, db = api
    user = _user(db, telegram_id=9995)
    challenge_id = _start(client, user, "google").json()["challenge_id"]

    first = _verify(client, user, challenge_id, google_id_token="good-google")
    second = _verify(client, user, challenge_id, google_id_token="good-google")
    assert first.status_code == second.status_code == 200
    assert first.json()["subject"] == second.json()["subject"] == "google-sub-1"

    different = _verify(client, user, challenge_id, google_id_token="other-google")
    assert different.status_code == 400
    assert "different identity" in different.json()["detail"].lower()


def test_invalid_and_stale_telegram_widget_proofs_are_rejected(
    api, telegram_widget_verifier
):
    client, db = api
    user = _user(db, telegram_id=9996)
    challenge_id = _start(client, user, "telegram").json()["challenge_id"]

    forged = dict(_widget(7001), hash="forged")
    assert _verify(client, user, challenge_id, telegram_login=forged).status_code == 400

    stale = _widget(7001, auth_date=int(time.time()) - 3600)
    response = _verify(client, user, challenge_id, telegram_login=stale)
    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


def test_init_data_freshness_is_enforced_outside_development(api, monkeypatch):
    client, db = api
    user = _user(db, telegram_id=9997)
    challenge_id = _start(client, user, "telegram").json()["challenge_id"]

    # The signature verifier accepts the blob; linking adds a freshness check.
    monkeypatch.setattr(linking.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(linking, "validate_init_data", lambda raw: {"telegram_id": 7002})

    stale = f"auth_date={int(time.time()) - 3600}&user=encoded"
    rejected = _verify(client, user, challenge_id, telegram_init_data=stale)
    assert rejected.status_code == 400
    assert "expired" in rejected.json()["detail"].lower()

    fresh = f"auth_date={int(time.time()) - 5}&user=encoded"
    assert _verify(client, user, challenge_id, telegram_init_data=fresh).status_code == 200


def test_challenge_creation_requires_authentication(api):
    client, _ = api
    response = client.post(
        "/api/auth/linking/challenges", json={"provider": "google"}
    )
    assert response.status_code in (401, 403)


def test_verify_and_confirm_require_authentication(api):
    client, db = api
    user = _user(db, telegram_id=9998)
    challenge_id = _start(client, user, "google").json()["challenge_id"]

    assert client.post(f"/api/auth/linking/challenges/{challenge_id}/verify", json={}).status_code in (401, 403)
    assert client.post(f"/api/auth/linking/challenges/{challenge_id}/confirm").status_code in (401, 403)


def test_unsupported_provider_is_rejected(api):
    client, db = api
    user = _user(db, telegram_id=9999)
    response = _start(client, user, "whatsapp")
    assert response.status_code == 422


def test_challenge_creation_is_rate_limited(api):
    client, db = api
    user = _user(db, telegram_id=123123)

    for _ in range(linking.MAX_CREATES_PER_WINDOW):
        assert _start(client, user, "google").status_code == 201

    limited = _start(client, user, "google")
    assert limited.status_code == 429
    assert limited.headers.get("Retry-After") == "60"


def test_challenge_ids_are_random_and_unpredictable(api):
    client, db = api
    user = _user(db, telegram_id=321321)
    ids = []
    for _ in range(linking.MAX_CREATES_PER_WINDOW):
        response = _start(client, user, "google")
        assert response.status_code == 201
        challenge_id = response.json()["challenge_id"]
        assert len(challenge_id) >= 40
        assert str(user.id) not in challenge_id
        ids.append(challenge_id)
    assert len(set(ids)) == len(ids)


def test_responses_do_not_echo_credentials(api, telegram_init_data):
    client, db = api
    user = _user(db, telegram_id=654654)
    challenge_id = _start(client, user, "telegram").json()["challenge_id"]
    raw = "dev:777"
    verified = _verify(client, user, challenge_id, telegram_init_data=raw)
    assert verified.status_code == 200
    body = verified.text.lower()
    for forbidden in (raw.lower(), "initdata", "hash", "token"):
        assert forbidden not in body


# ── concurrency ─────────────────────────────────────────────────────────────


def _verified_challenge(db, user, provider, subject, email=None):
    now = int(time.time())
    record = AccountLinkChallenge(
        id=f"race-{subject}",
        user_id=user.id,
        provider=provider,
        status="verified",
        attempts=1,
        created_at=now,
        expires_at=now + 300,
        verified_at=now,
        target_subject=subject,
        target_email=email,
    )
    db.add(record)
    db.commit()
    return record.id


def test_concurrent_confirmation_never_duplicates_identity(api, monkeypatch):
    """The insert can race another request: same owner must resolve safely."""
    _, db = api
    user = _user(db, telegram_id=111222)
    challenge_id = _verified_challenge(db, user, "google", "google-sub-1")
    db.add(AuthIdentity(user_id=user.id, provider="google", subject="google-sub-1"))
    db.commit()

    real_get_identity = linking.get_identity
    calls = {"count": 0}

    def racing_get_identity(session, provider, subject):
        calls["count"] += 1
        if calls["count"] == 1:  # emulate the identity appearing after our read
            return None
        return real_get_identity(session, provider, subject)

    monkeypatch.setattr(linking, "get_identity", racing_get_identity)

    result = linking.confirm_challenge(db, user.id, challenge_id)

    assert result["linked"] is False and result["already_linked"] is True
    assert db.query(AuthIdentity).filter_by(provider="google", subject="google-sub-1").count() == 1
    assert db.query(AccountLinkChallenge).filter_by(id=challenge_id).one().status == "consumed"


def test_concurrent_confirmation_with_another_owner_conflicts(api, monkeypatch):
    _, db = api
    caller = _user(db, telegram_id=333444)
    other = _user(db, telegram_id=555666)
    challenge_id = _verified_challenge(db, caller, "google", "google-sub-2")
    db.add(AuthIdentity(user_id=other.id, provider="google", subject="google-sub-2"))
    db.commit()

    real_get_identity = linking.get_identity
    calls = {"count": 0}

    def racing_get_identity(session, provider, subject):
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        return real_get_identity(session, provider, subject)

    monkeypatch.setattr(linking, "get_identity", racing_get_identity)

    with pytest.raises(linking.LinkConflict):
        linking.confirm_challenge(db, caller.id, challenge_id)

    assert get_identity(db, "google", "google-sub-2").user_id == other.id
    assert db.query(AccountLinkChallenge).filter_by(id=challenge_id).one().status == "failed"


def test_parallel_confirmation_links_exactly_once(tmp_path):
    """Real threads against a file-backed database: one identity, one success."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'race.db'}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    setup = Session()
    owner = User(telegram_id=777888)
    setup.add(owner)
    setup.commit()
    challenge_id = _verified_challenge(setup, owner, "google", "google-thread")
    user_id = owner.id
    setup.close()

    results = []
    lock = threading.Lock()
    start = threading.Barrier(4)

    def worker():
        session = Session()
        try:
            start.wait(timeout=10)
            outcome = ("ok", linking.confirm_challenge(session, user_id, challenge_id))
        except linking.LinkingError as error:
            outcome = ("error", type(error).__name__)
        except Exception as error:  # pragma: no cover - surfaced by assertions
            outcome = ("unexpected", type(error).__name__)
        finally:
            session.close()
        with lock:
            results.append(outcome)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    linked = [r for r in results if r[0] == "ok" and r[1]["linked"]]
    already = [r for r in results if r[0] == "ok" and r[1]["already_linked"]]
    errors = [r for r in results if r[0] == "error"]
    assert [r for r in results if r[0] == "unexpected"] == []
    assert len(linked) <= 1
    assert len(linked) + len(already) >= 1
    assert all(name == "LinkInvalid" for _, name in errors)

    check = Session()
    try:
        assert check.query(AuthIdentity).filter_by(provider="google", subject="google-thread").count() == 1
        assert check.query(AuthIdentity).filter_by(user_id=user_id).count() == 1
    finally:
        check.close()
        engine.dispose()


# ── additional safety rails ─────────────────────────────────────────────────


def test_second_telegram_identity_is_rejected(api, telegram_widget_verifier):
    """A canonical account keeps exactly one Telegram sign-in (single column)."""
    client, db = api
    user = _user(db, telegram_id=1212)
    db.add(AuthIdentity(user_id=user.id, provider="telegram", subject="1212"))
    db.commit()

    challenge_id = _start(client, user, "telegram").json()["challenge_id"]
    assert _verify(client, user, challenge_id, telegram_login=_widget(3434)).status_code == 200
    response = _confirm(client, user, challenge_id)

    assert response.status_code == 409
    assert "different telegram" in response.json()["detail"].lower()
    assert get_identity(db, "telegram", "3434") is None
    db.refresh(user)
    assert user.telegram_id == 1212
    assert db.query(AuthIdentity).filter_by(user_id=user.id).count() == 1


def test_confirm_attempts_are_bounded(api):
    """Unverified confirmations cannot be retried forever."""
    client, db = api
    user = _user(db, telegram_id=4545)
    challenge_id = _start(client, user, "google").json()["challenge_id"]

    for _ in range(linking.MAX_CONFIRM_ATTEMPTS):
        assert _confirm(client, user, challenge_id).status_code == 400
    # The challenge is burned rather than left open for unlimited retries.
    record = db.query(AccountLinkChallenge).filter_by(id=challenge_id).one()
    assert record.status == "failed"


def test_challenge_ids_are_redacted_from_request_logs():
    from app.utils.error_handlers import redact_path

    secret = "secret-challenge-id-value"
    assert (
        redact_path(f"/api/auth/linking/challenges/{secret}/verify")
        == "/api/auth/linking/challenges/<redacted>/verify"
    )
    assert (
        redact_path(f"/api/auth/linking/challenges/{secret}/confirm")
        == "/api/auth/linking/challenges/<redacted>/confirm"
    )
    assert (
        redact_path(f"/api/auth/linking/challenges/{secret}")
        == "/api/auth/linking/challenges/<redacted>"
    )
    assert redact_path("/api/users/me/identities") == "/api/users/me/identities"


def test_invalid_jwt_is_rejected_without_anonymous_fallback(api):
    client, _ = api
    response = client.post(
        "/api/auth/linking/challenges",
        json={"provider": "google"},
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )
    assert response.status_code == 401
