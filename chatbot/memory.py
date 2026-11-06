from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock

from config import (
    MEMORY_CACHE_MAX_SESSIONS,
    MEMORY_INACTIVITY_HOURS,
    MEMORY_MAX_MESSAGES,
    logger,
    supabase_client as _config_supabase_client,
)

# --- SESSION MEMORY --------------------------------------------------------
# Bounded process-local cache, used only when Supabase is not configured.
# Supabase is authoritative whenever a client is available: every request
# reads the stored row (including updated_at) before deciding whether history
# is still active, so a stale cache can never revive or replace database state.
# All cache mutations are guarded by a lock because FastAPI runs sync endpoints
# in a thread pool.
_session_memory_cache: OrderedDict[str, "_CacheEntry"] = OrderedDict()
_session_memory_cache_lock = Lock()


@dataclass(frozen=True)
class SessionState:
    """Result of loading one conversation's server-side memory."""

    messages: list[dict]
    updated_at: datetime | None
    # active | expired | new | unavailable | forbidden
    status: str


@dataclass(frozen=True)
class AppendResult:
    """Result of appending one validated conversation turn."""

    persisted: bool
    messages: list[dict]
    updated_at: datetime | None
    reset_applied: bool = False
    stale_turn: bool = False


@dataclass(frozen=True)
class _CacheEntry:
    owner_type: str
    owner_id: str
    messages: list[dict]
    updated_at: datetime


class SessionOwnershipError(RuntimeError):
    """Raised when a session is already bound to a different owner."""


_OWNER_TYPES = ("user", "anonymous")


def _validate_owner(owner_type: str, owner_id: str) -> None:
    if owner_type not in _OWNER_TYPES:
        raise ValueError("invalid chat session owner type")
    if not isinstance(owner_id, str) or not owner_id.strip():
        raise ValueError("invalid chat session owner id")


def _get_supabase_client():
    """Resolve the active Supabase client, honoring main.supabase_client patches."""
    import sys

    main_mod = sys.modules.get("main")
    if main_mod is not None:
        return main_mod.supabase_client
    return _config_supabase_client


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: object) -> datetime | None:
    """Parse a Supabase timestamp and normalize it to timezone-aware UTC."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        # Postgres/Supabase may return either +00:00 or a trailing Z.
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _trim_messages(messages: list[dict]) -> list[dict]:
    """Keep only valid roles/content and enforce the configured message limit."""
    if not isinstance(messages, list):
        return []
    cleaned = [
        {"role": item["role"], "content": item["content"]}
        for item in messages
        if isinstance(item, dict)
        and item.get("role") in ("user", "assistant")
        and isinstance(item.get("content"), str)
    ]
    if MEMORY_MAX_MESSAGES <= 0:
        return []
    trimmed = cleaned[-MEMORY_MAX_MESSAGES:]
    # A turn is a user+assistant pair. An odd limit can slice mid-pair, which
    # would make a restored conversation start with an assistant bubble. Drop
    # the orphaned leading assistant message instead of showing it as context.
    if trimmed and trimmed[0].get("role") == "assistant":
        trimmed = trimmed[1:]
    return trimmed


def _is_expired(updated_at: datetime, now: datetime) -> bool:
    return now - updated_at >= timedelta(hours=MEMORY_INACTIVITY_HOURS)


def _cache_pop(session_id: str) -> None:
    with _session_memory_cache_lock:
        _session_memory_cache.pop(session_id, None)


def _cache_clear() -> None:
    """Test helper: empty the process-local cache under the cache lock."""
    with _session_memory_cache_lock:
        _session_memory_cache.clear()


def _cache_get(
    session_id: str,
    owner_type: str,
    owner_id: str,
    now: datetime,
) -> SessionState | None:
    with _session_memory_cache_lock:
        entry = _session_memory_cache.get(session_id)
        if entry is None:
            return None
        if entry.owner_type != owner_type or entry.owner_id != owner_id:
            # Never return another identity's messages, even in degraded mode.
            return SessionState(
                messages=[], updated_at=entry.updated_at, status="forbidden"
            )
        if _is_expired(entry.updated_at, now):
            _session_memory_cache.pop(session_id, None)
            return SessionState(
                messages=[], updated_at=entry.updated_at, status="expired"
            )
        _session_memory_cache.move_to_end(session_id)
        return SessionState(
            messages=[dict(message) for message in entry.messages],
            updated_at=entry.updated_at,
            status="active",
        )


def _cache_put(
    session_id: str,
    owner_type: str,
    owner_id: str,
    messages: list[dict],
    updated_at: datetime,
) -> None:
    _validate_owner(owner_type, owner_id)
    if MEMORY_CACHE_MAX_SESSIONS <= 0:
        return
    entry = _CacheEntry(
        owner_type=owner_type,
        owner_id=owner_id,
        messages=_trim_messages(messages),
        updated_at=updated_at,
    )
    with _session_memory_cache_lock:
        existing = _session_memory_cache.get(session_id)
        if existing is not None and (
            existing.owner_type != owner_type or existing.owner_id != owner_id
        ):
            raise SessionOwnershipError("chat session ownership mismatch")
        _session_memory_cache[session_id] = entry
        _session_memory_cache.move_to_end(session_id)
        while len(_session_memory_cache) > MEMORY_CACHE_MAX_SESSIONS:
            _session_memory_cache.popitem(last=False)


def _cache_append(
    session_id: str,
    owner_type: str,
    owner_id: str,
    user_content: str,
    assistant_content: str,
    now: datetime,
) -> tuple[list[dict], bool]:
    """Append one turn to the fallback cache under a single lock."""
    _validate_owner(owner_type, owner_id)
    turn = [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ]
    with _session_memory_cache_lock:
        entry = _session_memory_cache.get(session_id)
        reset_applied = False
        base_messages: list[dict] = []
        if entry is not None:
            if entry.owner_type != owner_type or entry.owner_id != owner_id:
                raise SessionOwnershipError("chat session ownership mismatch")
            if _is_expired(entry.updated_at, now):
                _session_memory_cache.pop(session_id, None)
                reset_applied = True
            else:
                base_messages = [dict(message) for message in entry.messages]

        messages = _trim_messages(base_messages + turn)
        if MEMORY_CACHE_MAX_SESSIONS > 0:
            _session_memory_cache[session_id] = _CacheEntry(
                owner_type=owner_type,
                owner_id=owner_id,
                messages=messages,
                updated_at=now,
            )
            _session_memory_cache.move_to_end(session_id)
            while len(_session_memory_cache) > MEMORY_CACHE_MAX_SESSIONS:
                _session_memory_cache.popitem(last=False)
        return messages, reset_applied


def _memory_table_get(session_id: str) -> dict | None:
    """Read the authoritative row, or return None when the session is new."""
    supabase_client = _get_supabase_client()
    if supabase_client is None:
        raise RuntimeError("Supabase client is not configured")

    res = (
        supabase_client.table("chat_memory")
        .select("owner_type, owner_id, messages, updated_at")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return None


def _single_rpc_row(response: object) -> dict | None:
    """Extract the single row returned by a RETURNS TABLE RPC."""
    data = getattr(response, "data", None)
    if isinstance(data, list):
        if len(data) != 1:
            return None
        return data[0]
    if isinstance(data, dict):
        return data
    return None


def _validate_append_row(
    row: object,
    user_content: str,
    assistant_content: str,
) -> tuple[list[dict], datetime, bool, bool] | None:
    """Validate the RPC response before accepting the turn as persisted."""
    if not isinstance(row, dict):
        return None

    raw_messages = row.get("messages")
    updated_at = _as_utc(row.get("updated_at"))
    reset_applied = row.get("reset_applied", False)
    stale_turn = row.get("stale_turn", False)

    if not isinstance(raw_messages, list) or updated_at is None:
        return None
    if not isinstance(reset_applied, bool) or not isinstance(stale_turn, bool):
        return None

    messages: list[dict] = []
    for item in raw_messages:
        if not isinstance(item, dict):
            return None
        role = item.get("role")
        content = item.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            return None
        messages.append({"role": role, "content": content})

    expected_tail = [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ]
    if len(messages) < 2 or messages[-2:] != expected_tail:
        return None

    if len(messages) > MEMORY_MAX_MESSAGES:
        return None

    return messages, updated_at, reset_applied, stale_turn


def _memory_rpc_append(
    session_id: str,
    owner_type: str,
    owner_id: str,
    user_content: str,
    assistant_content: str,
    expected_updated_at: datetime | None,
) -> dict | None:
    """Append one turn atomically inside PostgreSQL."""
    supabase_client = _get_supabase_client()
    if supabase_client is None:
        return None

    response = supabase_client.rpc(
        "append_chat_turn",
        {
            "p_session_id": session_id,
            "p_owner_type": owner_type,
            "p_owner_id": owner_id,
            "p_user_content": user_content,
            "p_assistant_content": assistant_content,
            "p_expected_updated_at": (
                expected_updated_at.isoformat() if expected_updated_at else None
            ),
            "p_max_messages": MEMORY_MAX_MESSAGES,
            "p_inactivity_hours": MEMORY_INACTIVITY_HOURS,
        },
    ).execute()
    return _single_rpc_row(response)


def get_session_state(
    session_id: str,
    *,
    owner_type: str,
    owner_id: str,
    now: datetime | None = None,
) -> SessionState:
    """Load server history and classify it against the inactivity window.

    The owner is checked before any history is returned. A row that belongs to
    a different user or anonymous identity is reported as ``forbidden`` with
    empty messages, so a known session id cannot be used to read another
    conversation. When Supabase is configured, the database row is always read
    first. Cache is not allowed to override or fill in for a database result,
    which prevents an expired/stale cache entry from resurrecting old history.
    """
    _validate_owner(owner_type, owner_id)
    checked_at = _as_utc(now) or _utcnow()
    supabase_client = _get_supabase_client()

    if supabase_client is None:
        cached = _cache_get(session_id, owner_type, owner_id, checked_at)
        if cached is not None:
            return cached
        return SessionState(messages=[], updated_at=None, status="new")

    try:
        row = _memory_table_get(session_id)
    except Exception:
        logger.exception("Supabase read failed for session %s", session_id)
        # Do not fall back to process memory: it may be older than the
        # authoritative database state.
        _cache_pop(session_id)
        return SessionState(messages=[], updated_at=None, status="unavailable")

    if row is None:
        _cache_pop(session_id)
        return SessionState(messages=[], updated_at=None, status="new")

    row_owner_type = row.get("owner_type")
    row_owner_id = row.get("owner_id")
    if (
        row_owner_type not in _OWNER_TYPES
        or not isinstance(row_owner_id, str)
        or row_owner_type != owner_type
        or row_owner_id != owner_id
    ):
        # Legacy rows (owner_type='legacy') and rows owned by another identity
        # are never readable here. Do not put their messages in the cache.
        _cache_pop(session_id)
        return SessionState(messages=[], updated_at=None, status="forbidden")

    updated_at = _as_utc(row.get("updated_at"))
    if updated_at is None:
        # A row without a trustworthy activity timestamp cannot be treated as
        # active. Ignore its history rather than risk resurrecting it.
        logger.warning("chat_memory row for session %s has invalid updated_at", session_id)
        _cache_pop(session_id)
        return SessionState(messages=[], updated_at=None, status="expired")

    if _is_expired(updated_at, checked_at):
        _cache_pop(session_id)
        return SessionState(messages=[], updated_at=updated_at, status="expired")

    messages = _trim_messages(row.get("messages") or [])
    _cache_put(session_id, owner_type, owner_id, messages, updated_at)
    return SessionState(messages=messages, updated_at=updated_at, status="active")


def get_session_history(
    session_id: str, *, owner_type: str, owner_id: str
) -> list[dict]:
    """Backward-compatible helper returning only the active, owned history."""
    return get_session_state(
        session_id, owner_type=owner_type, owner_id=owner_id
    ).messages


def append_session_turn(
    session_id: str,
    user_content: str,
    assistant_content: str,
    *,
    owner_type: str,
    owner_id: str,
    expected_updated_at: datetime | None = None,
    now: datetime | None = None,
) -> AppendResult:
    """Append one successful user/assistant turn.

    With Supabase configured, the database does the append, expiry reset,
    trimming, and timestamp generation atomically. The response is validated
    before the turn is treated as persisted. When Supabase is not configured,
    only the bounded process cache is updated and ``persisted`` is False.

    The owner is passed to the database RPC and re-checked there while the row
    is locked. A mismatch raises :class:`SessionOwnershipError`; it is never
    converted into a successful anonymous/other-owner write.
    """
    _validate_owner(owner_type, owner_id)
    supabase_client = _get_supabase_client()
    checked_at = _as_utc(now) or _utcnow()

    if supabase_client is None:
        messages, reset_applied = _cache_append(
            session_id,
            owner_type,
            owner_id,
            user_content,
            assistant_content,
            checked_at,
        )
        return AppendResult(
            persisted=False,
            messages=messages,
            updated_at=checked_at,
            reset_applied=reset_applied,
        )

    expected_at = _as_utc(expected_updated_at)
    if expected_updated_at is not None and expected_at is None:
        logger.warning(
            "Ignoring invalid expected_updated_at for session %s", session_id
        )

    try:
        row = _memory_rpc_append(
            session_id,
            owner_type,
            owner_id,
            user_content,
            assistant_content,
            expected_at,
        )
    except SessionOwnershipError:
        raise
    except Exception as exc:
        # The RPC raises a PostgreSQL exception on an ownership race. Preserve
        # the security decision instead of degrading it to a cache write.
        if "ownership mismatch" in str(exc).lower():
            _cache_pop(session_id)
            raise SessionOwnershipError("chat session ownership mismatch") from exc
        logger.exception("Supabase append failed for session %s", session_id)
        _cache_pop(session_id)
        return AppendResult(persisted=False, messages=[], updated_at=None)

    validated = _validate_append_row(row, user_content, assistant_content)
    if validated is None:
        logger.error(
            "Supabase append returned an invalid result for session %s", session_id
        )
        _cache_pop(session_id)
        return AppendResult(persisted=False, messages=[], updated_at=None)

    messages, updated_at, reset_applied, stale_turn = validated
    _cache_put(session_id, owner_type, owner_id, messages, updated_at)
    return AppendResult(
        persisted=True,
        messages=messages,
        updated_at=updated_at,
        reset_applied=reset_applied,
        stale_turn=stale_turn,
    )


def save_session_history(
    session_id: str,
    messages: list[dict],
    *,
    owner_type: str,
    owner_id: str,
    now: datetime | None = None,
) -> bool:
    """Compatibility helper: append the final user/assistant pair.

    New code should call :func:`append_session_turn`, which sends only the
    current turn and lets PostgreSQL serialize concurrent writes.
    """
    trimmed = _trim_messages(messages)
    if len(trimmed) < 2:
        return False
    user_turn, assistant_turn = trimmed[-2], trimmed[-1]
    if user_turn["role"] != "user" or assistant_turn["role"] != "assistant":
        logger.warning(
            "save_session_history requires a final user/assistant pair (session %s)",
            session_id,
        )
        return False
    return append_session_turn(
        session_id,
        user_turn["content"],
        assistant_turn["content"],
        owner_type=owner_type,
        owner_id=owner_id,
        now=now,
    ).persisted


def clear_session(
    session_id: str, *, owner_type: str, owner_id: str
) -> int:
    """Delete a conversation row owned by the caller.

    The session id is only a selector, never proof of ownership: the owner
    values resolved from the request credential are applied as additional
    PostgREST filter conditions, so a session belonging to another identity,
    a legacy pre-ownership row, or an unknown id can never be deleted here.

    Returns the number of rows removed (0 when nothing was stored for this
    session under this owner — including an empty/whitespace id or a missing
    backend, where the process-local cache is cleared instead). Raises when
    the storage request itself fails so callers can distinguish "nothing to
    clear" from "the clear did not happen".
    """
    _validate_owner(owner_type, owner_id)
    sid = session_id.strip() if isinstance(session_id, str) else ""
    if sid:
        _cache_pop(sid)
    supabase_client = _get_supabase_client()
    if supabase_client is None:
        return 0
    if not sid:
        return 0
    try:
        res = (
            supabase_client.table("chat_memory")
            .delete()
            .eq("session_id", sid)
            .eq("owner_type", owner_type)
            .eq("owner_id", owner_id)
            .execute()
        )
    except Exception:
        logger.exception("Supabase clear failed for session %s", sid)
        raise
    rows = getattr(res, "data", None)
    return len(rows) if isinstance(rows, list) else 0
