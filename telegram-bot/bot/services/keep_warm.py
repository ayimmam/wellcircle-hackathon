"""Keep the backend's serverless functions warm.

Vercel evicts an idle function in a few minutes, and the next request pays a
cold start — several seconds, on top of a fresh connection to Supabase. The bot
is the one component that runs continuously (Railway, always-on polling), so it
is the natural place to hold the door open.

`/health` touches no database and returns a tiny payload, so this costs almost
nothing on either side of the free tier.
"""

import logging
import os

import httpx
from telegram.ext import ContextTypes

from bot.config import BACKEND_URL

logger = logging.getLogger(__name__)

# Comfortably inside Vercel's idle-eviction window without being chatty.
KEEP_WARM_INTERVAL_SECONDS = int(os.getenv("KEEP_WARM_INTERVAL_SECONDS", "270"))
KEEP_WARM_ENABLED = os.getenv("KEEP_WARM_ENABLED", "true").lower() not in ("false", "0", "no")


async def ping_backend(_context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job callback: one cheap GET so the function stays resident."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(f"{BACKEND_URL}/health")
        # Debug, not info: this fires every few minutes and would otherwise
        # bury everything else in the Railway logs.
        logger.debug("Keep-warm ping → %s", response.status_code)
    except Exception as e:
        # A missed ping just means the next user pays a cold start; never let
        # it surface as an unhandled job error.
        logger.warning("Keep-warm ping failed: %s", e)
