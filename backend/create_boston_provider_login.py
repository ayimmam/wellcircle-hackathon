"""One-off: create (or update) the username/password login for Boston Day
Spa's provider portal account and link it as that provider's owner.

Idempotent — safe to re-run; re-running rotates the password to a fresh
random one and prints it again.

Requires apply_provider_password_login_migration.py (or alembic 015) to
have run first, so users.login_username/password_hash exist.

Usage: cd backend && python create_boston_provider_login.py
"""
import os
import secrets
import string
import sys
import uuid

import psycopg2
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
from app.utils.password import hash_password  # noqa: E402

LOGIN_USERNAME = "Aman"
# Synthetic negative telegram_id — real Telegram user IDs are always
# positive, so this can never collide with an actual Telegram account.
# Deterministic (not random) so re-running this script updates the same row.
SYNTHETIC_TELEGRAM_ID = -1


def generate_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        "SELECT id, name, owner_user_id FROM providers WHERE name ILIKE %s LIMIT 1",
        ("%boston day spa%",),
    )
    row = cur.fetchone()
    if not row:
        print("Boston Day Spa provider not found — run seed_boston_day_spa.py first.")
        return
    provider_id, provider_name, owner_user_id = row

    password = generate_password()
    password_hash = hash_password(password)

    cur.execute("SELECT id FROM users WHERE login_username = %s", (LOGIN_USERNAME,))
    existing = cur.fetchone()

    if existing:
        user_id = existing[0]
        cur.execute(
            "UPDATE users SET password_hash = %s, is_provider = TRUE WHERE id = %s",
            (password_hash, user_id),
        )
        print(f"Updated existing login user {user_id} ({LOGIN_USERNAME}) with a new password.")
    else:
        user_id = uuid.uuid4()
        cur.execute(
            """
            INSERT INTO users (id, telegram_id, name, login_username, password_hash, is_provider, is_onboarded)
            VALUES (%s, %s, %s, %s, %s, TRUE, TRUE)
            """,
            (str(user_id), SYNTHETIC_TELEGRAM_ID, "Boston Day Spa (Aman)", LOGIN_USERNAME, password_hash),
        )
        print(f"Created login user {user_id} ({LOGIN_USERNAME}).")

    if owner_user_id and str(owner_user_id) != str(user_id):
        print(f"NOTE: provider already had a different owner_user_id ({owner_user_id}) — "
              "overwriting it. If that was a real Telegram-linked owner account, "
              "their widget login will stop working for this provider.")
    cur.execute("UPDATE providers SET owner_user_id = %s WHERE id = %s", (str(user_id), provider_id))
    print(f"Linked as owner of provider {provider_name} ({provider_id}).")

    cur.close()
    conn.close()

    print("\nProvider portal login:")
    print(f"  Username: {LOGIN_USERNAME}")
    print(f"  Password: {password}")
    print("Save this password now — it is not stored anywhere in plaintext.")


if __name__ == "__main__":
    main()
