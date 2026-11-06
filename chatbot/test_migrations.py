"""Static migration-contract tests.

These do not connect to PostgreSQL. They catch revision-chain drift, mismatched
RPC signatures, and accidental removal of the RLS/privilege or downgrade
statements before the SQL is applied to a real database.
"""

from migration_check import run_checks


def test_static_migration_checks_pass():
    results = run_checks()
    failures = [
        (result.name, result.detail) for result in results if not result.passed
    ]
    assert not failures
