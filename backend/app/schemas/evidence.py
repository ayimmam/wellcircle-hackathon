"""D2 evidence submission request schemas."""

from pydantic import BaseModel


class BotEvidenceSubmitRequest(BaseModel):
    """Bot POST /api/bot/evidence — staff submits a photo for an ended event."""
    telegram_id: int
    event_id: str
    telegram_file_id: str


class EvidenceReviewRequest(BaseModel):
    """Admin POST /api/admin/evidence/{id}/review."""
    action: str  # "approve" | "reject"
    points_per_participant: int | None = None
