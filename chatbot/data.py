import sys
import time
from datetime import datetime, timedelta, timezone

from config import (
    EVENT_WINDOW_DAYS,
    PROVIDER_CACHE_TTL_SECONDS,
    logger,
    supabase_client as _config_supabase_client,
)
from models import (
    EVENT_PROMPT_FIELDS,
    FALLBACK_EVENTS,
    FALLBACK_PROVIDERS,
    PROMPT_FIELDS,
)

_provider_cache = {"data": None, "source": None, "ts": 0.0}
_event_cache = {"data": None, "source": None, "ts": 0.0}


def _get_supabase_client():
    """Resolve the active Supabase client, honoring main.supabase_client patches."""
    main_mod = sys.modules.get("main")
    if main_mod is not None:
        return main_mod.supabase_client
    return _config_supabase_client


def _resolve_main_attr(name: str, fallback):
    main_mod = sys.modules.get("main")
    if main_mod is not None:
        return getattr(main_mod, name)
    return fallback


def fetch_providers():
    supabase_client = _get_supabase_client()
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
    provider_cache = _resolve_main_attr("_provider_cache", _provider_cache)
    fetch_providers_fn = _resolve_main_attr("fetch_providers", fetch_providers)
    now = time.monotonic()
    if (
        provider_cache["data"] is not None
        and (now - provider_cache["ts"]) < PROVIDER_CACHE_TTL_SECONDS
    ):
        return provider_cache["data"], provider_cache["source"]

    data, source = fetch_providers_fn()
    provider_cache.update(data=data, source=source, ts=now)
    return data, source


def compact_providers(providers):
    return [
        {k: p[k] for k in PROMPT_FIELDS if k in p}
        for p in providers
    ]


def fetch_events():
    """Load upcoming, non-cancelled events. Never raises — empty list on failure."""
    supabase_client = _get_supabase_client()
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
    event_cache = _resolve_main_attr("_event_cache", _event_cache)
    fetch_events_fn = _resolve_main_attr("fetch_events", fetch_events)
    now = time.monotonic()
    if (
        event_cache["data"] is not None
        and (now - event_cache["ts"]) < PROVIDER_CACHE_TTL_SECONDS
    ):
        return event_cache["data"], event_cache["source"]

    data, source = fetch_events_fn()
    event_cache.update(data=data, source=source, ts=now)
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
