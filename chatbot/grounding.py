"""Grounding checks for concierge replies.

The model never gets the final say on facts. Provider and event ids are already
resolved against the fetched dataset; this module extends that guarantee to the
facts models most often invent in free text:

* prices quoted in ETB or described as free, and
* event availability, sold-out, or reservation claims ("only 3 spots left",
  "I can hold a slot").

Only explicit claims are checked. A general reply about a user's budget with no
selected provider/event is left alone. When a claim contradicts the listing, the
reply is replaced with a deterministic, listing-backed response instead of
returning the model's invented number.
"""

from __future__ import annotations

from dataclasses import dataclass
import re

_ETB = r"(?:ETB|Br|(?:Ethiopian\s+)?birr)"
_ETB_SEP = r"\.?\s*[:=]?\s*"
_NUM = r"([0-9][0-9,]*)"
_AVAILABILITY_NOUN = r"(?:spots|places|seats|slots|spaces|tickets|openings)"

_ETB_RANGE_LEADING_RE = re.compile(
    rf"{_ETB}{_ETB_SEP}{_NUM}\s*(?:-|–|—|to|and)\s*{_NUM}",
    re.IGNORECASE,
)
_ETB_RANGE_TRAILING_RE = re.compile(
    rf"{_NUM}\s*(?:-|–|—|to|and)\s*{_NUM}\s*{_ETB}\b",
    re.IGNORECASE,
)
_ETB_SINGLE_LEADING_RE = re.compile(rf"{_ETB}{_ETB_SEP}{_NUM}", re.IGNORECASE)
_ETB_SINGLE_TRAILING_RE = re.compile(rf"{_NUM}\s*{_ETB}\b", re.IGNORECASE)

_ANY_NUMBER_RE = re.compile(r"\b([0-9][0-9,]*)\b")
_BUDGET_BEFORE_RE = re.compile(
    r"\b(?:budget|spend|afford|under|below|less\s+than|up\s+to|"
    r"max(?:imum)?|around)\b[^.\n]{0,30}?([0-9][0-9,]*)",
    re.IGNORECASE,
)
_BUDGET_AFTER_RE = re.compile(
    r"([0-9][0-9,]*)\s*(?:budget|max(?:imum)?)\b",
    re.IGNORECASE,
)
_NON_MONEY_AFTER_RE = re.compile(
    r"\s*(?:%|(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|"
    r"people|persons?|adults?|kids?|children|times?|sessions?|classes?|"
    r"kg|kgs|km|cm|mm|am|pm)\b)",
    re.IGNORECASE,
)

_AVAILABILITY_PATTERNS = (
    re.compile(
        rf"\b(?:only|just)?\s*{_NUM}\s*"
        rf"{_AVAILABILITY_NOUN}\s*(?:left|remaining|available)\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b{_AVAILABILITY_NOUN}\s*(?:left|remaining|available)"
        rf"\s*[:\-]?\s*{_NUM}\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b{_NUM}\s*{_AVAILABILITY_NOUN}\b",
        re.IGNORECASE,
    ),
)
_SOLD_OUT_RE = re.compile(
    r"\b(?:sold\s*out|fully\s*booked|all\s+booked|"
    r"no\s+(?:more\s+)?(?:spots|places|seats|slots|spaces|tickets|openings)\b|"
    r"no\s+available\s+(?:spots|places|seats|slots|spaces|tickets|openings)\b|"
    r"not\s+(?:any\s+)?(?:spots|places|seats|slots|spaces|tickets|openings)\b|"
    r"all\s+(?:spots|places|seats|slots|spaces|tickets|openings)\s+"
    r"(?:are\s+)?taken\b|"
    r"none\s+(?:left|remaining)|"
    r"not\s+available)\b",
    re.IGNORECASE,
)
_NEGATED_AVAILABILITY_RE = re.compile(
    r"\b(?:no|not|none|zero|without)\b",
    re.IGNORECASE,
)
_POSITIVE_AVAILABILITY_RE = re.compile(
    rf"\b{_AVAILABILITY_NOUN}\b[^.\n]{{0,24}}\b(?:available|open)\b",
    re.IGNORECASE,
)
_BOOKING_CLAIM_RE = re.compile(
    r"\b(?:"
    r"(?:i|we)(?:'ll|\s+(?:can|could|will))\s+(?:reserve|hold|book|save)"
    r"|(?:i|we)(?:'ve|\s+have)\s+(?:reserved|booked|held|saved)"
    r"|(?:i|we)\s+(?:reserved|booked|held|saved)"
    r")\b[^.\n]{0,40}\b(?:spot|slot|place|seat|space|ticket|appointment)\b"
    r"|\byou(?:'re|\s+are)\s+(?:booked|confirmed|reserved)\b"
    r"|\byour\s+(?:spot|slot|place|seat|space|ticket)\s+"
    r"(?:is|has\s+been)\s+(?:reserved|booked|held|saved|confirmed)\b"
    r"|\b(?:your\s+)?(?:booking|reservation|appointment)\s+"
    r"(?:is|has\s+been)\s+(?:confirmed|booked|reserved)\b",
    re.IGNORECASE,
)
_FREE_CLAIM_RE = re.compile(
    r"\b(?:free\s+of\s+charge|at\s+no\s+(?:cost|charge)|no\s+(?:cost|charge)|"
    r"costs?\s+nothing|for\s+free|"
    r"(?:it|this|that|they)(?:'s|’s|'re|’re|\s+is|\s+are)\s+"
    r"(?:free|complimentary)\b|"
    r"(?:free|complimentary)\s+"
    r"(?:entry|admission|access|membership|trial)\b|"
    r"(?:free|complimentary)\s+(?:\w+\s+){0,3}"
    r"(?:event|class|session|service|consultation|treatment|workshop)\b|"
    r"(?:is|are)\s+(?:free(?:\s+of\s+charge)?|complimentary))\b",
    re.IGNORECASE,
)
_FREE_LISTING_RE = re.compile(
    r"\b(?:free|no\s+charge|no\s+cost|complimentary)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class GroundingResult:
    """The reply that may be returned, plus any violated claim categories."""

    reply: str
    violations: tuple[str, ...] = ()


def _amount(value: str) -> int | None:
    try:
        return int(value.replace(",", ""))
    except (TypeError, ValueError):
        return None


def _add_amount(amounts: list[int], value: str) -> None:
    parsed = _amount(value)
    if parsed is not None and parsed not in amounts:
        amounts.append(parsed)


def extract_etb_amounts(text: object) -> list[int]:
    """Return every explicit ETB amount in text, including both range ends."""
    if not isinstance(text, str) or not text:
        return []

    amounts: list[int] = []
    for pattern in (_ETB_RANGE_LEADING_RE, _ETB_RANGE_TRAILING_RE):
        for match in pattern.finditer(text):
            _add_amount(amounts, match.group(1))
            _add_amount(amounts, match.group(2))
    for pattern in (_ETB_SINGLE_LEADING_RE, _ETB_SINGLE_TRAILING_RE):
        for match in pattern.finditer(text):
            _add_amount(amounts, match.group(1))
    return amounts


def extract_numbers(text: object) -> list[int]:
    """Return plain numbers from text; used for listed price strings."""
    if not isinstance(text, str) or not text:
        return []
    amounts: list[int] = []
    for match in _ANY_NUMBER_RE.finditer(text):
        _add_amount(amounts, match.group(1))
    return amounts


def extract_user_budget_amounts(text: object) -> list[int]:
    """Return user-supplied budget amounts without treating ages as prices."""
    amounts = extract_etb_amounts(text)
    if not isinstance(text, str) or not text:
        return amounts
    for pattern in (_BUDGET_BEFORE_RE, _BUDGET_AFTER_RE):
        for match in pattern.finditer(text):
            # "under 2 hours" or "for 2 people" is a count, not a money
            # allowance. Explicit ETB amounts above are still accepted.
            if _NON_MONEY_AFTER_RE.match(text, match.end(1)):
                continue
            _add_amount(amounts, match.group(1))
    return amounts


def _price_numbers(value: object) -> set[int]:
    if isinstance(value, bool):
        return set()
    if isinstance(value, int):
        return {value}
    if isinstance(value, float) and value.is_integer():
        return {int(value)}
    if isinstance(value, str):
        return set(extract_numbers(value))
    return set()


def _spots(event: dict | None) -> int | None:
    if not isinstance(event, dict):
        return None
    value = event.get("spots_remaining")
    if isinstance(value, bool) or value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def extract_availability_claims(text: object) -> tuple[list[int], bool]:
    """Return claimed remaining counts and whether the reply says sold out."""
    if not isinstance(text, str) or not text:
        return [], False

    claims: list[int] = []
    for pattern in _AVAILABILITY_PATTERNS:
        for match in pattern.finditer(text):
            _add_amount(claims, match.group(1))
    return claims, bool(_SOLD_OUT_RE.search(text))


def _has_positive_availability(text: str) -> bool:
    """Return True for a positive availability phrase, ignoring negations."""
    for match in _POSITIVE_AVAILABILITY_RE.finditer(text):
        before = text[max(0, match.start() - 24) : match.start()]
        if not _NEGATED_AVAILABILITY_RE.search(before):
            return True
    return False


def _listing_is_free(provider: dict | None, event: dict | None) -> bool:
    """Whether a selected listing explicitly says it is free or costs zero."""
    values: list[object] = []
    if isinstance(provider, dict):
        values.append(provider.get("price_range"))
    if isinstance(event, dict):
        values.append(event.get("price_etb"))
    for value in values:
        if isinstance(value, bool) or value is None:
            continue
        if isinstance(value, (int, float)) and value == 0:
            return True
        text = str(value).strip()
        if not text:
            continue
        if _FREE_LISTING_RE.search(text):
            return True
        if 0 in _price_numbers(text):
            return True
    return False


def _same_id(left: object, right: object) -> bool:
    return left is not None and right is not None and str(left) == str(right)


def _event_price_text(event: dict) -> str | None:
    value = event.get("price_etb")
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return f"ETB {value}"
    if isinstance(value, float) and value.is_integer():
        return f"ETB {int(value)}"
    text = str(value).strip()
    if not text:
        return None
    return f"ETB {text}" if text.isdigit() else text


def _provider_price_text(provider: dict) -> str | None:
    value = provider.get("price_range")
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _canonical_reply(provider: dict | None, event: dict | None) -> str:
    details: list[str] = []

    if isinstance(event, dict):
        name = event.get("service_name") or "This event"
        detail = str(name)
        price = _event_price_text(event)
        if price:
            detail += f" is listed at {price}"
        spots = _spots(event)
        if spots is not None:
            if spots == 0:
                detail += " with 0 spots remaining (sold out)"
            else:
                detail += f" with {spots} spots remaining"
        details.append(detail)

    if isinstance(provider, dict):
        event_provider_id = event.get("provider_id") if isinstance(event, dict) else None
        if not _same_id(provider.get("id"), event_provider_id):
            name = provider.get("name") or "This provider"
            detail = str(name)
            price = _provider_price_text(provider)
            if price:
                detail += f" is listed as {price}"
            else:
                detail += " has no confirmed price in the listing"
            details.append(detail)

    if details:
        return (
            "I can only confirm the current listing: "
            + "; ".join(details)
            + ". Would you like more details or another option?"
        )
    return (
        "I can't verify that price or availability from the current listings. "
        "Would you like me to show a confirmed option?"
    )


def ground_reply(
    reply: str,
    *,
    provider: dict | None = None,
    event: dict | None = None,
    user_message: str = "",
) -> GroundingResult:
    """Validate explicit price/availability claims against the fetched data.

    Provider and event objects are the canonical rows already used to resolve
    the response ids. ``user_message`` may contribute budget amounts because
    quoting the user's own budget is not a hallucination.
    """
    if not isinstance(reply, str) or not reply.strip():
        return GroundingResult(reply=reply or "")

    violations: list[str] = []

    claims = extract_etb_amounts(reply)
    free_claim = bool(_FREE_CLAIM_RE.search(reply))
    if (claims or free_claim) and (provider is not None or event is not None):
        allowed = set(extract_user_budget_amounts(user_message))
        if isinstance(provider, dict):
            allowed |= _price_numbers(provider.get("price_range"))
        if isinstance(event, dict):
            allowed |= _price_numbers(event.get("price_etb"))
        listing_is_free = _listing_is_free(provider, event)
        if listing_is_free:
            allowed.add(0)
        if free_claim and not listing_is_free:
            violations.append("price")
        if any(claim not in allowed for claim in claims):
            violations.append("price")

    availability_claims, sold_out_claim = extract_availability_claims(reply)
    positive_availability = _has_positive_availability(reply)
    booking_claim = bool(_BOOKING_CLAIM_RE.search(reply))
    if (
        availability_claims
        or sold_out_claim
        or positive_availability
        or booking_claim
    ):
        listed_spots = _spots(event)
        if event is None or listed_spots is None:
            violations.append("availability")
        else:
            if any(claim != listed_spots for claim in availability_claims):
                violations.append("availability")
            if sold_out_claim and listed_spots > 0:
                violations.append("availability")
            if positive_availability and listed_spots == 0:
                violations.append("availability")
            # The listing says how many places remain; it does not prove that
            # the concierge reserved one. Never let a booking confirmation pass.
            if booking_claim:
                violations.append("availability")

    if not violations:
        return GroundingResult(reply=reply)

    return GroundingResult(
        reply=_canonical_reply(provider, event),
        violations=tuple(dict.fromkeys(violations)),
    )
