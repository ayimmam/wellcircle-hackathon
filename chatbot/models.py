from pydantic import BaseModel


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
    # NEW: client-provided session id. Optional — server will generate one
    # if missing and hand it back in the response.
    session_id: str | None = None
    # Kept for backward compatibility with older clients. Only used to seed
    # a brand-new session that has no server-side memory yet.
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
