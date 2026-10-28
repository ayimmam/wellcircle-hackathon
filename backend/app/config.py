"""
Configuration settings for Well Circle FastAPI application.
Loaded from environment variables.
"""
import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # App
    APP_NAME: str = "Well Circle"
    APP_VERSION: str = "v1.1"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str

    # Telegram
    TELEGRAM_BOT_TOKEN: str

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Optional private notification stream. The signing secret stays server-side.
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Super Admin - comma-separated Telegram IDs
    SUPER_ADMIN_TELEGRAM_IDS: str = "628489806,746296167"

    # Payment - Telebirr (Primary - Ethiopia)
    TELEBIRR_MERCHANT_CODE: str = ""
    TELEBIRR_APP_KEY: str = ""
    TELEBIRR_APP_SECRET: str = ""
    TELEBIRR_NOTIFY_URL: str = ""

    # Payment - M-Pesa Daraja (Secondary)
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_CALLBACK_URL: str = ""

    # Frontend URL (Vercel - for CORS and bot WebApp button)
    FRONTEND_URL: str = "http://localhost:5173"

    # Backend URL
    BACKEND_URL: str = ""

    # Bot API Key - shared secret between bot and backend
    BOT_API_KEY: str = ""

    # External integrations
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    STRAVA_CLIENT_ID: str = ""
    STRAVA_CLIENT_SECRET: str = ""
    STRAVA_REDIRECT_URI: str = ""
    TERRA_DEV_ID: str = ""
    TERRA_API_KEY: str = ""
    TERRA_WEBHOOK_SECRET: str = ""
    TERRA_PROVIDERS: str = "FITBIT,GARMIN,STRAVA,GOOGLE"

    # Vercel/serverless maintenance endpoint
    CRON_SECRET: str = ""

    # Firebase phone-token audience; no service-account private key is required.
    FIREBASE_PROJECT_ID: str = ""
    GOOGLE_CLIENT_ID: str = ""
    WEB_FRONTEND_URL: str = "https://app.wellcircle.et"

    # WhatsApp OTP delivery (Meta WhatsApp Cloud API / Twilio)
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_OTP_TEMPLATE_NAME: str = ""
    WHATSAPP_OTP_TEMPLATE_LANGUAGE: str = "en_US"
    WHATSAPP_API_VERSION: str = ""  # Use the supported version shown in Meta API Setup.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://web.telegram.org",
        "https://wellcircle-hackathon.vercel.app",
        "https://wellcircle.et",
        "https://app.wellcircle.et",
    ]

    @property
    def cors_origins(self) -> List[str]:
        # Saved CORS_ORIGINS may predate the independently deployed browser app.
        # Keep every configured origin and include both first-party surfaces.
        return list(dict.fromkeys(origin for origin in [*self.CORS_ORIGINS, self.FRONTEND_URL, self.WEB_FRONTEND_URL] if origin))

    @property
    def super_admin_ids(self) -> List[int]:
        """Parse comma-separated super admin Telegram IDs."""
        if not self.SUPER_ADMIN_TELEGRAM_IDS:
            return []
        return [int(tid.strip()) for tid in self.SUPER_ADMIN_TELEGRAM_IDS.split(",") if tid.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
# Vercel injects VERCEL on deployed functions. A stale ENVIRONMENT=development
# must never enable unsigned Telegram initData or return OTP codes there.
if os.getenv("VERCEL"):
    settings.ENVIRONMENT = "production"
    settings.DEBUG = False
