"""Static readiness checks for the chat memory/profile migrations.

This is deliberately *not* a substitute for running PostgreSQL. It validates
the repository-side contract that can drift without a database:

* the Alembic revision chain and downgrade path;
* the canonical SQL files referenced by the revisions;
* the owner-aware RPC argument shape used by ``memory.py``;
* RLS/privilege hardening and the profile consent columns.

Run from the repository root:

    python chatbot/migration_check.py

The real database checks (existing table shape, RLS policies, RPC behaviour,
concurrency) still require a disposable PostgreSQL database.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
VERSIONS = ROOT / "backend" / "alembic" / "versions"
SQL_DIR = ROOT / "backend" / "supabase" / "migrations"
MEMORY_PY = ROOT / "chatbot" / "memory.py"

PHASE1_SIGNATURE = (
    "public.append_chat_turn(\n"
    "    p_session_id text,\n"
    "    p_user_content text,\n"
    "    p_assistant_content text,\n"
    "    p_expected_updated_at timestamptz,\n"
    "    p_max_messages integer,\n"
    "    p_inactivity_hours double precision\n"
    ")"
)
PHASE2_SIGNATURE = (
    "public.append_chat_turn(\n"
    "    p_session_id text,\n"
    "    p_owner_type text,\n"
    "    p_owner_id text,\n"
    "    p_user_content text,\n"
    "    p_assistant_content text,\n"
    "    p_expected_updated_at timestamptz,\n"
    "    p_max_messages integer,\n"
    "    p_inactivity_hours double precision\n"
    ")"
)
PHASE1_SQL_DROP_SIGNATURE = (
    "public.append_chat_turn(\n"
    "    text, text, text, timestamptz, integer, double precision\n"
    ")"
)
PHASE1_DROP_SIGNATURE = (
    "public.append_chat_turn(\n"
    "            text, text, text, timestamptz, integer, double precision\n"
    "        )"
)
PHASE2_DROP_SIGNATURE = (
    "public.append_chat_turn(\n"
    "            text, text, text, text, text, timestamptz, integer, double precision\n"
    "        )"
)
RPC_PARAMS = (
    "p_session_id",
    "p_owner_type",
    "p_owner_id",
    "p_user_content",
    "p_assistant_content",
    "p_expected_updated_at",
    "p_max_messages",
    "p_inactivity_hours",
)


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _version_file(prefix: str) -> Path:
    matches = sorted(VERSIONS.glob(f"{prefix}_*.py"))
    if len(matches) != 1:
        raise FileNotFoundError(f"expected exactly one {prefix}_*.py revision")
    return matches[0]


def _has_revision(text: str, revision: str) -> bool:
    return bool(re.search(rf'^revision\s*=\s*"{re.escape(revision)}"', text, re.M))


def _has_down_revision(text: str, revision: str) -> bool:
    return bool(
        re.search(rf'^down_revision\s*=\s*"{re.escape(revision)}"', text, re.M)
    )


def run_checks() -> list[CheckResult]:
    results: list[CheckResult] = []

    def add(name: str, condition: bool, detail: str = "") -> None:
        results.append(CheckResult(name=name, passed=bool(condition), detail=detail))

    try:
        versions = {number: _read(_version_file(number)) for number in ("027", "028", "029")}
        sql27 = _read(SQL_DIR / "027_chat_memory_append.sql")
        sql28 = _read(SQL_DIR / "028_chat_memory_ownership.sql")
        sql29 = _read(SQL_DIR / "029_chat_profile.sql")
        memory_py = _read(MEMORY_PY)
    except (OSError, FileNotFoundError) as exc:
        return [CheckResult(name="files present", passed=False, detail=str(exc))]

    add(
        "Alembic 027 follows 026",
        _has_revision(versions["027"], "027")
        and _has_down_revision(versions["027"], "026"),
    )
    add(
        "Alembic 028 follows 027",
        _has_revision(versions["028"], "028")
        and _has_down_revision(versions["028"], "027"),
    )
    add(
        "Alembic 029 follows 028",
        _has_revision(versions["029"], "029")
        and _has_down_revision(versions["029"], "028"),
    )

    for number, sql in (("027", sql27), ("028", sql28), ("029", sql29)):
        add(
            f"SQL {number} has balanced dollar quotes",
            sql.count("$$") % 2 == 0,
            f"count={sql.count('$$')}",
        )

    add("027 defines the Phase 1 RPC", PHASE1_SIGNATURE in sql27)
    add(
        "027 locks the row before expiry/trim",
        "FOR UPDATE" in sql27
        and "clock_timestamp()" in sql27
        and "jsonb_array_length(v_messages) > p_max_messages" in sql27,
    )
    add(
        "027 does not expose the RPC to browser roles",
        "REVOKE ALL ON FUNCTION public.append_chat_turn(" in sql27
        and "TO service_role" in sql27,
    )

    add(
        "028 adds nullable owner columns before backfill",
        "ADD COLUMN IF NOT EXISTS owner_type text" in sql28
        and "ADD COLUMN IF NOT EXISTS owner_id text" in sql28,
    )
    add(
        "028 preserves old rows as inaccessible legacy rows",
        "SET owner_type = 'legacy'" in sql28
        and "owner_id = 'legacy'" in sql28
        and "ALTER COLUMN owner_type SET NOT NULL" in sql28
        and "ALTER COLUMN owner_id SET NOT NULL" in sql28,
    )
    add(
        "028 constrains owner types",
        "chat_memory_owner_type_check" in sql28
        and "owner_type IN ('user', 'anonymous', 'legacy')" in sql28,
    )
    add(
        "028 hardens table access",
        "ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY" in sql28
        and "REVOKE ALL ON TABLE public.chat_memory FROM PUBLIC" in sql28
        and "REVOKE ALL ON TABLE public.chat_memory FROM anon" in sql28
        and "REVOKE ALL ON TABLE public.chat_memory FROM authenticated" in sql28
        and "GRANT SELECT, INSERT, UPDATE, DELETE" in sql28,
    )
    add(
        "028 retires the Phase 1 RPC signature",
        "DROP FUNCTION IF EXISTS public.append_chat_turn(" in sql28
        and PHASE1_SQL_DROP_SIGNATURE in sql28,
    )
    add("028 defines the owner-aware RPC", PHASE2_SIGNATURE in sql28)
    add(
        "028 rechecks ownership after the row lock",
        "IF v_owner_type IS DISTINCT FROM p_owner_type" in sql28
        and "OR v_owner_id IS DISTINCT FROM p_owner_id" in sql28
        and "FOR UPDATE" in sql28
        and "USING ERRCODE = 'P0001'" in sql28,
    )
    add(
        "028 makes the update owner-scoped",
        "AND cm.owner_type = p_owner_type" in sql28
        and "AND cm.owner_id = p_owner_id" in sql28
        and "IF NOT FOUND" in sql28,
    )
    add(
        "028 does not expose the owner-aware RPC to browser roles",
        "REVOKE ALL ON FUNCTION public.append_chat_turn(" in sql28
        and "TO service_role" in sql28,
    )

    add(
        "029 creates the profile table with an owner key",
        "CREATE TABLE IF NOT EXISTS public.chat_profile" in sql29
        and "PRIMARY KEY (owner_type, owner_id)" in sql29,
    )
    add(
        "029 stores consent separately from preferences",
        "preferences_consent_at timestamptz" in sql29
        and "preferences jsonb NOT NULL DEFAULT '{}'::jsonb" in sql29,
    )
    add(
        "029 validates profile values",
        "chat_profile_owner_type_check" in sql29
        and "chat_profile_display_name_length_check" in sql29
        and "chat_profile_preferences_object_check" in sql29,
    )
    add(
        "029 hardens profile access",
        "ALTER TABLE public.chat_profile ENABLE ROW LEVEL SECURITY" in sql29
        and "REVOKE ALL ON TABLE public.chat_profile FROM PUBLIC" in sql29
        and "REVOKE ALL ON TABLE public.chat_profile FROM anon" in sql29
        and "REVOKE ALL ON TABLE public.chat_profile FROM authenticated" in sql29
        and "GRANT SELECT, INSERT, UPDATE, DELETE" in sql29,
    )

    add(
        "027 downgrade removes the Phase 1 RPC",
        "DROP FUNCTION IF EXISTS public.append_chat_turn(" in versions["027"]
        and PHASE1_DROP_SIGNATURE in versions["027"]
        and "NOTIFY pgrst" in versions["027"],
    )
    add(
        "028 downgrade restores the Phase 1 RPC",
        PHASE2_DROP_SIGNATURE in versions["028"]
        and "DROP COLUMN IF EXISTS owner_id" in versions["028"]
        and "DROP COLUMN IF EXISTS owner_type" in versions["028"]
        and "_PHASE1_SQL.read_text" in versions["028"],
    )
    add(
        "029 downgrade drops the profile and refreshes PostgREST",
        'DROP TABLE IF EXISTS public.chat_profile' in versions["029"]
        and "NOTIFY pgrst" in versions["029"],
    )

    for param in RPC_PARAMS:
        add(
            f"memory.py sends {param}",
            f'"{param}"' in memory_py,
        )

    return results


def main() -> int:
    results = run_checks()
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        suffix = f" ({result.detail})" if result.detail else ""
        print(f"[{status}] {result.name}{suffix}")
    passed = sum(result.passed for result in results)
    print(f"\n{passed}/{len(results)} static migration checks passed")
    print(
        "Static checks only: run the SQL against a disposable PostgreSQL "
        "database before applying to a shared environment."
    )
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
