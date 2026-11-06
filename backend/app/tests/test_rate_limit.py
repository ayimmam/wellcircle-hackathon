"""Phase F — durable rate limiting for reconciliation dry runs."""

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB  # noqa: F401

from app.api import auth
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.api_rate_limit import ApiRateLimit
from app.models.auth_identity import AuthIdentity
from app.models.point_transaction import PointTransaction
from app.models.user import User
from app.services.rate_limit import (
    RECONCILIATION_DRY_RUN,
    RateLimitExceeded,
    enforce_rate_limit,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _user(db, telegram_id=None):
    user = User(telegram_id=telegram_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_rate_limit_allows_then_rejects_and_counts_only_counters(db):
    user = _user(db, telegram_id=881001)
    for _ in range(3):
        enforce_rate_limit(db, user.id, RECONCILIATION_DRY_RUN, limit=3)

    before = db.query(ApiRateLimit).count()
    with pytest.raises(RateLimitExceeded) as error:
        enforce_rate_limit(db, user.id, RECONCILIATION_DRY_RUN, limit=3)
    assert 1 <= error.value.retry_after <= 60
    assert db.query(ApiRateLimit).count() == before == 3


def test_expired_counter_window_is_reclaimed(db, monkeypatch):
    user = _user(db, telegram_id=881002)
    enforce_rate_limit(db, user.id, RECONCILIATION_DRY_RUN, limit=1)
    with pytest.raises(RateLimitExceeded):
        enforce_rate_limit(db, user.id, RECONCILIATION_DRY_RUN, limit=1)

    import app.services.rate_limit as rate_limit_module

    future = int(time.time()) + 120
    monkeypatch.setattr(rate_limit_module.time, "time", lambda: future)
    enforce_rate_limit(db, user.id, RECONCILIATION_DRY_RUN, limit=1)
    assert db.query(ApiRateLimit).count() == 1


def test_user_dry_run_returns_429_and_does_not_touch_account_data(db, monkeypatch):
    canonical = _user(db, telegram_id=881003)
    source = _user(db, telegram_id=None)
    db.add(AuthIdentity(user_id=source.id, provider="google", subject="rate-source"))
    db.add(PointTransaction(user_id=source.id, amount=5, type="checkin"))
    db.commit()

    monkeypatch.setattr(
        "app.api.account_reconciliation.verify_provider_proof",
        lambda provider, payload: {
            "provider": "google",
            "subject": "rate-source",
            "email": None,
        },
    )
    monkeypatch.setattr(
        "app.api.account_reconciliation.RECONCILIATION_DRY_RUN_LIMIT", 2
    )

    def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app) as client:
            headers = {"Authorization": f"Bearer {auth._create_token(str(canonical.id))}"}
            body = {"source_provider": "google", "google_id_token": "ok"}
            first = client.post("/api/account-reconciliation/dry-run", json=body, headers=headers)
            second = client.post("/api/account-reconciliation/dry-run", json=body, headers=headers)
            limited = client.post("/api/account-reconciliation/dry-run", json=body, headers=headers)

            assert first.status_code == 200
            assert second.status_code == 200
            assert limited.status_code == 429
            assert 1 <= int(limited.headers["retry-after"]) <= 60

        assert db.query(User).count() == 2
        assert db.query(PointTransaction).count() == 1
        assert db.query(ApiRateLimit).count() == 2
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
