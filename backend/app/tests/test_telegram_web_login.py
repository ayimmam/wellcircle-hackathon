"""Public Telegram configuration and signed widget-data regressions."""
import hashlib
import hmac
import time
import pytest
from fastapi import HTTPException
from app.api.auth import telegram_login_config
from app.config import settings
from app.services.telegram_login_widget import validate_login_widget_data

TOKEN = '8839515595:private-test-token'

@pytest.fixture(autouse=True)
def bot(monkeypatch): monkeypatch.setattr(settings, 'TELEGRAM_BOT_TOKEN', TOKEN)

def signed(**overrides):
    data = dict(id=123456789, first_name='Member', auth_date=int(time.time()))
    data.update(overrides)
    text = '\n'.join(f'{k}={v}' for k,v in sorted(data.items()))
    data['hash'] = hmac.new(hashlib.sha256(TOKEN.encode()).digest(), text.encode(), hashlib.sha256).hexdigest()
    return data

def test_public_configuration_tracks_the_verifying_bot_without_exposing_its_token():
    result = telegram_login_config()
    assert result == {'bot_id': 8839515595}
    assert 'private-test-token' not in str(result)

def test_bad_server_configuration_fails_closed(monkeypatch):
    monkeypatch.setattr(settings, 'TELEGRAM_BOT_TOKEN', 'missing-token')
    with pytest.raises(HTTPException) as error: telegram_login_config()
    assert error.value.status_code == 503

def test_valid_telegram_authorization_is_accepted():
    assert validate_login_widget_data(signed())['telegram_id'] == 123456789

@pytest.mark.parametrize('overrides', [{'id':0}, {'auth_date':int(time.time())-86401}, {'auth_date':int(time.time())+120}])
def test_invalid_or_out_of_window_authorizations_are_rejected(overrides):
    assert validate_login_widget_data(signed(**overrides)) is None

def test_unauthenticated_profile_changes_are_rejected():
    data = signed(); data['first_name']='Forged member'
    assert validate_login_widget_data(data) is None
