"""Unit tests for server-side conversation memory and inactivity expiry."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

import memory
from fake_supabase import FakeChatMemorySupabase


NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
USER_ID = "11111111-1111-4111-8111-111111111111"
OTHER_USER_ID = "22222222-2222-4222-8222-222222222222"
OWNER = {"owner_type": "user", "owner_id": USER_ID}
OTHER_OWNER = {"owner_type": "user", "owner_id": OTHER_USER_ID}


@pytest.fixture(autouse=True)
def reset_memory(monkeypatch):
    memory._cache_clear()
    monkeypatch.setattr(memory, "MEMORY_INACTIVITY_HOURS", 24.0)
    monkeypatch.setattr(memory, "MEMORY_MAX_MESSAGES", 5)
    monkeypatch.setattr(memory, "MEMORY_CACHE_MAX_SESSIONS", 1000)
    yield
    memory._cache_clear()


def _use_db(monkeypatch, fake=None, **kwargs):
    fake = fake or FakeChatMemorySupabase(**kwargs)
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: fake)
    return fake


def _row(messages, updated_at, *, owner=None):
    owner = owner or OWNER
    return {
        "owner_type": owner["owner_type"],
        "owner_id": owner["owner_id"],
        "messages": messages,
        "updated_at": updated_at.isoformat(),
    }


def test_active_session_restores_server_history(monkeypatch):
    old_messages = [
        {"role": "user", "content": "I prefer yoga"},
        {"role": "assistant", "content": "Try Serenity Yoga Studio."},
    ]
    fake = _use_db(
        monkeypatch,
        rows={"s1": _row(old_messages, NOW - timedelta(hours=23))},
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "active"
    assert state.messages == old_messages
    assert state.updated_at == (NOW - timedelta(hours=23)).astimezone(timezone.utc)
    assert fake.last_select == "owner_type, owner_id, messages, updated_at"


def test_expired_session_history_is_not_returned(monkeypatch):
    _use_db(
        monkeypatch,
        rows={
            "s1": _row(
                [{"role": "user", "content": "stale preference"}],
                NOW - timedelta(hours=25),
            )
        },
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "expired"
    assert state.messages == []
    assert "s1" not in memory._session_memory_cache


def test_expiry_boundary_and_configurable_window(monkeypatch):
    _use_db(
        monkeypatch,
        rows={
            "s1": _row(
                [{"role": "user", "content": "recent"}],
                NOW - timedelta(hours=2),
            )
        },
    )

    monkeypatch.setattr(memory, "MEMORY_INACTIVITY_HOURS", 1.0)
    assert memory.get_session_state("s1", **OWNER, now=NOW).status == "expired"

    monkeypatch.setattr(memory, "MEMORY_INACTIVITY_HOURS", 3.0)
    state = memory.get_session_state("s1", **OWNER, now=NOW)
    assert state.status == "active"
    assert state.messages == [{"role": "user", "content": "recent"}]


def test_append_adds_only_the_current_turn(monkeypatch):
    old_messages = [
        {"role": "user", "content": "earlier"},
        {"role": "assistant", "content": "earlier reply"},
    ]
    old_timestamp = NOW - timedelta(hours=1)
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={"s1": _row(old_messages, old_timestamp)}, now=NOW
        ),
    )

    result = memory.append_session_turn(
        "s1",
        "hello",
        "hi",
        **OWNER,
        expected_updated_at=old_timestamp,
    )

    assert result.persisted is True
    assert result.messages == old_messages + [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"},
    ]
    assert fake.rows["s1"]["messages"] == result.messages
    assert fake.rows["s1"]["updated_at"] == NOW.isoformat()
    assert fake.last_rpc["p_session_id"] == "s1"
    assert fake.last_rpc["p_owner_type"] == "user"
    assert fake.last_rpc["p_owner_id"] == USER_ID
    assert fake.last_rpc["p_user_content"] == "hello"
    assert fake.last_rpc["p_assistant_content"] == "hi"
    assert fake.last_rpc["p_expected_updated_at"] == old_timestamp.isoformat()


def test_successful_append_refreshes_activity_timestamp(monkeypatch):
    old_timestamp = NOW - timedelta(hours=1)
    _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "old turn"}], old_timestamp
                )
            },
            now=NOW,
        ),
    )

    result = memory.append_session_turn(
        "s1",
        "hello",
        "hi",
        **OWNER,
        expected_updated_at=old_timestamp,
    )

    assert result.persisted is True
    assert result.updated_at == NOW

    within_window = memory.get_session_state(
        "s1", **OWNER, now=NOW + timedelta(hours=23)
    )
    after_window = memory.get_session_state(
        "s1", **OWNER, now=NOW + timedelta(hours=25)
    )

    assert within_window.status == "active"
    assert within_window.messages == result.messages
    assert after_window.status == "expired"
    assert after_window.messages == []


def test_failed_persistence_does_not_change_row_or_cache(monkeypatch):
    old_timestamp = NOW - timedelta(hours=1)
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "old"}], old_timestamp
                )
            },
            now=NOW,
            fail_write=True,
        ),
    )

    result = memory.append_session_turn(
        "s1",
        "unsaved",
        "unsaved reply",
        **OWNER,
        expected_updated_at=old_timestamp,
    )

    assert result.persisted is False
    assert fake.rows["s1"]["updated_at"] == old_timestamp.isoformat()
    assert fake.rows["s1"]["messages"] == [{"role": "user", "content": "old"}]
    assert "s1" not in memory._session_memory_cache


def test_expired_session_is_reset_before_appending(monkeypatch):
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "expired context"}],
                    NOW - timedelta(hours=25),
                )
            },
            now=NOW,
        ),
    )

    result = memory.append_session_turn("s1", "fresh", "fresh reply", **OWNER)

    assert result.persisted is True
    assert result.reset_applied is True
    assert fake.last_rpc["p_expected_updated_at"] is None
    assert result.messages == [
        {"role": "user", "content": "fresh"},
        {"role": "assistant", "content": "fresh reply"},
    ]
    assert fake.rows["s1"]["messages"] == result.messages


def test_stale_turn_is_detected_when_history_changed(monkeypatch):
    old_timestamp = NOW - timedelta(minutes=1)
    _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "shared history"}], old_timestamp
                )
            },
            now=NOW,
        ),
    )

    read = memory.get_session_state("s1", **OWNER, now=NOW)
    assert read.status == "active"

    first = memory.append_session_turn(
        "s1",
        "first request",
        "first reply",
        **OWNER,
        expected_updated_at=read.updated_at,
    )
    second = memory.append_session_turn(
        "s1",
        "second request",
        "second reply",
        **OWNER,
        expected_updated_at=read.updated_at,
    )

    assert first.stale_turn is False
    assert second.stale_turn is True
    # Both turns are preserved; ordering is not rewritten by the protocol.
    assert [message["content"] for message in second.messages[-4:]] == [
        "first request",
        "first reply",
        "second request",
        "second reply",
    ]


def test_invalid_rpc_response_is_not_treated_as_persisted(monkeypatch):
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(now=NOW, malformed_rpc=True),
    )

    result = memory.append_session_turn("s1", "hello", "hi", **OWNER)

    assert result.persisted is False
    assert result.messages == []
    assert "s1" not in memory._session_memory_cache
    assert fake.last_rpc is not None


def test_stale_cache_does_not_override_newer_database_state(monkeypatch):
    memory._cache_put(
        "s1",
        OWNER["owner_type"],
        OWNER["owner_id"],
        [{"role": "user", "content": "stale cached message"}],
        NOW - timedelta(hours=23),
    )
    fresh_messages = [{"role": "user", "content": "newer database message"}]
    _use_db(
        monkeypatch,
        rows={"s1": _row(fresh_messages, NOW - timedelta(minutes=1))},
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "active"
    assert state.messages == fresh_messages


def test_expired_cache_does_not_override_active_database_state(monkeypatch):
    memory._cache_put(
        "s1",
        OWNER["owner_type"],
        OWNER["owner_id"],
        [{"role": "user", "content": "expired cache"}],
        NOW - timedelta(hours=25),
    )
    fresh_messages = [{"role": "user", "content": "active database"}]
    _use_db(
        monkeypatch,
        rows={"s1": _row(fresh_messages, NOW - timedelta(minutes=1))},
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "active"
    assert state.messages == fresh_messages


def test_database_read_failure_does_not_fall_back_to_cache(monkeypatch):
    memory._cache_put(
        "s1",
        OWNER["owner_type"],
        OWNER["owner_id"],
        [{"role": "user", "content": "cached but unverifiable"}],
        NOW - timedelta(minutes=1),
    )
    _use_db(monkeypatch, fail_read=True)

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "unavailable"
    assert state.messages == []
    assert "s1" not in memory._session_memory_cache


def test_append_failure_returns_unpersisted_result(monkeypatch):
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(now=NOW, fail_write=True),
    )

    result = memory.append_session_turn("s1", "hello", "hi", **OWNER)

    assert result.persisted is False
    assert fake.rows == {}


def test_invalid_updated_at_is_treated_as_expired(monkeypatch):
    _use_db(
        monkeypatch,
        rows={
            "s1": {
                "owner_type": "user",
                "owner_id": USER_ID,
                "messages": [{"role": "user", "content": "cannot verify"}],
                "updated_at": None,
            }
        },
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "expired"
    assert state.messages == []


def test_naive_database_timestamp_is_normalized_to_utc(monkeypatch):
    _use_db(
        monkeypatch,
        rows={
            "s1": {
                "owner_type": "user",
                "owner_id": USER_ID,
                "messages": [{"role": "user", "content": "hello"}],
                "updated_at": "2026-01-01T11:00:00",
            }
        },
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "active"
    assert state.updated_at is not None
    assert state.updated_at.tzinfo is not None
    assert state.updated_at.utcoffset() == timedelta(0)


def test_degraded_append_preserves_prior_cache_history(monkeypatch):
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: None)
    first = memory.append_session_turn("s1", "one", "first", **OWNER, now=NOW)
    second = memory.append_session_turn(
        "s1", "two", "second", **OWNER, now=NOW + timedelta(minutes=1)
    )

    assert first.persisted is False
    assert second.messages == [
        {"role": "user", "content": "one"},
        {"role": "assistant", "content": "first"},
        {"role": "user", "content": "two"},
        {"role": "assistant", "content": "second"},
    ]
    assert memory.get_session_state(
        "s1", **OWNER, now=NOW + timedelta(minutes=1)
    ).messages == second.messages


def test_message_limit_is_preserved(monkeypatch):
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: None)
    monkeypatch.setattr(memory, "MEMORY_MAX_MESSAGES", 4)
    for index in range(3):
        memory.append_session_turn(
            "s1",
            f"user {index}",
            f"assistant {index}",
            **OWNER,
            now=NOW + timedelta(minutes=index),
        )

    cached = memory._session_memory_cache["s1"]
    assert len(cached.messages) == 4
    assert [message["content"] for message in cached.messages] == [
        "user 1",
        "assistant 1",
        "user 2",
        "assistant 2",
    ]


def test_odd_message_limit_never_restores_an_orphan_assistant_turn(monkeypatch):
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: None)
    monkeypatch.setattr(memory, "MEMORY_MAX_MESSAGES", 5)
    for index in range(3):
        memory.append_session_turn(
            "s1",
            f"user {index}",
            f"assistant {index}",
            **OWNER,
            now=NOW + timedelta(minutes=index),
        )

    state = memory.get_session_state(
        "s1", **OWNER, now=NOW + timedelta(minutes=3)
    )

    assert state.messages[0]["role"] == "user"
    assert state.messages == [
        {"role": "user", "content": "user 1"},
        {"role": "assistant", "content": "assistant 1"},
        {"role": "user", "content": "user 2"},
        {"role": "assistant", "content": "assistant 2"},
    ]


def test_process_cache_is_bounded_and_thread_safe(monkeypatch):
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: None)
    monkeypatch.setattr(memory, "MEMORY_CACHE_MAX_SESSIONS", 20)

    def worker(index):
        for turn in range(50):
            memory.append_session_turn(
                f"s{index}-{turn % 10}",
                "user",
                "assistant",
                **OWNER,
                now=NOW,
            )
            memory.get_session_state(f"s{index}-{turn % 10}", **OWNER, now=NOW)

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(worker, range(8)))

    assert len(memory._session_memory_cache) <= 20
    assert all(
        len(entry.messages) <= memory.MEMORY_MAX_MESSAGES
        for entry in memory._session_memory_cache.values()
    )


def test_compatibility_helper_appends_final_pair(monkeypatch):
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(now=NOW),
    )

    assert memory.save_session_history(
        "s1",
        [
            {"role": "user", "content": "old"},
            {"role": "assistant", "content": "old reply"},
            {"role": "user", "content": "new"},
            {"role": "assistant", "content": "new reply"},
        ],
        **OWNER,
    ) is True

    assert fake.rows["s1"]["messages"] == [
        {"role": "user", "content": "new"},
        {"role": "assistant", "content": "new reply"},
    ]


def test_invalid_memory_config_falls_back_to_defaults(monkeypatch):
    import config

    monkeypatch.setenv("MEMORY_MAX_MESSAGES", "1")
    assert config._read_positive_int("MEMORY_MAX_MESSAGES", 5, minimum=2) == 5

    monkeypatch.setenv("MEMORY_INACTIVITY_HOURS", "not-a-number")
    assert config._read_positive_float("MEMORY_INACTIVITY_HOURS", 24.0) == 24.0

    monkeypatch.setenv("MEMORY_CACHE_MAX_SESSIONS", "-5")
    assert config._read_positive_int("MEMORY_CACHE_MAX_SESSIONS", 1000, minimum=0) == 1000


def test_cross_owner_read_is_forbidden_and_returns_no_messages(monkeypatch):
    _use_db(
        monkeypatch,
        rows={
            "s1": _row(
                [{"role": "user", "content": "another user's secret"}],
                NOW - timedelta(minutes=1),
                owner=OTHER_OWNER,
            )
        },
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)

    assert state.status == "forbidden"
    assert state.messages == []
    assert "s1" not in memory._session_memory_cache


def test_cross_owner_append_raises_and_preserves_the_row(monkeypatch):
    old_timestamp = NOW - timedelta(minutes=1)
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "owner only"}],
                    old_timestamp,
                    owner=OTHER_OWNER,
                )
            },
            now=NOW,
        ),
    )

    with pytest.raises(memory.SessionOwnershipError):
        memory.append_session_turn(
            "s1", "intruder", "should not persist", **OWNER
        )

    assert fake.rows["s1"]["messages"] == [
        {"role": "user", "content": "owner only"}
    ]
    assert fake.rows["s1"]["updated_at"] == old_timestamp.isoformat()


def test_legacy_unowned_row_cannot_be_claimed(monkeypatch):
    fake = _use_db(
        monkeypatch,
        fake=FakeChatMemorySupabase(
            rows={
                "s1": _row(
                    [{"role": "user", "content": "pre-ownership history"}],
                    NOW - timedelta(minutes=1),
                    owner={"owner_type": "legacy", "owner_id": "legacy"},
                )
            },
            now=NOW,
        ),
    )

    state = memory.get_session_state("s1", **OWNER, now=NOW)
    assert state.status == "forbidden"
    assert state.messages == []

    with pytest.raises(memory.SessionOwnershipError):
        memory.append_session_turn("s1", "claim", "claim reply", **OWNER)

    assert fake.rows["s1"]["owner_type"] == "legacy"
    assert fake.rows["s1"]["owner_id"] == "legacy"


def test_cache_never_returns_another_owners_history(monkeypatch):
    monkeypatch.setattr(memory, "_get_supabase_client", lambda: None)
    memory.append_session_turn("s1", "private", "private reply", **OWNER, now=NOW)

    other = memory.get_session_state("s1", **OTHER_OWNER, now=NOW)
    assert other.status == "forbidden"
    assert other.messages == []

    owner = memory.get_session_state("s1", **OWNER, now=NOW)
    assert owner.status == "active"
    assert owner.messages == [
        {"role": "user", "content": "private"},
        {"role": "assistant", "content": "private reply"},
    ]

    with pytest.raises(memory.SessionOwnershipError):
        memory.append_session_turn(
            "s1", "intruder", "nope", **OTHER_OWNER, now=NOW
        )


def test_invalid_owner_is_rejected_before_reading_or_writing(monkeypatch):
    with pytest.raises(ValueError):
        memory.get_session_state(
            "s1", owner_type="public", owner_id=USER_ID, now=NOW
        )
    with pytest.raises(ValueError):
        memory.append_session_turn(
            "s1", "hello", "hi", owner_type="user", owner_id="", now=NOW
        )
