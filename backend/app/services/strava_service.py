"""Strava OAuth/API client with authenticated token encryption."""
import base64
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.crud.strava import clear_user_cache

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"


class StravaError(RuntimeError):
    pass


def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.JWT_SECRET.encode()).digest())
    return Fernet(key)


def encrypt_token(token):
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(token):
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise StravaError("Stored Strava credentials could not be decrypted") from exc


def get_authorization_url(state):
    return f"{STRAVA_AUTH_URL}?{urlencode({
        'client_id': settings.STRAVA_CLIENT_ID,
        'redirect_uri': settings.STRAVA_REDIRECT_URI,
        'response_type': 'code',
        'approval_prompt': 'auto',
        'scope': 'read,activity:read_all',
        'state': state,
    })}"


def _post_token(data):
    try:
        response = httpx.post(STRAVA_TOKEN_URL, data=data, timeout=15)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise StravaError("Strava rate limit reached; try again later") from exc
        raise StravaError("Strava authorization failed") from exc
    except httpx.HTTPError as exc:
        raise StravaError("Strava is temporarily unavailable") from exc


def exchange_code(code):
    return _post_token({
        "client_id": settings.STRAVA_CLIENT_ID,
        "client_secret": settings.STRAVA_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    })


def refresh_token_if_needed(db, user):
    now = datetime.now(timezone.utc)
    expires = user.strava_token_expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires > now:
        return decrypt_token(user.strava_access_token)
    payload = _post_token({
        "client_id": settings.STRAVA_CLIENT_ID,
        "client_secret": settings.STRAVA_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": decrypt_token(user.strava_refresh_token),
    })
    user.strava_access_token = encrypt_token(payload["access_token"])
    user.strava_refresh_token = encrypt_token(payload.get("refresh_token") or decrypt_token(user.strava_refresh_token))
    user.strava_token_expires_at = datetime.fromtimestamp(payload["expires_at"], tz=timezone.utc)
    db.commit()
    return payload["access_token"]


def _get(path, access_token):
    try:
        response = httpx.get(
            f"{STRAVA_API_BASE}{path}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise StravaError("Strava rate limit reached; cached data remains available") from exc
        raise StravaError("Could not fetch Strava data") from exc
    except httpx.HTTPError as exc:
        raise StravaError("Strava is temporarily unavailable") from exc


def get_athlete_stats(access_token, athlete_id):
    return _get(f"/athletes/{athlete_id}/stats", access_token)


def get_recent_activities(access_token, per_page=10):
    return _get(f"/athlete/activities?per_page={per_page}&page=1", access_token)


def disconnect(db, user):
    user.strava_athlete_id = None
    user.strava_access_token = None
    user.strava_refresh_token = None
    user.strava_token_expires_at = None
    user.strava_visible_stats = None
    user.health_app_connected = False
    clear_user_cache(db, user.id)
    db.commit()
