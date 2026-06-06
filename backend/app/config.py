"""
Configuration settings for Well Circle FastAPI application.
Loaded from environment variables.
"""
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

    # Super Admin - comma-separated Telegram IDs
    SUPER_ADMIN_TELEGRAM_IDS: str = ""

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

    # Bot API Key - shared secret between bot and backend
    BOT_API_KEY: str = ""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://web.telegram.org",
    ]

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
