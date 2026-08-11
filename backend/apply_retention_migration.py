"""Apply retention-sprint migrations idempotently against Supabase.

Adds users.longest_streak (personal-best streak tracking behind the
comeback-bonus / "reward getting better" logic in checkin_community).
"""

import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

QUERIES = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0",
]


def main() -> None:
    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for query in QUERIES:
        try:
            cur.execute(query)
            print("OK:", query[:80])
        except Exception as exc:
            print("FAIL:", query[:80], "->", exc)

    cur.close()
    conn.close()
    print("Retention migration applied.")


if __name__ == "__main__":
    main()
