"""Read-only duplicate-account reconciliation planning.

Phase D deliberately stops short of a destructive merge.  This module builds a
complete, side-effect-free picture of what a merge between two existing
``users.id`` values would touch, what conflicts exist, and which decisions are
still missing.  It never inserts, updates, deletes, flushes or commits.

The plan is intentionally conservative:

* every table that references a user is inspected (including tables without a
  formal foreign key, such as ``chat_memory``/``chat_profile``);
* only counts, provider names, booleans and preference *keys* are returned —
  conversation text, names, emails, phone numbers, tokens and opaque provider
  subjects never leave the database;
* a table with an unresolved business rule produces an explicit blocker or
  manual-decision entry rather than an assumed rule;
* the source account is never deleted by this module.

Callers must treat a plan with ``safe_to_merge == false`` as non-actionable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Optional
from uuid import UUID

from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.models.admin_notification import AdminNotification
from app.models.auth_identity import AuthIdentity
from app.models.booking import Booking
from app.models.booking_status_event import BookingStatusEvent
from app.models.circle import Circle, CircleMember
from app.models.circle_story import CircleStory, CircleStoryView
from app.models.circle_subscription import CircleRevenueLedger, CircleSubscription
from app.models.community import CommunityFeedEvent, CommunityMember
from app.models.community_challenge import ChallengeAward
from app.models.event_inventory_log import EventInventoryLog
from app.models.evidence_submission import EvidenceSubmission
from app.models.feedback import Feedback
from app.models.follower import Follower
from app.models.point_transaction import PointTransaction
from app.models.post import Post, PostComment, Reaction
from app.models.provider import Provider
from app.models.provider_event import ProviderEvent
from app.models.provider_invite import ProviderInvite
from app.models.strava_activity_cache import StravaActivityCache
from app.models.story import Story, StoryLike, StoryView
from app.models.trainer_verification import TrainerVerification
from app.models.user import User
from app.models.user_notification import UserNotification
from app.models.user_redemption import UserRedemption
from app.models.wearable import UserWearable, WalkScoreDay, WearableDailySteps


class ReconciliationError(Exception):
    """A caller-visible validation failure for a reconciliation plan."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class TableRule:
    table: str
    ownership_column: str
    relationship: str
    sensitivity: str
    strategy: str
    note: str
    model: Any = None
    user_column: Optional[str] = None


# Strategy vocabulary matches the Phase D report:
#   direct_transfer | dedupe | aggregate | special | never_auto | not_user_owned
TABLE_RULES: tuple[TableRule, ...] = (
    TableRule(
        "users",
        "id",
        "canonical account row (source row is retained, never deleted)",
        "critical",
        "special",
        "Profile fields, credentials, roles, points, streaks and referrals need explicit rules.",
        User,
        "id",
    ),
    TableRule(
        "auth_identities",
        "user_id",
        "many-to-one users.id (CASCADE)",
        "authentication",
        "special",
        "Move verified identities; a second Telegram/WhatsApp identity conflicts with the single users.telegram_id/phone_number model.",
        AuthIdentity,
        "user_id",
    ),
    TableRule(
        "account_link_challenges",
        "user_id",
        "many-to-one users.id (CASCADE)",
        "authentication (ephemeral)",
        "never_auto",
        "Short-lived linking challenges are not durable user data; leave them to expire.",
        None,
        None,
    ),
    TableRule(
        "bookings",
        "user_id",
        "many-to-one users.id",
        "financial / personal",
        "direct_transfer",
        "Transfer history; unique (user_id, idempotency_key) collisions must block.",
        Booking,
        "user_id",
    ),
    TableRule(
        "point_transactions",
        "user_id",
        "many-to-one users.id",
        "financial",
        "aggregate",
        "Ledger rows are immutable history; cached points_balance needs an approved aggregation rule.",
        PointTransaction,
        "user_id",
    ),
    TableRule(
        "user_redemptions",
        "user_id",
        "many-to-one users.id",
        "financial / fulfilment",
        "direct_transfer",
        "Redeem history transfers; per-user redemption caps then apply across both histories.",
        UserRedemption,
        "user_id",
    ),
    TableRule(
        "posts",
        "user_id",
        "many-to-one users.id",
        "content",
        "direct_transfer",
        "Authored content is preserved under the canonical user.",
        Post,
        "user_id",
    ),
    TableRule(
        "reactions",
        "user_id",
        "many-to-one users.id",
        "content / social",
        "dedupe",
        "No DB uniqueness exists, but a merged user reacting twice to the same post is a semantic duplicate.",
        Reaction,
        "user_id",
    ),
    TableRule(
        "post_comments",
        "user_id",
        "many-to-one users.id",
        "content",
        "direct_transfer",
        "Comment history is preserved.",
        PostComment,
        "user_id",
    ),
    TableRule(
        "community_members",
        "user_id",
        "many-to-one users.id, composite PK (community_id, user_id)",
        "membership",
        "dedupe",
        "One membership per community; overlapping rows dedupe, others transfer.",
        CommunityMember,
        "user_id",
    ),
    TableRule(
        "community_feed_events",
        "user_id",
        "many-to-one users.id",
        "activity",
        "direct_transfer",
        "Both users' activity history is retained; no DB uniqueness to collide.",
        CommunityFeedEvent,
        "user_id",
    ),
    TableRule(
        "challenge_awards",
        "user_id",
        "many-to-one users.id, unique (challenge_id, user_id)",
        "gamification",
        "dedupe",
        "Transfer awards; two awards for the same challenge collide on the unique constraint and need a manual decision.",
        ChallengeAward,
        "user_id",
    ),
    TableRule(
        "circle_members",
        "user_id",
        "many-to-one users.id, composite PK (circle_id, user_id)",
        "membership",
        "dedupe",
        "One membership per circle; weekly_points is a dead column (leaderboards recompute from the ledger).",
        CircleMember,
        "user_id",
    ),
    TableRule(
        "circle_subscriptions",
        "user_id",
        "many-to-one users.id",
        "financial",
        "direct_transfer",
        "Unique (circle_id, user_id, period_start) collisions must block.",
        CircleSubscription,
        "user_id",
    ),
    TableRule(
        "circle_stories",
        "user_id",
        "many-to-one users.id",
        "content",
        "direct_transfer",
        "Story authorship transfers; expires/deleted flags are unchanged.",
        CircleStory,
        "user_id",
    ),
    TableRule(
        "circle_story_views",
        "user_id",
        "many-to-one users.id, composite PK (story_id, user_id)",
        "activity",
        "dedupe",
        "A view is idempotent; overlapping rows dedupe.",
        CircleStoryView,
        "user_id",
    ),
    TableRule(
        "stories",
        "user_id",
        "many-to-one users.id",
        "content",
        "direct_transfer",
        "Story authorship transfers; expires/deleted flags are unchanged.",
        Story,
        "user_id",
    ),
    TableRule(
        "story_views",
        "user_id",
        "many-to-one users.id, composite PK (story_id, user_id)",
        "activity",
        "dedupe",
        "A view is idempotent; overlapping rows dedupe.",
        StoryView,
        "user_id",
    ),
    TableRule(
        "story_likes",
        "user_id",
        "many-to-one users.id, composite PK (story_id, user_id)",
        "social",
        "dedupe",
        "A like is idempotent; overlapping rows dedupe.",
        StoryLike,
        "user_id",
    ),
    TableRule(
        "feedback",
        "user_id",
        "many-to-one users.id",
        "support / personal",
        "direct_transfer",
        "Support history transfers.",
        Feedback,
        "user_id",
    ),
    TableRule(
        "user_notifications",
        "user_id",
        "many-to-one users.id (CASCADE)",
        "activity",
        "direct_transfer",
        "Notification history transfers; actor_user_id has no FK and is audit history.",
        UserNotification,
        "user_id",
    ),
    TableRule(
        "evidence_submissions",
        "submitter_user_id",
        "many-to-one users.id",
        "content / moderation",
        "direct_transfer",
        "Submitter history transfers; reviewed_by is audit history and is not rewritten.",
        EvidenceSubmission,
        "submitter_user_id",
    ),
    TableRule(
        "trainer_verifications",
        "user_id",
        "one-to-one users.id (UNIQUE)",
        "verification / personal",
        "direct_transfer",
        "Transfer only when one account has a row; two rows collide on unique(user_id).",
        TrainerVerification,
        "user_id",
    ),
    TableRule(
        "strava_activity_cache",
        "user_id",
        "many-to-one users.id (CASCADE)",
        "health",
        "direct_transfer",
        "Cache rows transfer; the unique Strava activity id is global and cannot collide across accounts.",
        StravaActivityCache,
        "user_id",
    ),
    TableRule(
        "user_wearables",
        "user_id",
        "many-to-one users.id (CASCADE)",
        "health / external identity",
        "special",
        "Terra reference_id is the user UUID used by webhooks; an active external connection cannot be repointed safely.",
        UserWearable,
        "user_id",
    ),
    TableRule(
        "wearable_daily_steps",
        "wearable_id",
        "many-to-one user_wearables.id (CASCADE)",
        "health",
        "special",
        "Follows its wearable; blocked while an active Terra connection exists.",
        WearableDailySteps,
        None,
    ),
    TableRule(
        "walk_score_days",
        "user_id",
        "many-to-one users.id (CASCADE), PK (user_id, activity_date)",
        "health",
        "aggregate",
        "Same-day rows need an approved aggregation rule before users.walk_score can be recomputed.",
        WalkScoreDay,
        "user_id",
    ),
    TableRule(
        "followers",
        "follower_id / following_id",
        "many-to-many users.id, composite PK",
        "social",
        "dedupe",
        "Dedupe mirrored edges and remove self-follows created by the merge.",
        Follower,
        None,
    ),
    TableRule(
        "circles",
        "owner_id",
        "many-to-one users.id",
        "business / ownership",
        "special",
        "Circle ownership is a business role; source-owned circles block an automatic merge.",
        Circle,
        "owner_id",
    ),
    TableRule(
        "providers",
        "owner_user_id",
        "many-to-one users.id",
        "business / ownership",
        "special",
        "Provider ownership and provider-portal credentials block an automatic merge.",
        Provider,
        "owner_user_id",
    ),
    TableRule(
        "provider_events",
        "staff_user_id",
        "many-to-one users.id",
        "business / staffing",
        "special",
        "Event staff assignment is a business role and blocks an automatic merge.",
        ProviderEvent,
        "staff_user_id",
    ),
    TableRule(
        "provider_invites",
        "created_by_user_id / used_by_user_id",
        "many-to-one users.id",
        "business / audit",
        "never_auto",
        "Invite provenance is business/audit history; source row is retained so the FK stays valid.",
        ProviderInvite,
        None,
    ),
    TableRule(
        "admin_notifications",
        "admin_user_id / related_user_id",
        "many-to-one users.id",
        "admin audit",
        "never_auto",
        "Admin audit references are never rewritten by an account merge.",
        AdminNotification,
        None,
    ),
    TableRule(
        "booking_status_events",
        "actor_user_id",
        "many-to-one users.id (SET NULL)",
        "financial audit",
        "never_auto",
        "Historical status actors are audit evidence; source row retention keeps the FK valid.",
        BookingStatusEvent,
        None,
    ),
    TableRule(
        "circle_revenue_ledger",
        "subscription_id",
        "derived from circle_subscriptions",
        "financial",
        "not_user_owned",
        "Follows the subscription; never rewritten directly.",
        CircleRevenueLedger,
        None,
    ),
    TableRule(
        "event_inventory_log",
        "booking_id",
        "derived from bookings/events",
        "financial audit",
        "not_user_owned",
        "Follows the booking; never rewritten directly.",
        EventInventoryLog,
        None,
    ),
    TableRule(
        "chat_memory",
        "owner_id (owner_type='user')",
        "no foreign key; owner_type/owner_id are the chatbot ownership key",
        "sensitive conversation",
        "direct_transfer",
        "Update owner_id to the canonical UUID while preserving session_id and messages; session-id collisions must block.",
        None,
        None,
    ),
    TableRule(
        "chat_profile",
        "owner_id (owner_type='user')",
        "no foreign key; composite PK (owner_type, owner_id)",
        "sensitive personalization",
        "special",
        "One row per owner; conflicting display names/preference keys must be resolved explicitly, never overwritten.",
        None,
        None,
    ),
)

NOT_USER_OWNED = (
    "communities",
    "community_challenges",
    "products",
    "provider_promotions",
    "provider_subscriptions",
    "whatsapp_otp_challenges",
)

SENSITIVE_FIELD_NAMES = (
    "name",
    "telegram_handle",
    "phone_number",
    "bio",
    "photo_url",
    "strava_access_token",
    "strava_refresh_token",
    "password_hash",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _table_exists(db: Session, name: str) -> bool:
    try:
        return inspect(db.get_bind()).has_table(name)
    except Exception:
        return False


def _scalar(db: Session, statement) -> int:
    value = db.execute(statement).scalar()
    return int(value or 0)


def _count_model(db: Session, model: Any, column_name: str, user_id: UUID) -> int:
    if not _table_exists(db, model.__tablename__):
        return 0
    column = getattr(model, column_name)
    return _scalar(db, db.query(func.count()).select_from(model).filter(column == user_id).statement)


def _user_identities(db: Session, user_id: UUID) -> list[AuthIdentity]:
    if not _table_exists(db, "auth_identities"):
        return []
    return (
        db.query(AuthIdentity)
        .filter(AuthIdentity.user_id == user_id)
        .order_by(AuthIdentity.provider.asc(), AuthIdentity.id.asc())
        .all()
    )


def _identity_summary(identities: Iterable[AuthIdentity]) -> dict:
    identities = list(identities)
    providers = sorted({identity.provider for identity in identities})
    counts: dict[str, int] = {}
    for identity in identities:
        counts[identity.provider] = counts.get(identity.provider, 0) + 1
    return {"providers": providers, "counts": counts, "total": len(identities)}


def _user_summary(user: User, identities: list[AuthIdentity]) -> dict:
    """Safe account summary: no names, emails, handles, phones or tokens."""
    identity_summary = _identity_summary(identities)
    return {
        "user_id": str(user.id),
        "providers": identity_summary["providers"],
        "identity_count": identity_summary["total"],
        "identity_counts": identity_summary["counts"],
        "has_telegram_id": bool(user.telegram_id),
        "has_phone_number": bool(user.phone_number),
        "has_strava": bool(user.strava_athlete_id),
        "has_login_credentials": bool(user.login_username or user.password_hash),
        "is_onboarded": bool(user.is_onboarded),
        "is_provider": bool(user.is_provider),
        "is_super_admin": bool(user.is_super_admin),
        "is_verified_trainer": bool(user.is_verified_trainer),
        "points_balance": int(user.points_balance or 0),
        "walk_score": int(user.walk_score or 0),
        "current_streak": int(user.current_streak or 0),
        "longest_streak": int(user.longest_streak or 0),
        "freeze_count": int(user.freeze_count or 0),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _booking_idempotency_collisions(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "bookings"):
        return 0
    source_keys = db.query(Booking.idempotency_key).filter(
        Booking.user_id == source_id, Booking.idempotency_key.isnot(None)
    )
    return _scalar(
        db,
        db.query(func.count())
        .select_from(Booking)
        .filter(
            Booking.user_id == canonical_id,
            Booking.idempotency_key.isnot(None),
            Booking.idempotency_key.in_(source_keys),
        )
        .statement,
    )


def _challenge_award_collisions(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "challenge_awards"):
        return 0
    source_keys = db.query(ChallengeAward.challenge_id).filter(ChallengeAward.user_id == source_id)
    return _scalar(
        db,
        db.query(func.count())
        .select_from(ChallengeAward)
        .filter(ChallengeAward.user_id == canonical_id, ChallengeAward.challenge_id.in_(source_keys))
        .statement,
    )


def _circle_subscription_collisions(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "circle_subscriptions"):
        return 0
    source = db.query(
        CircleSubscription.circle_id, CircleSubscription.period_start
    ).filter(CircleSubscription.user_id == source_id).subquery()
    return _scalar(
        db,
        db.query(func.count())
        .select_from(CircleSubscription)
        .join(
            source,
            (CircleSubscription.circle_id == source.c.circle_id)
            & (CircleSubscription.period_start == source.c.period_start),
        )
        .filter(CircleSubscription.user_id == canonical_id)
        .statement,
    )


def _pin_bot_bonus_conflict(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "point_transactions"):
        return 0
    return _scalar(
        db,
        db.query(func.count())
        .select_from(PointTransaction)
        .filter(
            PointTransaction.type == "pin_bot_bonus",
            PointTransaction.user_id.in_([source_id, canonical_id]),
        )
        .statement,
    )


def _walk_score_day_collisions(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "walk_score_days"):
        return 0
    source_dates = db.query(WalkScoreDay.activity_date).filter(WalkScoreDay.user_id == source_id)
    return _scalar(
        db,
        db.query(func.count())
        .select_from(WalkScoreDay)
        .filter(WalkScoreDay.user_id == canonical_id, WalkScoreDay.activity_date.in_(source_dates))
        .statement,
    )


def _chat_memory_count(db: Session, user_id: UUID) -> int:
    if not _table_exists(db, "chat_memory"):
        return 0
    return _scalar(
        db,
        text(
            "SELECT COUNT(*) FROM chat_memory "
            "WHERE owner_type = 'user' AND lower(owner_id) = lower(:owner_id)"
        ).bindparams(owner_id=str(user_id)),
    )


def _chat_session_collisions(db: Session, source_id: UUID, canonical_id: UUID) -> int:
    if not _table_exists(db, "chat_memory"):
        return 0
    return _scalar(
        db,
        text(
            "SELECT COUNT(*) FROM chat_memory s "
            "JOIN chat_memory c ON s.session_id = c.session_id "
            "WHERE s.owner_type = 'user' AND c.owner_type = 'user' "
            "AND lower(s.owner_id) = lower(:source_id) "
            "AND lower(c.owner_id) = lower(:canonical_id)"
        ).bindparams(source_id=str(source_id), canonical_id=str(canonical_id)),
    )


def _json_object(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (TypeError, ValueError):
            return {}
    return {}


def _profile_row(db: Session, user_id: UUID) -> Optional[dict]:
    if not _table_exists(db, "chat_profile"):
        return None
    row = db.execute(
        text(
            "SELECT display_name, preferences, preferences_consent_at "
            "FROM chat_profile WHERE owner_type = 'user' AND lower(owner_id) = lower(:owner_id) "
            "LIMIT 1"
        ).bindparams(owner_id=str(user_id)),
    ).mappings().first()
    return dict(row) if row else None


def _profile_summary(row: Optional[dict]) -> dict:
    if not row:
        return {
            "exists": False,
            "display_name_present": False,
            "consent_recorded": False,
            "preference_keys": [],
        }
    preferences = _json_object(row.get("preferences")) if row.get("preferences_consent_at") else {}
    return {
        "exists": True,
        "display_name_present": bool(row.get("display_name")),
        "consent_recorded": bool(row.get("preferences_consent_at")),
        "preference_keys": sorted(preferences.keys()),
    }


def _chat_profile_analysis(db: Session, source_id: UUID, canonical_id: UUID) -> dict:
    if not _table_exists(db, "chat_profile"):
        return {
            "available": False,
            "canonical": _profile_summary(None),
            "source": _profile_summary(None),
            "display_name_conflict": False,
            "conflicting_preference_keys": [],
            "merge_required": False,
        }

    source_row = _profile_row(db, source_id)
    canonical_row = _profile_row(db, canonical_id)
    source_summary = _profile_summary(source_row)
    canonical_summary = _profile_summary(canonical_row)

    source_name = (source_row or {}).get("display_name")
    canonical_name = (canonical_row or {}).get("display_name")
    display_name_conflict = bool(
        source_name and canonical_name and str(source_name).strip() != str(canonical_name).strip()
    )

    source_prefs = _json_object((source_row or {}).get("preferences")) if source_summary["consent_recorded"] else {}
    canonical_prefs = (
        _json_object((canonical_row or {}).get("preferences")) if canonical_summary["consent_recorded"] else {}
    )
    conflicting_keys = sorted(
        key
        for key in set(source_prefs) & set(canonical_prefs)
        if source_prefs.get(key) != canonical_prefs.get(key)
    )
    merge_required = bool(
        source_summary["exists"]
        and canonical_summary["exists"]
        and (display_name_conflict or conflicting_keys)
    )

    return {
        "available": True,
        "canonical": canonical_summary,
        "source": source_summary,
        "display_name_conflict": display_name_conflict,
        "conflicting_preference_keys": conflicting_keys,
        "merge_required": merge_required,
    }


def _table_report(
    db: Session,
    rule: TableRule,
    canonical_id: UUID,
    source_id: UUID,
) -> dict:
    canonical_count = 0
    source_count = 0
    duplicates = 0
    conflicts = 0
    excluded = 0
    note = rule.note

    if rule.table == "users":
        canonical_count = source_count = 1
        excluded = 0
    elif rule.table == "auth_identities":
        canonical_count = _count_model(db, AuthIdentity, "user_id", canonical_id)
        source_count = _count_model(db, AuthIdentity, "user_id", source_id)
    elif rule.table == "account_link_challenges":
        if _table_exists(db, "account_link_challenges"):
            from app.models.account_link_challenge import AccountLinkChallenge

            canonical_count = _count_model(db, AccountLinkChallenge, "user_id", canonical_id)
            source_count = _count_model(db, AccountLinkChallenge, "user_id", source_id)
        excluded = source_count
    elif rule.table == "bookings":
        canonical_count = _count_model(db, Booking, "user_id", canonical_id)
        source_count = _count_model(db, Booking, "user_id", source_id)
        conflicts = _booking_idempotency_collisions(db, source_id, canonical_id)
    elif rule.table == "point_transactions":
        canonical_count = _count_model(db, PointTransaction, "user_id", canonical_id)
        source_count = _count_model(db, PointTransaction, "user_id", source_id)
        conflicts = 1 if _pin_bot_bonus_conflict(db, source_id, canonical_id) >= 2 else 0
    elif rule.table == "user_redemptions":
        canonical_count = _count_model(db, UserRedemption, "user_id", canonical_id)
        source_count = _count_model(db, UserRedemption, "user_id", source_id)
    elif rule.table == "posts":
        canonical_count = _count_model(db, Post, "user_id", canonical_id)
        source_count = _count_model(db, Post, "user_id", source_id)
    elif rule.table == "reactions":
        canonical_count = _count_model(db, Reaction, "user_id", canonical_id)
        source_count = _count_model(db, Reaction, "user_id", source_id)
        if _table_exists(db, "reactions"):
            source_posts = db.query(Reaction.post_id).filter(Reaction.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(Reaction)
                .filter(Reaction.user_id == canonical_id, Reaction.post_id.in_(source_posts))
                .statement,
            )
    elif rule.table == "post_comments":
        canonical_count = _count_model(db, PostComment, "user_id", canonical_id)
        source_count = _count_model(db, PostComment, "user_id", source_id)
    elif rule.table == "community_members":
        canonical_count = _count_model(db, CommunityMember, "user_id", canonical_id)
        source_count = _count_model(db, CommunityMember, "user_id", source_id)
        if _table_exists(db, "community_members"):
            source_keys = db.query(CommunityMember.community_id).filter(CommunityMember.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(CommunityMember)
                .filter(
                    CommunityMember.user_id == canonical_id,
                    CommunityMember.community_id.in_(source_keys),
                )
                .statement,
            )
    elif rule.table == "community_feed_events":
        canonical_count = _count_model(db, CommunityFeedEvent, "user_id", canonical_id)
        source_count = _count_model(db, CommunityFeedEvent, "user_id", source_id)
    elif rule.table == "challenge_awards":
        canonical_count = _count_model(db, ChallengeAward, "user_id", canonical_id)
        source_count = _count_model(db, ChallengeAward, "user_id", source_id)
        conflicts = _challenge_award_collisions(db, source_id, canonical_id)
    elif rule.table == "circle_members":
        canonical_count = _count_model(db, CircleMember, "user_id", canonical_id)
        source_count = _count_model(db, CircleMember, "user_id", source_id)
        if _table_exists(db, "circle_members"):
            source_keys = db.query(CircleMember.circle_id).filter(CircleMember.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(CircleMember)
                .filter(CircleMember.user_id == canonical_id, CircleMember.circle_id.in_(source_keys))
                .statement,
            )
    elif rule.table == "circle_subscriptions":
        canonical_count = _count_model(db, CircleSubscription, "user_id", canonical_id)
        source_count = _count_model(db, CircleSubscription, "user_id", source_id)
        conflicts = _circle_subscription_collisions(db, source_id, canonical_id)
    elif rule.table == "circle_stories":
        canonical_count = _count_model(db, CircleStory, "user_id", canonical_id)
        source_count = _count_model(db, CircleStory, "user_id", source_id)
    elif rule.table == "circle_story_views":
        canonical_count = _count_model(db, CircleStoryView, "user_id", canonical_id)
        source_count = _count_model(db, CircleStoryView, "user_id", source_id)
        if _table_exists(db, "circle_story_views"):
            source_keys = db.query(CircleStoryView.story_id).filter(CircleStoryView.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(CircleStoryView)
                .filter(CircleStoryView.user_id == canonical_id, CircleStoryView.story_id.in_(source_keys))
                .statement,
            )
    elif rule.table == "stories":
        canonical_count = _count_model(db, Story, "user_id", canonical_id)
        source_count = _count_model(db, Story, "user_id", source_id)
    elif rule.table == "story_views":
        canonical_count = _count_model(db, StoryView, "user_id", canonical_id)
        source_count = _count_model(db, StoryView, "user_id", source_id)
        if _table_exists(db, "story_views"):
            source_keys = db.query(StoryView.story_id).filter(StoryView.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(StoryView)
                .filter(StoryView.user_id == canonical_id, StoryView.story_id.in_(source_keys))
                .statement,
            )
    elif rule.table == "story_likes":
        canonical_count = _count_model(db, StoryLike, "user_id", canonical_id)
        source_count = _count_model(db, StoryLike, "user_id", source_id)
        if _table_exists(db, "story_likes"):
            source_keys = db.query(StoryLike.story_id).filter(StoryLike.user_id == source_id)
            duplicates = _scalar(
                db,
                db.query(func.count())
                .select_from(StoryLike)
                .filter(StoryLike.user_id == canonical_id, StoryLike.story_id.in_(source_keys))
                .statement,
            )
    elif rule.table == "feedback":
        canonical_count = _count_model(db, Feedback, "user_id", canonical_id)
        source_count = _count_model(db, Feedback, "user_id", source_id)
    elif rule.table == "user_notifications":
        canonical_count = _count_model(db, UserNotification, "user_id", canonical_id)
        source_count = _count_model(db, UserNotification, "user_id", source_id)
    elif rule.table == "evidence_submissions":
        canonical_count = _count_model(db, EvidenceSubmission, "submitter_user_id", canonical_id)
        source_count = _count_model(db, EvidenceSubmission, "submitter_user_id", source_id)
        if _table_exists(db, "evidence_submissions"):
            excluded = _scalar(
                db,
                db.query(func.count())
                .select_from(EvidenceSubmission)
                .filter(EvidenceSubmission.reviewed_by == source_id)
                .statement,
            )
    elif rule.table == "trainer_verifications":
        canonical_count = _count_model(db, TrainerVerification, "user_id", canonical_id)
        source_count = _count_model(db, TrainerVerification, "user_id", source_id)
        conflicts = 1 if canonical_count and source_count else 0
        if _table_exists(db, "trainer_verifications"):
            excluded = _scalar(
                db,
                db.query(func.count())
                .select_from(TrainerVerification)
                .filter(TrainerVerification.reviewed_by == source_id)
                .statement,
            )
    elif rule.table == "strava_activity_cache":
        canonical_count = _count_model(db, StravaActivityCache, "user_id", canonical_id)
        source_count = _count_model(db, StravaActivityCache, "user_id", source_id)
    elif rule.table == "user_wearables":
        canonical_count = _count_model(db, UserWearable, "user_id", canonical_id)
        source_count = _count_model(db, UserWearable, "user_id", source_id)
        if _table_exists(db, "user_wearables"):
            conflicts = _scalar(
                db,
                db.query(func.count())
                .select_from(UserWearable)
                .filter(UserWearable.user_id == source_id, UserWearable.active.is_(True))
                .statement,
            )
    elif rule.table == "wearable_daily_steps":
        if _table_exists(db, "wearable_daily_steps") and _table_exists(db, "user_wearables"):
            source_wearables = db.query(UserWearable.id).filter(UserWearable.user_id == source_id)
            canonical_wearables = db.query(UserWearable.id).filter(UserWearable.user_id == canonical_id)
            canonical_count = _scalar(
                db,
                db.query(func.count())
                .select_from(WearableDailySteps)
                .filter(WearableDailySteps.wearable_id.in_(canonical_wearables))
                .statement,
            )
            source_count = _scalar(
                db,
                db.query(func.count())
                .select_from(WearableDailySteps)
                .filter(WearableDailySteps.wearable_id.in_(source_wearables))
                .statement,
            )
    elif rule.table == "walk_score_days":
        canonical_count = _count_model(db, WalkScoreDay, "user_id", canonical_id)
        source_count = _count_model(db, WalkScoreDay, "user_id", source_id)
        conflicts = _walk_score_day_collisions(db, source_id, canonical_id)
    elif rule.table == "followers":
        if _table_exists(db, "followers"):
            canonical_edges = db.query(Follower.follower_id, Follower.following_id).filter(
                (Follower.follower_id == canonical_id) | (Follower.following_id == canonical_id)
            ).all()
            source_edges = db.query(Follower.follower_id, Follower.following_id).filter(
                (Follower.follower_id == source_id) | (Follower.following_id == source_id)
            ).all()
            canonical_count = len(canonical_edges)
            source_count = len(source_edges)
            canonical_set = {(row[0], row[1]) for row in canonical_edges}
            seen: set[tuple[UUID, UUID]] = set()
            for follower_id, following_id in source_edges:
                mapped = (
                    canonical_id if follower_id == source_id else follower_id,
                    canonical_id if following_id == source_id else following_id,
                )
                if mapped[0] == mapped[1] or mapped in canonical_set or mapped in seen:
                    duplicates += 1
                else:
                    seen.add(mapped)
    elif rule.table == "circles":
        if _table_exists(db, "circles"):
            canonical_count = _count_model(db, Circle, "owner_id", canonical_id)
            source_count = _count_model(db, Circle, "owner_id", source_id)
    elif rule.table == "providers":
        if _table_exists(db, "providers"):
            canonical_count = _count_model(db, Provider, "owner_user_id", canonical_id)
            source_count = _count_model(db, Provider, "owner_user_id", source_id)
    elif rule.table == "provider_events":
        if _table_exists(db, "provider_events"):
            canonical_count = _count_model(db, ProviderEvent, "staff_user_id", canonical_id)
            source_count = _count_model(db, ProviderEvent, "staff_user_id", source_id)
    elif rule.table == "provider_invites":
        if _table_exists(db, "provider_invites"):
            canonical_count = _scalar(
                db,
                db.query(func.count())
                .select_from(ProviderInvite)
                .filter(
                    (ProviderInvite.created_by_user_id == canonical_id)
                    | (ProviderInvite.used_by_user_id == canonical_id)
                )
                .statement,
            )
            source_count = _scalar(
                db,
                db.query(func.count())
                .select_from(ProviderInvite)
                .filter(
                    (ProviderInvite.created_by_user_id == source_id)
                    | (ProviderInvite.used_by_user_id == source_id)
                )
                .statement,
            )
            excluded = source_count
    elif rule.table == "admin_notifications":
        if _table_exists(db, "admin_notifications"):
            canonical_count = _scalar(
                db,
                db.query(func.count())
                .select_from(AdminNotification)
                .filter(
                    (AdminNotification.admin_user_id == canonical_id)
                    | (AdminNotification.related_user_id == canonical_id)
                )
                .statement,
            )
            source_count = _scalar(
                db,
                db.query(func.count())
                .select_from(AdminNotification)
                .filter(
                    (AdminNotification.admin_user_id == source_id)
                    | (AdminNotification.related_user_id == source_id)
                )
                .statement,
            )
            excluded = source_count
    elif rule.table == "booking_status_events":
        if _table_exists(db, "booking_status_events"):
            canonical_count = _count_model(db, BookingStatusEvent, "actor_user_id", canonical_id)
            source_count = _count_model(db, BookingStatusEvent, "actor_user_id", source_id)
            excluded = source_count
    elif rule.table == "circle_revenue_ledger":
        if _table_exists(db, "circle_revenue_ledger") and _table_exists(db, "circle_subscriptions"):
            source_subs = db.query(CircleSubscription.id).filter(CircleSubscription.user_id == source_id)
            canonical_subs = db.query(CircleSubscription.id).filter(CircleSubscription.user_id == canonical_id)
            canonical_count = _scalar(
                db,
                db.query(func.count())
                .select_from(CircleRevenueLedger)
                .filter(CircleRevenueLedger.subscription_id.in_(canonical_subs))
                .statement,
            )
            source_count = _scalar(
                db,
                db.query(func.count())
                .select_from(CircleRevenueLedger)
                .filter(CircleRevenueLedger.subscription_id.in_(source_subs))
                .statement,
            )
    elif rule.table == "event_inventory_log":
        if _table_exists(db, "event_inventory_log") and _table_exists(db, "bookings"):
            source_bookings = db.query(Booking.id).filter(Booking.user_id == source_id)
            canonical_bookings = db.query(Booking.id).filter(Booking.user_id == canonical_id)
            canonical_count = _scalar(
                db,
                db.query(func.count())
                .select_from(EventInventoryLog)
                .filter(EventInventoryLog.booking_id.in_(canonical_bookings))
                .statement,
            )
            source_count = _scalar(
                db,
                db.query(func.count())
                .select_from(EventInventoryLog)
                .filter(EventInventoryLog.booking_id.in_(source_bookings))
                .statement,
            )
    elif rule.table == "chat_memory":
        canonical_count = _chat_memory_count(db, canonical_id)
        source_count = _chat_memory_count(db, source_id)
        conflicts = _chat_session_collisions(db, source_id, canonical_id)
    elif rule.table == "chat_profile":
        profile = _chat_profile_analysis(db, source_id, canonical_id)
        canonical_count = 1 if profile["canonical"]["exists"] else 0
        source_count = 1 if profile["source"]["exists"] else 0
        conflicts = 1 if profile["display_name_conflict"] or profile["conflicting_preference_keys"] else 0

    if rule.strategy == "direct_transfer":
        transferable = max(0, source_count - duplicates - conflicts)
    elif rule.strategy == "dedupe":
        transferable = max(0, source_count - duplicates - conflicts)
    elif rule.strategy == "aggregate":
        transferable = source_count
    elif rule.strategy == "special":
        blocked_special = {
            "user_wearables",
            "wearable_daily_steps",
            "circles",
            "providers",
            "provider_events",
        }
        transferable = 0 if (conflicts or (source_count and rule.table in blocked_special)) else source_count
    else:
        transferable = 0

    if rule.strategy == "never_auto" or rule.table == "users":
        transferable = 0

    return {
        "table": rule.table,
        "ownership_column": rule.ownership_column,
        "relationship": rule.relationship,
        "sensitivity": rule.sensitivity,
        "strategy": rule.strategy,
        "canonical_count": canonical_count,
        "source_count": source_count,
        "transferable": transferable,
        "duplicates": duplicates,
        "conflicts": conflicts,
        "excluded": excluded,
        "note": note,
    }


def _blocker(code: str, table: Optional[str], message: str) -> dict:
    return {"code": code, "table": table, "message": message}


def _decision(code: str, table: Optional[str], message: str) -> dict:
    return {"code": code, "table": table, "message": message}


def build_reconciliation_plan(db: Session, canonical_id: UUID, source_id: UUID) -> dict:
    """Return a side-effect-free reconciliation plan.

    The function only issues SELECT statements.  It never calls ``flush``,
    ``commit`` or any DDL/DML.  A caller must still treat every plan as
    non-actionable until its blockers/decisions are resolved.
    """
    if canonical_id == source_id:
        raise ReconciliationError(
            "SAME_ACCOUNT",
            "Canonical and source accounts must be different users.",
            400,
        )

    canonical = db.get(User, canonical_id)
    source = db.get(User, source_id)
    if canonical is None or source is None:
        raise ReconciliationError(
            "ACCOUNT_NOT_FOUND",
            "One or both accounts do not exist.",
            404,
        )

    canonical_identities = _user_identities(db, canonical_id)
    source_identities = _user_identities(db, source_id)
    canonical_summary = _user_summary(canonical, canonical_identities)
    source_summary = _user_summary(source, source_identities)

    blockers: list[dict] = []
    decisions: list[dict] = []

    if source.is_provider:
        blockers.append(_blocker(
            "SOURCE_IS_PROVIDER", "users",
            "The source account is a provider account; provider ownership and portal credentials require a separate business decision.",
        ))
    if source.is_super_admin:
        blockers.append(_blocker(
            "SOURCE_IS_SUPER_ADMIN", "users",
            "The source account has super-admin privileges and must not be merged automatically.",
        ))
    if source.login_username or source.password_hash:
        blockers.append(_blocker(
            "SOURCE_HAS_LOGIN_CREDENTIALS", "users",
            "The source account has provider-portal username/password credentials; these cannot be merged automatically.",
        ))
    if source.telegram_id and canonical.telegram_id and source.telegram_id != canonical.telegram_id:
        blockers.append(_blocker(
            "MULTIPLE_TELEGRAM_IDENTITIES", "users",
            "Both accounts have different Telegram IDs. The bot resolves users by the single users.telegram_id column, so one identity would become unreachable.",
        ))
    if source.phone_number and canonical.phone_number and source.phone_number != canonical.phone_number:
        blockers.append(_blocker(
            "PHONE_NUMBER_CONFLICT", "users",
            "Both accounts have different phone numbers; phone is a credential and a PII field and needs explicit resolution.",
        ))
    if source.strava_athlete_id and canonical.strava_athlete_id and source.strava_athlete_id != canonical.strava_athlete_id:
        blockers.append(_blocker(
            "STRAVA_ACCOUNT_CONFLICT", "users",
            "Both accounts are linked to different Strava athletes; one user row cannot hold both.",
        ))
    if source.referred_by and canonical.referred_by and source.referred_by != canonical.referred_by:
        blockers.append(_blocker(
            "REFERRAL_CONFLICT", "users",
            "Both accounts have different referrers; referral credit is a financial reward and cannot be chosen automatically.",
        ))
    if source.referred_by == source.id:
        blockers.append(_blocker(
            "SELF_REFERRAL", "users",
            "The source account refers to itself; the referral graph must be repaired before any merge.",
        ))

    # Provider/business ownership and staffing.
    for table, count, code, message in (
        ("providers", _count_model(db, Provider, "owner_user_id", source_id) if _table_exists(db, "providers") else 0,
         "SOURCE_OWNS_PROVIDER", "The source account owns one or more providers."),
        ("circles", _count_model(db, Circle, "owner_id", source_id) if _table_exists(db, "circles") else 0,
         "SOURCE_OWNS_CIRCLE", "The source account owns one or more circles."),
        ("provider_events", _count_model(db, ProviderEvent, "staff_user_id", source_id) if _table_exists(db, "provider_events") else 0,
         "SOURCE_IS_EVENT_STAFF", "The source account is assigned as staff on one or more events."),
    ):
        if count:
            blockers.append(_blocker(code, table, message))

    # Authentication identities.
    canonical_providers = {identity.provider for identity in canonical_identities}
    source_providers = {identity.provider for identity in source_identities}
    for provider in sorted(canonical_providers & source_providers):
        if provider in {"telegram", "whatsapp"}:
            blockers.append(_blocker(
                f"MULTIPLE_{provider.upper()}_IDENTITIES", "auth_identities",
                f"Both accounts have a {provider} identity. The single users.telegram_id/phone_number model cannot represent both.",
            ))
    source_whatsapp = [i for i in source_identities if i.provider == "whatsapp"]
    if source_whatsapp and not canonical.phone_number and source.phone_number:
        decisions.append(_decision(
            "WHATSAPP_PHONE_TRANSFER", "auth_identities",
            "A WhatsApp identity implies a phone credential; confirm that the source phone becomes the canonical phone before moving the identity.",
        ))

    # Uniqueness conflicts.
    pin_bonus_conflict = _pin_bot_bonus_conflict(db, source_id, canonical_id) >= 2
    if pin_bonus_conflict:
        blockers.append(_blocker(
            "PIN_BOT_BONUS_UNIQUE_CONFLICT", "point_transactions",
            "Both accounts have a pin-bot bonus. A partial unique index allows only one per user, and silently dropping either ledger row is prohibited.",
        ))
    if _challenge_award_collisions(db, source_id, canonical_id):
        blockers.append(_blocker(
            "CHALLENGE_AWARD_DUPLICATE", "challenge_awards",
            "Both accounts hold an award for the same challenge; unique(challenge_id, user_id) prevents keeping both rows.",
        ))
    if _circle_subscription_collisions(db, source_id, canonical_id):
        blockers.append(_blocker(
            "CIRCLE_SUBSCRIPTION_DUPLICATE", "circle_subscriptions",
            "Both accounts have a subscription for the same circle/period; unique(circle_id, user_id, period_start) prevents keeping both rows.",
        ))
    if _booking_idempotency_collisions(db, source_id, canonical_id):
        blockers.append(_blocker(
            "BOOKING_IDEMPOTENCY_COLLISION", "bookings",
            "Both accounts used the same booking idempotency key; unique(user_id, idempotency_key) prevents keeping both rows.",
        ))

    # Trainer verification is one-to-one.
    canonical_verification = _count_model(db, TrainerVerification, "user_id", canonical_id)
    source_verification = _count_model(db, TrainerVerification, "user_id", source_id)
    if canonical_verification and source_verification:
        blockers.append(_blocker(
            "TRAINER_VERIFICATION_CONFLICT", "trainer_verifications",
            "Both accounts have a trainer verification row; unique(user_id) cannot represent both.",
        ))

    # External health identity cannot be repointed safely.
    active_wearables = 0
    if _table_exists(db, "user_wearables"):
        active_wearables = _scalar(
            db,
            db.query(func.count())
            .select_from(UserWearable)
            .filter(UserWearable.user_id == source_id, UserWearable.active.is_(True))
            .statement,
        )
    if active_wearables:
        blockers.append(_blocker(
            "ACTIVE_WEARABLE_EXTERNAL_IDENTITY", "user_wearables",
            "The source has an active Terra wearable. Terra references the user UUID, so moving the row would break future webhooks; deactivation/reconnect needs explicit handling.",
        ))

    # Chat profile conflicts.
    chat_profile = _chat_profile_analysis(db, source_id, canonical_id)
    chat_memory_available = _table_exists(db, "chat_memory")
    if chat_profile["available"]:
        if chat_profile["display_name_conflict"]:
            blockers.append(_blocker(
                "CHAT_PROFILE_NAME_CONFLICT", "chat_profile",
                "Both Circler profiles contain a different display name; choosing one automatically would discard a user preference.",
            ))
        if chat_profile["conflicting_preference_keys"]:
            blockers.append(_blocker(
                "CHAT_PROFILE_PREFERENCE_CONFLICT", "chat_profile",
                "Both Circler profiles set different values for the same preference keys; the plan refuses to overwrite either side.",
            ))
        if chat_profile["source"]["exists"] and chat_profile["canonical"]["exists"]:
            decisions.append(_decision(
                "CHAT_PROFILE_MERGE", "chat_profile",
                "Both Circler profiles exist. Agree how to combine display names/consent and non-conflicting preference keys, and retain the source row for audit.",
            ))
    if not chat_profile["available"] or not chat_memory_available:
        blockers.append(_blocker(
            "CIRCLER_SCHEMA_UNAVAILABLE", "chat_profile",
            "chat_profile/chat_memory are missing or not visible to this database role, so Circler preservation cannot be verified.",
        ))

    # Point balance/ledger aggregation is a product rule, not a mechanical move.
    source_points_count = _count_model(db, PointTransaction, "user_id", source_id)
    canonical_points_count = _count_model(db, PointTransaction, "user_id", canonical_id)
    if source_points_count or canonical_points_count or (source.points_balance or 0) or (canonical.points_balance or 0):
        decisions.append(_decision(
            "POINTS_AGGREGATION_RULE", "point_transactions",
            "Define the approved balance rule (and ledger-break handling) before merging cached points_balance and ledger history.",
        ))

    # Walk data.
    if _walk_score_day_collisions(db, source_id, canonical_id):
        decisions.append(_decision(
            "WALK_SCORE_SAME_DAY_RULE", "walk_score_days",
            "Both accounts have step data for the same dates; agree whether same-day steps are maxed or summed before recomputing users.walk_score.",
        ))

    # Referral graph.
    if _table_exists(db, "users"):
        referred_to_source = _scalar(
            db,
            db.query(func.count()).select_from(User).filter(User.referred_by == source_id).statement,
        )
        if referred_to_source:
            decisions.append(_decision(
                "REFERRAL_GRAPH_REPOINT", "users",
                "Other users refer to the source account; confirm that their referred_by pointer should move to the canonical account.",
            ))

    # Social self-edges are deterministic cleanup, but record them.
    self_follows = 0
    if _table_exists(db, "followers"):
        self_follows = _scalar(
            db,
            db.query(func.count())
            .select_from(Follower)
            .filter(
                ((Follower.follower_id == source_id) & (Follower.following_id == canonical_id))
                | ((Follower.follower_id == canonical_id) & (Follower.following_id == source_id))
            )
            .statement,
        )
    if self_follows:
        decisions.append(_decision(
            "SELF_FOLLOW_CLEANUP", "followers",
            "The merge creates self-follow edges; confirm removal of only those invalid edges.",
        ))

    table_reports = [
        _table_report(db, rule, canonical_id, source_id) for rule in TABLE_RULES
    ]
    table_by_name = {row["table"]: row for row in table_reports}

    # Add conflict details that are cheap and safe to expose.
    summary = {
        "canonical": canonical_summary,
        "source": source_summary,
        "total_tables_inspected": len(TABLE_RULES) + len(NOT_USER_OWNED),
        "transferable_records": sum(
            row["transferable"] for row in table_reports if row["table"] not in {"users", "auth_identities"}
        ),
        "duplicate_records": sum(row["duplicates"] for row in table_reports),
        "conflicting_records": sum(row["conflicts"] for row in table_reports),
        "excluded_records": sum(row["excluded"] for row in table_reports),
        "blockers": len(blockers),
        "manual_decisions": len(decisions),
    }

    return {
        "canonical_user_id": str(canonical_id),
        "source_user_id": str(source_id),
        "generated_at": _now().isoformat(),
        "read_only": True,
        "merge_implemented": False,
        "safe_to_merge": False,
        "merge_status": "blocked_pending_rules",
        "blockers": blockers,
        "manual_decisions": decisions,
        "summary": summary,
        "tables": table_reports,
        "circler": {
            "chat_memory": table_by_name["chat_memory"],
            "chat_profile": {
                **table_by_name["chat_profile"],
                **chat_profile,
            },
        },
        "not_user_owned": [
            {
                "table": table,
                "strategy": "not_user_owned",
                "row_count": (
                    _scalar(db, text(f"SELECT COUNT(*) FROM {table}"))
                    if _table_exists(db, table)
                    else 0
                ),
                "note": "No user ownership column; not changed by account reconciliation.",
            }
            for table in NOT_USER_OWNED
        ],
        "unresolved_rules": [
            "POINTS_AGGREGATION_RULE: points_balance is a cached balance with floor-at-zero semantics; ledger history cannot be merged without an approved balance rule.",
            "CHAT_PROFILE_MERGE: two Circler profiles may hold different names/preferences; an explicit combine/keep decision and consent record are required.",
            "MULTIPLE_TELEGRAM_IDENTITIES: users.telegram_id is a single column used by the bot; a second Telegram identity cannot be preserved automatically.",
            "ACTIVE_WEARABLE_EXTERNAL_IDENTITY: Terra reference_id is the user UUID; an active wearable must be deactivated and reconnected rather than repointed.",
            "PROVIDER_AND_ADMIN_ROLES: provider ownership, provider-portal credentials and super-admin flags require a separate administrative reconciliation.",
            "SOURCE_ACCOUNT_RETENTION: the source users row should be marked/retained for audit; deleting it would cascade or orphan audit references.",
            "AUDIT_TRAIL: a durable reconciliation-run/audit table and a two-account authentication flow must be implemented before any destructive merge.",
        ],
    }
