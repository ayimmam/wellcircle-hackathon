import os
import re
import json
import time
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

app = FastAPI(title="Well Circle Concierge - Production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


FALLBACK_PROVIDERS = [
    {
        "id": "fb-001",
        "name": "Bole Wellness Hub",
        "category": "gym",
        "description": "Modern gym with personal training and group classes.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 800-2500",
        "rating": 4.6,
    },
    {
        "id": "fb-002",
        "name": "Serenity Yoga Studio",
        "category": "yoga",
        "description": "Calm, beginner-friendly yoga studio with daily sessions.",
        "location_text": "Kazanchis, Addis Ababa",
        "price_range": "ETB 500-1200",
        "rating": 4.8,
    },
    {
        "id": "fb-003",
        "name": "NutriLife Consulting",
        "category": "nutrition",
        "description": "Affordable nutrition planning and weight management coaching.",
        "location_text": "CMC, Addis Ababa",
        "price_range": "ETB 400-1000",
        "rating": 4.5,
    },
    {
        "id": "fb-004",
        "name": "Spa Oasis Addis",
        "category": "spa",
        "description": "Relaxing massage and spa treatments in a tranquil setting.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 600-2000",
        "rating": 4.7,
    },
    {
        "id": "fb-005",
        "name": "Mindful Therapy Center",
        "category": "therapy",
        "description": "Licensed therapists offering individual counseling sessions.",
        "location_text": "Sarbet, Addis Ababa",
        "price_range": "ETB 700-1800",
        "rating": 4.9,
    },
]

PROMPT_FIELDS = (
    "id",
    "name",
    "category",
    "description",
    "location_text",
    "price_range",
    "rating",
)

EVENT_PROMPT_FIELDS = (
    "id",
    "provider_id",
    "service_name",
    "description",
    "starts_at",
    "ends_at",
    "price_etb",
    "spots_remaining",
)

FALLBACK_EVENTS = [
    {
        "id": "fe-001",
        "provider_id": "fb-001",
        "service_name": "Sunrise HIIT at Bole Wellness Hub",
        "description": "45-minute outdoor interval class for all levels.",
        "starts_at": "2026-09-12T06:30:00+00:00",
        "ends_at": "2026-09-12T07:15:00+00:00",
        "price_etb": 250,
        "spots_remaining": 8,
    },
    {
        "id": "fe-002",
        "provider_id": "fb-002",
        "service_name": "Weekend Restorative Yoga",
        "description": "Gentle 60-minute session to unwind after the week.",
        "starts_at": "2026-09-13T10:00:00+00:00",
        "ends_at": "2026-09-13T11:00:00+00:00",
        "price_etb": 400,
        "spots_remaining": 12,
    },
]


class ChatMessage(BaseModel):
    role: str
    content: str


class ConciergeRequest(BaseModel):
    message: str
    # NEW: client-provided session id. Optional — server will generate one
    # if missing and hand it back in the response.
    session_id: str | None = None
    # Kept for backward compatibility with older clients. Only used to seed
    # a brand-new session that has no server-side memory yet.
    history: list[ChatMessage] = []


class ConciergeResponse(BaseModel):
    reply: str
    provider_id: str | None = None
    provider_name: str | None = None
    event_id: str | None = None
    event_name: str | None = None
    event_provider_id: str | None = None
    data_source: str = "unknown"
    # NEW: echoed/generated session id so the client can persist it.
    session_id: str = ""


_provider_cache = {"data": None, "source": None, "ts": 0.0}
_event_cache = {"data": None, "source": None, "ts": 0.0}

# --- NEW: SESSION MEMORY (last N messages) ---------------------------------
# Fast in-process cache: session_id -> list[{"role": ..., "content": ...}]
# Backed by a Supabase table (chat_memory) so memory survives restarts and
# works across multiple server instances.
_session_memory_cache: dict[str, list[dict]] = {}


def _memory_table_get(session_id: str) -> list[dict] | None:
    if supabase_client is None:
        return None
    try:
        res = (
            supabase_client.table("chat_memory")
            .select("messages")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0].get("messages") or []
        return None
    except Exception:
        logger.exception("Supabase read failed for session %s", session_id)
        return None


def _memory_table_upsert(session_id: str, messages: list[dict]) -> None:
    if supabase_client is None:
        return
    try:
        supabase_client.table("chat_memory").upsert(
            {"session_id": session_id, "messages": messages}
        ).execute()
    except Exception:
        logger.exception("Supabase write failed for session %s", session_id)


def get_session_history(session_id: str) -> list[dict]:
    if session_id in _session_memory_cache:
        return _session_memory_cache[session_id]

    stored = _memory_table_get(session_id)
    if stored is None:
        stored = []

    _session_memory_cache[session_id] = stored
    return stored


def save_session_history(session_id: str, messages: list[dict]) -> None:
    trimmed = messages[-MEMORY_MAX_MESSAGES:]
    _session_memory_cache[session_id] = trimmed
    _memory_table_upsert(session_id, trimmed)
# --- END NEW SECTION --------------------------------------------------------


def fetch_providers():
    if supabase_client is not None:
        try:
            db_response = supabase_client.table("providers").select("*").execute()
            if db_response.data:
                return db_response.data, "live"
            logger.info("Supabase returned 0 providers — using fallback dataset")
            return FALLBACK_PROVIDERS, "fallback"
        except Exception:
            logger.exception("Supabase fetch failed — using fallback dataset")
            return FALLBACK_PROVIDERS, "fallback"
    logger.info("Supabase client not initialized — using fallback dataset")
    return FALLBACK_PROVIDERS, "fallback"


def get_providers():
    now = time.monotonic()
    if (
        _provider_cache["data"] is not None
        and (now - _provider_cache["ts"]) < PROVIDER_CACHE_TTL_SECONDS
    ):
        return _provider_cache["data"], _provider_cache["source"]

    data, source = fetch_providers()
    _provider_cache.update(data=data, source=source, ts=now)
    return data, source


def compact_providers(providers):
    return [
        {k: p[k] for k in PROMPT_FIELDS if k in p}
        for p in providers
    ]


def fetch_events():
    """Load upcoming, non-cancelled events. Never raises — empty list on failure."""
    if supabase_client is None:
        logger.info("Supabase client not initialized — using fallback events")
        return FALLBACK_EVENTS, "fallback"

    now = datetime.now(timezone.utc)
    until = now + timedelta(days=EVENT_WINDOW_DAYS)
    try:
        db_response = (
            supabase_client.table("provider_events")
            .select(",".join(EVENT_PROMPT_FIELDS))
            .eq("is_cancelled", False)
            .gte("starts_at", now.isoformat())
            .lt("starts_at", until.isoformat())
            .execute()
        )
        if db_response.data:
            return db_response.data, "live"
        logger.info("Supabase returned 0 upcoming events")
        return [], "empty"
    except Exception:
        logger.exception("Supabase events fetch failed — continuing without events")
        return [], "unavailable"


def get_events():
    now = time.monotonic()
    if (
        _event_cache["data"] is not None
        and (now - _event_cache["ts"]) < PROVIDER_CACHE_TTL_SECONDS
    ):
        return _event_cache["data"], _event_cache["source"]

    data, source = fetch_events()
    _event_cache.update(data=data, source=source, ts=now)
    return data, source


def compact_events(events):
    compacted = []
    for event in events:
        row = {k: event[k] for k in EVENT_PROMPT_FIELDS if k in event}
        if "id" in row:
            row["id"] = str(row["id"])
        if "provider_id" in row:
            row["provider_id"] = str(row["provider_id"])
        compacted.append(row)
    return compacted


@app.get("/")
def health():
    db_status = "not_configured"
    if supabase_client:
        try:
            supabase_client.table("providers").select("id").limit(1).execute()
            db_status = "live"
        except Exception:
            db_status = "unreachable_using_fallback"
    return {
        "status": "ok",
        "service": "well-circle-concierge",
        "database": db_status,
    }


def _resolve_provider(parsed: dict, providers: list) -> tuple[str | None, str | None]:
    provider_id = parsed.get("provider_id")

    if isinstance(provider_id, str):
        provider_id = provider_id.strip()
        if provider_id.lower() in ("", "null", "none"):
            provider_id = None
    elif provider_id is not None:
        provider_id = str(provider_id)

    if provider_id is None:
        return None, None

    name_by_id = {p["id"]: p.get("name") for p in providers}
    if provider_id not in name_by_id:
        logger.info("Model returned unknown provider_id %r — dropping it", provider_id)
        return None, None

    return provider_id, name_by_id[provider_id]


def _normalize_optional_id(value):
    if isinstance(value, str):
        value = value.strip()
        if value.lower() in ("", "null", "none"):
            return None
        return value
    if value is not None:
        return str(value)
    return None


def _resolve_event(parsed: dict, events: list) -> tuple[str | None, str | None, str | None]:
    event_id = _normalize_optional_id(parsed.get("event_id"))
    if event_id is None:
        return None, None, None

    by_id = {str(e["id"]): e for e in events}
    event = by_id.get(event_id)
    if event is None:
        logger.info("Model returned unknown event_id %r — dropping it", event_id)
        return None, None, None

    provider_id = event.get("provider_id")
    return event_id, event.get("service_name"), str(provider_id) if provider_id else None


# Merges three behaviors requested:
#   - Wellness-only scope with a polite redirect for off-topic questions
#   - Exact, never-rounded price quoting straight from the database
#   - Every reply ends with a short open-ended question to keep the user engaged
SYSTEM_PROMPT_PREFIX = (
    "You are the Well Circle Concierge, a friendly and knowledgeable wellness expert for Addis Ababa.\n\n"
    "CORE GUIDELINES:\n"
    "1. WELLNESS SCOPE: Anchor every response to wellness services. If the user asks something unrelated "
    "to wellness (sports, weather, jokes, general trivia), politely redirect them back to your purpose in "
    "a warm, natural way, then invite them to describe what wellness service they're looking for.\n"
    "2. DATABASE PRIORITY: Always check the Available Providers list first. If a provider matches the "
    "user's stated category, location, or budget, recommend that exact provider using its EXACT id.\n"
    "3. EVENTS: If the user asks about events, classes, something happening this week/weekend, or "
    "upcoming sessions, check the Available Upcoming Events list. Recommend a matching event using its "
    "EXACT id and its service_name. You may recommend a provider and an event in the same reply when both fit.\n"
    "4. EXACT DATA RETRIEVAL: When quoting a provider price, quote price_range EXACTLY as it appears "
    "in the data. When quoting an event price, quote price_etb EXACTLY. Never round, estimate, or invent "
    "a number. If the user gives a budget, only treat a provider/event as a match if the listed price "
    "plausibly fits that budget.\n"
    "5. CONSULTATIVE FALLBACK: If no provider or event in the lists is a genuine match, do not invent one. "
    "Instead, give brief, general, accurate wellness guidance relevant to their request, then invite them "
    "to refine their ask (neighbourhood, budget, or service type). Set provider_id, provider_name, "
    "event_id, and event_name to null in this case.\n"
    "6. ADVISORY INTENT (pain, stress, weight, general health questions): give a short, practical, "
    "evidence-based tip first, THEN suggest a relevant provider or event only if one genuinely fits.\n"
    "7. SEARCH INTENT (explicitly looking for a gym, spa, yoga studio, event, etc.): lead directly with the "
    "best-match provider or event from the data.\n"
    "8. ENGAGING ENDING: End your 'reply' with a short, relevant, open-ended question that keeps the "
    "conversation moving (e.g. asking about budget, neighbourhood, or whether they'd like to see the match).\n\n"
    "ABSOLUTE RULES:\n"
    "1. REPLY MUST BE 2-4 SENTENCES MAX, including the closing question. No filler greetings like "
    "'Hello' or 'I am an AI'.\n"
    "2. ONLY recommend a provider that appears in the Available Providers list below, using its EXACT id. "
    "ONLY recommend an event that appears in the Available Upcoming Events list below, using its EXACT id. "
    "If nothing genuinely fits, set the matching id/name fields to null. Never invent providers, events, or prices.\n"
    "3. OUTPUT FORMAT: Return ONLY a single JSON object — no conversational text before or after it, "
    "no markdown, and no code fences. The entire response must be valid JSON that can be parsed directly.\n"
    'REQUIRED KEYS: {"reply": "<advice/recommendation + closing question>", "provider_id": "<id or null>", '
    '"provider_name": "<name or null>", "event_id": "<id or null>", "event_name": "<service_name or null>"}\n\n'
    "Available Providers: "
)


def build_system_prompt(providers, events) -> str:
    return (
        SYSTEM_PROMPT_PREFIX
        + json.dumps(compact_providers(providers))
        + "\n\nAvailable Upcoming Events: "
        + json.dumps(compact_events(events))
    )

FALLBACK_REPLY = (
    "I'm having trouble matching that request right now - try stating your "
    "health goal, budget, or neighbourhood."
)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?```", re.DOTALL | re.IGNORECASE)


def extract_json_object(text: str) -> dict | None:
    """Parse a JSON object from plain text or markdown-fenced model output."""
    if not text or not isinstance(text, str):
        return None

    stripped = text.strip()
    if not stripped:
        return None

    candidates = [stripped]

    fence_match = _JSON_FENCE_RE.search(stripped)
    if fence_match:
        candidates.insert(0, fence_match.group(1).strip())

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end > start:
        candidates.append(stripped[start : end + 1])

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


def validate_concierge_payload(parsed: dict) -> bool:
    """Ensure the parsed model output matches the concierge response contract."""
    if not isinstance(parsed, dict):
        return False
    if "reply" not in parsed:
        return False
    reply = parsed.get("reply")
    if reply is not None and not isinstance(reply, str):
        return False
    return True


def _is_groq_api_error(exc: BaseException) -> bool:
    return type(exc).__module__.startswith("groq")


def _extract_model_text(message) -> str:
    """Return assistant text from content, falling back to reasoning for OSS models."""
    content = getattr(message, "content", None)
    if content is not None and str(content).strip():
        return str(content).strip()

    reasoning = getattr(message, "reasoning", None)
    if reasoning is None and hasattr(message, "model_dump"):
        reasoning = message.model_dump().get("reasoning")
    if reasoning is not None and str(reasoning).strip():
        logger.info("Model returned empty content; attempting JSON extraction from reasoning")
        return str(reasoning).strip()

    return ""


@app.post("/ai/concierge", response_model=ConciergeResponse)
def ai_concierge(req: ConciergeRequest):

    # NEW: resolve/generate the session id for this conversation.
    session_id = req.session_id or str(uuid.uuid4())

    # Every message goes straight to the LLM matching engine.
    # Welcome/onboarding text is owned entirely by the frontend now.
    providers, data_source = get_providers()
    events, _event_source = get_events()

    system_prompt = build_system_prompt(providers, events)

    try:
        # NEW: pull server-side memory instead of trusting client-sent history.
        stored_history = get_session_history(session_id)

        # Seed brand-new sessions from client-sent history, if any (backward compat).
        if not stored_history and req.history:
            MAX_HISTORY_TURNS = 6
            trimmed_client_history = req.history[-MAX_HISTORY_TURNS:]
            stored_history = [
                {"role": turn.role, "content": turn.content}
                for turn in trimmed_client_history
                if turn.role in ("user", "assistant")
            ][-MEMORY_MAX_MESSAGES:]

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(stored_history)
        messages.append({"role": "user", "content": req.message})

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=GROQ_MAX_TOKENS,
        )

        if not response.choices:
            logger.error("Model failure: Groq returned no choices (model=%s)", GROQ_MODEL)
            raise ValueError("model_no_choices")

        raw_content = _extract_model_text(response.choices[0].message)
        if not raw_content:
            logger.error("Model failure: Groq returned empty content (model=%s)", GROQ_MODEL)
            raise ValueError("model_empty_content")

        raw_text = raw_content
        parsed = extract_json_object(raw_text)
        if parsed is None:
            preview = raw_text[:200].replace("\n", " ")
            logger.error(
                "JSON parsing failure: could not extract object from model output "
                "(model=%s, preview=%r)",
                GROQ_MODEL,
                preview,
            )
            raise ValueError("json_parse_failed")

        if not validate_concierge_payload(parsed):
            logger.error(
                "Response validation failure: missing or invalid required fields "
                "(keys=%s, model=%s)",
                sorted(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__,
                GROQ_MODEL,
            )
            raise ValueError("validation_failed")

        provider_id, provider_name = _resolve_provider(parsed, providers)
        event_id, event_name, event_provider_id = _resolve_event(parsed, events)

        reply = parsed.get("reply") or ""
        if not isinstance(reply, str) or not reply.strip():
            reply = FALLBACK_REPLY

        # NEW: save this turn to session memory, trimmed to the last N messages.
        updated_history = stored_history + [
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": reply},
        ]
        save_session_history(session_id, updated_history)

        return ConciergeResponse(
            reply=reply,
            provider_id=provider_id,
            provider_name=provider_name,
            event_id=event_id,
            event_name=event_name,
            event_provider_id=event_provider_id,
            data_source=data_source,
            session_id=session_id,
        )

    except ValueError as exc:
        if str(exc) not in (
            "model_no_choices",
            "model_empty_content",
            "json_parse_failed",
            "validation_failed",
        ):
            logger.exception("Unexpected validation error during AI processing")
    except Exception as exc:
        if _is_groq_api_error(exc):
            logger.exception("Groq API failure (model=%s)", GROQ_MODEL)
        else:
            logger.exception("Unexpected AI processing error")

    return ConciergeResponse(
        reply=FALLBACK_REPLY,
        provider_id=None,
        provider_name=None,
        event_id=None,
        event_name=None,
        event_provider_id=None,
        data_source=data_source,
        session_id=session_id,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)