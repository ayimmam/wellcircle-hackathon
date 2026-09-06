"""For You feed builder — shared by GET /api/feed/for-you and
home_bootstrap's `feed` key (Phase 4 of the For You / Boston Day Spa pilot
plan). Ranking is a fixed, deterministic section order, documented in
docs/API_CONTRACT.md — not a scoring model:

    1. **Upcoming events** — every boosted event in the next 14 days, newest
       session first, at the very top of the feed.
    2. **User content** — member posts, newest-first, paginated by `before`.
    3. **Provider content** — services, then providers, then past-event
       recaps, appended once the post stream is exhausted.

    Sections 1 and 3 are bound to the ends of the *whole* feed, not of each
    page: events are emitted only on the first page (`before is None`) and
    provider content only on the last (`next_before is None`). Emitting them
    per-page would repeat the same events on every scroll and strand
    provider cards in the middle of the post stream.

    Both live and coming-soon providers may appear as `service` or
    `provider` items (coming-soon ones render with a "Coming soon" badge and
    no booking CTA — see FeedProviderCard/FeedServiceCard — so the pilot
    stays visible in the feed pre-launch). An `event` item is emitted only
    for a boosted/featured event. A `past_event` item carries
    `attendee_count` and renders a recap with no booking CTA.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.events import query_upcoming_events, query_past_events
from app.crud.post import get_public_feed_posts
from app.models.provider import Provider
from app.services.promotion_service import get_active_promotion
from app.utils.resilient import section

FEED_EVENT_WINDOW = timedelta(days=14)
# Small, fixed pools — these are display highlights, not a full directory scan.
MAX_NON_POST_POOL = 10


def _provider_brief(p: Provider) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "location_text": p.location_text,
        "rating": p.rating,
        "cover_photo_url": p.cover_photo_url,
        "is_coming_soon": bool(p.is_coming_soon),
    }


def _feed_providers(db: Session):
    return (
        db.query(Provider)
        .filter(
            or_(Provider.status == "active", Provider.status.is_(None)),
        )
        .order_by(Provider.is_featured.desc(), Provider.rating.desc())
        .limit(MAX_NON_POST_POOL)
        .all()
    )


def _build_service_items(providers) -> list:
    items = []
    for p in providers:
        brief = _provider_brief(p)
        for idx, svc in enumerate(p.services or []):
            items.append({
                "type": "service",
                "render_cost": "media",
                "id": f"{p.id}:{idx}",
                "provider": brief,
                "service": svc,
            })
    return items


def _build_provider_items(db: Session, providers) -> list:
    return [
        {
            "type": "provider",
            "render_cost": "media",
            "id": p.id,
            "provider": _provider_brief(p),
            "promotion": get_active_promotion(db, p.id),
        }
        for p in providers
    ]


def _event_item(e: dict, item_type: str) -> dict:
    return {
        "type": item_type,
        "render_cost": "media",
        "id": e["id"],
        "event": e,
        "provider": {
            "id": e["provider_id"],
            "name": e["provider_name"],
            "category": e["provider_category"],
            "cover_photo_url": e["provider_cover_photo_url"],
        },
    }


def _build_event_items(db: Session, now: datetime) -> list:
    events, _ = query_upcoming_events(
        db, from_date=now, to_date=now + FEED_EVENT_WINDOW,
        boosted_only=True, limit=MAX_NON_POST_POOL, with_total=False,
    )
    return [_event_item(e, "event") for e in events]


def _build_past_event_items(db: Session) -> list:
    """Recaps of sessions that already ran. They can't be booked, so the card
    converts the "I'd have gone to that" reaction into the provider's next
    session rather than showing a dead CTA."""
    events, _ = query_past_events(db, limit=MAX_NON_POST_POOL)
    return [_event_item(e, "past_event") for e in events]


def _order_feed(
    post_items: list,
    event_items: list,
    service_items: list,
    provider_items: list,
    past_event_items: list,
    *,
    include_events: bool,
    include_provider_content: bool,
) -> list:
    """Lay the feed out in three sections: upcoming events, then member
    posts, then provider content.

    `include_events` / `include_provider_content` are the page guards. Events
    belong to the top of the feed as a whole, so only the first page carries
    them; provider content belongs to the bottom, so only the last page does.
    Without those guards every scroll page would repeat the same event cards
    and drop provider cards into the middle of the post stream.
    """
    result = []

    if include_events:
        result.extend(event_items)

    result.extend(post_items)

    if include_provider_content:
        result.extend(service_items)
        result.extend(provider_items)
        result.extend(past_event_items)

    return result


def build_for_you_feed(
    db: Session,
    limit: int = 10,
    before: Optional[datetime] = None,
    text_only: bool = False,
) -> dict:
    """`limit`/`before` paginate the underlying posts (keyset on created_at);
    the event and provider sections are additional and outside that cursor."""
    now = datetime.now(timezone.utc)

    posts = section(db, "feed_posts", lambda: get_public_feed_posts(db, limit=limit, before=before), [])

    post_items = [
        {
            "type": "post",
            "render_cost": "instant" if not p.get("photo_url") else "media",
            "id": p["id"],
            "created_at": p["created_at"],
            "post": p,
        }
        for p in posts
    ]

    next_before = posts[-1]["created_at"] if len(posts) == limit else None

    items = _order_feed(
        post_items, event_items, service_items, provider_items, past_event_items,
        # First page opens with the events; the last one closes with the
        # provider block. A short feed is both at once.
        include_events=before is None,
        include_provider_content=next_before is None,
    )

    return {"items": items, "next_before": next_before}
