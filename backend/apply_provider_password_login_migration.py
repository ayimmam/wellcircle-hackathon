"""Idempotent provider-password-login migration (mirror of alembic 015) for
Supabase. Run: cd backend && python apply_provider_password_login_migration.py
"""
import os
import psycopg2
from dotenv import load_dotenv


def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    statements = [
        ("users.login_username",
         "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_username VARCHAR(100);"),
        ("users.password_hash",
         "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);"),
        ("users.login_username unique",
         "ALTER TABLE users ADD CONSTRAINT uq_users_login_username UNIQUE (login_username);"),
        ("users.login_username index",
         "CREATE INDEX IF NOT EXISTS ix_users_login_username ON users (login_username);"),
    ]
    for label, sql in statements:
        try:
            cur.execute(sql)
            print(f"Applied: {label}")
        except Exception as e:
            print(f"Skipped {label}: {e}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
