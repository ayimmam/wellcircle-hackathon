"""PBKDF2 password hashing for the provider-portal username/password login.

Stdlib-only (hashlib.pbkdf2_hmac) — avoids adding a bcrypt/passlib dependency
for what is currently a single alt-login path alongside the Telegram widget.
"""
import hashlib
import hmac
import os

_ITERATIONS = 260_000
_ALGORITHM = "sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(_ALGORITHM, password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2_{_ALGORITHM}${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored.split("$")
        iterations = int(iterations)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, AttributeError):
        return False
    algo_name = algorithm.removeprefix("pbkdf2_")
    candidate = hashlib.pbkdf2_hmac(algo_name, password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(candidate, expected)
