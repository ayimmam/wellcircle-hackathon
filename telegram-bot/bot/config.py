"""Bot configuration."""
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
BOT_API_KEY = os.getenv("BOT_API_KEY", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://your-app.vercel.app")
FRONTEND_URL = os.getenv("FRONTEND_URL", MINI_APP_URL)
SUPER_ADMIN_TELEGRAM_IDS = os.getenv("SUPER_ADMIN_TELEGRAM_IDS", "")


def is_super_admin(telegram_id: int) -> bool:
    if not SUPER_ADMIN_TELEGRAM_IDS:
        return False
    ids = [int(x.strip()) for x in SUPER_ADMIN_TELEGRAM_IDS.split(",") if x.strip()]
    return telegram_id in ids
