"""Persistent Circler profile data, independent of short-term chat history.

Conversation history expires after the configured inactivity window, but a
person's name and explicitly consented preferences should not. This module
stores that small profile in ``public.chat_profile`` keyed by the same owner
identity used for chat memory.

Two consent paths are supported:

* an explicit conversational statement (``my name is ...`` / ``call me ...``)
  may store the name; and
* the profile endpoint requires ``consent: true`` before storing preferences.

Profile reads and writes are best-effort. A missing migration or a transient
database failure must never stop a chat reply; the caller keeps working with
an empty profile and the failure is logged.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone

from config import logger

MAX_NAME_LENGTH = 60
MAX_NEIGHBOURHOOD_LENGTH = 100
MAX_INTEREST_LENGTH = 60
MAX_INTERESTS = 8
MAX_NOTES_LENGTH = 500
MAX_BUDGET_ETB = 100_000_000

_NAME_PATTERNS = (
    re.compile(
        r"\bmy name is\s+([^\W\d_](?:[^\W\d_]|[ '’.-]){0,59})",
        re.IGNORECASE | re.UNICODE,
    ),
    re.compile(
        r"\byou can call me\s+([^\W\d_](?:[^\W\d_]|[ '’.-]){0,59})",
        re.IGNORECASE | re.UNICODE,
    ),
    re.compile(
        r"\bplease call me\s+([^\W\d_](?:[^\W\d_]|[ '’.-]){0,59})",
        re.IGNORECASE | re.UNICODE,
    ),
    re.compile(
        r"\bi go by\s+([^\W\d_](?:[^\W\d_]|[ '’.-]){0,59})",
        re.IGNORECASE | re.UNICODE,
    ),
)

_NAME_STOPWORDS = {
    "a",
    "an",
    "actually",
    "again",
    "back",
    "but",
    "from",
    "if",
    "in",
    "later",
    "maybe",
    "not",
    "or",
    "please",
    "the",
    "tomorrow",
    "when",
    "who",
}

_TRAILING_WORD_RE = re.compile(
    r"\s+(?:and|but|or|from|in|at|who|please)\b.*$",
    re.IGNORECASE,
)
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]+")
_SPACE_RE = re.compile(r"\s+")


class ConsentRequiredError(ValueError):
    """Raised when a preference write is attempted without explicit consent."""


@dataclass(frozen=True)
class ChatProfile:
    """The persistent profile used to personalise the concierge."""

    display_name: str | None = None
    preferences: dict = field(default_factory=dict)
    # True when the row records the explicit consent that allows preferences
    # to be stored and used. Distinct from the name, which is consented to
    # through ordinary conversation and survives consent withdrawal.
    consent_recorded: bool = False


def _get_supabase_client():
    """Resolve the active Supabase client, honoring main.supabase_client patches."""
    main_mod = sys.modules.get("main")
    if main_mod is not None:
        return main_mod.supabase_client
    from config import supabase_client

    return supabase_client


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_display_name(value: object) -> str | None:
    """Return a safe display name, or ``None`` when the input is unusable."""
    if not isinstance(value, str):
        return None
    cleaned = _CONTROL_RE.sub(" ", value)
    cleaned = _SPACE_RE.sub(" ", cleaned).strip(" \t\r\n.,;:!?\"'")
    if not cleaned or len(cleaned) > MAX_NAME_LENGTH:
        return None
    if not any(character.isalpha() for character in cleaned):
        return None
    if len(cleaned.split()) > 4:
        return None
    return cleaned


def extract_explicit_name(message: object) -> str | None:
    """Extract a name only from a clear, self-identifying statement.

    Deliberately conservative: generic phrases such as "I'm stressed" are not
    treated as names, and ambiguous words ("call me later") are rejected.
    """
    if not isinstance(message, str) or not message.strip():
        return None

    for pattern in _NAME_PATTERNS:
        match = pattern.search(message)
        if match is None:
            continue
        candidate = _TRAILING_WORD_RE.sub("", match.group(1)).strip()
        candidate = candidate.strip(" \t\r\n.,;:!?\"'")
        if not candidate:
            continue
        if candidate.split()[0].lower() in _NAME_STOPWORDS:
            continue
        name = normalize_display_name(candidate)
        if name:
            return name
    return None


def normalize_preferences(raw: object) -> dict | None:
    """Validate and reduce preference input to the fields we actually store."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        return None

    preferences: dict = {}

    interests = raw.get("interests")
    if interests is not None:
        if not isinstance(interests, (list, tuple)):
            return None
        cleaned_interests: list[str] = []
        for item in interests:
            if not isinstance(item, str):
                return None
            item = _SPACE_RE.sub(" ", item).strip()
            if not item or len(item) > MAX_INTEREST_LENGTH:
                continue
            if item.lower() not in {value.lower() for value in cleaned_interests}:
                cleaned_interests.append(item)
        preferences["interests"] = cleaned_interests[:MAX_INTERESTS]

    neighbourhood = raw.get("neighbourhood")
    if neighbourhood is not None:
        if not isinstance(neighbourhood, str):
            return None
        neighbourhood = _SPACE_RE.sub(" ", neighbourhood).strip()[
            :MAX_NEIGHBOURHOOD_LENGTH
        ]
        if neighbourhood:
            preferences["neighbourhood"] = neighbourhood

    budget = raw.get("budget_etb")
    if budget is not None:
        if isinstance(budget, bool) or not isinstance(budget, int):
            return None
        if budget < 0 or budget > MAX_BUDGET_ETB:
            return None
        preferences["budget_etb"] = budget

    notes = raw.get("notes")
    if notes is not None:
        if not isinstance(notes, str):
            return None
        notes = _SPACE_RE.sub(" ", notes).strip()[:MAX_NOTES_LENGTH]
        if notes:
            preferences["notes"] = notes

    return preferences


def _profile_row_to_profile(row: object) -> ChatProfile:
    if not isinstance(row, dict):
        return ChatProfile()
    display_name = normalize_display_name(row.get("display_name"))
    # Preferences are usable only when the row records the explicit consent
    # that allowed them to be stored. This defends against old/manual rows or
    # a future write path that forgets the consent timestamp.
    preferences = (
        normalize_preferences(row.get("preferences"))
        if row.get("preferences_consent_at")
        else {}
    )
    return ChatProfile(
        display_name=display_name,
        preferences=preferences or {},
        consent_recorded=bool(row.get("preferences_consent_at")),
    )


def get_profile(owner_type: str, owner_id: str) -> ChatProfile:
    """Load the persistent profile, falling back to the users table name."""
    client = _get_supabase_client()
    if client is None:
        return ChatProfile()

    profile = ChatProfile()
    try:
        res = (
            client.table("chat_profile")
            .select("display_name, preferences, preferences_consent_at")
            .eq("owner_type", owner_type)
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None)
        if isinstance(rows, list) and rows:
            profile = _profile_row_to_profile(rows[0])
    except Exception as exc:
        # Expected until migration 029 is applied, or when the chatbot is
        # running against an older project. Degrade to no profile.
        logger.info("Chat profile read unavailable for %s: %s", owner_type, exc)

    if profile.display_name is None and owner_type == "user":
        try:
            res = (
                client.table("users")
                .select("name")
                .eq("id", owner_id)
                .limit(1)
                .execute()
            )
            rows = getattr(res, "data", None)
            if isinstance(rows, list) and rows and isinstance(rows[0], dict):
                name = normalize_display_name(rows[0].get("name"))
                if name:
                    profile = ChatProfile(
                        display_name=name,
                        preferences=profile.preferences,
                        consent_recorded=profile.consent_recorded,
                    )
        except Exception as exc:
            logger.info("User profile name read unavailable: %s", exc)

    return profile


def _upsert(payload: dict) -> bool:
    client = _get_supabase_client()
    if client is None:
        return False
    try:
        client.table("chat_profile").upsert(
            payload,
            on_conflict="owner_type,owner_id",
        ).execute()
        return True
    except Exception as exc:
        logger.warning("Chat profile write failed: %s", exc)
        return False


def remember_display_name(
    owner_type: str,
    owner_id: str,
    display_name: object,
) -> str | None:
    """Persist an explicitly supplied name and return the normalized value."""
    name = normalize_display_name(display_name)
    if name is None:
        return None
    now = _utcnow().isoformat()
    saved = _upsert(
        {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "display_name": name,
            "last_seen_at": now,
            "updated_at": now,
        }
    )
    return name if saved else None


def remember_name_from_message(
    owner_type: str,
    owner_id: str,
    message: object,
) -> str | None:
    """Store a name the user explicitly stated in this turn, if any."""
    name = extract_explicit_name(message)
    if name is None:
        return None
    return remember_display_name(owner_type, owner_id, name)


def save_preferences(
    owner_type: str,
    owner_id: str,
    preferences: object,
    *,
    consent: bool,
) -> dict | None:
    """Persist validated preferences only when explicit consent was given."""
    if consent is not True:
        raise ConsentRequiredError("explicit consent is required")
    cleaned = normalize_preferences(preferences)
    if cleaned is None:
        return None
    now = _utcnow().isoformat()
    saved = _upsert(
        {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "preferences": cleaned,
            "preferences_consent_at": now,
            "last_seen_at": now,
            "updated_at": now,
        }
    )
    return cleaned if saved else None


def clear_preferences(
    owner_type: str,
    owner_id: str,
    *,
    withdraw_consent: bool,
) -> bool:
    """Remove stored preference data, keeping the profile name.

    Three settings-panel operations map onto this one function:

    * ``withdraw_consent=False`` deletes the preference data but leaves the
      recorded consent standing (the "delete saved preferences" button);
    * ``withdraw_consent=True`` deletes the data and clears
      ``preferences_consent_at`` (disabling personalization), which is the
      existing consent model's withdrawal path: the read gate ignores
      preferences without a recorded consent timestamp, and here the data is
      removed as well so nothing is retained under a consent that was
      withdrawn.

    The display name is never touched — it is consented to through ordinary
    conversation and must survive either operation.
    """
    now = _utcnow().isoformat()
    payload: dict = {
        "owner_type": owner_type,
        "owner_id": owner_id,
        "preferences": {},
        "last_seen_at": now,
        "updated_at": now,
    }
    if withdraw_consent:
        payload["preferences_consent_at"] = None
    return _upsert(payload)
