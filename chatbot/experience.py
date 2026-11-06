"""Server-owned conversation welcome state for the Circler concierge.

The browser must not decide whether this is a first visit, a returning
conversation, or an expired one. Those decisions depend on the authenticated
owner and the authoritative ``chat_memory.updated_at`` value, so the server
returns a small, explicit experience payload when a client opens the chat.

Keeping this logic here also makes the three clients consistent: the Telegram
Mini App, the public web app, and the standalone demo all render the same copy
and the same four suggestion cards.
"""

from __future__ import annotations

from dataclasses import dataclass

FIRST_VISIT = "first_visit"
RETURNING = "returning"
EXPIRED = "expired"

FULL_INTRO = (
    "🌿 Welcome to Well Circle — I'm Circler, your personal wellness concierge.\n\n"
    "Here is what I can help you do right now:\n"
    "1. Find a service — gyms, spas, yoga, nutrition, therapy, and more.\n"
    "2. Discover upcoming wellness events and classes around Addis Ababa.\n"
    "3. Match options to your neighbourhood and budget in ETB.\n"
    "4. Turn a wellness goal into a simple next step.\n\n"
    "Pick one of the suggestions below, or tell me what you're looking for."
)

SHORT_WELCOME = (
    "Welcome back! Your previous conversation has expired, so let's start fresh. "
    "What would you like to explore today?"
)

# These are the four cards the product contract promises on a first visit and
# after an expired conversation. The prompt is separate from the label so the
# UI can show a short, friendly chip while still sending a complete request.
SUGGESTION_CARDS = (
    {
        "id": "events",
        "label": "Wellness events this week",
        "prompt": "Wellness events this week",
        "needs_location": False,
    },
    {
        "id": "gyms",
        "label": "Affordable gyms around me",
        "prompt": "Affordable gyms around me",
        "needs_location": True,
    },
    {
        "id": "yoga",
        "label": "Yoga classes this week",
        "prompt": "Yoga classes this week",
        "needs_location": False,
    },
    {
        "id": "nutrition",
        "label": "Nutrition coaching options",
        "prompt": "Nutrition coaching options",
        "needs_location": False,
    },
)


@dataclass(frozen=True)
class Welcome:
    """The greeting and cards to render for this visit."""

    text: str
    cards: tuple[dict, ...]


def _with_name(text: str, profile_name: str | None) -> str:
    name = (profile_name or "").strip()
    if not name:
        return text
    if text.startswith("Welcome back!"):
        return text.replace("Welcome back!", f"Welcome back, {name}!", 1)
    return f"Hi {name}! {text}"


def build_welcome(experience: str, profile_name: str | None = None) -> Welcome | None:
    """Return the welcome for a visit, or ``None`` for a live conversation.

    A returning conversation within the inactivity window must restore its
    history without repeating a greeting. Only a genuinely new conversation or
    one whose stored history has expired gets a welcome.
    """
    if experience == RETURNING:
        return None

    text = FULL_INTRO if experience == FIRST_VISIT else SHORT_WELCOME
    return Welcome(
        text=_with_name(text, profile_name),
        cards=SUGGESTION_CARDS,
    )
