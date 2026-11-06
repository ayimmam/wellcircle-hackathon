#!/usr/bin/env python3
"""Read-only duplicate-account reconciliation planner (Phase D).

Usage (local/disposable database only by default):

    cd backend
    python reconcile_accounts_dry_run.py \
        --canonical 11111111-1111-1111-1111-111111111111 \
        --source    22222222-2222-2222-2222-222222222222

The script only issues SELECTs. It refuses non-local databases unless
``RECONCILIATION_ALLOW_REMOTE=1`` is set explicitly, so it cannot be aimed at a
shared/production project by accident. It never merges, deletes or commits.

The same plan is available to super admins through
``POST /api/admin/accounts/reconciliation/dry-run``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from uuid import UUID

from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.services.account_reconciliation import (
    ReconciliationError,
    build_reconciliation_plan,
)

LOCAL_HOSTS = {"", "localhost", "127.0.0.1", "::1"}


def _uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except (ValueError, AttributeError) as exc:
        raise argparse.ArgumentTypeError("must be a UUID") from exc


def _assert_local_target() -> None:
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() == "sqlite":
        return
    if (url.host or "") in LOCAL_HOSTS:
        return
    if os.getenv("RECONCILIATION_ALLOW_REMOTE") == "1":
        return
    sys.exit(
        "Refusing a non-local database target. Use a disposable database, or "
        "set RECONCILIATION_ALLOW_REMOTE=1 for an explicitly approved read-only run."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only account reconciliation plan")
    parser.add_argument("--canonical", required=True, type=_uuid, help="canonical users.id")
    parser.add_argument("--source", required=True, type=_uuid, help="source users.id")
    parser.add_argument("--pretty", action="store_true", help="pretty-print JSON")
    args = parser.parse_args()

    _assert_local_target()
    with SessionLocal() as db:
        try:
            plan = build_reconciliation_plan(db, args.canonical, args.source)
        except ReconciliationError as exc:
            print(json.dumps({"error": exc.code, "message": exc.message}), file=sys.stderr)
            return 2
        finally:
            # The planner only SELECTs; rollback is belt-and-braces.
            db.rollback()

    print(json.dumps(plan, indent=2 if args.pretty else None, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
