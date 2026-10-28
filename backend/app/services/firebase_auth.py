"""Validate Firebase Google ID tokens using Google's public signing certificates.

The project ID pins the token audience and issuer. Never trust an email address
or UID supplied separately by the browser, or enable the Auth emulator here.
"""
import time

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.config import settings


class FirebaseUnavailable(Exception):
    pass


def verify_google_token(token: str) -> dict:
    project = settings.FIREBASE_PROJECT_ID.strip()
    if not project:
        raise FirebaseUnavailable("Google sign-in is not configured.")
    transport = Request()

    def bounded_request(*args, **kwargs):
        kwargs["timeout"] = 10
        return transport(*args, **kwargs)

    try:
        # Validates RS256 signature, expiration, issued-at and project audience.
        claims = id_token.verify_firebase_token(token, bounded_request, audience=project)
    except TransportError as error:
        raise FirebaseUnavailable("Could not reach the token verification service.") from error
    except (ValueError, GoogleAuthError) as error:
        raise ValueError("Invalid Firebase credential.") from error

    uid = claims.get("sub")
    email = claims.get("email")
    provider = claims.get("firebase", {})
    auth_time = claims.get("auth_time")
    identities = provider.get("identities", {}) if isinstance(provider, dict) else {}
    google_ids = identities.get("google.com", []) if isinstance(identities, dict) else []
    if (claims.get("iss") != f"https://securetoken.google.com/{project}"
            or not isinstance(uid, str) or not 1 <= len(uid) <= 128
            or not isinstance(email, str) or not 1 <= len(email) <= 255 or "@" not in email
            or claims.get("email_verified") is not True
            or not isinstance(provider, dict) or provider.get("sign_in_provider") != "google.com"
            or not isinstance(google_ids, list) or len(google_ids) != 1
            or not isinstance(google_ids[0], str) or not 1 <= len(google_ids[0]) <= 255
            or provider.get("tenant") is not None
            or not isinstance(auth_time, (int, float)) or isinstance(auth_time, bool)
            or not 0 < auth_time <= time.time()):
        raise ValueError("A verified Google sign-in is required.")
    return {"uid": uid, "google_sub": google_ids[0], "email": email, "name": claims.get("name"), "picture": claims.get("picture")}
