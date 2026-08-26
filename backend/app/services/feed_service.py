"""For You feed builder — shared by GET /api/feed/for-you and
home_bootstrap's `feed` key (Phase 4 of the For You / Boston Day Spa pilot
plan). Ranking is a fixed, deterministic interleave, documented in
docs/API_CONTRACT.md — not a scoring model:

    A four-item lead-in opens the feed — the spotlight provider (top
    featured, then highest rated), one of its services, its next boosted
    event, and the recap of its most recent past one — each separated by a
    member post so the top of the feed reads as a community rather than as a
    storefront. After the lead-in, posts continue newest-first with one
    non-post item spliced in after every 3rd, cycling
    event -> service -> provider -> past_event and skipping a category when
    empty.

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


def _interleave(
    post_items: list,
    event_items: list,
    service_items: list,
    provider_items: list,
    past_event_items: list,
) -> list:
    pools = [event_items, service_items, provider_items, past_event_items]
    cursors = [0, 0, 0, 0]
    cycle_idx = 0

    def _take_from(pool_idx: int):
        """Pull the next unused item out of one specific pool, or None."""
        pool = pools[pool_idx]
        if cursors[pool_idx] >= len(pool):
            return None
        cursors[pool_idx] += 1
        return pool[cursors[pool_idx] - 1]

    def _take_next() -> bool:
        """Advance the cycle by one, appending an item if that slot isn't
        empty. Returns whether anything was appended."""
        nonlocal cycle_idx
        for _attempt in range(len(pools)):
            chosen = cycle_idx
            cycle_idx = (cycle_idx + 1) % len(pools)
            item = _take_from(chosen)
            if item is not None:
                result.append(item)
                return True
        return False

    result = []
    # The lead-in: the spotlight provider (top featured/highest-rated — the
    # pilot, e.g. Boston Day Spa), one of its services, its next event, and
    # the recap of its last one. Leaving these to the every-3rd-post cadence
    # meant a light post day pushed them past the fold or off the first page
    # entirely; spacing them one post apart keeps them visible without
    # stacking four commercial cards on top of each other.
    lead_in = [item for item in (
        _take_from(2), _take_from(1), _take_from(0), _take_from(3),
    ) if item is not None]

    if lead_in:
        result.append(lead_in.pop(0))

    for i, post_item in enumerate(post_items):
        result.append(post_item)
        if lead_in:
            result.append(lead_in.pop(0))
        elif (i + 1) % 3 == 0:
            _take_next()

    # A new user with few/no posts would otherwise never see providers,
    # services, or events at all — drain whatever the post stream didn't
    # reach so the feed is never empty while there's content to show.
    result.extend(lead_in)
    while _take_next():
        pass

    return result


def build_for_you_feed(
    db: Session,
    limit: int = 10,
    before: Optional[datetime] = None,
    text_only: bool = False,
) -> dict:
    """`limit`/`before` paginate the underlying posts (keyset on created_at);
    interleaved non-post items are additional and outside that cursor.

    `text_only` builds the post stream and nothing else — one keyset query
    instead of six, no lead-in and no interleave. It is what GET /api/home/lite
    serves so the For You screen can paint readable text while the provider,
    service and event pools are still being assembled for the full payload (see
    app/api/home.py). The cursor is identical either way, because it is derived
    from the same posts query, so a client that paginates off a lite page stays
    consistent once the full page replaces it.
    """
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

    if text_only:
        return {"items": post_items, "next_before": next_before, "partial": True}

    providers = section(db, "feed_providers", lambda: _feed_providers(db), [])
    event_items = section(db, "feed_events", lambda: _build_event_items(db, now), [])
    past_event_items = section(db, "feed_past_events", lambda: _build_past_event_items(db), [])
    service_items = section(db, "feed_service_items", lambda: _build_service_items(providers), [])
    provider_items = section(db, "feed_provider_items", lambda: _build_provider_items(db, providers), [])

    items = _interleave(post_items, event_items, service_items, provider_items, past_event_items)

    return {"items": items, "next_before": next_before}
