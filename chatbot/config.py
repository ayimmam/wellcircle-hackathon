import os
import logging

from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- LOGGING ---------------------------------------------------------------
# Detailed diagnostics go to the server logs; users only ever see the short,
# friendly replies returned by the endpoint.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("concierge")

# --- ENVIRONMENT VARIABLES -------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1024"))
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "20"))
PROVIDER_CACHE_TTL_SECONDS = float(os.getenv("PROVIDER_CACHE_TTL_SECONDS", "60"))
EVENT_WINDOW_DAYS = int(os.getenv("EVENT_WINDOW_DAYS", "30"))

logger.info("Groq model configured: %s", GROQ_MODEL)

# NEW: how many past messages (user + assistant, combined) to remember per session.
MEMORY_MAX_MESSAGES = int(os.getenv("MEMORY_MAX_MESSAGES", "5"))

if not GROQ_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Missing environment configuration variables — running in degraded mode")

groq_client = Groq(
    api_key=GROQ_API_KEY or "fallback_placeholder",
    timeout=GROQ_TIMEOUT_SECONDS,
    max_retries=1,
)

try:
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    logger.warning("Supabase client init failed (%s) — falling back to local dataset", e)
    supabase_client = None
