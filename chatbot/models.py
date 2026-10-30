from typing import Any

from pydantic import BaseModel, Field


FALLBACK_PROVIDERS = [
    {
        "id": "fb-001",
        "name": "Bole Wellness Hub",
        "category": "gym",
        "description": "Modern gym with personal training and group classes.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 800-2500",
        "rating": 4.6,
    },
    {
        "id": "fb-002",
        "name": "Serenity Yoga Studio",
        "category": "yoga",
        "description": "Calm, beginner-friendly yoga studio with daily sessions.",
        "location_text": "Kazanchis, Addis Ababa",
        "price_range": "ETB 500-1200",
        "rating": 4.8,
    },
    {
        "id": "fb-003",
        "name": "NutriLife Consulting",
        "category": "nutrition",
        "description": "Affordable nutrition planning and weight management coaching.",
        "location_text": "CMC, Addis Ababa",
        "price_range": "ETB 400-1000",
        "rating": 4.5,
    },
    {
        "id": "fb-004",
        "name": "Spa Oasis Addis",
        "category": "spa",
        "description": "Relaxing massage and spa treatments in a tranquil setting.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 600-2000",
        "rating": 4.7,
    },
    {
        "id": "fb-005",
        "name": "Mindful Therapy Center",
        "category": "therapy",
        "description": "Licensed therapists offering individual counseling sessions.",
        "location_text": "Sarbet, Addis Ababa",
        "price_range": "ETB 700-1800",
        "rating": 4.9,
    },
]

PROMPT_FIELDS = (
    "id",
    "name",
    "category",
    "description",
    "location_text",
    "price_range",
    "rating",
)

EVENT_PROMPT_FIELDS = (
    "id",
    "provider_id",
    "service_name",
    "description",
    "starts_at",
    "ends_at",
    "price_etb",
    "spots_remaining",
)

FALLBACK_EVENTS = [
    {
        "id": "fe-001",
        "provider_id": "fb-001",
        "service_name": "Sunrise HIIT at Bole Wellness Hub",
        "description": "45-minute outdoor interval class for all levels.",
        "starts_at": "2026-09-12T06:30:00+00:00",
        "ends_at": "2026-09-12T07:15:00+00:00",
        "price_etb": 250,
        "spots_remaining": 8,
    },
    {
        "id": "fe-002",
        "provider_id": "fb-002",
        "service_name": "Weekend Restorative Yoga",
        "description": "Gentle 60-minute session to unwind after the week.",
        "starts_at": "2026-09-13T10:00:00+00:00",
        "ends_at": "2026-09-13T11:00:00+00:00",
        "price_etb": 400,
        "spots_remaining": 12,
    },
]


class ChatMessage(BaseModel):
    role: str
    content: str


class ConciergeRequest(BaseModel):
    message: str
    # Client-provided session id. Optional — the server generates one when it
    # is missing and returns it in the response. Keep the same bound as the
    # GET /session query parameter.
    session_id: str | None = Field(default=None, max_length=200)
    # Kept only for backward compatibility with older clients. The server
    # never seeds conversation history from this field; session_id plus the
    # stored chat_memory row is the sole source of truth.
    history: list[ChatMessage] = []


class ConciergeResponse(BaseModel):
    reply: str
    provider_id: str | None = None
    provider_name: str | None = None
    event_id: str | None = None
    event_name: str | None = None
    event_provider_id: str | None = None
    data_source: str = "unknown"
    # NEW: echoed/generated session id so the client can persist it.
    session_id: str = ""
    # Issued only when the request started a new anonymous identity. Authenticated
    # users never receive one, and anonymous tokens are not user JWTs.
    anonymous_token: str | None = None
    # Persistent profile name, independent of the expiring chat history.
    profile_name: str | None = None


class SuggestionCard(BaseModel):
    """One server-owned quick-request card."""

    id: str
    label: str
    prompt: str
    needs_location: bool = False


class WelcomePayload(BaseModel):
    """The greeting a client should render before the user types."""

    text: str
    cards: list[SuggestionCard] = []


class ConciergeSessionResponse(BaseModel):
    """Conversation state returned when a client opens the chat."""

    session_id: str
    # first_visit | returning | expired
    experience: str
    welcome: WelcomePayload | None = None
    # Only active, owned history is returned. Expired or another owner's
    # history is never included.
    history: list[ChatMessage] = []
    profile_name: str | None = None
    anonymous_token: str | None = None
    memory_available: bool = True


class ConciergeProfileUpdate(BaseModel):
    """Explicit, consent-gated update of persistent profile data."""

    display_name: str | None = None
    preferences: dict[str, Any] | None = None
    # Must be true for any persistent write. Omitted/false is rejected.
    consent: bool = False


class ConciergeProfileResponse(BaseModel):
    display_name: str | None = None
    preferences: dict[str, Any] = {}
    consent_recorded: bool = False


class ConciergeHistoryClearResponse(BaseModel):
    """Result of a server-side conversation-history clear.

    ``session_id`` is a fresh id for the next conversation; the client adopts
    it instead of the cleared one so the next open starts a genuinely new
    conversation. The persistent profile is never touched by this operation.
    """

    cleared: bool = True
    session_id: str = ""
