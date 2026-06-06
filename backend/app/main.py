"""
Well Circle — FastAPI application entry point.
Telegram Mini App for wellness providers and communities in Ethiopia.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, providers, communities, bookings, payments, users
from app.api.admin import router as admin_router
from app.api.bot import router as bot_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🟢 Well Circle API starting...")

    # Start background scheduler (points decay)
    scheduler = None
    try:
        from app.services.scheduler import start_scheduler
        scheduler = start_scheduler()
    except Exception as e:
        print(f"⚠️  Scheduler failed to start: {e}")

    # Create tables if they don't exist (dev convenience)
    if settings.ENVIRONMENT == "development":
        try:
            from app.database import engine, Base
            from app.models import User, Provider, Community, Booking  # noqa: ensure models loaded
            Base.metadata.create_all(bind=engine)
            print("📦 Database tables ensured")
        except Exception as e:
            print(f"⚠️  DB table creation skipped: {e}")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
    print("🔴 Well Circle API shutting down...")


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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Routers ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(providers.router, prefix="/api/providers", tags=["Providers"])
app.include_router(communities.router, prefix="/api/communities", tags=["Communities"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(bot_router, prefix="/api/bot", tags=["Bot"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Well Circle API", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
