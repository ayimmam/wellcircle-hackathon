"""Profile name and consented-preference tests."""

import pytest

import profile
from fake_supabase import FakeChatMemorySupabase


USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ANON_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeChatMemorySupabase()
    monkeypatch.setattr(profile, "_get_supabase_client", lambda: fake)
    return fake


@pytest.mark.parametrize(
    "message,expected",
    [
        ("Hi, my name is Selam.", "Selam"),
        ("You can call me Samuel", "Samuel"),
        ("please call me Hanna!", "Hanna"),
        ("I go by Bezis and I like yoga", "Bezis"),
        ("My name is not important", None),
        ("call me later", None),
        ("I am stressed and have 500 ETB", None),
        ("my name is", None),
    ],
)
def test_extract_explicit_name_is_conservative(message, expected):
    assert profile.extract_explicit_name(message) == expected


def test_display_name_rejects_control_characters_and_prompt_text():
    assert profile.normalize_display_name("  Selam  ") == "Selam"
    assert profile.normalize_display_name("line\nbreak") == "line break"
    assert profile.normalize_display_name("12345") is None
    assert profile.normalize_display_name("x" * 61) is None
    assert profile.normalize_display_name("one two three four five") is None


def test_preferences_are_allowlisted_and_normalized():
    cleaned = profile.normalize_preferences(
        {
            "interests": ["Yoga", "yoga", "  gym  "],
            "neighbourhood": "  Bole   Atlas ",
            "budget_etb": 500,
            "notes": "Mornings only",
            "unexpected": "must not be stored",
        }
    )

    assert cleaned == {
        "interests": ["Yoga", "gym"],
        "neighbourhood": "Bole Atlas",
        "budget_etb": 500,
        "notes": "Mornings only",
    }


def test_preferences_reject_invalid_shapes():
    assert profile.normalize_preferences({"budget_etb": True}) is None
    assert profile.normalize_preferences({"budget_etb": -1}) is None
    assert profile.normalize_preferences({"interests": "yoga"}) is None


def test_preference_write_requires_explicit_consent(fake_db):
    with pytest.raises(profile.ConsentRequiredError):
        profile.save_preferences(
            "anonymous", ANON_ID, {"budget_etb": 500}, consent=False
        )
    assert fake_db.profiles == {}


def test_preference_write_is_stored_with_consent_and_survives(fake_db):
    saved = profile.save_preferences(
        "anonymous", ANON_ID, {"budget_etb": 500}, consent=True
    )

    assert saved == {"budget_etb": 500}
    loaded = profile.get_profile("anonymous", ANON_ID)
    assert loaded.preferences == {"budget_etb": 500}
    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences_consent_at"]
    assert stored["last_seen_at"]


def test_preferences_without_recorded_consent_are_not_used(fake_db):
    fake_db.profiles[("anonymous", ANON_ID)] = {
        "preferences": {"budget_etb": 500},
    }

    loaded = profile.get_profile("anonymous", ANON_ID)

    assert loaded.preferences == {}


def test_profile_read_exposes_whether_consent_is_recorded(fake_db):
    fake_db.profiles[("anonymous", ANON_ID)] = {
        "preferences": {"budget_etb": 500},
        "preferences_consent_at": "2026-01-01T00:00:00+00:00",
    }
    assert profile.get_profile("anonymous", ANON_ID).consent_recorded is True

    fake_db.profiles[("anonymous", ANON_ID)] = {
        "display_name": "Selam",
        "preferences": {},
        "preferences_consent_at": None,
    }
    assert profile.get_profile("anonymous", ANON_ID).consent_recorded is False


def test_clear_preferences_deletes_data_and_keeps_consent_and_name(fake_db):
    fake_db.profiles[("anonymous", ANON_ID)] = {
        "display_name": "Selam",
        "preferences": {"budget_etb": 500},
        "preferences_consent_at": "2026-01-01T00:00:00+00:00",
    }

    assert profile.clear_preferences("anonymous", ANON_ID, withdraw_consent=False)

    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {}
    assert stored["display_name"] == "Selam"
    assert stored["preferences_consent_at"]
    assert profile.get_profile("anonymous", ANON_ID).consent_recorded is True


def test_clear_preferences_can_withdraw_consent(fake_db):
    fake_db.profiles[("anonymous", ANON_ID)] = {
        "display_name": "Selam",
        "preferences": {"budget_etb": 500},
        "preferences_consent_at": "2026-01-01T00:00:00+00:00",
    }

    assert profile.clear_preferences("anonymous", ANON_ID, withdraw_consent=True)

    stored = fake_db.profiles[("anonymous", ANON_ID)]
    assert stored["preferences"] == {}
    assert stored["preferences_consent_at"] is None
    assert stored["display_name"] == "Selam"
    loaded = profile.get_profile("anonymous", ANON_ID)
    assert loaded.preferences == {}
    assert loaded.consent_recorded is False


def test_clear_preferences_fails_when_storage_is_unavailable(fake_db, monkeypatch):
    monkeypatch.setattr(profile, "_get_supabase_client", lambda: None)

    assert (
        profile.clear_preferences("anonymous", ANON_ID, withdraw_consent=False)
        is False
    )


def test_display_name_is_independent_of_chat_memory(fake_db):
    profile.remember_display_name("anonymous", ANON_ID, "Selam")
    fake_db.rows.clear()  # simulate chat history expiry/cleanup

    loaded = profile.get_profile("anonymous", ANON_ID)
    assert loaded.display_name == "Selam"
    assert fake_db.profiles[("anonymous", ANON_ID)]["last_seen_at"]


def test_signed_in_name_falls_back_to_users_table(fake_db):
    fake_db.users[USER_ID] = {"name": "Hanna"}

    loaded = profile.get_profile("user", USER_ID)

    assert loaded.display_name == "Hanna"


def test_profile_database_failure_degrades_to_empty(monkeypatch):
    fake = FakeChatMemorySupabase(fail_profile=True)
    monkeypatch.setattr(profile, "_get_supabase_client", lambda: fake)

    loaded = profile.get_profile("anonymous", ANON_ID)

    assert loaded.display_name is None
    assert loaded.preferences == {}


def test_profile_without_supabase_returns_empty(monkeypatch):
    monkeypatch.setattr(profile, "_get_supabase_client", lambda: None)

    assert profile.get_profile("anonymous", ANON_ID).display_name is None
    assert profile.remember_display_name("anonymous", ANON_ID, "Selam") is None
