"""Centralized points service — single entry point for ALL points mutations.

Consolidates B1 (transaction ledger) and B2 (engine consolidation).
Every call to `apply_transaction` inserts a ledger row AND updates the
cached `User.points_balance` in the same DB transaction.

Also houses tier calculation, constants, and cap-checking helpers for D3.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.point_transaction import PointTransaction


# ── Named constants (B2: moved from points_engine.py + hardcoded values) ────

POINTS_CHECKIN = 10
POINTS_BOOKING_BONUS = 50
POINTS_DECAY_PER_DAY = 5
DECAY_AFTER_DAYS = 3
POINTS_REFERRAL = 30

# D3 caps
PROVIDER_AWARD_MAX_PER_CUSTOMER_PER_DAY = 1  # awards
PROVIDER_AWARD_MAX_POINTS_PER_AWARD = 50
PROVIDER_AWARD_MAX_POINTS_PER_DAY = 300
REFERRAL_MAX_PER_MONTH = 10

# Transaction type literals
TXN_CHECKIN = "checkin"
TXN_BOOKING_BONUS = "booking_bonus"
TXN_CHALLENGE = "challenge"
TXN_GIFT_SENT = "gift_sent"
TXN_GIFT_RECEIVED = "gift_received"
TXN_REDEMPTION = "redemption"
TXN_DECAY = "decay"
TXN_EVENT_PARTICIPATION = "event_participation"
TXN_PROVIDER_AWARD = "provider_award"
TXN_ADMIN_ADJUST = "admin_adjust"
TXN_REFERRAL = "referral"

VALID_TXN_TYPES = {
    TXN_CHECKIN, TXN_BOOKING_BONUS, TXN_CHALLENGE,
    TXN_GIFT_SENT, TXN_GIFT_RECEIVED, TXN_REDEMPTION,
    TXN_DECAY, TXN_EVENT_PARTICIPATION, TXN_PROVIDER_AWARD,
    TXN_ADMIN_ADJUST, TXN_REFERRAL,
}


# ── Tier calculation (B2: single canonical implementation) ──────────────────

def get_points_tier(balance: int) -> Tuple[str, str]:
    """Returns (tier_name, emoji) based on points balance."""
    if balance >= 700:
        return ("forest", "🌲")
    elif balance >= 300:
        return ("grove", "🌳")
    elif balance >= 100:
        return ("sprout", "🌿")
    else:
        return ("seed", "🌱")


# ── Core transaction function ──────────────────────────────────────────────

def apply_transaction(
    db: Session,
    user: User,
    amount: int,
    txn_type: str,
    *,
    provider_id: Optional[UUID] = None,
    reference_id: Optional[UUID] = None,
    note: Optional[str] = None,
) -> PointTransaction:
    """Insert a ledger row and update the user's cached balance atomically.

    This is the ONLY function that should mutate `User.points_balance`.
    All call sites must route through here.

    Args:
        db: SQLAlchemy session (caller manages commit)
        user: The User ORM instance whose balance changes
        amount: Signed integer (positive = earn, negative = spend/decay)
        txn_type: One of VALID_TXN_TYPES
        provider_id: Optional provider context
        reference_id: Optional FK to the triggering entity
        note: Optional freeform note

    Returns:
        The created PointTransaction row (not yet committed — caller commits)
    """
    if txn_type not in VALID_TXN_TYPES:
        raise ValueError(f"Invalid transaction type: {txn_type}")

    txn = PointTransaction(
        user_id=user.id,
        amount=amount,
        type=txn_type,
        provider_id=provider_id,
        reference_id=reference_id,
        note=note,
    )
    db.add(txn)

    # Update cached balance (never go below 0)
    new_balance = max(0, (user.points_balance or 0) + amount)
    user.points_balance = new_balance

    return txn


# ── History query ──────────────────────────────────────────────────────────

def get_user_transactions(
    db: Session,
    user_id: UUID,
    limit: int = 30,
    txn_type: Optional[str] = None,
) -> List[PointTransaction]:
    """Get recent point transactions for a user (newest first)."""
    query = db.query(PointTransaction).filter(
        PointTransaction.user_id == user_id,
        PointTransaction.reversed_by.is_(None),  # exclude reversed
    )
    if txn_type:
        query = query.filter(PointTransaction.type == txn_type)
    return query.order_by(PointTransaction.created_at.desc()).limit(limit).all()


# ── D3 cap-checking helpers ───────────────────────────────────────────────

def count_provider_awards_to_customer_today(
    db: Session,
    provider_id: UUID,
    customer_user_id: UUID,
) -> int:
    """Count awards from a specific provider to a specific customer today."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return (
        db.query(PointTransaction)
        .filter(
            PointTransaction.user_id == customer_user_id,
            PointTransaction.provider_id == provider_id,
            PointTransaction.type == TXN_PROVIDER_AWARD,
            PointTransaction.created_at >= today_start,
            PointTransaction.reversed_by.is_(None),
        )
        .count()
    )


def sum_provider_awards_today(
    db: Session,
    provider_id: UUID,
) -> int:
    """Total points awarded by a provider today (across all customers)."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result = (
        db.query(func.coalesce(func.sum(PointTransaction.amount), 0))
        .filter(
            PointTransaction.provider_id == provider_id,
            PointTransaction.type == TXN_PROVIDER_AWARD,
            PointTransaction.created_at >= today_start,
            PointTransaction.reversed_by.is_(None),
        )
        .scalar()
    )
    return int(result)


def count_referrals_this_month(
    db: Session,
    user_id: UUID,
) -> int:
    """Count credited referrals for a user in the current calendar month."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(PointTransaction)
        .filter(
            PointTransaction.user_id == user_id,
            PointTransaction.type == TXN_REFERRAL,
            PointTransaction.created_at >= month_start,
            PointTransaction.reversed_by.is_(None),
        )
        .count()
    )


# ── Reversal ──────────────────────────────────────────────────────────────

def reverse_transaction(
    db: Session,
    original_txn: PointTransaction,
    note: Optional[str] = None,
) -> PointTransaction:
    """Reverse a previous transaction. Creates a compensating row and marks
    the original as reversed.

    Returns the new compensating PointTransaction (caller commits).
    """
    if original_txn.reversed_by is not None:
        raise ValueError("Transaction already reversed")

    compensating = apply_transaction(
        db,
        user=db.query(User).filter(User.id == original_txn.user_id).one(),
        amount=-original_txn.amount,
        txn_type=original_txn.type,
        provider_id=original_txn.provider_id,
        reference_id=original_txn.reference_id,
        note=note or f"Reversal of txn {original_txn.id}",
    )
    db.flush()  # ensure compensating.id is populated
    original_txn.reversed_by = compensating.id
    return compensating


# ── Decay eligibility (updated per plan) ──────────────────────────────────

def get_last_positive_transaction_at(
    db: Session,
    user_id: UUID,
) -> Optional[datetime]:
    """Return the timestamp of the user's most recent positive-amount
    ledger transaction (any type except decay). Used for decay eligibility
    instead of last_checkin_at once earning diversifies.
    """
    row = (
        db.query(PointTransaction.created_at)
        .filter(
            PointTransaction.user_id == user_id,
            PointTransaction.amount > 0,
            PointTransaction.reversed_by.is_(None),
        )
        .order_by(PointTransaction.created_at.desc())
        .first()
    )
    return row[0] if row else None
