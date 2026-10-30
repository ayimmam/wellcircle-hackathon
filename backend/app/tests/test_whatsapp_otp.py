"""Delivery, restart survival, abuse controls and failure-mode regressions."""
import logging
import json
import uuid
from types import SimpleNamespace
import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker
# Match the existing test suite's SQLite compatibility before importing models.
import sqlalchemy.dialects.postgresql as pg
class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True
    def process_bind_param(self, value, dialect): return str(value) if value is not None else None
    def process_result_value(self, value, dialect): return uuid.UUID(value) if value else None
class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True
    def process_bind_param(self, value, dialect): return json.dumps(value) if value is not None else None
    def process_result_value(self, value, dialect): return json.loads(value) if value is not None else None
pg.UUID = SQLiteUUID
pg.JSONB = SQLiteJSONB

from app.services import otp
from app.models.otp_challenge import OTPChallenge
from app.schemas.user import WhatsAppStartRequest, WhatsAppVerifyRequest

PHONE = "+251911234567"

@pytest.fixture
def sessions(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    OTPChallenge.__table__.create(engine)
    factory = sessionmaker(bind=engine)
    for name in ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_TOKEN", "WHATSAPP_OTP_TEMPLATE_NAME", "WHATSAPP_API_VERSION", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"]:
        monkeypatch.setattr(otp.settings, name, "")
    monkeypatch.setattr(otp.settings, "ENVIRONMENT", "production")
    monkeypatch.delenv("VERCEL", raising=False)
    yield factory
    engine.dispose()

@pytest.fixture
def meta(sessions, monkeypatch):
    for key, value in {"WHATSAPP_PHONE_NUMBER_ID": "phone-id", "WHATSAPP_API_TOKEN": "server-token", "WHATSAPP_OTP_TEMPLATE_NAME": "wellcircle_login", "WHATSAPP_API_VERSION": "v24.0"}.items():
        monkeypatch.setattr(otp.settings, key, value)
    calls = []
    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(200, json={"messages": [{"id": "message-id"}]})
    monkeypatch.setattr(otp.httpx, "post", post)
    return calls

def send(sessions):
    with sessions() as db: return otp.start_otp(PHONE, db=db, ip="test-client")

def test_meta_sends_same_code_in_body_and_button_and_verifies_in_new_worker(sessions, meta):
    result = send(sessions)
    body = meta[0][1]["json"]["template"]
    code = body["components"][0]["parameters"][0]["text"]
    assert code.isdigit() and len(code) == 6
    assert body["components"][1]["parameters"][0]["text"] == code
    assert "_dev_code" not in result
    with sessions() as db:
        record = db.get(OTPChallenge, result["request_id"])
        assert record.code_hash != code and record.code_hash
        assert otp.verify_otp(result["request_id"], code, db=db) == PHONE
    with sessions() as db:
        assert otp.verify_otp(result["request_id"], code, db=db) is None
        record = db.get(OTPChallenge, result["request_id"])
        assert record.status == "used" and record.code_hash is None and record.phone_e164 is None

@pytest.mark.parametrize("response", [httpx.Response(400, json={"error": "provider-private-detail"}), httpx.Response(200, json={"messages": []})])
def test_delivery_failure_never_reports_success(sessions, meta, monkeypatch, caplog, response):
    monkeypatch.setattr(otp.httpx, "post", lambda *args, **kwargs: response)
    with caplog.at_level(logging.WARNING), sessions() as db:
        with pytest.raises(otp.OTPDeliveryUnavailable): otp.start_otp(PHONE, db=db)
        record = db.query(OTPChallenge).one()
        assert record.status == "failed" and record.phone_e164 is None and record.code_hash is None
    assert PHONE not in caplog.text and "server-token" not in caplog.text and "provider-private-detail" not in caplog.text

def test_unconfigured_production_fails_closed(sessions):
    with sessions() as db:
        with pytest.raises(otp.OTPDeliveryUnavailable): otp.start_otp(PHONE, db=db)
        assert db.query(OTPChallenge).count() == 0

def test_vercel_never_enables_development_fallback(sessions, monkeypatch):
    monkeypatch.setattr(otp.settings, "ENVIRONMENT", "development")
    monkeypatch.setenv("VERCEL", "1")
    with sessions() as db:
        with pytest.raises(otp.OTPDeliveryUnavailable): otp.start_otp(PHONE, db=db)

def test_phone_rate_limit_survives_new_sessions(sessions, meta):
    assert send(sessions)
    assert send(sessions)
    assert send(sessions) is None
    assert len(meta) == 2

def test_ip_limit_spans_different_phones(sessions, meta, monkeypatch):
    monkeypatch.setattr(otp, "IP_RATE_LIMIT", 2)
    for index in range(3):
        with sessions() as db:
            result = otp.start_otp(f"+25191100000{index}", db=db, ip="shared-ip")
            assert bool(result) == (index < 2)
    assert len(meta) == 2

def test_wrong_attempts_lock_challenge_across_workers(sessions, meta):
    result = send(sessions)
    correct = meta[0][1]["json"]["template"]["components"][0]["parameters"][0]["text"]
    wrong = "000000" if correct != "000000" else "111111"
    for _ in range(5):
        with sessions() as db: assert otp.verify_otp(result["request_id"], wrong, db=db) is None
    with sessions() as db:
        assert otp.verify_otp(result["request_id"], correct, db=db) is None
        assert db.get(OTPChallenge, result["request_id"]).status == "locked"

def test_fifth_attempt_can_succeed(sessions, meta):
    result = send(sessions)
    correct = meta[0][1]["json"]["template"]["components"][0]["parameters"][0]["text"]
    wrong = "000000" if correct != "000000" else "111111"
    with sessions() as db:
        for _ in range(4): assert otp.verify_otp(result["request_id"], wrong, db=db) is None
        assert otp.verify_otp(result["request_id"], correct, db=db) == PHONE

def test_expired_code_is_rejected_and_redacted(sessions, meta, monkeypatch):
    result = send(sessions)
    correct = meta[0][1]["json"]["template"]["components"][0]["parameters"][0]["text"]
    now = otp.time.time()
    monkeypatch.setattr(otp.time, "time", lambda: now + 601)
    with sessions() as db:
        assert otp.verify_otp(result["request_id"], correct, db=db) is None
        assert db.get(OTPChallenge, result["request_id"]).phone_e164 is None

def test_twilio_survives_restart_and_checks_provider_sid(sessions, monkeypatch):
    for name in ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"]: monkeypatch.setattr(otp.settings, name, "test-value")
    calls = []
    def post(url, **kwargs):
        calls.append(kwargs)
        return httpx.Response(200, json={"status": "approved"} if url.endswith("VerificationCheck") else {"sid": "verification-sid", "status": "pending"})
    monkeypatch.setattr(otp.httpx, "post", post)
    result = send(sessions)
    with sessions() as db: assert otp.verify_otp(result["request_id"], "123456", db=db) == PHONE
    assert calls[-1]["data"] == {"VerificationSid": "verification-sid", "Code": "123456"}

def test_schema_rejects_unsupported_channel_and_non_numeric_code():
    with pytest.raises(ValidationError): WhatsAppStartRequest(phone=PHONE, channel="email")
    with pytest.raises(ValidationError): WhatsAppVerifyRequest(request_id="challenge", code="abcdef")

def test_route_returns_503_for_unconfigured_delivery(sessions):
    from app.api.auth import whatsapp_start
    with sessions() as db:
        with pytest.raises(HTTPException) as failure:
            whatsapp_start(WhatsAppStartRequest(phone=PHONE), SimpleNamespace(client=SimpleNamespace(host="client")), db)
        assert failure.value.status_code == 503

def test_development_codes_never_escape_public_response(sessions, monkeypatch):
    from app.api.auth import whatsapp_start
    monkeypatch.setattr(otp.settings, "ENVIRONMENT", "development")
    with sessions() as db:
        result = whatsapp_start(WhatsAppStartRequest(phone=PHONE), SimpleNamespace(client=SimpleNamespace(host="client")), db)
        assert "_dev_code" not in result.model_dump()
        assert result.retry_after == 60

def test_whatsapp_creates_then_reuses_the_same_account(sessions, meta):
    from app.database import Base
    from app.api.auth import whatsapp_verify
    from app.models.auth_identity import AuthIdentity
    from app.models.user import User
    with sessions() as db: Base.metadata.create_all(db.get_bind())
    first = send(sessions)
    first_code = meta[-1][1]["json"]["template"]["components"][0]["parameters"][0]["text"]
    with sessions() as db:
        created = whatsapp_verify(WhatsAppVerifyRequest(request_id=first["request_id"], code=first_code), db)
        assert created.is_new_user and created.token and created.user.telegram_id is None
    second = send(sessions)
    second_code = meta[-1][1]["json"]["template"]["components"][0]["parameters"][0]["text"]
    with sessions() as db:
        existing = whatsapp_verify(WhatsAppVerifyRequest(request_id=second["request_id"], code=second_code), db)
        assert not existing.is_new_user and existing.user.id == created.user.id
        assert db.query(AuthIdentity).filter_by(provider="whatsapp", subject=PHONE).count() == 1
        assert db.query(User).count() == 1


def test_otp_migration_can_be_applied_idempotently_to_existing_installations():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect
    path = Path(__file__).resolve().parents[2] / "alembic/versions/027_durable_whatsapp_otp.py"
    spec = importlib.util.spec_from_file_location("otp_migration_027", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            module.upgrade()
            assert inspect(connection).has_table("whatsapp_otp_challenges")
            module.downgrade()
            assert not inspect(connection).has_table("whatsapp_otp_challenges")
    engine.dispose()
