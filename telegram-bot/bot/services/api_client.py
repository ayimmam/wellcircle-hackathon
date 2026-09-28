"""API client — calls Well Circle backend endpoints.

Uses a single module-level httpx.AsyncClient for connection pooling.
Call init_http_client() on bot startup and close_http_client() on shutdown.
"""

import httpx
from typing import Optional

from bot.config import BACKEND_URL, BOT_API_KEY

HEADERS = {
    "Content-Type": "application/json",
    "X-Bot-API-Key": BOT_API_KEY,
}

# ── Shared HTTP client lifecycle ─────────────────────────────────────────

_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    """Return the shared HTTP client. Raises if not initialised."""
    if _client is None:
        raise RuntimeError("HTTP client not initialised — call init_http_client() first")
    return _client


async def init_http_client() -> None:
    """Create the shared HTTP client. Call once from post_init."""
    global _client
    _client = httpx.AsyncClient(
        timeout=10,
        follow_redirects=True,
        headers=HEADERS,
    )


async def close_http_client() -> None:
    """Close the shared HTTP client. Call once from post_shutdown."""
    global _client
    if _client:
        await _client.aclose()
        _client = None


# ── API methods ──────────────────────────────────────────────────────────


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
    )
    response.raise_for_status()
    return response.json()


async def check_admin_access(telegram_id: int) -> dict:
    """Check if user has super-admin access via GET /api/bot/users/{id}/admin-access."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/users/{telegram_id}/admin-access",
    )
    response.raise_for_status()
    return response.json()


async def get_inactive_users(days: int = 7) -> dict:
    """Get inactive users via GET /api/bot/inactive-users."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/inactive-users",
        params={"days": days},
    )
    response.raise_for_status()
    return response.json()


async def get_streaks_at_risk() -> dict:
    """Users with a live streak but no check-in today, via GET /api/bot/streaks-at-risk."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/streaks-at-risk",
    )
    response.raise_for_status()
    return response.json()


async def mark_reengagement_sent(telegram_id: int) -> dict:
    """Mark re-engagement message sent via POST /api/bot/users/{id}/reengagement-sent."""
    client = get_http_client()
    response = await client.post(
        f"{BACKEND_URL}/api/bot/users/{telegram_id}/reengagement-sent",
    )
    response.raise_for_status()
    return response.json()


async def get_staff_events(telegram_id: int) -> dict:
    """Ended events this user is designated staff for, via GET /api/bot/staff-events."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/staff-events",
        params={"telegram_id": telegram_id},
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
    )
    response.raise_for_status()
    return response.json()


async def get_circle_digests() -> dict:
    """Weekly digest data via GET /api/bot/circle-digests."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/circle-digests",
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


# ── WS14: engagement digest push ─────────────────────────────────────────

async def get_engagement_digest(since_hours: int = 6) -> dict:
    """Users with unread push-worthy notifications via GET /api/bot/engagement-digest."""
    client = get_http_client()
    response = await client.get(
        f"{BACKEND_URL}/api/bot/engagement-digest",
        params={"since_hours": since_hours},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


async def mark_engagement_push_sent(telegram_id: int) -> dict:
    """Mark engagement notifications as push-sent via POST /api/bot/users/{id}/engagement-push-sent."""
    client = get_http_client()
    response = await client.post(
        f"{BACKEND_URL}/api/bot/users/{telegram_id}/engagement-push-sent",
    )
    response.raise_for_status()
    return response.json()
