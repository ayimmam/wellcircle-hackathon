"""One-off: create a dedicated username/password provider-portal login for
every provider that doesn't already have one (everything except Boston Day
Spa, which already has Aman + Anteneh — see create_boston_provider_login.py
/ create_anteneh_provider_login.py).

Why dedicated accounts instead of reusing existing owner_user_id: several
"coming soon" providers currently share a seed/demo owner across multiple
providers (e.g. one user owns 5 different providers). get_provider_by_owner()
does a `.first()` lookup, so a shared owner would only ever see ONE of their
providers on the dashboard. Giving each provider its own login account fixes
that and matches the pattern already in production for Boston Day Spa.

Sets points_balance=0, health_app_connected=FALSE, is_super_admin=FALSE
explicitly on insert — raw SQL inserts bypass SQLAlchemy's Python-side
column defaults, and leaving those NULL is what caused the /providers/me
500 crash fixed for Boston Day Spa.

Idempotent — safe to re-run; re-running rotates the password for any
provider whose login user already exists and prints it again.

Usage: cd backend && python create_all_provider_logins.py
"""
import os
import re
import secrets
import string
import sys
import uuid

import psycopg2
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
from app.utils.password import hash_password  # noqa: E402

EXCLUDE_PROVIDER_NAMES = {"boston day spa"}


def generate_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def slug_username(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name)
    return "".join(w.capitalize() for w in words)


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id, name, owner_user_id FROM providers ORDER BY name")
    providers = cur.fetchall()

    results = []
    next_synthetic_id = -100  # stay well clear of -1/-2 already used by Boston Day Spa

    for provider_id, provider_name, owner_user_id in providers:
        if provider_name.strip().lower() in EXCLUDE_PROVIDER_NAMES:
            continue

        login_username = slug_username(provider_name)
        password = generate_password()
        password_hash = hash_password(password)

        cur.execute("SELECT id FROM users WHERE login_username = %s", (login_username,))
        existing = cur.fetchone()

        if existing:
            user_id = existing[0]
            cur.execute(
                """
                UPDATE users
                SET password_hash = %s, is_provider = TRUE,
                    points_balance = COALESCE(points_balance, 0),
                    health_app_connected = COALESCE(health_app_connected, FALSE),
                    is_super_admin = COALESCE(is_super_admin, FALSE)
                WHERE id = %s
                """,
                (password_hash, user_id),
            )
        else:
            user_id = uuid.uuid4()
            synthetic_telegram_id = next_synthetic_id
            next_synthetic_id -= 1
            cur.execute(
                """
                INSERT INTO users (
                    id, telegram_id, name, login_username, password_hash,
                    is_provider, is_onboarded, points_balance, health_app_connected, is_super_admin
                )
                VALUES (%s, %s, %s, %s, %s, TRUE, TRUE, 0, FALSE, FALSE)
                """,
                (str(user_id), synthetic_telegram_id, f"{provider_name} (admin)", login_username, password_hash),
            )

        cur.execute("UPDATE providers SET owner_user_id = %s WHERE id = %s", (str(user_id), provider_id))

        results.append((provider_name, login_username, password))

    cur.close()
    conn.close()

    print(f"\nProvisioned {len(results)} provider portal logins:\n")
    for provider_name, login_username, password in results:
        print(f"  {provider_name:30s} username={login_username:25s} password={password}")
    print("\nSave these now — passwords are not stored anywhere in plaintext.")


if __name__ == "__main__":
    main()
