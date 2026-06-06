"""Provider CRUD operations."""

from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.provider import Provider
from app.models.community import Community, CommunityMember, CommunityFeedEvent
from app.models.booking import Booking
from app.models.user import User


def get_all_providers(
    db: Session,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    """Get all providers with community info."""
    query = db.query(Provider)

    if category:
        query = query.filter(Provider.category == category)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Provider.name.ilike(search_filter)) |
            (Provider.description.ilike(search_filter))
        )

    providers = query.order_by(Provider.name).all()
    result = []
    for p in providers:
        community = db.query(Community).filter(Community.provider_id == p.id).first()
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
            "member_count": community.member_count if community else 0,
            "community_id": str(community.id) if community else None,
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


def create_provider(db: Session, **kwargs) -> Provider:
    """Create a new provider."""
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
