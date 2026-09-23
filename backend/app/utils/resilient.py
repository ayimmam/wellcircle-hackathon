"""Shared defensive-section helper for aggregate endpoints (home bootstrap,
the For You feed) that run several independent DB reads in one call.
Postgres aborts the whole transaction on an error, so without this the first
failed section would take every later one with it — each section instead
degrades to its fallback and the request still returns."""
from sqlalchemy.exc import ProgrammingError

from app.utils.logger import get_logger

logger = get_logger(__name__)


def section(db, name, fn, fallback):
    try:
        return fn()
    except ProgrammingError as exc:
        # A missing column or table is a deploy that ran ahead of its
        # migration, not a transient fault — and degrading it to an empty
        # section hides that completely. The For You feed once went silently
        # post-only for exactly this reason: a model gained three columns,
        # the migration had not been applied, and every section that joined
        # `providers` returned its empty fallback instead of erroring.
        #
        # Still degrade (one section must not take the request down), but say
        # plainly what it is so the log names the cause rather than a generic
        # traceback.
        logger.error(
            "section %s failed on a SCHEMA error — the database is likely behind "
            "the code. Run the pending migration. Detail: %s",
            name, exc.orig if hasattr(exc, "orig") else exc,
        )
        db.rollback()
        return fallback
    except Exception:
        logger.exception("bootstrap section %s failed", name)
        db.rollback()
        return fallback
