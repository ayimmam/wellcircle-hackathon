"""Paid-circle eligibility, subscriptions, access and revenue."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.admin_notification import AdminNotification
from app.models.circle import Circle, CircleMember
from app.models.circle_subscription import CircleRevenueLedger, CircleSubscription
from app.models.point_transaction import PointTransaction
from app.models.user import User
from app.services.notification_service import create_notification


def owner_lifetime_points(db: Session, owner_id):
    return int(db.query(func.coalesce(func.sum(PointTransaction.amount), 0)).filter(
        PointTransaction.user_id == owner_id,
        PointTransaction.amount > 0,
        PointTransaction.reversed_by.is_(None),
    ).scalar() or 0)


def _validate_eligibility(db: Session, circle: Circle):
    members = db.query(CircleMember).filter(CircleMember.circle_id == circle.id).count()
    points = owner_lifetime_points(db, circle.owner_id)
    if members < 100:
        raise ValueError("Circle must have at least 100 members")
    if points < 1000:
        raise ValueError("Circle owner must have at least 1000 lifetime points")
    return members, points


def apply_for_paid_circle(db: Session, circle_id, owner_id, price_etb):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if circle.owner_id != owner_id:
        raise PermissionError("Only the circle owner can apply")
    if circle.paid_circle_status in ("pending_approval", "approved"):
        raise ValueError("Circle has already applied for paid status")
    _validate_eligibility(db, circle)
    circle.price_etb = price_etb
    circle.paid_circle_status = "pending_approval"
    circle.paid_circle_applied_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(circle)
    return circle


def review_paid_circle(db: Session, circle_id, action, reason=None):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if circle.paid_circle_status != "pending_approval":
        raise ValueError("Paid-circle application is not pending")
    if action == "approve":
        _validate_eligibility(db, circle)
        circle.paid_circle_status = "approved"
        circle.is_paid = True
        body = f"{circle.name} is now a paid circle."
    else:
        circle.paid_circle_status = "rejected"
        circle.is_paid = False
        body = reason or f"{circle.name} was not approved as a paid circle."
    db.commit()
    create_notification(
        db, circle.owner_id, "paid_circle_review",
        "Paid circle application reviewed", body, f"/circle/{circle.id}",
    )
    db.refresh(circle)
    return circle


def subscribe_to_circle(db: Session, circle_id, user_id, receipt_url, receipt_public_id):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if not circle.is_paid or circle.paid_circle_status != "approved":
        raise ValueError("Circle is not accepting paid subscriptions")
    if circle.owner_id == user_id:
        raise ValueError("Circle owners do not need a subscription")
    now = datetime.now(timezone.utc)
    active_or_pending = db.query(CircleSubscription).filter(
        CircleSubscription.circle_id == circle_id,
        CircleSubscription.user_id == user_id,
        CircleSubscription.status.in_(("pending_approval", "active")),
        CircleSubscription.period_end > now,
    ).first()
    if active_or_pending:
        raise ValueError("A current subscription already exists")
    row = CircleSubscription(
        circle_id=circle_id, user_id=user_id, period_start=now,
        period_end=now + timedelta(days=30), amount_etb=circle.price_etb,
        status="pending_approval", receipt_url=receipt_url,
        receipt_public_id=receipt_public_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def creator_review_subscription(db: Session, subscription_id, owner_id, action):
    row = db.query(CircleSubscription).filter(CircleSubscription.id == subscription_id).first()
    if not row:
        raise LookupError("Subscription not found")
    circle = db.query(Circle).filter(Circle.id == row.circle_id).first()
    if circle.owner_id != owner_id:
        raise PermissionError("Only the circle owner can review receipts")
    if row.status != "pending_approval":
        raise ValueError("Subscription is not pending approval")
    if action == "approve":
        # Integer-safe: platform receives floor(5%); creator receives remainder.
        platform = row.amount_etb * 5 // 100
        creator = row.amount_etb - platform
        row.status = "active"
        row.creator_approved_at = datetime.now(timezone.utc)
        db.add(CircleRevenueLedger(
            circle_id=circle.id, subscription_id=row.id,
            total_amount_etb=row.amount_etb,
            creator_amount_etb=creator, platform_fee_etb=platform,
        ))
        circle.total_revenue_etb = (circle.total_revenue_etb or 0) + row.amount_etb
        if not db.query(CircleMember).filter_by(circle_id=circle.id, user_id=row.user_id).first():
            db.add(CircleMember(circle_id=circle.id, user_id=row.user_id))
        message = "Your receipt was approved and circle access is active."
    else:
        row.status = "rejected"
        message = "Your circle subscription receipt was rejected."
    db.commit()
    create_notification(
        db, row.user_id, "circle_subscription", "Subscription updated",
        message, f"/circle/{circle.id}",
    )
    db.refresh(row)
    return row


def get_pending_subscriptions(db: Session, circle_id, owner_id):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if circle.owner_id != owner_id:
        raise PermissionError("Only the circle owner can view receipts")
    return db.query(CircleSubscription).filter_by(
        circle_id=circle_id, status="pending_approval"
    ).order_by(CircleSubscription.created_at).all()


def get_user_active_subscription(db: Session, circle_id, user_id):
    now = datetime.now(timezone.utc)
    return db.query(CircleSubscription).filter(
        CircleSubscription.circle_id == circle_id,
        CircleSubscription.user_id == user_id,
        CircleSubscription.status == "active",
        CircleSubscription.period_end > now,
    ).order_by(CircleSubscription.period_end.desc()).first()


def has_circle_access(db: Session, circle_id, user_id):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        return False
    if circle.owner_id == user_id or not circle.is_paid:
        return True
    # Existing rows are intentionally grandfathered when a free circle converts.
    return db.query(CircleMember).filter_by(circle_id=circle_id, user_id=user_id).first() is not None


def get_circle_revenue(db: Session, circle_id, owner_id):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise LookupError("Circle not found")
    if circle.owner_id != owner_id:
        raise PermissionError("Only the circle owner can view revenue")
    ledgers = db.query(CircleRevenueLedger).filter_by(circle_id=circle_id).all()
    trend = defaultdict(lambda: {"revenue": 0, "subscribers": 0})
    for ledger in ledgers:
        key = ledger.created_at.strftime("%Y-%m")
        trend[key]["revenue"] += ledger.total_amount_etb
        trend[key]["subscribers"] += 1
    now = datetime.now(timezone.utc)
    return {
        "total_revenue_etb": sum(x.total_amount_etb for x in ledgers),
        "creator_earnings_etb": sum(x.creator_amount_etb for x in ledgers),
        "platform_fee_etb": sum(x.platform_fee_etb for x in ledgers),
        "active_subscribers": db.query(CircleSubscription).filter(
            CircleSubscription.circle_id == circle_id,
            CircleSubscription.status == "active",
            CircleSubscription.period_end > now,
        ).count(),
        "pending_receipts": db.query(CircleSubscription).filter_by(
            circle_id=circle_id, status="pending_approval"
        ).count(),
        "monthly_trend": [
            {"month": month, **values} for month, values in sorted(trend.items())
        ],
    }


def check_expired_subscriptions(db: Session):
    now = datetime.now(timezone.utc)
    rows = db.query(CircleSubscription).filter(
        CircleSubscription.status == "active",
        CircleSubscription.period_end <= now,
    ).all()
    for row in rows:
        row.status = "expired"
        # Paid members added at approval lose access on expiry. A pre-existing
        # member cannot be distinguished retroactively, so only remove members
        # whose join timestamp falls within this subscription period.
        member = db.query(CircleMember).filter_by(
            circle_id=row.circle_id, user_id=row.user_id
        ).first()
        if member and member.joined_at >= row.period_start:
            db.delete(member)
    db.commit()
    return len(rows)


def escalate_stale_receipts(db: Session, hours=72):
    now = datetime.now(timezone.utc)
    rows = db.query(CircleSubscription).filter(
        CircleSubscription.status == "pending_approval",
        CircleSubscription.created_at <= now - timedelta(hours=hours),
        CircleSubscription.escalated_at.is_(None),
    ).all()
    admin_ids = [r[0] for r in db.query(User.id).filter(
        (User.is_super_admin == True) | User.telegram_id.in_(settings.super_admin_ids)
    ).all()]
    for row in rows:
        row.escalated_at = now
        for admin_id in admin_ids:
            db.add(AdminNotification(
                admin_user_id=admin_id, event_type="stale_circle_receipt",
                related_user_id=row.user_id,
                message=f"Subscription receipt {row.id} has awaited creator review for over {hours} hours.",
            ))
    db.commit()
    return len(rows)
