"""Schemas for the Phase D read-only reconciliation planner."""

from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ReconciliationAdminDryRunRequest(BaseModel):
    canonical_user_id: UUID
    source_user_id: UUID


class ReconciliationDryRunRequest(BaseModel):
    """User-facing dry run: the JWT identifies the canonical account.

    The source account is discovered only from a fresh, server-verified
    provider credential. Client-supplied user ids/subjects are not accepted.
    """

    source_provider: Literal["google", "telegram"]
    google_id_token: Optional[str] = Field(default=None, max_length=8192)
    telegram_init_data: Optional[str] = Field(default=None, max_length=8192)
    telegram_login: Optional[dict] = None


class ReconciliationBlocker(BaseModel):
    code: str
    table: Optional[str] = None
    message: str


class ReconciliationTableReport(BaseModel):
    table: str
    ownership_column: str
    relationship: str
    sensitivity: str
    strategy: str
    canonical_count: int = 0
    source_count: int = 0
    transferable: int = 0
    duplicates: int = 0
    conflicts: int = 0
    excluded: int = 0
    note: Optional[str] = None


class ReconciliationDryRunResponse(BaseModel):
    canonical_user_id: str
    source_user_id: str
    generated_at: str
    read_only: bool = True
    merge_implemented: bool = False
    safe_to_merge: bool = False
    merge_status: str
    blockers: List[ReconciliationBlocker] = Field(default_factory=list)
    manual_decisions: List[ReconciliationBlocker] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    tables: List[ReconciliationTableReport] = Field(default_factory=list)
    circler: Dict[str, Any] = Field(default_factory=dict)
    not_user_owned: List[Dict[str, Any]] = Field(default_factory=list)
    unresolved_rules: List[str] = Field(default_factory=list)
