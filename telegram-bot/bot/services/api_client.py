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
    async with httpx.AsyncClient(timeout=10) as client:
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


async def get_inactive_users(days: int = 7) -> dict:
    """Get inactive users via GET /api/bot/inactive-users."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": days},
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.json()
