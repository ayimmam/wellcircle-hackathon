"""Shared CORS and response security-header policy.

Kept separate from ``app.main`` so the allow-list and header contract can be
tested without starting the whole application.
"""

from __future__ import annotations

from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.config import settings


def cors_options() -> dict:
    """CORS options for the production API.

    First-party origins are explicit. Vercel previews are no longer accepted by
    a blanket ``*.vercel.app`` wildcard; a staging/preview deployment that needs
    CORS must set ``CORS_ORIGIN_REGEX`` explicitly (or add its exact origin to
    ``CORS_ORIGINS``).
    """
    return {
        "allow_origins": list(settings.cors_origins),
        "allow_origin_regex": settings.CORS_ORIGIN_REGEX or None,
        "allow_credentials": True,
        # Preserve the existing auth/chat/provider flows; these verbs are all
        # used by the application and preflights remain explicit.
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["*"],
    }


def install_cors(app) -> None:
    app.add_middleware(CORSMiddleware, **cors_options())


async def security_headers_middleware(request: Request, call_next) -> Response:
    """Apply low-risk security headers to every API response.

    The API returns JSON, so a restrictive document CSP is safe. HSTS is only
    emitted in production where the request is served over HTTPS.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    # FastAPI's Swagger/ReDoc pages load their UI from a CDN; a document CSP
    # must not break developer tooling.
    if not request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        )
    if settings.ENVIRONMENT == "production":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response
