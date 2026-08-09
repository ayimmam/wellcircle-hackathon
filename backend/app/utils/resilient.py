"""Shared defensive-section helper for aggregate endpoints (home bootstrap,
the For You feed) that run several independent DB reads in one call.
Postgres aborts the whole transaction on an error, so without this the first
failed section would take every later one with it — each section instead
degrades to its fallback and the request still returns."""
from app.utils.logger import get_logger

logger = get_logger(__name__)


def section(db, name, fn, fallback):
    try:
        return fn()
    except Exception:
        logger.exception("bootstrap section %s failed", name)
        db.rollback()
        return fallback
