"""Run with: cd backend && .venv/bin/python -m app.tests.test_walk_score"""
import hashlib
import hmac
import json
import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import String, Text, TypeDecorator, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sqlalchemy.dialects.postgresql as pg

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("JWT_SECRET", "test-secret")


class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value is not None else None


class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else None


pg.UUID = SQLiteUUID
pg.JSONB = SQLiteJSONB

from app.database import Base  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.wearable import UserWearable, WearableDailySteps, WalkScoreDay  # noqa: E402
from app.services.walk_score import process_event, verify_signature  # noqa: E402
from app.api.wearables import router, connect  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import get_db  # noqa: E402
from app.dependencies import get_current_user  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def daily(terra_id, user_id, provider, steps, day=None):
    day = day or datetime.now(timezone.utc).date().isoformat()
    return {
        "type": "daily",
        "user": {"user_id": terra_id, "reference_id": str(user_id), "provider": provider},
        "data": [{"metadata": {"start_time": f"{day}T00:00:00+03:00"},
                  "distance_data": {"summary": {"steps": steps}}}],
    }


def run():
    raw = b'{"type":"daily"}'
    timestamp = int(datetime.now(timezone.utc).timestamp())
    digest = hmac.new(b"secret", str(timestamp).encode() + b"." + raw, hashlib.sha256).hexdigest()
    header = f"t={timestamp},v1={digest}"
    assert verify_signature(raw, header, "secret")
    assert not verify_signature(raw + b" ", header, "secret")
    assert not verify_signature(raw, header, "wrong")
    old_timestamp = timestamp - 3600
    old_digest = hmac.new(b"secret", str(old_timestamp).encode() + b"." + raw, hashlib.sha256).hexdigest()
    assert not verify_signature(raw, f"t={old_timestamp},v1={old_digest}", "secret")

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[User.__table__, UserWearable.__table__,
                                            WearableDailySteps.__table__, WalkScoreDay.__table__])
    db = sessionmaker(bind=engine)()
    user = User(id=uuid.uuid4(), name="Walker", telegram_id=999001)
    db.add(user)
    db.commit()
    uid = user.id

    def auth(terra_id, provider):
        return {"type": "auth", "status": "success", "user": {"user_id": terra_id, "reference_id": str(uid), "provider": provider}}

    process_event(db, auth("terra-fitbit", "FITBIT"))
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 4000))["steps_added"] == 4000
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 4000))["steps_added"] == 0
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 3500))["steps_added"] == 0
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 5200))["steps_added"] == 1200
    process_event(db, auth("terra-garmin", "GARMIN"))
    assert process_event(db, daily("terra-garmin", uid, "GARMIN", 5000))["steps_added"] == 0
    assert process_event(db, daily("terra-garmin", uid, "GARMIN", 6000))["steps_added"] == 800
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 2000, yesterday))["steps_added"] == 2000
    assert db.get(User, uid).walk_score == 8000

    app = FastAPI()
    app.include_router(router, prefix="/api/wearables")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    settings.TERRA_WEBHOOK_SECRET = "secret"
    with TestClient(app) as client:
        payload = json.dumps(daily("terra-garmin", uid, "GARMIN", 6500)).encode()
        assert client.post("/api/wearables/webhook", content=payload, headers={"terra-signature": "bad"}).status_code == 401
        signed = hmac.new(b"secret", str(timestamp).encode() + b"." + payload, hashlib.sha256).hexdigest()
        response = client.post("/api/wearables/webhook", content=payload,
                               headers={"terra-signature": f"t={timestamp},v1={signed}"})
        assert response.status_code == 200, response.text
        assert response.json()["steps_added"] == 500
        assert client.post("/api/wearables/webhook", content=payload,
                           headers={"terra-signature": f"t={timestamp},v1={signed}"}).json()["steps_added"] == 0
        assert client.get("/api/wearables/status").json()["walk_score"] == 8500

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "success", "url": "https://widget.tryterra.co/session/test", "expires_in": 900}

    class FakeTerraClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        async def post(self, url, headers, json):
            assert json["reference_id"] == str(uid)
            assert headers["x-api-key"] == "api-key"
            return FakeResponse()

    settings.TERRA_DEV_ID = "dev-id"
    settings.TERRA_API_KEY = "api-key"
    with patch("app.api.wearables.httpx.AsyncClient", return_value=FakeTerraClient()):
        assert asyncio.run(connect(user))["url"] == "https://widget.tryterra.co/session/test"
    assert db.query(WalkScoreDay).count() == 2

    process_event(db, {"type": "deauth", "user": {"user_id": "terra-fitbit", "reference_id": str(uid), "provider": "FITBIT"}})
    assert process_event(db, daily("terra-fitbit", uid, "FITBIT", 9000))["status"] == "ignored"
    assert db.get(User, uid).walk_score == 8500
    process_event(db, {"type": "user_reauth", "status": "success",
                       "new_user": {"user_id": "terra-garmin-new", "reference_id": str(uid), "provider": "GARMIN"},
                       "old_user": {"user_id": "terra-garmin", "reference_id": str(uid), "provider": "GARMIN"}})
    assert process_event(db, daily("terra-garmin", uid, "GARMIN", 10000))["status"] == "ignored"
    assert process_event(db, daily("terra-garmin-new", uid, "GARMIN", 7000))["steps_added"] == 500
    try:
        process_event(db, daily("unknown-terra-id", uid, "STRAVA", 3000))
        assert False, "daily data before auth must be retried"
    except LookupError:
        pass
    assert db.get(User, uid).walk_score == 9000
    db.close()
    print("Walk Score signature and daily accounting tests passed")


def test_walk_score():
    run()


if __name__ == "__main__":
    run()
