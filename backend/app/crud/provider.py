"""Provider CRUD operations."""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.provider import Provider
from app.models.product import Product
from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.booking import Booking
from app.models.user import User
from app.crud.admin_notification import notify_all_admins
from app.services.promotion_service import get_active_promotion, get_eligible_promotion
from app.models.provider_promotion import ProviderPromotion


def get_all_providers(
    db: Session,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    """Get all providers with community info (active only for public listing)."""
    query = db.query(Provider).filter(
        or_(Provider.status == "active", Provider.status.is_(None))
    )

    if category:
        query = query.filter(Provider.category == category)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Provider.name.ilike(search_filter)) |
            (Provider.description.ilike(search_filter))
        )

    providers = query.order_by(
        Provider.is_featured.desc(),
        Provider.rating.desc(),
        Provider.name,
    ).all()

    # Batch what used to be two extra queries per provider (community +
    # active promotion) into two queries total — under concurrent load, each
    # request held its DB connection open through every row's round-trips.
    provider_ids = [p.id for p in providers]
    communities_by_provider = {}
    if provider_ids:
        for c in db.query(Community).filter(Community.provider_id.in_(provider_ids)).all():
            communities_by_provider[c.provider_id] = c

    promotions_by_provider = {}
    if provider_ids:
        now = datetime.now(timezone.utc)
        active_promos = (
            db.query(ProviderPromotion)
            .filter(
                ProviderPromotion.provider_id.in_(provider_ids),
                ProviderPromotion.is_active == True,
                ProviderPromotion.valid_until >= now,
            )
            .order_by(ProviderPromotion.valid_until.desc())
            .all()
        )
        # order_by valid_until desc + first-seen-wins keeps the same "latest
        # valid_until" pick per provider that get_active_promotion() made.
        for promo in active_promos:
            promotions_by_provider.setdefault(promo.provider_id, promo)

    result = []
    for p in providers:
        community = communities_by_provider.get(p.id)
        promo = promotions_by_provider.get(p.id)
        result.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "description": p.description,
            "location_text": p.location_text,
            "lat": p.lat,
            "lng": p.lng,
            "price_range": p.price_range,
            "rating": p.rating,
            "cover_photo_url": p.cover_photo_url,
            "services": p.services or [],
            "member_count": community.member_count if community else 0,
            "community_id": str(community.id) if community else None,
            "is_featured": bool(p.is_featured),
            "subscription_plan": p.subscription_plan,
            "active_promotion": {
                "id": str(promo.id),
                "headline": promo.headline,
                "discount_pct": promo.discount_pct,
                "valid_until": promo.valid_until,
                "audience": promo.audience or "all",
            } if promo else None,
        })
    return result


def get_provider_by_id(db: Session, provider_id: UUID) -> Optional[Provider]:
    """Get a provider by ID."""
    return db.query(Provider).filter(Provider.id == provider_id).first()


def get_provider_detail(db: Session, provider_id: UUID, user_id: Optional[UUID] = None) -> Optional[dict]:
    """Get full provider detail with community and user join status."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return None

    community = db.query(Community).filter(Community.provider_id == provider_id).first()
    user_joined = False
    if community and user_id:
        membership = (
            db.query(CommunityMember)
            .filter(
                CommunityMember.community_id == community.id,
                CommunityMember.user_id == user_id,
            )
            .first()
        )
        user_joined = membership is not None

    # Marketing copy shows to everyone; user_eligible tells this specific user
    # whether the promo will actually apply to their booking (presale promos
    # only apply to first-time visitors).
    promotion = get_active_promotion(db, provider.id)
    if promotion and user_id:
        eligible = get_eligible_promotion(db, provider.id, user_id)
        promotion["user_eligible"] = bool(eligible and eligible["id"] == promotion["id"])
        if not promotion["user_eligible"] and eligible:
            promotion = {**eligible, "user_eligible": True}

    return {
        "id": str(provider.id),
        "name": provider.name,
        "category": provider.category,
        "description": provider.description,
        "location_text": provider.location_text,
        "lat": provider.lat,
        "lng": provider.lng,
        "price_range": provider.price_range,
        "rating": provider.rating,
        "cover_photo_url": provider.cover_photo_url,
        "photos": provider.photos or [],
        "services": provider.services or [],
        "community": {
            "id": str(community.id),
            "name": community.name,
            "member_count": community.member_count,
            "user_joined": user_joined,
        } if community else None,
        "theme_primary_color": provider.theme_primary_color,
        "theme_accent_color": provider.theme_accent_color,
        "is_featured": bool(provider.is_featured),
        "subscription_plan": provider.subscription_plan,
        "active_promotion": promotion,
    }


def get_provider_stats(db: Session, provider_id: UUID) -> dict:
    """Get provider dashboard statistics."""
    from datetime import datetime, timezone, timedelta

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return {}

    communities = db.query(Community).filter(Community.provider_id == provider_id).all()
    community_ids = [c.id for c in communities]

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Total members across all communities
    total_members = sum(c.member_count for c in communities)

    # New members today
    new_members_today = 0
    if community_ids:
        new_members_today = (
            db.query(CommunityMember)
            .filter(
                CommunityMember.community_id.in_(community_ids),
                CommunityMember.joined_at >= today_start,
            )
            .count()
        )

    # Bookings this week
    bookings_this_week = (
        db.query(Booking)
        .filter(
            Booking.provider_id == provider_id,
            Booking.created_at >= week_start,
        )
        .all()
    )

    estimated_revenue = sum(
        b.amount_etb for b in bookings_this_week if b.payment_status == "success"
    )

    # Checkins today
    checkins_today = 0
    if community_ids:
        checkins_today = (
            db.query(CommunityFeedEvent)
            .filter(
                CommunityFeedEvent.community_id.in_(community_ids),
                CommunityFeedEvent.event_type == "checkin",
                CommunityFeedEvent.created_at >= today_start,
            )
            .count()
        )

    engagement_rate = round(checkins_today / total_members, 2) if total_members > 0 else 0.0

    # Community stats
    community_stats = []
    for c in communities:
        c_checkins = (
            db.query(CommunityFeedEvent)
            .filter(
                CommunityFeedEvent.community_id == c.id,
                CommunityFeedEvent.event_type == "checkin",
                CommunityFeedEvent.created_at >= today_start,
            )
            .count()
        )
        c_engagement = round(c_checkins / c.member_count, 2) if c.member_count > 0 else 0.0
        community_stats.append({
            "id": str(c.id),
            "name": c.name,
            "member_count": c.member_count,
            "checkins_today": c_checkins,
            "engagement_rate": c_engagement,
        })

    # Recent bookings
    recent_bookings = (
        db.query(Booking)
        .filter(Booking.provider_id == provider_id)
        .order_by(Booking.created_at.desc())
        .limit(20)
        .all()
    )

    booking_items = []
    for b in recent_bookings:
        user = db.query(User).filter(User.id == b.user_id).first()
        booking_items.append({
            "id": str(b.id),
            "user_handle": user.telegram_handle if user else None,
            "service_name": b.service_name,
            "slot_datetime": b.slot_datetime.isoformat(),
            "amount_etb": b.amount_etb,
            "payment_status": b.payment_status,
            "created_at": b.created_at.isoformat(),
        })

    # Recent feed events
    recent_feed = []
    if community_ids:
        events = (
            db.query(CommunityFeedEvent)
            .filter(CommunityFeedEvent.community_id.in_(community_ids))
            .order_by(CommunityFeedEvent.created_at.desc())
            .limit(20)
            .all()
        )
        for e in events:
            user = db.query(User).filter(User.id == e.user_id).first()
            comm = db.query(Community).filter(Community.id == e.community_id).first()
            recent_feed.append({
                "user_name": user.name if user else None,
                "user_photo": user.photo_url if user else None,
                "event_type": e.event_type,
                "community_name": comm.name if comm else None,
                "created_at": e.created_at.isoformat(),
            })

    return {
        "provider_id": str(provider.id),
        "provider_name": provider.name,
        "theme_primary_color": provider.theme_primary_color,
        "theme_accent_color": provider.theme_accent_color,
        "stats": {
            "total_members": total_members,
            "new_members_today": new_members_today,
            "bookings_this_week": len(bookings_this_week),
            "estimated_revenue_etb": estimated_revenue,
            "checkins_today": checkins_today,
            "engagement_rate": engagement_rate,
        },
        "communities": community_stats,
        "recent_bookings": booking_items,
        "recent_feed": recent_feed,
    }


def _auto_create_community(db: Session, provider: Provider) -> Optional[Community]:
    existing = db.query(Community).filter(Community.provider_id == provider.id).first()
    if existing:
        return existing
    community = Community(
        provider_id=provider.id,
        name=f"{provider.name} Community",
        category=provider.category,
    )
    db.add(community)
    return community


def get_provider_by_owner(db: Session, user_id: UUID) -> Optional[Provider]:
    return db.query(Provider).filter(Provider.owner_user_id == user_id).first()


def user_has_active_provider(db: Session, user_id: UUID) -> bool:
    provider = get_provider_by_owner(db, user_id)
    if not provider:
        return False
    return provider.status in ("active", "pending_approval", None)


def create_self_onboarded_provider(
    db: Session,
    user: User,
    invite,
    **kwargs,
) -> Provider:
    now = datetime.now(timezone.utc)
    services = kwargs.get("services")
    if services:
        kwargs["services"] = [s.model_dump() if hasattr(s, "model_dump") else s for s in services]

    provider = Provider(
        owner_user_id=user.id,
        status="active",
        onboarded_by_admin=False,
        submitted_at=now,
        reviewed_at=now,
        **kwargs,
    )
    db.add(provider)
    db.flush()

    user.is_provider = True

    from app.crud.provider_invite import mark_invite_used
    mark_invite_used(db, invite, user.id)

    _auto_create_community(db, provider)

    notify_all_admins(
        db,
        event_type="provider_approved",
        message=f'{provider.name} auto-approved for the hackathon demo',
        related_provider_id=provider.id,
        related_user_id=user.id,
    )

    db.commit()
    db.refresh(provider)
    return provider


def approve_provider(db: Session, provider_id: UUID, notes: Optional[str] = None) -> Optional[Provider]:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider or provider.status != "pending_approval":
        return None

    now = datetime.now(timezone.utc)
    provider.status = "active"
    provider.reviewed_at = now

    if provider.owner_user_id:
        owner = db.query(User).filter(User.id == provider.owner_user_id).first()
        if owner:
            owner.is_provider = True

    _auto_create_community(db, provider)

    notify_all_admins(
        db,
        event_type="provider_approved",
        message=f'{provider.name} was approved' + (f": {notes}" if notes else ""),
        related_provider_id=provider.id,
        related_user_id=provider.owner_user_id,
    )

    db.commit()
    db.refresh(provider)
    return provider


def reject_provider(db: Session, provider_id: UUID, reason: str) -> Optional[Provider]:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider or provider.status != "pending_approval":
        return None

    provider.status = "rejected"
    provider.reviewed_at = datetime.now(timezone.utc)

    notify_all_admins(
        db,
        event_type="provider_rejected",
        message=f'{provider.name} was rejected: {reason}',
        related_provider_id=provider.id,
        related_user_id=provider.owner_user_id,
    )

    db.commit()
    db.refresh(provider)
    return provider


def promote_user_to_provider(
    db: Session,
    user: User,
    provider_data: dict,
) -> Provider:
    services = provider_data.get("services")
    if services:
        provider_data["services"] = [
            s.model_dump() if hasattr(s, "model_dump") else s for s in services
        ]

    provider = Provider(
        owner_user_id=user.id,
        status="active",
        onboarded_by_admin=True,
        reviewed_at=datetime.now(timezone.utc),
        **provider_data,
    )
    db.add(provider)
    db.flush()

    user.is_provider = True
    _auto_create_community(db, provider)

    db.commit()
    db.refresh(provider)
    return provider


def get_pending_providers(db: Session) -> List[dict]:
    providers = (
        db.query(Provider)
        .filter(Provider.status == "pending_approval")
        .order_by(Provider.submitted_at.desc())
        .all()
    )
    items = []
    for p in providers:
        owner = db.query(User).filter(User.id == p.owner_user_id).first() if p.owner_user_id else None
        items.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "status": p.status,
            "owner_user_id": str(p.owner_user_id) if p.owner_user_id else None,
            "owner_name": owner.name if owner else None,
            "owner_telegram_handle": owner.telegram_handle if owner else None,
            "submitted_at": p.submitted_at,
            "description": p.description,
            "location_text": p.location_text,
            "lat": p.lat,
            "lng": p.lng,
            "price_range": p.price_range,
            "services": p.services or [],
            "cover_photo_url": p.cover_photo_url,
            "photos": p.photos or [],
        })
    return items


def get_admin_providers(
    db: Session,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    query = db.query(Provider)
    if status:
        query = query.filter(Provider.status == status)
    if search:
        query = query.filter(Provider.name.ilike(f"%{search}%"))

    providers = query.order_by(Provider.name).all()
    items = []
    for p in providers:
        community = db.query(Community).filter(Community.provider_id == p.id).first()
        owner = db.query(User).filter(User.id == p.owner_user_id).first() if p.owner_user_id else None
        items.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "status": p.status or "active",
            "location_text": p.location_text,
            "owner_user_id": str(p.owner_user_id) if p.owner_user_id else None,
            "owner_name": owner.name if owner else None,
            "member_count": community.member_count if community else 0,
            "onboarded_by_admin": p.onboarded_by_admin or False,
            "submitted_at": p.submitted_at,
            "reviewed_at": p.reviewed_at,
        })
    return items


def get_provider_me(db: Session, user: User) -> Optional[dict]:
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        return None

    communities = db.query(Community).filter(Community.provider_id == provider.id).all()
    community_ids = [c.id for c in communities]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_members = sum(c.member_count for c in communities)
    new_members_today = 0
    if community_ids:
        new_members_today = (
            db.query(CommunityMember)
            .filter(
                CommunityMember.community_id.in_(community_ids),
                CommunityMember.joined_at >= today_start,
            )
            .count()
        )

    products = db.query(Product).filter(Product.provider_id == provider.id).all()
    active_products = sum(1 for p in products if p.is_active)

    return {
        "id": str(provider.id),
        "name": provider.name,
        "category": provider.category,
        "status": provider.status or "active",
        "description": provider.description,
        "location_text": provider.location_text,
        "lat": provider.lat,
        "lng": provider.lng,
        "services": provider.services or [],
        "theme_primary_color": provider.theme_primary_color,
        "theme_accent_color": provider.theme_accent_color,
        "dashboard_stats": {
            "total_members": total_members,
            "new_members_today": new_members_today,
            "total_products": len(products),
            "active_products": active_products,
        },
    }


def update_provider_me(db: Session, user: User, **kwargs) -> Optional[Provider]:
    provider = get_provider_by_owner(db, user.id)
    if not provider:
        return None

    if "services" in kwargs and kwargs["services"] is not None:
        kwargs["services"] = [
            s.model_dump() if hasattr(s, "model_dump") else s for s in kwargs["services"]
        ]

    for key, value in kwargs.items():
        if value is not None and hasattr(provider, key) and key != "status":
            setattr(provider, key, value)

    provider.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(provider)
    return provider


def create_provider(db: Session, **kwargs) -> Provider:
    """Create a new provider (admin flow)."""
    owner_telegram_id = kwargs.pop("owner_telegram_id", None)
    create_community = kwargs.pop("create_community", False)
    community_name = kwargs.pop("community_name", None)

    # Resolve owner user
    owner_user_id = None
    if owner_telegram_id:
        owner = db.query(User).filter(User.telegram_id == owner_telegram_id).first()
        if owner:
            owner.is_provider = True
            owner_user_id = owner.id

    kwargs.setdefault("status", "active")
    kwargs.setdefault("onboarded_by_admin", True)
    kwargs.setdefault("reviewed_at", datetime.now(timezone.utc))

    provider = Provider(owner_user_id=owner_user_id, **kwargs)
    db.add(provider)
    db.flush()

    community = None
    if create_community and community_name:
        community = Community(
            provider_id=provider.id,
            name=community_name,
            category=provider.category,
        )
        db.add(community)

    db.commit()
    db.refresh(provider)
    if community:
        db.refresh(community)

    return provider, community


def update_provider(db: Session, provider_id: UUID, **kwargs) -> Optional[Provider]:
    """Update provider fields."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(provider, key):
            setattr(provider, key, value)

    db.commit()
    db.refresh(provider)
    return provider


def delete_provider(db: Session, provider_id: UUID) -> bool:
    """Delete a provider and its linked communities."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return False

    # Delete linked communities and their members/events
    communities = db.query(Community).filter(Community.provider_id == provider_id).all()
    for comm in communities:
        db.query(CommunityFeedEvent).filter(CommunityFeedEvent.community_id == comm.id).delete()
        db.query(CommunityMember).filter(CommunityMember.community_id == comm.id).delete()
        db.delete(comm)

    # Delete bookings
    db.query(Booking).filter(Booking.provider_id == provider_id).delete()

    db.delete(provider)
    db.commit()
    return True


# ── C1: Provider Customer List (mini-CRM) ─────────────────────────────────

def get_provider_customers(db: Session, provider_id: UUID) -> List[dict]:
    """Get distinct users who interacted with this provider
    (via booking or community check-in), with last-visit and lifetime points."""
    from app.models.point_transaction import PointTransaction

    # Users with successful bookings at this provider
    booking_users = (
        db.query(Booking.user_id)
        .filter(
            Booking.provider_id == provider_id,
            Booking.payment_status == "success",
        )
        .distinct()
    )

    # Users who checked in at this provider's community
    community = db.query(Community).filter(Community.provider_id == provider_id).first()
    checkin_users_q = db.query(CommunityFeedEvent.user_id).filter(False)  # empty if no community
    if community:
        checkin_users_q = (
            db.query(CommunityFeedEvent.user_id)
            .filter(
                CommunityFeedEvent.community_id == community.id,
                CommunityFeedEvent.event_type == "checkin",
            )
            .distinct()
        )

    # Union of both sets
    all_customer_ids = set()
    for row in booking_users.all():
        all_customer_ids.add(row[0])
    for row in checkin_users_q.all():
        all_customer_ids.add(row[0])

    customers = []
    for uid in all_customer_ids:
        user = db.query(User).filter(User.id == uid).first()
        if not user:
            continue

        # Last visit (most recent booking or check-in)
        last_booking = (
            db.query(func.max(Booking.created_at))
            .filter(Booking.user_id == uid, Booking.provider_id == provider_id, Booking.payment_status == "success")
            .scalar()
        )
        last_checkin = None
        if community:
            last_checkin = (
                db.query(func.max(CommunityFeedEvent.created_at))
                .filter(
                    CommunityFeedEvent.user_id == uid,
                    CommunityFeedEvent.community_id == community.id,
                    CommunityFeedEvent.event_type == "checkin",
                )
                .scalar()
            )
        last_visit = max(filter(None, [last_booking, last_checkin]), default=None)

        # Lifetime points redeemed at this provider
        lifetime_redeemed = (
            db.query(func.coalesce(func.sum(PointTransaction.amount), 0))
            .filter(
                PointTransaction.user_id == uid,
                PointTransaction.provider_id == provider_id,
                PointTransaction.type == "redemption",
                PointTransaction.reversed_by.is_(None),
            )
            .scalar()
        )

        customers.append({
            "user_id": str(uid),
            "name": user.name or user.telegram_handle or "User",
            "photo_url": user.photo_url,
            "last_visit": last_visit.isoformat() if last_visit else None,
            "lifetime_points_redeemed": abs(int(lifetime_redeemed)),
            "points_balance": user.points_balance or 0,
        })

    # Sort by most recent visit
    customers.sort(key=lambda c: c["last_visit"] or "", reverse=True)
    return customers


# ── D3: Provider-Initiated Point Awards ───────────────────────────────────

def award_customer_points(
    db: Session,
    provider_id: UUID,
    customer_user_id: UUID,
    points: int,
    note: Optional[str] = None,
) -> dict:
    """Award points to a customer who has interacted with this provider.

    Enforces caps:
    - Max 1 award per customer per day
    - Max 50 points per award
    - Max 300 points per provider per day
    """
    from app.services.points import (
        apply_transaction, TXN_PROVIDER_AWARD,
        count_provider_awards_to_customer_today,
        sum_provider_awards_today,
        PROVIDER_AWARD_MAX_PER_CUSTOMER_PER_DAY,
        PROVIDER_AWARD_MAX_POINTS_PER_AWARD,
        PROVIDER_AWARD_MAX_POINTS_PER_DAY,
    )

    # Validate points amount
    if points <= 0:
        raise ValueError("Points must be positive")
    if points > PROVIDER_AWARD_MAX_POINTS_PER_AWARD:
        raise ValueError(f"Maximum {PROVIDER_AWARD_MAX_POINTS_PER_AWARD} points per award")

    # Check customer has interacted with this provider
    customer = db.query(User).filter(User.id == customer_user_id).first()
    if not customer:
        raise ValueError("Customer not found")

    has_booking = (
        db.query(Booking)
        .filter(
            Booking.user_id == customer_user_id,
            Booking.provider_id == provider_id,
            Booking.payment_status == "success",
        )
        .first()
    )
    has_checkin = False
    community = db.query(Community).filter(Community.provider_id == provider_id).first()
    if community:
        has_checkin = (
            db.query(CommunityFeedEvent)
            .filter(
                CommunityFeedEvent.user_id == customer_user_id,
                CommunityFeedEvent.community_id == community.id,
                CommunityFeedEvent.event_type == "checkin",
            )
            .first()
        ) is not None

    if not has_booking and not has_checkin:
        raise ValueError("Customer has no verified interaction with this provider")

    # Cap checks
    awards_today = count_provider_awards_to_customer_today(db, provider_id, customer_user_id)
    if awards_today >= PROVIDER_AWARD_MAX_PER_CUSTOMER_PER_DAY:
        raise ValueError("Already awarded this customer today (max 1/day)")

    total_today = sum_provider_awards_today(db, provider_id)
    if total_today + points > PROVIDER_AWARD_MAX_POINTS_PER_DAY:
        remaining = PROVIDER_AWARD_MAX_POINTS_PER_DAY - total_today
        raise ValueError(f"Daily provider limit reached. Remaining allowance: {max(0, remaining)} pts")

    # Apply the award
    txn = apply_transaction(
        db, customer, points, TXN_PROVIDER_AWARD,
        provider_id=provider_id,
        note=note or "Provider award",
    )
    db.commit()

    return {
        "transaction_id": str(txn.id),
        "customer_user_id": str(customer_user_id),
        "points_awarded": points,
        "customer_new_balance": customer.points_balance,
        "provider_daily_remaining": PROVIDER_AWARD_MAX_POINTS_PER_DAY - (total_today + points),
    }


# ── D1: Price Suggestion for Products ────────────────────────────────────

def get_price_suggestion(db: Session, category: str) -> dict:
    """Compute recommended point costs for products in a given wellness category.

    Returns median and P25–P75 range of points_cost across active in-category
    products. Falls back to ETB anchor heuristic when < 3 comparables exist.
    """
    # Get all active product costs in this category
    costs = (
        db.query(Product.points_cost)
        .join(Provider, Product.provider_id == Provider.id)
        .filter(
            Product.is_active == True,
            Provider.category == category,
            or_(Provider.status == "active", Provider.status.is_(None)),
        )
        .all()
    )
    values = sorted([c[0] for c in costs if c[0] and c[0] > 0])

    if len(values) < 3:
        # Fallback: ETB anchor heuristic (1 point ≈ 1 ETB)
        return {
            "category": category,
            "has_comparables": False,
            "suggestion_text": "Not enough data for category comparison. Suggested: set points equal to the ETB value of the service.",
            "median": None,
            "p25": None,
            "p75": None,
            "sample_size": len(values),
        }

    import statistics
    median = int(statistics.median(values))
    q = statistics.quantiles(values, n=4)
    p25 = int(q[0])
    p75 = int(q[2])

    return {
        "category": category,
        "has_comparables": True,
        "suggestion_text": f"Similar {category} providers charge {p25}–{p75} pts (median {median})",
        "median": median,
        "p25": p25,
        "p75": p75,
        "sample_size": len(values),
    }


# ── C5: Provider Payout Predictability ────────────────────────────────────

def get_provider_points_analytics(db: Session, provider_id: UUID) -> dict:
    """Points redeemed at this provider — trend data for the analytics tab."""
    from app.models.point_transaction import PointTransaction
    from datetime import timedelta

    now = datetime.now(timezone.utc)

    # Last 30 days, grouped by week
    weeks = []
    for i in range(4):
        week_end = now - timedelta(days=i * 7)
        week_start = week_end - timedelta(days=7)
        redeemed = (
            db.query(func.coalesce(func.sum(func.abs(PointTransaction.amount)), 0))
            .filter(
                PointTransaction.provider_id == provider_id,
                PointTransaction.type.in_(["redemption", "provider_award"]),
                PointTransaction.created_at >= week_start,
                PointTransaction.created_at < week_end,
                PointTransaction.reversed_by.is_(None),
            )
            .scalar()
        )
        visit_count = (
            db.query(PointTransaction.user_id)
            .filter(
                PointTransaction.provider_id == provider_id,
                PointTransaction.type.in_(["redemption", "provider_award"]),
                PointTransaction.created_at >= week_start,
                PointTransaction.created_at < week_end,
                PointTransaction.reversed_by.is_(None),
            )
            .distinct()
            .count()
        )
        weeks.append({
            "week_label": f"Week {4 - i}",
            "points_redeemed": int(redeemed),
            "unique_visits": visit_count,
        })

    weeks.reverse()
    return {
        "provider_id": str(provider_id),
        "weekly_trend": weeks,
    }

