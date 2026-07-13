"""API client — calls Well Circle backend endpoints."""

import httpx
from typing import Optional

from bot.config import BACKEND_URL, BOT_API_KEY

HEADERS = {
    "Content-Type": "application/json",
    "X-Bot-API-Key": BOT_API_KEY,
}


async def register_user(
    telegram_id: int,
    telegram_handle: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> dict:
    """Register a user via POST /api/bot/register."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.post(
            f"{BACKEND_URL}/api/bot/register",
            json={
                "telegram_id": telegram_id,
                "telegram_handle": telegram_handle,
                "photo_url": photo_url,
            },
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def check_admin_access(telegram_id: int) -> dict:
    """Check if user has super-admin access via GET /api/bot/users/{id}/admin-access."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/users/{telegram_id}/admin-access",
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def get_inactive_users(days: int = 7) -> dict:
    """Get inactive users via GET /api/bot/inactive-users."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": days},
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def get_streaks_at_risk() -> dict:
    """Users with a live streak but no check-in today, via GET /api/bot/streaks-at-risk."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/streaks-at-risk",
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def mark_reengagement_sent(telegram_id: int) -> dict:
    """Mark re-engagement message sent via POST /api/bot/users/{id}/reengagement-sent."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.post(
            f"{BACKEND_URL}/api/bot/users/{telegram_id}/reengagement-sent",
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def get_staff_events(telegram_id: int) -> dict:
    """Ended events this user is designated staff for, via GET /api/bot/staff-events."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/staff-events",
            params={"telegram_id": telegram_id},
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def submit_evidence(telegram_id: int, event_id: str, telegram_file_id: str) -> dict:
    """Submit photo evidence via POST /api/bot/evidence."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.post(
            f"{BACKEND_URL}/api/bot/evidence",
            json={
                "telegram_id": telegram_id,
                "event_id": event_id,
                "telegram_file_id": telegram_file_id,
            },
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()


async def get_circle_digests() -> dict:
    """Weekly digest data via GET /api/bot/circle-digests."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/circle-digests",
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()
