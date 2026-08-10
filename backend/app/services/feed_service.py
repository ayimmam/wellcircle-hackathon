"""For You feed builder — shared by GET /api/feed/for-you and
home_bootstrap's `feed` key (Phase 4 of the For You / Boston Day Spa pilot
plan). Ranking is a fixed, deterministic interleave, documented in
docs/API_CONTRACT.md — not a scoring model:

    Posts newest-first. After every 3rd post, splice in one non-post item,
    cycling event -> service -> provider, skipping a category when empty.
    Both live and coming-soon providers may appear as `service` or
    `provider` items (coming-soon ones render with a "Coming soon" badge and
    no booking CTA — see FeedProviderCard/FeedServiceCard — so the pilot
    stays visible in the feed pre-launch). An `event` item is emitted only
    for a boosted/featured event.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.events import query_upcoming_events
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


def _build_event_items(db: Session, now: datetime) -> list:
    events, _ = query_upcoming_events(
        db, from_date=now, to_date=now + FEED_EVENT_WINDOW,
        boosted_only=True, limit=MAX_NON_POST_POOL, with_total=False,
    )
    return [
        {
            "type": "event",
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
        for e in events
    ]


def _interleave(post_items: list, event_items: list, service_items: list, provider_items: list) -> list:
    pools = [event_items, service_items, provider_items]
    cursors = [0, 0, 0]
    cycle_idx = 0

    def _take_next() -> bool:
        """Advance the cycle by one, appending an item if that slot isn't
        empty. Returns whether anything was appended."""
        nonlocal cycle_idx
        for _attempt in range(len(pools)):
            chosen = cycle_idx
            cycle_idx = (cycle_idx + 1) % len(pools)
            if cursors[chosen] < len(pools[chosen]):
                result.append(pools[chosen][cursors[chosen]])
                cursors[chosen] += 1
                return True
        return False

    result = []
    # Pin the top featured/highest-rated provider (the pilot spotlight, e.g.
    # Boston Day Spa) as the very first feed item instead of leaving it to
    # the every-3rd-post cadence — otherwise a light post day can push it
    # past the fold or off the first page entirely.
    if provider_items:
        result.append(provider_items[0])
        cursors[2] = 1

    for i, post_item in enumerate(post_items):
        result.append(post_item)
        if (i + 1) % 3 == 0:
            _take_next()

    # A new user with few/no posts would otherwise never see providers,
    # services, or events at all — drain whatever the post stream didn't
    # reach so the feed is never empty while there's content to show.
    while _take_next():
        pass

    return result


def build_for_you_feed(db: Session, limit: int = 10, before: Optional[datetime] = None) -> dict:
    """`limit`/`before` paginate the underlying posts (keyset on created_at);
    interleaved non-post items are additional and outside that cursor."""
    now = datetime.now(timezone.utc)

    posts = section(db, "feed_posts", lambda: get_public_feed_posts(db, limit=limit, before=before), [])
    providers = section(db, "feed_providers", lambda: _feed_providers(db), [])
    event_items = section(db, "feed_events", lambda: _build_event_items(db, now), [])
    service_items = section(db, "feed_service_items", lambda: _build_service_items(providers), [])
    provider_items = section(db, "feed_provider_items", lambda: _build_provider_items(db, providers), [])

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

    items = _interleave(post_items, event_items, service_items, provider_items)
    next_before = posts[-1]["created_at"] if len(posts) == limit else None

    return {"items": items, "next_before": next_before}
