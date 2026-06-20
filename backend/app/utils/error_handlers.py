"""Centralised error handling and request observability.

Goal: users see short, calm, non-technical messages; operators get the full
story (method, path, status, duration, traceback, correlation id) in the logs.

Call ``register_error_handling(app)`` once during app construction.
"""

import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.utils.logger import get_logger

logger = get_logger("wellcircle.request")

# Shown when something genuinely unexpected breaks. Friendly, blame-free, and
# carries an id the user can quote to support so we can find the real error.
GENERIC_USER_MESSAGE = (
    "Something went wrong on our side. Please try again in a moment."
)


def _error_id() -> str:
    return uuid.uuid4().hex[:12]


def register_error_handling(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Time every request and log slow / failed ones for free-tier triage."""
        start = time.perf_counter()
        request_id = _error_id()
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            # Unhandled errors are turned into responses by the handler below;
            # this branch only runs if something escapes even that, so re-raise.
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id

        log = logger.info
        if response.status_code >= 500:
            log = logger.error
        elif response.status_code >= 400 or duration_ms > 1500:
            # 1.5s is the rough threshold where free-tier cold starts hurt UX.
            log = logger.warning
        log(
            "%s %s -> %s in %.0fms [req:%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Pass through intentional HTTP errors (401/403/404/409 ...).

        These ``detail`` strings are written by us for users, so they are safe
        to surface as-is. We still log 5xx-class ones.
        """
        request_id = getattr(request.state, "request_id", None)
        if exc.status_code >= 500:
            logger.error(
                "HTTPException %s on %s %s: %s [req:%s]",
                exc.status_code,
                request.method,
                request.url.path,
                exc.detail,
                request_id,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "request_id": request_id},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Bad client input. Log the specifics, return a simple summary."""
        request_id = getattr(request.state, "request_id", None)
        logger.warning(
            "Validation error on %s %s: %s [req:%s]",
            request.method,
            request.url.path,
            exc.errors(),
            request_id,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Some of the information sent was invalid. Please check and try again.",
                "request_id": request_id,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Catch-all: never leak a stack trace to the client.

        Full traceback + correlation id go to the logs; the user gets a calm,
        generic message tagged with the same id for support follow-up.
        """
        request_id = getattr(request.state, "request_id", None) or _error_id()
        logger.exception(
            "Unhandled error on %s %s [req:%s]",
            request.method,
            request.url.path,
            request_id,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": GENERIC_USER_MESSAGE, "request_id": request_id},
        )
