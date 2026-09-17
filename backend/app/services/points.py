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

# NOTE: Check-in no longer earns points as of the points-economy rework.
# POINTS_CHECKIN is retained for backward compatibility with existing ledger
# rows of type TXN_CHECKIN. New check-ins mint 0 points.
POINTS_CHECKIN = 10
POINTS_BOOKING_BONUS = 50
POINTS_DECAY_PER_DAY = 5
DECAY_AFTER_DAYS = 3
POINTS_REFERRAL = 30
# Endowed progress: onboarding completion seeds the balance so the first-reward
# progress bar never starts at zero
POINTS_WELCOME = 20
# Returning after a broken streak (3+ days built up, no freeze available)
# should feel like a win, not just a reset — "reward the comeback."
POINTS_COMEBACK = 15
COMEBACK_MIN_PREVIOUS_STREAK = 3

# D3 caps
PROVIDER_AWARD_MAX_PER_CUSTOMER_PER_DAY = 1  # awards
PROVIDER_AWARD_MAX_POINTS_PER_AWARD = 50
PROVIDER_AWARD_MAX_POINTS_PER_DAY = 300
REFERRAL_MAX_PER_MONTH = 10

# WS1/WS2 (docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md): stories and posts earn
# points, capped per UTC day so spamming either doesn't farm the economy.
# Defaults per the plan's §15 "confirm or override" list.
POINTS_STORY = 20
STORY_POINTS_DAILY_CAP = 1  # stories that earn per UTC day
POINTS_POST = 10
POST_POINTS_DAILY_CAP = 3  # posts that earn per UTC day

# WS9: changing the profile photo always costs 10, uncapped and unblocked —
# apply_transaction() floors the balance at 0 rather than refusing the change.
POINTS_PROFILE_PHOTO_COST = 10

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
TXN_WELCOME = "welcome"
TXN_COMEBACK = "comeback"
TXN_STORY = "story"
TXN_POST = "post"
TXN_PROFILE_PHOTO = "profile_photo"

VALID_TXN_TYPES = {
    TXN_CHECKIN, TXN_BOOKING_BONUS, TXN_CHALLENGE,
    TXN_GIFT_SENT, TXN_GIFT_RECEIVED, TXN_REDEMPTION,
    TXN_DECAY, TXN_EVENT_PARTICIPATION, TXN_PROVIDER_AWARD,
    TXN_ADMIN_ADJUST, TXN_REFERRAL, TXN_WELCOME, TXN_COMEBACK,
    TXN_STORY, TXN_POST, TXN_PROFILE_PHOTO,
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


def award_capped(
    db: Session,
    user: User,
    txn_type: str,
    amount: int,
    daily_cap: int,
    *,
    reference_id: Optional[UUID] = None,
) -> int:
    """Award `amount` points via `apply_transaction`, unless the user already
    has `daily_cap` ledger rows of `txn_type` since UTC midnight — then it's
    a no-op. Returns the amount actually awarded (0 or `amount`).

    Counts ledger rows, not live content, so posting-then-deleting can't
    reset the cap (WS1/WS2's story/post point caps). Caller still commits —
    same convention as `apply_transaction`.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count_today = (
        db.query(PointTransaction)
        .filter(
            PointTransaction.user_id == user.id,
            PointTransaction.type == txn_type,
            PointTransaction.created_at >= today_start,
        )
        .count()
    )
    if count_today >= daily_cap:
        return 0
    apply_transaction(db, user, amount, txn_type, reference_id=reference_id)
    return amount


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
