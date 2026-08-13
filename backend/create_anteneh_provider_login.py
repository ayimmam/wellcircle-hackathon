"""One-off: create (or update) the username/password login for Anteneh's
Boston Day Spa provider portal account.

Unlike create_boston_provider_login.py, this does NOT touch
providers.owner_user_id — it only provisions a login-capable user with
is_provider=TRUE, so Anteneh can authenticate but the provider's single
"owner" record stays whatever it already is (Aman).

Idempotent — safe to re-run; re-running rotates the password to a fresh
random one and prints it again.

Requires apply_provider_password_login_migration.py (or alembic 015) to
have run first, so users.login_username/password_hash exist.

Usage: cd backend && python create_anteneh_provider_login.py
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

LOGIN_USERNAME = "Anteneh"
# Synthetic negative telegram_id — real Telegram user IDs are always
# positive, so this can never collide with an actual Telegram account.
# Deterministic (not random) so re-running this script updates the same row.
SYNTHETIC_TELEGRAM_ID = -2


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
        "SELECT id, name FROM providers WHERE name ILIKE %s LIMIT 1",
        ("%boston day spa%",),
    )
    row = cur.fetchone()
    if not row:
        print("Boston Day Spa provider not found — run seed_boston_day_spa.py first.")
        return
    provider_id, provider_name = row

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
            INSERT INTO users (
                id, telegram_id, name, login_username, password_hash,
                is_provider, is_onboarded, points_balance, health_app_connected, is_super_admin
            )
            VALUES (%s, %s, %s, %s, %s, TRUE, TRUE, 0, FALSE, FALSE)
            """,
            (str(user_id), SYNTHETIC_TELEGRAM_ID, "Boston Day Spa (Anteneh)", LOGIN_USERNAME, password_hash),
        )
        print(f"Created login user {user_id} ({LOGIN_USERNAME}).")

    print(
        f"NOTE: providers.owner_user_id for {provider_name} ({provider_id}) was NOT changed. "
        "This user can authenticate via POST /api/auth/provider-login, but until the "
        "backend supports multiple admins per provider (or owner_user_id is repointed), "
        "get_current_provider only requires is_provider=TRUE, so this account WILL pass "
        "that check — however any endpoint that additionally checks "
        "Provider.owner_user_id == current_user.id will still reject it for this provider."
    )

    cur.close()
    conn.close()

    print("\nProvider portal login:")
    print(f"  Username: {LOGIN_USERNAME}")
    print(f"  Password: {password}")
    print("Save this password now — it is not stored anywhere in plaintext.")


if __name__ == "__main__":
    main()
