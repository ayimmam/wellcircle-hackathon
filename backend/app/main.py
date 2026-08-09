"""
Well Circle — FastAPI application entry point.
Telegram Mini App for wellness providers and communities in Ethiopia.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth, providers, communities, bookings, payments, users, circles, posts,
    products, events, challenges, notifications, subscriptions, ranks, feedback,
    followers, maintenance, strava, trainer, uploads, home, feed,
)
from app.api.admin import router as admin_router
from app.api.bot import router as bot_router
from app.config import settings
from app.utils.logger import get_logger
from app.utils.error_handlers import register_error_handling

logger = get_logger("wellcircle.app")

# Vercel freezes serverless functions between requests, so a background
# scheduler thread can't run reliably there and just slows cold starts.
# Run it only on long-lived hosts (Render/local).
IS_SERVERLESS = bool(os.getenv("VERCEL"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Well Circle API starting (env=%s, serverless=%s)", settings.ENVIRONMENT, IS_SERVERLESS)

    # Start background scheduler (points decay) — skip on serverless.
    scheduler = None
    if not IS_SERVERLESS:
        try:
            from app.services.scheduler import start_scheduler
            scheduler = start_scheduler()
        except Exception:
            logger.exception("Scheduler failed to start")
    else:
        logger.info("Scheduler disabled on serverless host; run decay via cron/Render instead")

    # Create tables & ensure columns exist across environments
    try:
        from app.database import engine, Base
        from app.database_schema import ensure_db_schema
        from app.models import (  # noqa: ensure models loaded
            User, Provider, ProviderInvite, Product, UserRedemption,
            AdminNotification, Community, Booking, Circle, Post,
        )
        if settings.ENVIRONMENT == "development":
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables ensured")
        ensure_db_schema(engine)
    except Exception:
        logger.exception("DB table and column migration check skipped")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
    logger.info("Well Circle API shutting down")


app = FastAPI(
    title="Well Circle API",
    description="Telegram Mini App — Wellness Marketplace + Community for Ethiopia",
    version="v1.1",
    lifespan=lifespan,
)

# CORS
origins = settings.CORS_ORIGINS.copy()
if settings.FRONTEND_URL and settings.FRONTEND_URL not in origins:
    origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Allow Vercel preview/production frontends (e.g. /admin deep links from Telegram)
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Graceful error responses + request timing/logging
register_error_handling(app)

# --- API Routers ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(providers.router, prefix="/api/providers", tags=["Providers"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(communities.router, prefix="/api/communities", tags=["Communities"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(circles.router, prefix="/api/circles", tags=["Circles"])
app.include_router(posts.router, prefix="/api/posts", tags=["Posts"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(bot_router, prefix="/api/bot", tags=["Bot"])

# Phase 3
app.include_router(events.router, prefix="/api", tags=["Events"])
app.include_router(challenges.router, prefix="/api", tags=["Challenges"])
app.include_router(notifications.router, prefix="/api", tags=["Notifications"])
app.include_router(subscriptions.router, prefix="/api", tags=["Subscriptions"])
app.include_router(ranks.router, prefix="/api", tags=["Ranks"])
app.include_router(feedback.router, prefix="/api", tags=["Feedback"])
app.include_router(followers.router, prefix="/api/users", tags=["Users"])
app.include_router(trainer.router, prefix="/api", tags=["Trainer Verification"])
app.include_router(strava.router, prefix="/api/strava", tags=["Strava"])
app.include_router(uploads.router, prefix="/api", tags=["Uploads"])
app.include_router(home.router, prefix="/api", tags=["Home"])
app.include_router(feed.router, prefix="/api/feed", tags=["Feed"])
app.include_router(maintenance.router, prefix="/api", tags=["Maintenance"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Well Circle API", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
