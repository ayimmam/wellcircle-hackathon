"""Verified account linking — challenge lifecycle and provider proof checks.

Two separate facts are required before an identity is attached:

1. the caller controls the canonical account — enforced by the existing JWT
   dependency at the API layer and re-checked against ``challenge.user_id``;
2. the caller has freshly verified the provider identity — enforced here by the
   *existing* Google (Firebase) and Telegram verifiers. No second verifier is
   introduced and no client-supplied subject/email/user id is trusted.

Challenges are durable rows (``account_link_challenges``), single-use, bound to
(user, provider, verified subject), and expire after ``CHALLENGE_TTL_SECONDS``.
"""

import hashlib
import hmac
import secrets
import time
from urllib.parse import parse_qs

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.auth_identity import get_identity, get_user_identities
from app.models.account_link_challenge import AccountLinkChallenge
from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.services.firebase_auth import FirebaseUnavailable, verify_google_token
from app.services.telegram_auth import validate_init_data, validate_init_data_dev
from app.services.telegram_login_widget import validate_login_widget_data
from app.utils.logger import get_logger

logger = get_logger(__name__)

PROVIDERS = ("google", "telegram")
CHALLENGE_TTL_SECONDS = 300
MAX_VERIFY_ATTEMPTS = 5
MAX_CONFIRM_ATTEMPTS = 10
HOUSEKEEPING_SECONDS = 24 * 60 * 60
CREATE_WINDOW_SECONDS = 60
MAX_CREATES_PER_WINDOW = 5
# Linking must be based on a *fresh* provider proof, not a day-old login blob.
PROOF_MAX_AGE_SECONDS = 300


class LinkingError(Exception):
    """Base class; ``status_code``/``detail`` are safe to return to the client."""

    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class LinkInvalid(LinkingError):
    status_code = 400


class LinkNotFound(LinkingError):
    status_code = 404


class LinkConflict(LinkingError):
    status_code = 409


class LinkRateLimited(LinkingError):
    status_code = 429

    def __init__(self, detail: str = "Too many linking requests. Please wait a moment and try again."):
        super().__init__(detail)


class LinkProviderUnavailable(LinkingError):
    status_code = 503


def _lock_user(db: Session, user_id) -> None:
    """Serialize challenge creation per user (transaction-scoped, pooler-safe)."""
    if db.get_bind().dialect.name != "postgresql":
        return
    digest = hmac.new(
        settings.JWT_SECRET.encode(), f"link:{user_id}".encode(), hashlib.sha256
    ).hexdigest()
    lock_id = int.from_bytes(bytes.fromhex(digest)[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})


def _init_data_age_ok(init_data: str) -> bool:
    """Telegram Mini App initData must carry a recent ``auth_date``."""
    try:
        raw = parse_qs(init_data).get("auth_date", [None])[0]
        age = time.time() - int(raw)
    except (TypeError, ValueError):
        return False
    return -60 <= age <= PROOF_MAX_AGE_SECONDS


def _telegram_from_init_data(init_data: str) -> dict:
    if not isinstance(init_data, str) or not init_data:
        raise LinkInvalid("Telegram sign-in could not be verified.")
    if settings.ENVIRONMENT == "development":
        # Mirrors the login path's documented development fallback; the real
        # HMAC verifier is still what every non-development environment uses.
        data = validate_init_data_dev(init_data)
    else:
        data = validate_init_data(init_data)
        if data is not None and not _init_data_age_ok(init_data):
            raise LinkInvalid(
                "Telegram sign-in has expired. Please sign in with Telegram again."
            )
    if not data or not data.get("telegram_id"):
        raise LinkInvalid("Telegram sign-in could not be verified.")
    return {
        "provider": "telegram",
        "subject": str(int(data["telegram_id"])),
        "email": None,
        "username": data.get("username"),
    }


def _telegram_from_widget(login) -> dict:
    if not isinstance(login, dict):
        raise LinkInvalid("Telegram sign-in could not be verified.")
    data = validate_login_widget_data(login)
    if not data:
        raise LinkInvalid("Telegram sign-in could not be verified.")
    try:
        age = time.time() - int(login.get("auth_date"))
    except (TypeError, ValueError):
        raise LinkInvalid("Telegram sign-in could not be verified.")
    if not -60 <= age <= PROOF_MAX_AGE_SECONDS:
        raise LinkInvalid("Telegram sign-in has expired. Please sign in with Telegram again.")
    return {
        "provider": "telegram",
        "subject": str(int(data["telegram_id"])),
        "email": None,
        "username": data.get("username"),
    }


def _google_from_token(token: str) -> dict:
    if not isinstance(token, str) or not token:
        raise LinkInvalid("Google sign-in could not be verified.")
    try:
        claims = verify_google_token(token)
    except FirebaseUnavailable as error:
        raise LinkProviderUnavailable("Google sign-in is unavailable right now. Please try again later.") from error
    except ValueError as error:
        raise LinkInvalid("Google sign-in could not be verified.") from error
    subject = claims.get("google_sub")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise LinkInvalid("Google sign-in could not be verified.")
    return {
        "provider": "google",
        "subject": subject,
        "email": claims.get("email"),
        "username": None,
    }


def verify_provider_proof(provider: str, payload: dict) -> dict:
    """Verify the target identity with the provider's existing verifier.

    The proof type must match the challenge provider; a Telegram proof cannot
    satisfy a Google challenge and vice versa.
    """
    if provider == "google":
        if payload.get("telegram_init_data") or payload.get("telegram_login"):
            raise LinkInvalid("The provided credential does not match this linking request.")
        return _google_from_token(payload.get("google_id_token"))

    if provider == "telegram":
        if payload.get("google_id_token"):
            raise LinkInvalid("The provided credential does not match this linking request.")
        init_data = payload.get("telegram_init_data")
        login = payload.get("telegram_login")
        if init_data and login:
            raise LinkInvalid("Provide one Telegram credential, not two.")
        if init_data:
            return _telegram_from_init_data(init_data)
        if login:
            return _telegram_from_widget(login)
        raise LinkInvalid("Telegram sign-in could not be verified.")

    raise LinkInvalid("Choose Google or Telegram to link.")


def start_challenge(db: Session, user_id, provider: str) -> dict:
    """Create a short-lived, single-use challenge bound to the JWT user."""
    if provider not in PROVIDERS:
        raise LinkInvalid("Choose Google or Telegram to link.")
    now = int(time.time())
    _lock_user(db, user_id)
    db.query(AccountLinkChallenge).filter(
        AccountLinkChallenge.expires_at < now - HOUSEKEEPING_SECONDS
    ).delete(synchronize_session=False)
    recent = db.query(AccountLinkChallenge).filter(
        AccountLinkChallenge.user_id == user_id,
        AccountLinkChallenge.created_at > now - CREATE_WINDOW_SECONDS,
    ).count()
    if recent >= MAX_CREATES_PER_WINDOW:
        db.rollback()
        raise LinkRateLimited()

    record = AccountLinkChallenge(
        id=secrets.token_urlsafe(32),
        user_id=user_id,
        provider=provider,
        status="pending",
        attempts=0,
        created_at=now,
        expires_at=now + CHALLENGE_TTL_SECONDS,
    )
    db.add(record)
    db.commit()
    return {
        "challenge_id": record.id,
        "provider": provider,
        "expires_in": CHALLENGE_TTL_SECONDS,
        "expires_at": record.expires_at,
    }


def _locked_challenge(db: Session, challenge_id: str, user_id) -> AccountLinkChallenge:
    record = (
        db.query(AccountLinkChallenge)
        .filter(AccountLinkChallenge.id == challenge_id)
        .with_for_update()
        .first()
    )
    # Same response for "missing" and "someone else's" — no account enumeration.
    if record is None or record.user_id != user_id:
        raise LinkNotFound("This linking request was not found. Start a new one.")
    return record


def verify_challenge(db: Session, user_id, challenge_id: str, payload: dict) -> dict:
    """Verify the provider credential and bind it to the challenge (not linked yet)."""
    record = (
        db.query(AccountLinkChallenge)
        .filter(AccountLinkChallenge.id == challenge_id, AccountLinkChallenge.user_id == user_id)
        .first()
    )
    if record is None:
        raise LinkNotFound("This linking request was not found. Start a new one.")
    # The proof type is decided by the stored challenge, never by the payload.
    proof = verify_provider_proof(record.provider, payload)

    now = int(time.time())
    record = _locked_challenge(db, challenge_id, user_id)
    if record.status in ("consumed", "failed"):
        raise LinkInvalid("This linking request can no longer be used. Start a new one.")
    if record.expires_at <= now:
        record.status = "expired"
        db.commit()
        raise LinkInvalid("This linking request has expired. Start a new one.")
    if record.attempts >= MAX_VERIFY_ATTEMPTS:
        record.status = "failed"
        db.commit()
        raise LinkInvalid("This linking request can no longer be used. Start a new one.")

    if record.status == "verified":
        if record.target_subject != proof["subject"]:
            record.attempts += 1
            if record.attempts >= MAX_VERIFY_ATTEMPTS:
                record.status = "failed"
            db.commit()
            raise LinkInvalid(
                "This linking request is already bound to a different identity. Start a new one."
            )
        db.commit()  # idempotent re-verification of the same identity
    else:
        record.attempts += 1
        record.target_subject = proof["subject"]
        record.target_email = proof["email"]
        record.status = "verified"
        record.verified_at = now
        db.commit()

    return {
        "challenge_id": record.id,
        "provider": record.provider,
        "subject": record.target_subject,
        "email": record.target_email,
        "expires_in": max(0, record.expires_at - now),
        "requires_confirmation": True,
    }


def confirm_challenge(db: Session, user_id, challenge_id: str) -> dict:
    """Atomically consume the challenge and attach the verified identity.

    The identity insert and the challenge consumption commit together, so a
    failure leaves neither a half-linked identity nor a reusable challenge.
    """
    now = int(time.time())
    record = _locked_challenge(db, challenge_id, user_id)

    if record.status == "consumed":
        raise LinkInvalid("This linking request has already been used. Start a new one.")
    if record.status != "verified" or not record.target_subject:
        # Bounded confirmation attempts per challenge (abuse resistance); the
        # caller cannot loop on this endpoint indefinitely.
        record.attempts += 1
        if record.attempts >= MAX_CONFIRM_ATTEMPTS:
            record.status = "failed"
        db.commit()
        raise LinkInvalid("Verify a sign-in method before confirming the link.")
    if record.expires_at <= now:
        record.status = "expired"
        db.commit()
        raise LinkInvalid("This linking request has expired. Start a new one.")

    provider = record.provider
    subject = record.target_subject

    existing = get_identity(db, provider, subject)
    if existing is not None:
        if existing.user_id == user_id:
            record.status = "consumed"
            record.consumed_at = now
            db.commit()
            logger.info("Linking confirmed as a no-op (identity already attached)")
            return _confirmation(db, user_id, provider, subject, linked=False, already_linked=True)
        # Never reassign an identity that belongs to another account.
        record.status = "failed"
        db.commit()
        raise LinkConflict(
            "This sign-in method is already connected to another Well Circle account. "
            "Contact support if you believe this is a mistake."
        )

    if provider == "telegram":
        # One Telegram sign-in per canonical account: users.telegram_id is a
        # single UNIQUE column that the bot/Mini App use, so a second Telegram
        # identity would resolve through different paths (and could let the
        # bot create a duplicate account). Reject rather than split the login.
        other_identity = (
            db.query(AuthIdentity)
            .filter(
                AuthIdentity.user_id == user_id,
                AuthIdentity.provider == "telegram",
                AuthIdentity.subject != subject,
            )
            .first()
        )
        if other_identity is not None:
            record.status = "failed"
            db.commit()
            raise LinkConflict(
                "This account already has a different Telegram sign-in connected. "
                "Contact support if you need to change it."
            )
        # The users.telegram_id column is the bot/legacy lookup key and is
        # UNIQUE. If another user still holds it, attaching the identity here
        # would split login resolution between two accounts — reject instead.
        try:
            telegram_id = int(subject)
        except (TypeError, ValueError):
            record.status = "failed"
            db.commit()
            raise LinkInvalid("Telegram sign-in could not be verified.")
        other_owner = (
            db.query(User)
            .filter(User.telegram_id == telegram_id, User.id != user_id)
            .first()
        )
        if other_owner is not None:
            record.status = "failed"
            db.commit()
            raise LinkConflict(
                "This Telegram account is already connected to another Well Circle account. "
                "Contact support if you believe this is a mistake."
            )

        user = db.query(User).filter(User.id == user_id).with_for_update().first()
        if user is None:  # deleted between JWT validation and confirmation
            record.status = "failed"
            db.commit()
            raise LinkNotFound("This account is no longer available.")
        if user.telegram_id is None:
            user.telegram_id = telegram_id

    db.add(
        AuthIdentity(
            user_id=user_id,
            provider=provider,
            subject=subject,
            email=record.target_email,
        )
    )
    record.status = "consumed"
    record.consumed_at = now
    try:
        db.commit()
    except IntegrityError:
        # A concurrent confirmation/registration inserted the same identity.
        db.rollback()
        existing = get_identity(db, provider, subject)
        if existing is not None and existing.user_id == user_id:
            record = _locked_challenge(db, challenge_id, user_id)
            record.status = "consumed"
            record.consumed_at = now
            db.commit()
            return _confirmation(db, user_id, provider, subject, linked=False, already_linked=True)
        record = _locked_challenge(db, challenge_id, user_id)
        record.status = "failed"
        db.commit()
        raise LinkConflict(
            "This sign-in method is already connected to another Well Circle account. "
            "Contact support if you believe this is a mistake."
        )

    logger.info("Linked a verified %s identity to the signed-in account", provider)
    return _confirmation(db, user_id, provider, subject, linked=True, already_linked=False)


def _confirmation(db: Session, user_id, provider: str, subject: str, *,
                  linked: bool, already_linked: bool) -> dict:
    return {
        "linked": linked,
        "already_linked": already_linked,
        "provider": provider,
        "subject": subject,
        "user_id": str(user_id),
        "identities": get_user_identities(db, user_id),
    }
