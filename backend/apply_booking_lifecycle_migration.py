"""Apply Alembic 024's schema idempotently before deploying booking/reminder code.

Run from backend/: python apply_booking_lifecycle_migration.py
DATABASE_URL comes from the environment or the local .env. All statements run
in one transaction; errors roll back and cause a nonzero exit.
"""
import os

import psycopg2
from dotenv import load_dotenv

from app.booking_lifecycle_schema import BOOKING_LIFECYCLE_STATEMENTS


def main():
    load_dotenv()
    with psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL lock_timeout = '5s'")
            cur.execute("SET LOCAL statement_timeout = '60s'")
            cur.execute("SET LOCAL search_path = public")
            for statement in BOOKING_LIFECYCLE_STATEMENTS:
                cur.execute(statement)
    print("Booking lifecycle and reminder schema applied successfully.")


if __name__ == "__main__":
    main()
