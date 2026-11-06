import os
import logging
import math

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


def _read_positive_int(name: str, default: int, *, minimum: int = 1) -> int:
    """Read an integer env var, falling back to a safe default when invalid."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid %s=%r — using default %s", name, raw, default)
        return default
    if value < minimum:
        logger.warning(
            "Invalid %s=%r (minimum %s) — using default %s",
            name,
            raw,
            minimum,
            default,
        )
        return default
    return value


def _read_positive_float(name: str, default: float) -> float:
    """Read a finite, strictly positive float env var or use the default."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid %s=%r — using default %s", name, raw, default)
        return default
    if not math.isfinite(value) or value <= 0:
        logger.warning("Invalid %s=%r — using default %s", name, raw, default)
        return default
    return value


# --- ENVIRONMENT VARIABLES -------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1024"))
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "20"))
PROVIDER_CACHE_TTL_SECONDS = float(os.getenv("PROVIDER_CACHE_TTL_SECONDS", "60"))
EVENT_WINDOW_DAYS = int(os.getenv("EVENT_WINDOW_DAYS", "30"))

# User JWTs are issued by the main FastAPI backend. The chatbot only verifies
# them, so these values must match the backend's JWT settings.
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256").strip().upper()

# Anonymous visitors receive a server-signed credential. When no dedicated
# secret is configured, auth.py derives a domain-separated key from JWT_SECRET.
ANON_SESSION_SECRET = os.getenv("ANON_SESSION_SECRET", "").strip()
ANON_SESSION_TTL_HOURS = _read_positive_float("ANON_SESSION_TTL_HOURS", 720.0)

logger.info("Groq model configured: %s", GROQ_MODEL)

# How many past messages (user + assistant, combined) to remember per session.
# At least two are required so a stored turn is never cut in half.
MEMORY_MAX_MESSAGES = _read_positive_int("MEMORY_MAX_MESSAGES", 5, minimum=2)

# A conversation is ignored once its stored activity timestamp is older than
# this window. The database row's updated_at is authoritative.
MEMORY_INACTIVITY_HOURS = _read_positive_float("MEMORY_INACTIVITY_HOURS", 24.0)

# Upper bound for the process-local fallback cache. Supabase-backed requests
# always read the database, so this cache primarily protects local/degraded use.
MEMORY_CACHE_MAX_SESSIONS = _read_positive_int(
    "MEMORY_CACHE_MAX_SESSIONS", 1000, minimum=0
)

if not GROQ_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Missing environment configuration variables — running in degraded mode")

if not JWT_SECRET:
    logger.warning(
        "JWT_SECRET is not configured — authenticated chatbot requests will be rejected"
    )
if JWT_ALGORITHM not in {"HS256"}:
    logger.warning(
        "JWT_ALGORITHM=%s is not supported by the chatbot; user authentication will be rejected",
        JWT_ALGORITHM,
    )
if not ANON_SESSION_SECRET and not JWT_SECRET:
    logger.warning(
        "No anonymous-session secret is configured — anonymous credentials will not survive a restart"
    )

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
