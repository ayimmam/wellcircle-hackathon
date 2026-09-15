"""API client — calls Well Circle backend endpoints.

Uses a single module-level httpx.AsyncClient so all backend requests share a
connection pool and TLS session, avoiding the DNS lookup + handshake cost that
the previous per-call ``async with httpx.AsyncClient()`` pattern paid on every
request.

Lifecycle (must be called by main.py):
    await init_http_client()    # before the bot starts accepting requests
    await close_http_client()   # after the bot stops polling

Per-call timeouts are applied at the *request* level so different endpoints can
hold different budgets (10 s standard, 15 s for the heavier digest query) while
still sharing a warm connection to the backend.
"""

import logging
from typing import Optional

import httpx

from bot.config import BACKEND_URL, BOT_API_KEY

logger = logging.getLogger(__name__)

_DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "X-Bot-API-Key": BOT_API_KEY,
}

# Module-level shared client — initialised on bot startup, closed on shutdown.
_http_client: Optional[httpx.AsyncClient] = None

# Standard per-call timeouts kept from the original implementation.
_TIMEOUT_DEFAULT = httpx.Timeout(10.0)
_TIMEOUT_DIGEST = httpx.Timeout(15.0)


async def init_http_client() -> None:
    """Create and store the shared AsyncClient.

    Called once from post_init so the client is ready before any handler or
    scheduled job fires.  Idempotent: safe to call a second time (logs a
    warning and returns).
    """
    global _http_client
    if _http_client is not None:
        logger.warning("init_http_client called more than once — ignoring")
        return
    _http_client = httpx.AsyncClient(
        headers=_DEFAULT_HEADERS,
        follow_redirects=True,
    )
    logger.info("🔗 Shared HTTP client initialised")


async def close_http_client() -> None:
    """Close the shared AsyncClient and release pooled connections.

    Called from post_shutdown so in-flight requests complete before the pool
    is torn down.  Idempotent: safe to call when the client was never created.
    """
    global _http_client
    if _http_client is None:
        return
    await _http_client.aclose()
    _http_client = None
    logger.info("🔌 Shared HTTP client closed")


def get_http_client() -> httpx.AsyncClient:
    """Return the shared client, raising clearly if it was never initialised.

    Every API function calls this rather than accessing the module variable
    directly, so a missing init_http_client() call produces an obvious error
    instead of an AttributeError deep in the stack.
    """
    if _http_client is None:
        raise RuntimeError(
            "HTTP client not initialised — call await init_http_client() "
            "before making API requests."
        )
    return _http_client


# ---------------------------------------------------------------------------
# Backend API functions
# ---------------------------------------------------------------------------

async def register_user(
    telegram_id: int,
    telegram_handle: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> dict:
    """Register a user via POST /api/bot/register."""
    client = get_http_client()
    response = await client.post(
        f"{BACKEND_URL}/api/bot/register",
        json={
            "telegram_id": telegram_id,
            "telegram_handle": telegram_handle,
            "photo_url": photo_url,
        },
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def check_admin_access(telegram_id: int) -> dict:
    """Check if user has super-admin access via GET /api/bot/users/{id}/admin-access."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/users/{telegram_id}/admin-access",
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def get_inactive_users(days: int = 7) -> dict:
    """Get inactive users via GET /api/bot/inactive-users."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/inactive-users",
        params={"days": days},
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def get_streaks_at_risk() -> dict:
    """Users with a live streak but no check-in today, via GET /api/bot/streaks-at-risk."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/streaks-at-risk",
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def mark_reengagement_sent(telegram_id: int) -> dict:
    """Mark re-engagement message sent via POST /api/bot/users/{id}/reengagement-sent."""
    client = get_http_client()
    response = await client.post(
        f"{BACKEND_URL}/api/bot/users/{telegram_id}/reengagement-sent",
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def get_staff_events(telegram_id: int) -> dict:
    """Ended events this user is designated staff for, via GET /api/bot/staff-events."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/staff-events",
        params={"telegram_id": telegram_id},
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def submit_evidence(telegram_id: int, event_id: str, telegram_file_id: str) -> dict:
    """Submit photo evidence via POST /api/bot/evidence."""
    client = get_http_client()
    response = await client.post(
        f"{BACKEND_URL}/api/bot/evidence",
        json={
            "telegram_id": telegram_id,
            "event_id": event_id,
            "telegram_file_id": telegram_file_id,
        },
        timeout=_TIMEOUT_DEFAULT,
    )
    response.raise_for_status()
    return response.json()


async def get_circle_digests() -> dict:
    """Weekly digest data via GET /api/bot/circle-digests."""
    client = get_http_client()
    # This endpoint is heavier than the others — give it a longer budget.
    response = await client.get(
        f"{BACKEND_URL}/api/bot/circle-digests",
        timeout=_TIMEOUT_DIGEST,
    )
    response.raise_for_status()
    return response.json()
