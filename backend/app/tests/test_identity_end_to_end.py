"""Phase E — integrated identity journeys across Mini App, widget, web, bot.

Provider credentials are mocked at the existing service boundaries; no real
Telegram/Google account or production credential is used. The tests exercise
the real FastAPI routes, real JWT creation, real identity resolution and the
real Phase B challenge lifecycle.
"""

import time

from jose import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Existing suite UUID/JSON adapters must be installed before model imports.
from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB  # noqa: F401

from app.api import auth
from app.config import settings
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.services import account_linking as linking

GOOGLE_SUB_A = "google-sub-journey-a"
GOOGLE_SUB_B = "google-sub-journey-b"
GOOGLE_SUB_SHARED = "google-sub-shared"


@pytest.fixture
def api(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    monkeypatch.setattr(settings, "BOT_API_KEY", "test-bot-key")

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
def providers(monkeypatch):
    """Mock provider verification at the same boundaries as production code."""

    google_tokens = {
        "google-a": (GOOGLE_SUB_A, "a@example.com"),
        "google-b": (GOOGLE_SUB_B, "b@example.com"),
        "google-shared": (GOOGLE_SUB_SHARED, "shared@example.com"),
    }
    telegram_init = {
        "telegram:111": 111000111,
        "telegram:222": 222000222,
        "telegram:333": 333000333,
    }

    def verify_google(token):
        if token not in google_tokens:
            raise ValueError("unknown Google token")
        subject, email = google_tokens[token]
        return {"google_sub": subject, "email": email, "name": "Journey User", "picture": None}

    def validate_init(raw):
        if raw not in telegram_init:
            return None
        return {"telegram_id": telegram_init[raw], "username": "journey", "photo_url": None}

    def validate_widget(data):
        if data.get("hash") != "signed":
            return None
        return {
            "telegram_id": data["id"],
            "username": data.get("username"),
            "first_name": "Journey",
            "last_name": "User",
            "photo_url": None,
        }

    # Login routes import their verifiers directly into app.api.auth.
    monkeypatch.setattr(auth, "verify_google_token", verify_google)
    monkeypatch.setattr(auth, "validate_login_widget_data", validate_widget)
    monkeypatch.setattr(auth, "validate_init_data", validate_init)
    monkeypatch.setattr(auth, "validate_init_data_dev", validate_init)

    # Linking imports its own copies into the service module.
    monkeypatch.setattr(linking, "verify_google_token", verify_google)
    monkeypatch.setattr(linking, "validate_login_widget_data", validate_widget)
    monkeypatch.setattr(linking, "validate_init_data", validate_init)
    monkeypatch.setattr(linking, "validate_init_data_dev", validate_init)

    return {"google": google_tokens, "telegram": telegram_init}


def _jwt_sub(token):
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    return payload["sub"]


def _auth_headers(user):
    return {"Authorization": f"Bearer {auth._create_token(str(user.id))}"}


def _mini_app_login(client, raw_init):
    response = client.post("/api/auth/telegram", json={"init_data": raw_init})
    assert response.status_code == 200, response.text
    return response.json()


def _widget_login(client, telegram_id):
    response = client.post(
        "/api/auth/telegram-widget",
        json={
            "id": telegram_id,
            "first_name": "Journey",
            "last_name": "User",
            "username": "journey",
            "photo_url": None,
            "auth_date": int(time.time()),
            "hash": "signed",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _google_login(client, token="google-a"):
    response = client.post("/api/auth/firebase", json={"id_token": token})
    assert response.status_code == 200, response.text
    return response.json()


def _start_link(client, user, provider):
    response = client.post(
        "/api/auth/linking/challenges",
        json={"provider": provider},
        headers=_auth_headers(user),
    )
    assert response.status_code == 201, response.text
    return response.json()["challenge_id"]


def _verify_link(client, user, challenge_id, **proof):
    response = client.post(
        f"/api/auth/linking/challenges/{challenge_id}/verify",
        json=proof,
        headers=_auth_headers(user),
    )
    assert response.status_code == 200, response.text
    return response.json()


def _confirm_link(client, user, challenge_id):
    return client.post(
        f"/api/auth/linking/challenges/{challenge_id}/confirm",
        headers=_auth_headers(user),
    )


def _user(db, user_id):
    return db.query(User).filter(User.id == user_id).one()


def _identities(db, user_id):
    return (
        db.query(AuthIdentity)
        .filter(AuthIdentity.user_id == user_id)
        .order_by(AuthIdentity.provider)
        .all()
    )


def test_journey_a_telegram_to_google(api, providers):
    client, db = api

    mini = _mini_app_login(client, "telegram:111")
    canonical_id = mini["user"]["id"]
    assert _jwt_sub(mini["token"]) == canonical_id
    assert {(row.provider, row.subject) for row in _identities(db, canonical_id)} == {
        ("telegram", "111000111")
    }

    challenge_id = _start_link(client, _user(db, canonical_id), "google")
    _verify_link(client, _user(db, canonical_id), challenge_id, google_id_token="google-a")
    confirmed = _confirm_link(client, _user(db, canonical_id), challenge_id)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["linked"] is True

    # Sign out means discarding the JWT; a fresh Google login must resolve the
    # same canonical account.
    google = _google_login(client, "google-a")
    assert google["is_new_user"] is False
    assert _jwt_sub(google["token"]) == canonical_id
    assert {(row.provider, row.subject) for row in _identities(db, canonical_id)} == {
        ("telegram", "111000111"),
        ("google", GOOGLE_SUB_A),
    }
    assert db.query(User).count() == 1


def test_journey_b_google_to_telegram(api, providers):
    client, db = api

    google = _google_login(client, "google-b")
    canonical_id = google["user"]["id"]
    assert _jwt_sub(google["token"]) == canonical_id
    assert {(row.provider, row.subject) for row in _identities(db, canonical_id)} == {
        ("google", GOOGLE_SUB_B)
    }

    challenge_id = _start_link(client, _user(db, canonical_id), "telegram")
    _verify_link(
        client,
        _user(db, canonical_id),
        challenge_id,
        telegram_login={
            "id": 222000222,
            "first_name": "Journey",
            "last_name": "User",
            "username": "journey",
            "photo_url": None,
            "auth_date": int(time.time()),
            "hash": "signed",
        },
    )
    confirmed = _confirm_link(client, _user(db, canonical_id), challenge_id)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["linked"] is True

    widget = _widget_login(client, 222000222)
    assert widget["is_new_user"] is False
    assert _jwt_sub(widget["token"]) == canonical_id
    assert {(row.provider, row.subject) for row in _identities(db, canonical_id)} == {
        ("google", GOOGLE_SUB_B),
        ("telegram", "222000222"),
    }
    assert db.query(User).count() == 1


def test_journey_c_bot_to_miniapp_to_website(api, providers):
    client, db = api

    registered = client.post(
        "/api/bot/register",
        json={"telegram_id": 333000333, "telegram_handle": "journey"},
        headers={"X-Bot-API-Key": "test-bot-key"},
    )
    assert registered.status_code == 200, registered.text
    canonical_id = registered.json()["id"]
    assert registered.json()["created"] is True
    assert len(_identities(db, canonical_id)) == 1

    mini = _mini_app_login(client, "telegram:333")
    assert mini["is_new_user"] is False
    assert _jwt_sub(mini["token"]) == canonical_id
    assert len(_identities(db, canonical_id)) == 1

    widget = _widget_login(client, 333000333)
    assert widget["is_new_user"] is False
    assert _jwt_sub(widget["token"]) == canonical_id
    assert len(_identities(db, canonical_id)) == 1
    assert db.query(User).count() == 1


def test_journey_d_conflict_never_reassigns_identity(api, providers):
    client, db = api

    first = _mini_app_login(client, "telegram:111")
    second = _mini_app_login(client, "telegram:222")
    first_id, second_id = first["user"]["id"], second["user"]["id"]
    assert first_id != second_id

    challenge_id = _start_link(client, _user(db, first_id), "google")
    _verify_link(client, _user(db, first_id), challenge_id, google_id_token="google-shared")
    assert _confirm_link(client, _user(db, first_id), challenge_id).status_code == 200

    other_challenge = _start_link(client, _user(db, second_id), "google")
    other_verify = _verify_link(
        client, _user(db, second_id), other_challenge, google_id_token="google-shared"
    )
    assert other_verify["subject"] == GOOGLE_SUB_SHARED
    conflict = _confirm_link(client, _user(db, second_id), other_challenge)
    assert conflict.status_code == 409, conflict.text

    first_identities = {(row.provider, row.subject) for row in _identities(db, first_id)}
    second_identities = {(row.provider, row.subject) for row in _identities(db, second_id)}
    assert ("google", GOOGLE_SUB_SHARED) in first_identities
    assert ("google", GOOGLE_SUB_SHARED) not in second_identities
    assert db.query(User).count() == 2
