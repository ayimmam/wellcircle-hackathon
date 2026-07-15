"""Database configuration and session management for Supabase PostgreSQL."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

# Supabase requires SSL for external connections
connect_args = {}
if "supabase" in settings.DATABASE_URL:
    connect_args["sslmode"] = "require"

# Supabase's pooler (Supavisor, transaction mode on :6543 — see DATABASE_URL)
# already multiplexes connections to Postgres. On Vercel, each request can
# land on a fresh serverless instance, each with its own module-level engine;
# a client-side pool sized for a long-lived process (5 + 10 overflow) would
# pile up to 15 connections per instance on top of Supavisor's own pool and
# exhaust it under concurrent traffic — exactly the "surge registrations"
# scenario a launch produces. NullPool hands one connection straight through
# per request instead, leaving pooling to Supavisor where it belongs.
# Off Vercel (local dev, Render — a persistent process), the normal
# client-side pool is correct and beneficial, so keep it there.
if os.getenv("VERCEL") or settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        poolclass=NullPool,
        connect_args=connect_args,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
