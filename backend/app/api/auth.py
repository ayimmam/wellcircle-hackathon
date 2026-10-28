"""Authentication routes — Telegram Mini App initData exchange for JWT,
plus WhatsApp OTP and Google Sign-In for the web app (app.wellcircle.et).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from jose import jwt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.auth_identity import AuthIdentity
from app.crud.user import (
    get_user_by_telegram_id,
    create_user_from_telegram_auth,
    get_user_joined_community_ids,
)
from app.crud.auth_identity import (
    get_identity,
    get_user_by_identity,
    create_identity,
    find_user_by_phone,
)
from app.services.points import get_points_tier
from app.schemas.user import (
    TelegramAuthRequest, TelegramWidgetLoginRequest, ProviderPasswordLoginRequest,
    WhatsAppStartRequest, WhatsAppVerifyRequest, GoogleAuthRequest, FirebaseAuthRequest,
    WhatsAppStartResponse, AuthResponse, UserResponse,
)
from app.services.telegram_auth import validate_init_data, validate_init_data_dev
from app.services.telegram_login_widget import validate_login_widget_data
from app.services.otp import start_otp, verify_otp, OTPDeliveryUnavailable
from app.services.firebase_auth import verify_google_token, FirebaseUnavailable
from app.utils.password import verify_password

router = APIRouter()


def _create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


from app.api.users import _build_response



@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(request: TelegramAuthRequest, db: Session = Depends(get_db)):
    """
    Validate Telegram initData and return JWT + user profile.
    Creates user if first login (or if bot registered them, returns existing).
    """
    # Validate initData
    if settings.ENVIRONMENT == "development":
        user_data = validate_init_data_dev(request.init_data)
    else:
        user_data = validate_init_data(request.init_data)

    if not user_data or not user_data.get("telegram_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram initData",
        )

    telegram_id = user_data["telegram_id"]
    is_new = False

    # Find or create user
    user = get_user_by_telegram_id(db, telegram_id)
    if not user:
        user = create_user_from_telegram_auth(
            db,
            telegram_id=telegram_id,
            username=user_data.get("username"),
            photo_url=user_data.get("photo_url"),
        )
        is_new = True
        # Also write an auth_identities row so the new identity table stays in sync
        create_identity(db, user.id, "telegram", str(telegram_id))
    else:
        # Update photo/handle if changed — never once the user has set a
        # custom photo (WS9 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md),
        # or it would revert to the Telegram photo on the next login.
        if not user.photo_is_custom and user_data.get("photo_url") and user_data["photo_url"] != user.photo_url:
            user.photo_url = user_data["photo_url"]
        if user_data.get("username") and user_data["username"] != user.telegram_handle:
            user.telegram_handle = user_data["username"]
        user.last_activity_at = datetime.now(timezone.utc)
        db.commit()

    # Check if should be super admin
    if telegram_id in settings.super_admin_ids and not user.is_super_admin:
        user.is_super_admin = True
        db.commit()

    token = _create_token(str(user.id))
    joined = get_user_joined_community_ids(db, user.id)

    return AuthResponse(
        token=token,
        user=_build_response(user, db),
        is_new_user=is_new,
    )


@router.get("/telegram/config")
def telegram_login_config():
    # The token's numeric prefix is a public bot ID, never the bot credential.
    # Derive it here so website login uses the same bot as signature validation.
    bot_id, separator, secret = settings.TELEGRAM_BOT_TOKEN.partition(":")
    if not separator or not secret or not bot_id.isdigit() or int(bot_id) <= 0:
        raise HTTPException(status_code=503, detail="Telegram sign-in is unavailable. Please use Google or contact support.")
    return {"bot_id": int(bot_id)}


@router.post("/telegram-widget", response_model=AuthResponse)
async def telegram_widget_auth(request: TelegramWidgetLoginRequest, db: Session = Depends(get_db)):
    """
    Telegram Login Widget auth — used by both the provider portal AND the web app.
    On the web app (app.wellcircle.et) it creates a user on first login.
    On the provider portal it still requires an existing provider account.
    """
    payload = {
        "id": request.id,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "username": request.username,
        "photo_url": request.photo_url,
        "auth_date": request.auth_date,
        "hash": request.hash,
    }
    user_data = validate_login_widget_data(payload)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Telegram login",
        )

    telegram_id = user_data["telegram_id"]
    user = get_user_by_telegram_id(db, telegram_id)
    is_new = False

    if not user:
        # Web app mode: create user on first login (the plan says the consumer
        # web app needs a variant that creates on first login).
        first_name = request.first_name or ""
        last_name = request.last_name or ""
        display_name = f"{first_name} {last_name}".strip() or None

        user = create_user_from_telegram_auth(
            db,
            telegram_id=telegram_id,
            username=request.username,
            photo_url=request.photo_url,
        )
        if display_name:
            user.name = display_name
            db.commit()
            db.refresh(user)
        is_new = True
        create_identity(db, user.id, "telegram", str(telegram_id))

    token = _create_token(str(user.id))

    return AuthResponse(
        token=token,
        user=_build_response(user, db),
        is_new_user=is_new,
    )


@router.post("/provider-login", response_model=AuthResponse)
async def provider_password_login(request: ProviderPasswordLoginRequest, db: Session = Depends(get_db)):
    """
    Provider website login via username/password — an alt path to the
    Telegram Login Widget for provider staff accounts with no linked
    Telegram login (e.g. a front-desk account).
    """
    user = db.query(User).filter(User.login_username == request.username).first()
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_provider:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No provider account found for this login",
        )

    token = _create_token(str(user.id))

    return AuthResponse(
        token=token,
        user=_build_response(user, db),
        is_new_user=False,
    )


# ── WhatsApp OTP ──────────────────────────────────────────────

@router.post("/whatsapp/start", response_model=WhatsAppStartResponse)
def whatsapp_start(req: WhatsAppStartRequest, request: Request, db: Session = Depends(get_db)):
    """
    Start WhatsApp OTP flow: normalize phone to E.164, rate-limit, send code.
    POST /api/auth/whatsapp/start  { phone: "+2519xxxxxxxx" }
    """
    try:
        result = start_otp(req.phone, channel=req.channel, db=db, ip=request.client.host if request.client else "unknown")
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except OTPDeliveryUnavailable as error:
        raise HTTPException(status_code=503, detail="WhatsApp sign-in is unavailable right now. Please use Telegram or contact support.") from error
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait a moment and try again.",
            headers={"Retry-After": "60"},
        )
    return WhatsAppStartResponse(
        request_id=result["request_id"],
        expires_in=result["expires_in"],
        retry_after=result["retry_after"],
    )


@router.post("/whatsapp/verify", response_model=AuthResponse)
def whatsapp_verify(req: WhatsAppVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify WhatsApp OTP and return JWT.
    POST /api/auth/whatsapp/verify  { request_id, code }
      → 200 { token, user, is_new_user }
    """
    try:
        phone = verify_otp(req.request_id, req.code, db=db)
    except OTPDeliveryUnavailable as error:
        raise HTTPException(status_code=503, detail="Verification is temporarily unavailable. Please try again.") from error
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        )

    is_new = False
    try:
        user = get_user_by_identity(db, "whatsapp", phone)
        if not user:
            user = find_user_by_phone(db, phone)
            if not user:
                user = User(phone_number=phone, last_activity_at=datetime.now(timezone.utc))
                db.add(user)
                db.flush()
                is_new = True
            db.add(AuthIdentity(user_id=user.id, provider="whatsapp", subject=phone))
        if not user.phone_number:
            user.phone_number = phone
        user.last_activity_at = datetime.now(timezone.utc)
        # User creation and its identity must commit together. Two valid OTPs
        # for the same phone cannot leave duplicate/orphan accounts behind.
        db.commit()
    except IntegrityError:
        db.rollback()
        user = get_user_by_identity(db, "whatsapp", phone)
        if not user:
            raise HTTPException(status_code=409, detail="Please request a new code and try signing in again.")
        is_new = False
    db.refresh(user)

    token = _create_token(str(user.id))

    return AuthResponse(
        token=token,
        user=_build_response(user, db),
        is_new_user=is_new,
    )


# ── Firebase Google sign-in ──────────────────────────────────────

@router.post("/firebase", response_model=AuthResponse)
def firebase_auth(req: FirebaseAuthRequest, db: Session = Depends(get_db)):
    try:
        verified = verify_google_token(req.id_token)
    except FirebaseUnavailable as error:
        raise HTTPException(status_code=503, detail="Google sign-in is temporarily unavailable. Please use Telegram or contact support.") from error
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.") from error

    google_sub = verified["google_sub"]
    is_new = False
    try:
        # Google subject is stable across Firebase and direct Google sign-in.
        # Never merge accounts by matching an editable profile/email address.
        user = get_user_by_identity(db, "google", google_sub)
        if not user:
            user = User(name=verified.get("name"), photo_url=verified.get("picture"), last_activity_at=datetime.now(timezone.utc))
            db.add(user)
            db.flush()
            db.add(AuthIdentity(user_id=user.id, provider="google", subject=google_sub, email=verified["email"]))
            is_new = True
        user.last_activity_at = datetime.now(timezone.utc)
        db.commit()
    except IntegrityError:
        db.rollback()
        user = get_user_by_identity(db, "google", google_sub)
        if not user:
            raise HTTPException(status_code=409, detail="Please try signing in again.")
        is_new = False
    db.refresh(user)
    return AuthResponse(token=_create_token(str(user.id)), user=_build_response(user, db), is_new_user=is_new)


# ── Google Sign-In ────────────────────────────────────────────

@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google Identity Services — verify the ID token server-side.
    POST /api/auth/google  { credential: "<id_token>" }
      → 200 { token, user, is_new_user }

    Identity subject is Google's `sub`, never the email — emails change hands.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")
    # Verify the Google ID token
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        idinfo = google_id_token.verify_oauth2_token(
            req.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )

    google_sub = idinfo.get("sub")
    email = idinfo.get("email")
    email_verified = idinfo.get("email_verified", False)

    if not google_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token missing 'sub' claim",
        )

    is_new = False

    # 1. Check existing google identity
    user = get_user_by_identity(db, "google", google_sub)

    # 2. Brand new user (Google alone cannot auto-link per the plan)
    if not user:
        name = idinfo.get("name")
        picture = idinfo.get("picture")
        user = User(
            name=name,
            photo_url=picture,
            last_activity_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        create_identity(db, user.id, "google", google_sub, email=email if email_verified else None)
        is_new = True

    user.last_activity_at = datetime.now(timezone.utc)
    db.commit()

    token = _create_token(str(user.id))

    return AuthResponse(
        token=token,
        user=_build_response(user, db),
        is_new_user=is_new,
    )

