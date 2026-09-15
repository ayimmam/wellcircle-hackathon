import os
import re
import json
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import (
    GROQ_MAX_TOKENS,
    GROQ_MODEL,
    MEMORY_MAX_MESSAGES,
    groq_client,
    logger,
    supabase_client,
)
from data import (
    _event_cache,
    _provider_cache,
    _resolve_event,
    _resolve_provider,
    fetch_events,
    fetch_providers,
    get_events,
    get_providers,
)
from prompt import SYSTEM_PROMPT_PREFIX, build_system_prompt
from models import (
    EVENT_PROMPT_FIELDS,
    FALLBACK_EVENTS,
    FALLBACK_PROVIDERS,
    PROMPT_FIELDS,
    ChatMessage,
    ConciergeRequest,
    ConciergeResponse,
)
from memory import (
    _session_memory_cache,
    get_session_history,
    save_session_history,
)

app = FastAPI(title="Well Circle Concierge - Production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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