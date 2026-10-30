"""Real RSA token validation plus Google identity/session exchange regressions."""
import json
import time
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from google.auth.exceptions import TransportError
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Existing test-suite UUID/JSON adapters must be installed before model imports.
from app.tests.test_auth_identity import SQLiteUUID, SQLiteJSONB
from app.database import Base
from app.models.user import User
from app.models.auth_identity import AuthIdentity
from app.api import auth
from app.schemas.user import FirebaseAuthRequest, UserResponse
from app.services import firebase_auth as service

PROJECT = 'wellcircle-test-project'
EMAIL = 'member@gmail.com'
GOOGLE_SUB = 'google-sub-123'

@pytest.fixture
def signing(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    requests = []
    def transport(url, **kwargs):
        requests.append((url, kwargs))
        return SimpleNamespace(status=200, data=json.dumps({'test-key': public}).encode())
    monkeypatch.setattr(service, 'Request', lambda: transport)
    monkeypatch.setattr(service.settings, 'FIREBASE_PROJECT_ID', PROJECT)
    def token(**overrides):
        now = int(time.time())
        claims = dict(aud=PROJECT, iss=f'https://securetoken.google.com/{PROJECT}', sub='firebase-user-1', iat=now-5, exp=now+600, auth_time=now-5, email=EMAIL, email_verified=True, name='Google member', firebase={'sign_in_provider': 'google.com', 'identities': {'google.com': [GOOGLE_SUB]}})
        claims.update(overrides)
        return jwt.encode(claims, private, algorithm='RS256', headers={'kid': 'test-key'})
    return token, requests

def test_verifies_real_signature_and_uses_project_audience(signing):
    token, calls = signing
    assert service.verify_google_token(token()) == {'uid': 'firebase-user-1', 'google_sub': GOOGLE_SUB, 'email': EMAIL, 'name': 'Google member', 'picture': None}
    assert calls[0][0] == 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    assert calls[0][1]['timeout'] == 10

@pytest.mark.parametrize('overrides', [
    {'aud':'other-project'}, {'iss':'https://attacker.example'}, {'exp':1},
    {'iat':int(time.time())+600}, {'auth_time':int(time.time())+600},
    {'sub':''}, {'sub':'a'*129}, {'email':None}, {'email_verified':False},
    {'firebase':{'sign_in_provider':'password'}},
    {'firebase':{'sign_in_provider':'google.com','identities':{'google.com':[GOOGLE_SUB]},'tenant':'other-tenant'}}, {'auth_time':True},
    {'firebase':{'sign_in_provider':'phone'}},
    {'firebase':{'sign_in_provider':'google.com'}},
])
def test_rejects_wrong_project_expired_or_non_google_tokens(signing, overrides):
    token, _ = signing
    with pytest.raises(ValueError): service.verify_google_token(token(**overrides))

def test_rejects_forged_and_unsigned_tokens(signing):
    token, _ = signing
    good = token()
    header, payload, signature = good.split('.')
    with pytest.raises(ValueError): service.verify_google_token(header+'.'+payload+'.'+('A'*len(signature)))
    with pytest.raises(ValueError): service.verify_google_token('not-a-signed-token')

def test_missing_project_fails_closed_without_network(monkeypatch):
    monkeypatch.setattr(service.settings, 'FIREBASE_PROJECT_ID', '')
    with pytest.raises(service.FirebaseUnavailable): service.verify_google_token('anything')

def test_certificate_outage_is_a_service_error(signing, monkeypatch):
    token, _ = signing
    def unavailable(*args, **kwargs): raise TransportError('private network detail')
    monkeypatch.setattr(service, 'Request', lambda: unavailable)
    with pytest.raises(service.FirebaseUnavailable): service.verify_google_token(token())

@pytest.fixture
def db(monkeypatch):
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    monkeypatch.setattr(auth, '_build_response', lambda user, db: UserResponse(id=str(user.id), created_at=datetime.now(timezone.utc), phone_number=user.phone_number))
    with sessionmaker(bind=engine)() as session: yield session
    engine.dispose()

def test_first_and_repeat_login_issue_existing_app_session(db, signing):
    token, _ = signing
    first = auth.firebase_auth(FirebaseAuthRequest(id_token=token()), db)
    second = auth.firebase_auth(FirebaseAuthRequest(id_token=token()), db)
    assert first.is_new_user and not second.is_new_user
    assert first.user.id == second.user.id
    assert db.query(AuthIdentity).one().email == EMAIL
    assert jwt.decode(second.token, auth.settings.JWT_SECRET, algorithms=[auth.settings.JWT_ALGORITHM])['sub'] == first.user.id
    assert db.query(User).count() == 1 and db.query(AuthIdentity).count() == 1

def test_existing_google_account_is_preserved(db, signing):
    user = User(name='Existing member', points_balance=123)
    db.add(user); db.flush()
    db.add(AuthIdentity(user_id=user.id, provider='google', subject=GOOGLE_SUB, email=EMAIL)); db.commit()
    token, _ = signing
    result = auth.firebase_auth(FirebaseAuthRequest(id_token=token()), db)
    assert result.user.id == str(user.id) and not result.is_new_user
    assert db.query(User).count() == 1 and user.points_balance == 123

def test_same_email_does_not_take_over_another_identity(db, signing):
    user = User(name='Different Google identity')
    db.add(user); db.flush()
    db.add(AuthIdentity(user_id=user.id, provider='google', subject='different-google-sub', email=EMAIL)); db.commit()
    token, _ = signing
    result = auth.firebase_auth(FirebaseAuthRequest(id_token=token()), db)
    assert result.user.id != str(user.id) and result.is_new_user

def test_invalid_token_creates_no_user(db, signing):
    with pytest.raises(HTTPException) as error:
        auth.firebase_auth(FirebaseAuthRequest(id_token='invalid'), db)
    assert error.value.status_code == 401 and db.query(User).count() == 0

def test_unconfigured_route_returns_actionable_error(db, monkeypatch):
    monkeypatch.setattr(service.settings, 'FIREBASE_PROJECT_ID', '')
    with pytest.raises(HTTPException) as error:
        auth.firebase_auth(FirebaseAuthRequest(id_token='anything'), db)
    assert error.value.status_code == 503
