"""Application logging configuration.

Provides a single configured logger factory so every module logs with a
consistent, parseable format. Detailed diagnostics (stack traces, request
context, error ids) are written here on the server side; user-facing responses
stay deliberately vague (see app.main exception handlers).
"""

import logging
import sys

from app.config import settings

_LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
_configured = False


def _configure_root() -> None:
    """Attach a single stdout handler to the root logger (idempotent).

    Serverless platforms (Vercel/Render) capture stdout, so a StreamHandler to
    stdout is what surfaces logs in their dashboards.
    """
    global _configured
    if _configured:
        return

    root = logging.getLogger()
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    root.setLevel(level)

    # Avoid duplicate handlers when the module is re-imported (serverless reuse).
    if not any(getattr(h, "_wellcircle", False) for h in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        handler._wellcircle = True  # type: ignore[attr-defined]
        root.addHandler(handler)

    # Tame noisy third-party loggers in production.
    if not settings.DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance."""
    _configure_root()
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    return logger
