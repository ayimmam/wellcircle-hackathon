"""Dev-only check: measure GET /api/home/bootstrap's serialized size against
the Phase 2 "instant open" budget (docs/FEATURE_PLAN_FOR_YOU_AND_PILOT_FOCUS.md).

`frontend/src/api/cache.js` only persists an entry to localStorage when it is
under 192 KB — a bigger payload is memory-only and gone the moment Telegram
tears the WebView down, which defeats the whole point of this phase. We treat
150 KB as the working ceiling to leave headroom for response-envelope
overhead and future growth (e.g. Phase 4's feed page).

Usage: cd backend && DATABASE_URL=... python check_bootstrap_payload_size.py [telegram_id]
Requires a live DATABASE_URL — this measures real data, not a fixture.
"""
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

CEILING_BYTES = 150 * 1024
PERSIST_CAP_BYTES = 192 * 1024


def main():
    from sqlalchemy.orm import sessionmaker
    from app.database import engine
    from app.models.user import User
    from app.api.home import home_bootstrap
    import asyncio

    telegram_id = int(sys.argv[1]) if len(sys.argv) > 1 else None

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        user = (
            db.query(User).filter(User.telegram_id == telegram_id).first()
            if telegram_id else db.query(User).first()
        )
        if not user:
            print("No user found — pass a telegram_id or seed a user first.")
            return

        payload = asyncio.run(home_bootstrap(user=user, db=db))
        serialized = json.dumps(payload, default=str)
        size = len(serialized.encode("utf-8"))

        print(f"/api/home/bootstrap for user {user.telegram_id}: {size:,} bytes "
              f"({size / 1024:.1f} KB)")
        print(f"  Working ceiling: {CEILING_BYTES / 1024:.0f} KB")
        print(f"  Hard persist cap (cache.js MAX_PERSISTED_BYTES): {PERSIST_CAP_BYTES / 1024:.0f} KB")

        if size > PERSIST_CAP_BYTES:
            print("  ❌ FAILS the persist cap — this entry will be memory-only "
                  "and lost on WebView teardown. Trim the payload.")
            sys.exit(1)
        elif size > CEILING_BYTES:
            print("  ⚠️  Over the working ceiling — trim before adding more sections.")
        else:
            print("  ✅ Within budget.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
