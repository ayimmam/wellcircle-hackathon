"""Bot configuration."""
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
BOT_API_KEY = os.getenv("BOT_API_KEY", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://your-app.vercel.app")
