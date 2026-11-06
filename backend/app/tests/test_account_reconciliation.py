"""Phase D — read-only duplicate-account reconciliation planning.

These tests are deliberately about the *dry-run* contract:

* the planner never mutates either account;
* every user-owned table (including Circler chat tables without FKs) is
  inspected;
* conflicts and unsafe business rules become blockers/manual decisions;
* sensitive content (names, emails, phones, subjects, chat text, tokens) is
  never returned.

There is no destructive merge in this phase; the plan always reports
``merge_implemented == False`` and ``safe_to_merge == False``.
"""

import json
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Existing suite UUID/JSON adapters must be installed before model imports.
from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB  # noqa: F401

from app.api import auth
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.auth_identity import AuthIdentity
from app.models.booking import Booking
from app.models.circle import Circle, CircleMember
from app.models.circle_subscription import CircleSubscription
from app.models.community_challenge import ChallengeAward as ChallengeAwardModel
from app.models.follower import Follower
from app.models.point_transaction import PointTransaction
from app.models.trainer_verification import TrainerVerification
from app.models.user import User
from app.models.wearable import UserWearable
from app.services.account_reconciliation import (
    ReconciliationError,
    build_reconciliation_plan,
)

CHAT_DDL = (
    "CREATE TABLE chat_memory ("
    "session_id TEXT PRIMARY KEY, messages TEXT, updated_at TEXT, "
    "owner_type TEXT, owner_id TEXT)",
    "CREATE TABLE chat_profile ("
    "owner_type TEXT, owner_id TEXT, display_name TEXT, preferences TEXT, "
    "preferences_consent_at TEXT, first_seen_at TEXT, last_seen_at TEXT, "
    "updated_at TEXT, PRIMARY KEY (owner_type, owner_id))",
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for statement in CHAT_DDL:
            conn.execute(text(statement))
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _users(db):
    canonical = User(telegram_id=111, name="Canonical Person", points_balance=10)
    source = User(telegram_id=222, name="Source Person", points_balance=20)
    db.add_all([canonical, source])
    db.commit()
    db.refresh(canonical)
    db.refresh(source)
    db.add_all([
        AuthIdentity(user_id=canonical.id, provider="telegram", subject="111"),
        AuthIdentity(user_id=source.id, provider="google", subject="google-subject", email="source@example.com"),
    ])
    db.commit()
    return canonical, source


def _chat(db, user, session_id, message="secret conversation text"):
    db.execute(
        text(
            "INSERT INTO chat_memory (session_id, messages, updated_at, owner_type, owner_id) "
            "VALUES (:sid, :messages, :updated, 'user', :owner)"
        ),
        {
            "sid": session_id,
            "messages": json.dumps([{"role": "user", "content": message}]),
            "updated": datetime.now(timezone.utc).isoformat(),
            "owner": str(user.id),
        },
    )
    db.commit()


def _chat_profile(db, user, name, preferences, consent=True):
    db.execute(
        text(
            "INSERT INTO chat_profile "
            "(owner_type, owner_id, display_name, preferences, preferences_consent_at, "
            " first_seen_at, last_seen_at, updated_at) "
            "VALUES ('user', :owner, :name, :prefs, :consent, 'now', 'now', 'now')"
        ),
        {
            "owner": str(user.id),
            "name": name,
            "prefs": json.dumps(preferences),
            "consent": "2026-01-01T00:00:00Z" if consent else None,
        },
    )
    db.commit()


def _snapshot(db):
    tables = (
        "users",
        "auth_identities",
        "bookings",
        "point_transactions",
        "circle_members",
        "challenge_awards",
        "trainer_verifications",
        "user_wearables",
        "chat_memory",
        "chat_profile",
    )
    result = {}
    for table in tables:
        result[table] = int(db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0)
    result["users_rows"] = [
        tuple(row)
        for row in db.execute(
            text("SELECT id, telegram_id, points_balance, walk_score, current_streak FROM users ORDER BY id")
        ).all()
    ]
    result["chat_rows"] = [
        tuple(row)
        for row in db.execute(
            text("SELECT session_id, owner_id, messages FROM chat_memory ORDER BY session_id")
        ).all()
    ]
    result["chat_profile_rows"] = [
        tuple(row)
        for row in db.execute(
            text("SELECT owner_id, display_name, preferences FROM chat_profile ORDER BY owner_id")
        ).all()
    ]
    return result


def _codes(plan, key="blockers"):
    return {entry["code"] for entry in plan[key]}


def test_dry_run_is_read_only_and_inspects_user_owned_tables(db):
    canonical, source = _users(db)
    _chat(db, source, "source-session")
    _chat(db, canonical, "canonical-session")
    before = _snapshot(db)

    plan = build_reconciliation_plan(db, canonical.id, source.id)

    assert _snapshot(db) == before
    assert plan["read_only"] is True
    assert plan["merge_implemented"] is False
    assert plan["safe_to_merge"] is False
    assert plan["merge_status"] == "blocked_pending_rules"
    tables = {row["table"]: row for row in plan["tables"]}
    assert tables["chat_memory"]["canonical_count"] == 1
    assert tables["chat_memory"]["source_count"] == 1
    assert tables["chat_memory"]["transferable"] == 1
    assert tables["auth_identities"]["source_count"] == 1
    assert plan["circler"]["chat_memory"]["source_count"] == 1
    assert len(plan["not_user_owned"]) == 6
    assert all("row_count" in entry for entry in plan["not_user_owned"])


def test_plan_never_exposes_pii_chat_text_subjects_or_credentials(db):
    canonical, source = _users(db)
    canonical.phone_number = "+251911000001"
    canonical.bio = "private bio"
    canonical.strava_access_token = "strava-secret-token"
    source.phone_number = "+251911000002"
    db.commit()
    _chat(db, source, "source-session", "private conversation content")
    _chat_profile(db, source, "Source Secret Name", {"notes": "private preference value"})
    _chat_profile(db, canonical, "Canonical Secret Name", {"notes": "other private value"})

    plan = build_reconciliation_plan(db, canonical.id, source.id)
    serialized = json.dumps(plan)

    for secret in (
        "Canonical Person",
        "Source Person",
        "Canonical Secret Name",
        "Source Secret Name",
        "source@example.com",
        "google-subject",
        "+251911000001",
        "+251911000002",
        "private bio",
        "private conversation content",
        "private preference value",
        "strava-secret-token",
    ):
        assert secret not in serialized
    assert "Source Secret Name" not in serialized


def test_detects_duplicate_and_conflicting_business_records(db):
    canonical, source = _users(db)
    challenge_id = uuid.uuid4()
    circle_id = uuid.uuid4()
    provider_id = uuid.uuid4()
    db.add(Circle(id=circle_id, name="C", owner_id=canonical.id))
    db.commit()
    db.add_all([
        CircleMember(circle_id=circle_id, user_id=canonical.id),
        CircleMember(circle_id=circle_id, user_id=source.id),
        ChallengeAwardModel(challenge_id=challenge_id, user_id=canonical.id, points_given=10),
        ChallengeAwardModel(challenge_id=challenge_id, user_id=source.id, points_given=10),
        Booking(
            user_id=canonical.id, provider_id=provider_id, service_name="A",
            slot_datetime=datetime.now(timezone.utc), amount_etb=100,
            payment_method="telebirr", payment_status="pending",
            idempotency_key="same-key",
        ),
        Booking(
            user_id=source.id, provider_id=provider_id, service_name="B",
            slot_datetime=datetime.now(timezone.utc), amount_etb=100,
            payment_method="telebirr", payment_status="pending",
            idempotency_key="same-key",
        ),
        PointTransaction(user_id=canonical.id, amount=200, type="pin_bot_bonus"),
        PointTransaction(user_id=source.id, amount=200, type="pin_bot_bonus"),
        TrainerVerification(user_id=canonical.id, certificate_url="c1"),
        TrainerVerification(user_id=source.id, certificate_url="c2"),
    ])
    db.commit()

    plan = build_reconciliation_plan(db, canonical.id, source.id)

    codes = _codes(plan)
    assert "CHALLENGE_AWARD_DUPLICATE" in codes
    assert "BOOKING_IDEMPOTENCY_COLLISION" in codes
    assert "PIN_BOT_BONUS_UNIQUE_CONFLICT" in codes
    assert "TRAINER_VERIFICATION_CONFLICT" in codes
    tables = {row["table"]: row for row in plan["tables"]}
    assert tables["circle_members"]["duplicates"] >= 1
    assert tables["challenge_awards"]["conflicts"] == 1


def test_blocks_provider_admin_credentials_and_active_wearables(db):
    canonical, source = _users(db)
    source.is_provider = True
    source.is_super_admin = True
    source.login_username = "staff"
    source.password_hash = "hash"
    db.add(UserWearable(
        user_id=source.id, terra_user_id="terra-1", reference_id=str(source.id),
        provider="fitbit", active=True,
    ))
    db.commit()

    plan = build_reconciliation_plan(db, canonical.id, source.id)
    codes = _codes(plan)

    assert "SOURCE_IS_PROVIDER" in codes
    assert "SOURCE_IS_SUPER_ADMIN" in codes
    assert "SOURCE_HAS_LOGIN_CREDENTIALS" in codes
    assert "ACTIVE_WEARABLE_EXTERNAL_IDENTITY" in codes


def test_blocks_multiple_telegram_phone_strava_and_referral_conflicts(db):
    canonical, source = _users(db)
    source.telegram_id = 222
    source.phone_number = "+251911000002"
    canonical.phone_number = "+251911000001"
    source.strava_athlete_id = 2
    canonical.strava_athlete_id = 1
    source.referred_by = uuid.uuid4()
    canonical.referred_by = uuid.uuid4()
    db.commit()

    plan = build_reconciliation_plan(db, canonical.id, source.id)
    codes = _codes(plan)

    assert "MULTIPLE_TELEGRAM_IDENTITIES" in codes
    assert "PHONE_NUMBER_CONFLICT" in codes
    assert "STRAVA_ACCOUNT_CONFLICT" in codes
    assert "REFERRAL_CONFLICT" in codes


def test_chat_profile_conflict_is_blocked_and_single_sided_profile_is_transferable(db):
    canonical, source = _users(db)
    _chat_profile(db, canonical, "Canonical Name", {"interests": ["yoga"], "notes": "left"})
    _chat_profile(db, source, "Source Name", {"interests": ["gym"], "notes": "left"})

    plan = build_reconciliation_plan(db, canonical.id, source.id)
    codes = _codes(plan)

    assert "CHAT_PROFILE_NAME_CONFLICT" in codes
    assert "CHAT_PROFILE_PREFERENCE_CONFLICT" in codes
    profile = plan["circler"]["chat_profile"]
    assert profile["display_name_conflict"] is True
    assert "interests" in profile["conflicting_preference_keys"]
    assert "notes" not in profile["conflicting_preference_keys"]
    assert "CHAT_PROFILE_MERGE" in _codes(plan, "manual_decisions")


def test_same_or_missing_accounts_are_rejected(db):
    canonical, _source = _users(db)

    with pytest.raises(ReconciliationError) as same:
        build_reconciliation_plan(db, canonical.id, canonical.id)
    assert same.value.code == "SAME_ACCOUNT"
    assert same.value.status_code == 400

    with pytest.raises(ReconciliationError) as missing:
        build_reconciliation_plan(db, canonical.id, uuid.uuid4())
    assert missing.value.code == "ACCOUNT_NOT_FOUND"
    assert missing.value.status_code == 404


def test_user_dry_run_derives_source_from_verified_proof_and_ignores_client_ids(db, monkeypatch):
    canonical, source = _users(db)
    source.telegram_id = None
    db.commit()
    db.add(AuthIdentity(user_id=source.id, provider="google", subject="src-google"))
    db.commit()
    before = _snapshot(db)

    def fake_verify(provider, payload):
        assert provider == "google"
        token = payload.get("google_id_token")
        if token == "good-token":
            return {"provider": "google", "subject": "src-google", "email": None}
        if token == "canonical-token":
            return {"provider": "google", "subject": "canonical-google", "email": None}
        if token == "unknown-token":
            return {"provider": "google", "subject": "unknown-subject", "email": None}
        raise AssertionError("unexpected proof")

    monkeypatch.setattr(
        "app.api.account_reconciliation.verify_provider_proof",
        fake_verify,
    )

    def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app) as client:
            headers = {"Authorization": f"Bearer {auth._create_token(str(canonical.id))}"}
            body = {
                "source_provider": "google",
                "google_id_token": "good-token",
                # Deliberately supplied client ids must never select the source.
                "source_user_id": str(uuid.uuid4()),
                "canonical_user_id": str(uuid.uuid4()),
            }
            response = client.post("/api/account-reconciliation/dry-run", json=body, headers=headers)
            assert response.status_code == 200, response.text
            assert response.json()["canonical_user_id"] == str(canonical.id)
            assert response.json()["source_user_id"] == str(source.id)

            missing_auth = client.post("/api/account-reconciliation/dry-run", json=body)
            assert missing_auth.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)

    assert _snapshot(db) == before


def test_user_dry_run_rejects_unverified_or_unlinked_source(db, monkeypatch):
    canonical, _source = _users(db)

    def fake_verify(provider, payload):
        token = payload.get("google_id_token")
        if token == "bad":
            from app.services.account_linking import LinkInvalid

            raise LinkInvalid("Google sign-in could not be verified.")
        if token == "canonical":
            return {"provider": "google", "subject": "canonical-google", "email": None}
        return {"provider": "google", "subject": "no-such-subject", "email": None}

    monkeypatch.setattr(
        "app.api.account_reconciliation.verify_provider_proof",
        fake_verify,
    )
    # Add a Google identity to the canonical user so the proof can resolve back
    # to the same account.
    db.add(AuthIdentity(user_id=canonical.id, provider="google", subject="canonical-google"))
    db.commit()

    def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app) as client:
            headers = {"Authorization": f"Bearer {auth._create_token(str(canonical.id))}"}
            bad = client.post(
                "/api/account-reconciliation/dry-run",
                json={"source_provider": "google", "google_id_token": "bad"},
                headers=headers,
            )
            assert bad.status_code == 400

            same = client.post(
                "/api/account-reconciliation/dry-run",
                json={"source_provider": "google", "google_id_token": "canonical"},
                headers=headers,
            )
            assert same.status_code == 400
            assert same.json()["detail"]["code"] == "SAME_ACCOUNT"

            unlinked = client.post(
                "/api/account-reconciliation/dry-run",
                json={"source_provider": "google", "google_id_token": "unlinked"},
                headers=headers,
            )
            assert unlinked.status_code == 404
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)


def test_circle_subscription_and_follower_collisions_are_detected(db):
    canonical, source = _users(db)
    circle_id = uuid.uuid4()
    other_user = User(telegram_id=333, name="Other")
    db.add_all([Circle(id=circle_id, name="Paid", owner_id=canonical.id), other_user])
    db.commit()
    period = datetime(2026, 1, 1, tzinfo=timezone.utc)
    db.add_all([
        CircleSubscription(
            circle_id=circle_id, user_id=canonical.id, period_start=period,
            period_end=period.replace(month=2), amount_etb=100, status="active",
        ),
        CircleSubscription(
            circle_id=circle_id, user_id=source.id, period_start=period,
            period_end=period.replace(month=2), amount_etb=100, status="active",
        ),
        Follower(follower_id=canonical.id, following_id=other_user.id),
        Follower(follower_id=source.id, following_id=other_user.id),
        Follower(follower_id=source.id, following_id=canonical.id),
        Follower(follower_id=canonical.id, following_id=source.id),
    ])
    db.commit()

    plan = build_reconciliation_plan(db, canonical.id, source.id)
    tables = {row["table"]: row for row in plan["tables"]}

    assert "CIRCLE_SUBSCRIPTION_DUPLICATE" in _codes(plan)
    assert tables["circle_subscriptions"]["conflicts"] == 1
    # canonical→other already exists, source→other collapses onto it; the two
    # direct edges become self-follows and are removed.
    assert tables["followers"]["duplicates"] >= 2
    assert "SELF_FOLLOW_CLEANUP" in _codes(plan, "manual_decisions")


def test_missing_circler_schema_is_a_blocker():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        canonical, source = _users(session)
        plan = build_reconciliation_plan(session, canonical.id, source.id)
        assert "CIRCLER_SCHEMA_UNAVAILABLE" in _codes(plan)
        assert plan["circler"]["chat_profile"]["available"] is False
    finally:
        session.close()
        engine.dispose()


def test_endpoint_requires_super_admin_and_never_writes_targets():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for statement in CHAT_DDL:
            conn.execute(text(statement))
    session = sessionmaker(bind=engine)()
    canonical, source = _users(session)
    admin = User(telegram_id=999, name="Admin", is_super_admin=True)
    regular = User(telegram_id=888, name="Regular")
    session.add_all([admin, regular])
    session.commit()
    session.refresh(admin)
    session.refresh(regular)
    before = _snapshot(session)

    def override_get_db():
        yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app) as client:
            body = {"canonical_user_id": str(canonical.id), "source_user_id": str(source.id)}
            missing = client.post("/api/admin/accounts/reconciliation/dry-run", json=body)
            assert missing.status_code == 403

            denied = client.post(
                "/api/admin/accounts/reconciliation/dry-run",
                json=body,
                headers={"Authorization": f"Bearer {auth._create_token(str(regular.id))}"},
            )
            assert denied.status_code == 403

            allowed = client.post(
                "/api/admin/accounts/reconciliation/dry-run",
                json=body,
                headers={"Authorization": f"Bearer {auth._create_token(str(admin.id))}"},
            )
            assert allowed.status_code == 200, allowed.text
            assert allowed.json()["read_only"] is True
            assert allowed.json()["safe_to_merge"] is False

            same = client.post(
                "/api/admin/accounts/reconciliation/dry-run",
                json={"canonical_user_id": str(canonical.id), "source_user_id": str(canonical.id)},
                headers={"Authorization": f"Bearer {auth._create_token(str(admin.id))}"},
            )
            assert same.status_code == 400
            assert same.json()["detail"]["code"] == "SAME_ACCOUNT"

            missing_source = client.post(
                "/api/admin/accounts/reconciliation/dry-run",
                json={"canonical_user_id": str(canonical.id), "source_user_id": str(uuid.uuid4())},
                headers={"Authorization": f"Bearer {auth._create_token(str(admin.id))}"},
            )
            assert missing_source.status_code == 404
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
        assert _snapshot(session) == before
        session.close()
        engine.dispose()
