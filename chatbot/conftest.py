"""Shared test isolation.

Importing the service is enough to pick up live credentials from the developer's
environment. Every test gets a clean cache and no Supabase client unless it
explicitly installs a fake, so a local `.env` can never reach the real project.
"""

import os

import pytest

# Set deterministic test-only signing keys before importing config/auth/main.
os.environ["JWT_SECRET"] = "test-only-user-jwt-secret"
os.environ["ANON_SESSION_SECRET"] = "test-only-anonymous-session-secret"
os.environ["JWT_ALGORITHM"] = "HS256"

import main
import memory


@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    main._provider_cache.update(data=None, source=None, ts=0.0)
    main._event_cache.update(data=None, source=None, ts=0.0)
    memory._cache_clear()
    monkeypatch.setattr(main, "supabase_client", None)
    yield
    memory._cache_clear()
