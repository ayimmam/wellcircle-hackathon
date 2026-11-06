"""Small in-memory Supabase double used by the chatbot tests.

It implements only the `chat_memory` read and `append_chat_turn` RPC shapes the
service uses. Production code never imports this module.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import types


def _as_utc(value: object) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _copy_messages(messages: object) -> list[dict]:
    if not isinstance(messages, list):
        return []
    return [
        {"role": item["role"], "content": item["content"]}
        for item in messages
        if isinstance(item, dict)
        and item.get("role") in ("user", "assistant")
        and isinstance(item.get("content"), str)
    ]


class FakeSelect:
    def __init__(self, client):
        self.client = client
        self.session_id = None

    def eq(self, column, value):
        assert column == "session_id"
        self.session_id = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        if self.client.fail_read:
            raise RuntimeError("simulated read failure")
        row = self.client.rows.get(self.session_id)
        if row is None:
            return types.SimpleNamespace(data=[])
        return types.SimpleNamespace(
            data=[
                {
                    "owner_type": row.get("owner_type"),
                    "owner_id": row.get("owner_id"),
                    "messages": _copy_messages(row["messages"]),
                    "updated_at": row["updated_at"],
                }
            ]
        )


class FakeRpc:
    def __init__(self, client, params):
        self.client = client
        self.params = params

    def execute(self):
        if self.client.fail_write:
            raise RuntimeError("simulated write failure")
        if self.client.before_rpc is not None:
            self.client.before_rpc(self.client)

        params = self.params
        session_id = params["p_session_id"]
        owner_type = params["p_owner_type"]
        owner_id = params["p_owner_id"]
        expected = _as_utc(params.get("p_expected_updated_at"))
        max_messages = int(params["p_max_messages"])
        inactivity_hours = float(params["p_inactivity_hours"])
        now = self.client.now or datetime.now(timezone.utc)

        existing = self.client.rows.get(session_id)
        reset_applied = False
        stale_turn = False

        if existing is None:
            messages: list[dict] = []
            updated_at = now
            if expected is not None:
                stale_turn = True
        else:
            if (
                existing.get("owner_type") != owner_type
                or existing.get("owner_id") != owner_id
            ):
                raise RuntimeError("chat session ownership mismatch")
            messages = _copy_messages(existing["messages"])
            updated_at = _as_utc(existing["updated_at"])
            assert updated_at is not None
            if now - updated_at >= timedelta(hours=inactivity_hours):
                reset_applied = True
                messages = []
            elif expected is None or updated_at != expected:
                stale_turn = True
            updated_at = max(now, updated_at + timedelta(microseconds=1))

        messages = messages + [
            {"role": "user", "content": params["p_user_content"]},
            {"role": "assistant", "content": params["p_assistant_content"]},
        ]
        messages = messages[-max_messages:]

        self.client.rows[session_id] = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "messages": messages,
            "updated_at": updated_at.isoformat(),
        }
        self.client.last_rpc = dict(params)

        if self.client.malformed_rpc:
            return types.SimpleNamespace(
                data=[
                    {
                        "messages": "not-a-list",
                        "updated_at": updated_at.isoformat(),
                        "reset_applied": reset_applied,
                        "stale_turn": stale_turn,
                    }
                ]
            )

        return types.SimpleNamespace(
            data=[
                {
                    "messages": messages,
                    "updated_at": updated_at.isoformat(),
                    "reset_applied": reset_applied,
                    "stale_turn": stale_turn,
                }
            ]
        )


class FakeTable:
    def __init__(self, client):
        self.client = client

    def select(self, columns=None):
        self.client.last_select = columns
        return FakeSelect(self.client)

    def delete(self):
        self.client.last_delete_filters = None
        return FakeMemoryDelete(self.client)


class FakeMemoryDelete:
    """Deletes chat_memory rows matching every filter, like PostgREST."""

    def __init__(self, client):
        self.client = client
        self.filters = {}

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def execute(self):
        if self.client.fail_write:
            raise RuntimeError("simulated write failure")
        self.client.last_delete_filters = dict(self.filters)
        removed = []
        for key, row in list(self.client.rows.items()):
            if key != self.filters.get("session_id"):
                continue
            if row.get("owner_type") != self.filters.get("owner_type"):
                continue
            if row.get("owner_id") != self.filters.get("owner_id"):
                continue
            removed.append(
                {
                    "session_id": key,
                    "owner_type": row.get("owner_type"),
                    "owner_id": row.get("owner_id"),
                    "messages": _copy_messages(row["messages"]),
                }
            )
            self.client.rows.pop(key)
        return types.SimpleNamespace(data=removed)


class FakeProfileSelect:
    def __init__(self, client, columns):
        self.client = client
        self.columns = columns
        self.filters = {}

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        if self.client.fail_profile:
            raise RuntimeError("simulated profile failure")
        key = (self.filters.get("owner_type"), self.filters.get("owner_id"))
        row = self.client.profiles.get(key)
        if row is None:
            return types.SimpleNamespace(data=[])
        return types.SimpleNamespace(
            data=[
                {
                    "display_name": row.get("display_name"),
                    "preferences": dict(row.get("preferences") or {}),
                    "preferences_consent_at": row.get("preferences_consent_at"),
                }
            ]
        )


class FakeProfileTable:
    def __init__(self, client):
        self.client = client

    def select(self, columns=None):
        self.client.last_profile_select = columns
        return FakeProfileSelect(self.client, columns)

    def upsert(self, payload, on_conflict=None):
        self.client.last_profile_upsert = {
            "payload": dict(payload),
            "on_conflict": on_conflict,
        }
        return FakeProfileUpsert(self.client, payload)


class FakeProfileUpsert:
    def __init__(self, client, payload):
        self.client = client
        self.payload = dict(payload)

    def execute(self):
        if self.client.fail_profile:
            raise RuntimeError("simulated profile failure")
        key = (self.payload["owner_type"], self.payload["owner_id"])
        existing = self.client.profiles.get(key, {})
        merged = {**existing, **self.payload}
        self.client.profiles[key] = merged
        return types.SimpleNamespace(data=[merged])


class FakeUsersSelect:
    def __init__(self, client):
        self.client = client
        self.user_id = None

    def eq(self, column, value):
        assert column == "id"
        self.user_id = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        if self.client.fail_profile:
            raise RuntimeError("simulated profile failure")
        user = self.client.users.get(self.user_id)
        if user is None:
            return types.SimpleNamespace(data=[])
        return types.SimpleNamespace(data=[{"name": user.get("name")}])


class FakeUsersTable:
    def __init__(self, client):
        self.client = client

    def select(self, _columns=None):
        return FakeUsersSelect(self.client)


class FakeChatMemorySupabase:
    def __init__(
        self,
        rows=None,
        *,
        fail_read=False,
        fail_write=False,
        now=None,
        malformed_rpc=False,
        before_rpc=None,
        profiles=None,
        users=None,
        fail_profile=False,
    ):
        self.rows = rows or {}
        self.profiles = profiles or {}
        self.users = users or {}
        self.fail_read = fail_read
        self.fail_write = fail_write
        self.fail_profile = fail_profile
        self.now = now
        self.malformed_rpc = malformed_rpc
        self.before_rpc = before_rpc
        self.last_select = None
        self.last_profile_select = None
        self.last_profile_upsert = None
        self.last_delete_filters = None
        self.last_rpc = None

    def table(self, name):
        if name == "chat_memory":
            return FakeTable(self)
        if name == "chat_profile":
            return FakeProfileTable(self)
        if name == "users":
            return FakeUsersTable(self)
        raise AssertionError(f"unexpected table {name!r}")

    def rpc(self, name, params):
        assert name == "append_chat_turn"
        return FakeRpc(self, params)
