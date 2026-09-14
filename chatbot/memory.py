from config import MEMORY_MAX_MESSAGES, logger, supabase_client as _config_supabase_client

# --- SESSION MEMORY (last N messages) --------------------------------------
# Fast in-process cache: session_id -> list[{"role": ..., "content": ...}]
# Backed by a Supabase table (chat_memory) so memory survives restarts and
# works across multiple server instances.
_session_memory_cache: dict[str, list[dict]] = {}


def _get_supabase_client():
    """Resolve the active Supabase client, honoring main.supabase_client patches."""
    import sys

    main_mod = sys.modules.get("main")
    if main_mod is not None:
        return main_mod.supabase_client
    return _config_supabase_client


def _memory_table_get(session_id: str) -> list[dict] | None:
    supabase_client = _get_supabase_client()
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
    supabase_client = _get_supabase_client()
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
