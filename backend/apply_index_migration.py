"""Idempotent hot-path index migration (mirror of alembic 013) for Supabase.

Each index backs a query the Mini App runs on app open or on a poll. Created
CONCURRENTLY so this is safe to run against the live database.

Run: cd backend && python apply_index_migration.py
"""
import importlib.util
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

MIGRATION = Path(__file__).parent / "alembic" / "versions" / "013_hot_path_indexes.py"


def load_indexes():
    """Read the index list straight out of the Alembic revision.

    The revision module can't be imported by name (it starts with a digit), but
    loading it by path keeps this script and the migration from drifting apart.
    """
    spec = importlib.util.spec_from_file_location("_migration_013", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.INDEXES


def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True  # CONCURRENTLY cannot run inside a transaction
    cur = conn.cursor()

    for name, table, columns in load_indexes():
        try:
            cur.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} {columns}")
            print(f"Applied: {name}")
        except Exception as e:
            print(f"Skipped {name}: {e}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
