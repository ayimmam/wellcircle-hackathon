"""Phase A — Telegram identity consistency and GET /users/me/identities.

Covers the identity-foundation contract:

* every Telegram authentication path (Mini App, Login Widget, bot registration)
  records the verified Telegram identity in ``auth_identities``;
* repeated logins are idempotent and never duplicate an identity row;
* an identity already owned by another user is never reassigned, and the login
  itself keeps working unchanged;
* ``GET /users/me/identities`` returns only the verified caller's identities,
  rejects unauthenticated requests, and exposes no sensitive fields.

Run: cd backend && pytest app/tests/test_auth_identity_consistency.py -q
"""

from datetime import datetime, timezone

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Existing suite UUID/JSON adapters must be installed before model imports.
from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB  # noqa: F401

from app.api import auth, bot
from app.crud.auth_identity import ensure_telegram_identity, get_identity
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.schemas.user import (
    BotRegisterRequest,
    TelegramAuthRequest,
    TelegramWidgetLoginRequest,
    UserResponse,
)

MINI_APP_ID = 555000111
WIDGET_ID = 555000222
BOT_ID = 555000333


def _user_response(user, db):
    """Minimal profile payload; this module tests identity wiring, not profile."""
    return UserResponse(
        id=str(user.id),
        created_at=user.created_at or datetime.now(timezone.utc),
        phone_number=user.phone_number,
    )


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def telegram_login(monkeypatch, db):
    """Make Mini App and widget logins verify as fixed, server-side identities."""
    monkeypatch.setattr(auth.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(auth, "_build_response", _user_response)
    monkeypatch.setattr(
        auth,
        "validate_init_data_dev",
        lambda raw: {"telegram_id": MINI_APP_ID, "username": "abebe", "photo_url": None},
    )
    monkeypatch.setattr(
        auth,
        "validate_login_widget_data",
        lambda payload: {"telegram_id": payload["id"]},
    )


def _mini_app_login(db):
    return asyncio.run(
        auth.telegram_auth(TelegramAuthRequest(init_data="signed-init-data"), db)
    )


def _widget_login(db, telegram_id=WIDGET_ID):
    return asyncio.run(
        auth.telegram_widget_auth(
            TelegramWidgetLoginRequest(
                id=telegram_id,
                first_name="Abebe",
                last_name="Bekele",
                username="abebe",
                photo_url=None,
                auth_date=1_700_000_000,
                hash="verified-by-patched-validator",
            ),
            db,
        )
    )


def _identity_for(db, telegram_id):
    return get_identity(db, "telegram", str(telegram_id))


# --------------------------------------------------------------- Mini App flow


def test_new_mini_app_user_gets_identity_row(db, telegram_login):
    result = _mini_app_login(db)

    assert result.is_new_user is True
    identity = _identity_for(db, MINI_APP_ID)
    assert identity is not None
    assert identity.provider == "telegram"
    assert str(identity.user_id) == result.user.id


def test_existing_telegram_user_missing_identity_gets_one_on_login(db, telegram_login):
    user = User(telegram_id=MINI_APP_ID, telegram_handle="abebe")
    db.add(user)
    db.commit()
    assert _identity_for(db, MINI_APP_ID) is None

    result = _mini_app_login(db)

    assert result.is_new_user is False
    identity = _identity_for(db, MINI_APP_ID)
    assert identity is not None and str(identity.user_id) == str(user.id)


def test_repeated_login_is_idempotent(db, telegram_login):
    first = _mini_app_login(db)
    second = _mini_app_login(db)

    assert first.user.id == second.user.id
    identities = (
        db.query(AuthIdentity)
        .filter(AuthIdentity.provider == "telegram", AuthIdentity.subject == str(MINI_APP_ID))
        .all()
    )
    assert len(identities) == 1
    assert str(identities[0].user_id) == first.user.id


# ------------------------------------------------------------ Login Widget flow


def test_new_widget_user_gets_identity_row(db, telegram_login):
    result = _widget_login(db)

    assert result.is_new_user is True
    identity = _identity_for(db, WIDGET_ID)
    assert identity is not None and str(identity.user_id) == result.user.id


def test_existing_widget_user_is_backfilled_on_login(db, telegram_login):
    user = User(telegram_id=WIDGET_ID, telegram_handle="abebe")
    db.add(user)
    db.commit()

    result = _widget_login(db)

    assert result.is_new_user is False
    identity = _identity_for(db, WIDGET_ID)
    assert identity is not None and str(identity.user_id) == str(user.id)


# --------------------------------------------------------------- bot flow


def test_bot_registration_creates_identity_row(db, telegram_login):
    result = asyncio.run(
        bot.bot_register(
            BotRegisterRequest(telegram_id=BOT_ID, telegram_handle="abebe"),
            db,
            True,  # bot API key dependency already verified
        )
    )

    assert result["created"] is True
    identity = _identity_for(db, BOT_ID)
    assert identity is not None and str(identity.user_id) == result["id"]


def test_bot_user_relogin_via_mini_app_does_not_duplicate(db, telegram_login, monkeypatch):
    first = asyncio.run(
        bot.bot_register(BotRegisterRequest(telegram_id=BOT_ID), db, True)
    )
    monkeypatch.setattr(
        auth,
        "validate_init_data_dev",
        lambda raw: {"telegram_id": BOT_ID, "username": "abebe", "photo_url": None},
    )

    login = _mini_app_login(db)

    assert login.user.id == first["id"]
    identities = (
        db.query(AuthIdentity)
        .filter(AuthIdentity.provider == "telegram", AuthIdentity.subject == str(BOT_ID))
        .all()
    )
    assert len(identities) == 1
    assert str(identities[0].user_id) == first["id"]


# ------------------------------------------------- ownership conflicts


def test_identity_owned_by_another_user_is_never_reassigned(db, telegram_login, monkeypatch):
    owner = User(telegram_id=999000111)
    other = User(telegram_id=999000222)
    db.add_all([owner, other])
    db.commit()
    db.add(
        AuthIdentity(user_id=owner.id, provider="telegram", subject=str(other.telegram_id))
    )
    db.commit()

    # Helper contract: the conflicting row is left untouched and reported as
    # "not yours" rather than being moved onto the current user.
    assert ensure_telegram_identity(db, other.id, other.telegram_id) is None
    identity = _identity_for(db, other.telegram_id)
    assert str(identity.user_id) == str(owner.id)

    # A real login as `other` still succeeds and still does not steal the row.
    monkeypatch.setattr(
        auth,
        "validate_init_data_dev",
        lambda raw: {"telegram_id": other.telegram_id, "username": "other", "photo_url": None},
    )
    result = _mini_app_login(db)

    assert result.user.id == str(other.id)
    identity = _identity_for(db, other.telegram_id)
    assert str(identity.user_id) == str(owner.id)
    assert (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.provider == "telegram",
            AuthIdentity.subject == str(other.telegram_id),
        )
        .count()
        == 1
    )


def test_login_still_works_when_identity_row_is_held_elsewhere(db, telegram_login):
    user = User(telegram_id=MINI_APP_ID)
    owner = User(telegram_id=777000000)
    db.add_all([user, owner])
    db.commit()
    db.add(AuthIdentity(user_id=owner.id, provider="telegram", subject=str(MINI_APP_ID)))
    db.commit()

    result = _mini_app_login(db)

    assert result.is_new_user is False
    assert result.user.id == str(user.id)
    assert result.token


# ------------------------------------------------- Google path stays intact


def test_google_sign_in_still_creates_identity(db, monkeypatch):
    """Regression guard: the Telegram refactor must not disturb Google's flow."""
    import google.auth.transport.requests as google_requests
    import google.oauth2.id_token as google_id_token

    from app.schemas.user import GoogleAuthRequest

    monkeypatch.setattr(auth.settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(auth, "_build_response", _user_response)
    monkeypatch.setattr(google_requests, "Request", lambda *args, **kwargs: object())
    monkeypatch.setattr(
        google_id_token,
        "verify_oauth2_token",
        lambda credential, request, client_id: {
            "sub": "google-sub-phase-a",
            "email": "member@example.com",
            "email_verified": True,
            "name": "Member",
        },
    )

    result = asyncio.run(auth.google_auth(GoogleAuthRequest(credential="stub"), db))

    assert result.is_new_user is True
    identity = get_identity(db, "google", "google-sub-phase-a")
    assert identity is not None and str(identity.user_id) == result.user.id
    assert identity.email == "member@example.com"


# ------------------------------------------------- GET /users/me/identities


@pytest.fixture
def api():
    """TestClient wired to a shared in-memory SQLite database.

    ``StaticPool`` + ``check_same_thread=False`` follow the existing
    TestClient tests (test_walk_score.py): the app runs the dependency in a
    worker thread, so the session must be usable across threads.
    """
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
        with TestClient(fastapi_app) as test_client:
            yield test_client, session
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
        session.close()
        engine.dispose()


def _seed_identities(db):
    caller = User(telegram_id=MINI_APP_ID)
    other = User(telegram_id=WIDGET_ID)
    db.add_all([caller, other])
    db.commit()
    db.add_all(
        [
            AuthIdentity(
                user_id=caller.id,
                provider="telegram",
                subject=str(MINI_APP_ID),
            ),
            AuthIdentity(
                user_id=caller.id,
                provider="google",
                subject="google-sub-caller",
                email="caller@example.com",
            ),
            AuthIdentity(
                user_id=other.id,
                provider="telegram",
                subject=str(WIDGET_ID),
            ),
        ]
    )
    db.commit()
    return caller, other


def _auth_header(user):
    return {"Authorization": f"Bearer {auth._create_token(str(user.id))}"}


def test_me_identities_returns_only_the_callers_identities(api):
    client, db = api
    caller, other = _seed_identities(db)

    response = client.get("/api/users/me/identities", headers=_auth_header(caller))

    assert response.status_code == 200
    identities = response.json()["identities"]
    assert len(identities) == 2
    assert {item["provider"] for item in identities} == {"telegram", "google"}
    assert all(item["subject"] != str(other.telegram_id) for item in identities)
    assert "google-sub-caller" in {item["subject"] for item in identities}


def test_me_identities_requires_authentication(api):
    client, db = api
    _seed_identities(db)

    response = client.get("/api/users/me/identities")

    # FastAPI 0.104 (pinned) answers a missing bearer credential with 403.
    assert response.status_code in (401, 403)


def test_me_identities_has_no_sensitive_fields(api):
    client, db = api
    caller, _ = _seed_identities(db)

    response = client.get("/api/users/me/identities", headers=_auth_header(caller))

    assert response.status_code == 200
    for identity in response.json()["identities"]:
        assert set(identity) == {"provider", "subject", "email", "verified_at", "created_at"}
    lowered = response.text.lower()
    for forbidden in ("password", "secret", "token", "hash"):
        assert forbidden not in lowered
