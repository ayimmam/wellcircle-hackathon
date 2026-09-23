"""For You feed builder — shared by GET /api/feed/for-you and
home_bootstrap's `feed` key (Phase 4 of the For You / Boston Day Spa pilot
plan). Ranking is a fixed, deterministic section order, documented in
docs/API_CONTRACT.md — not a scoring model:

    1. **This week's events** — boosted events starting within the next 7
       days, soonest session first, at the very top of the feed. These are
       the ones a reader can still act on today.
    2. **User content** — member posts, newest-first, paginated by `before`.
    3. **Coming-soon events** — boosted events starting 8-30 days out. Far
       enough away that they belong below the post stream, close enough to
       be worth planning around.
    4. **Provider content** — services, then providers, then past-event
       recaps, appended once the post stream is exhausted.

    Sections 1, 3 and 4 are bound to the ends of the *whole* feed, not of
    each page: events are emitted only on the first page (`before is None`)
    and coming-soon/provider content only on the last (`next_before is
    None`). Emitting them per-page would repeat the same events on every
    scroll and strand provider cards in the middle of the post stream.

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

# "This week" is the actionable block at the top of the feed; everything from
# there out to FEED_EVENT_WINDOW is the coming-soon block below the posts.
FEED_THIS_WEEK_WINDOW = timedelta(days=7)
FEED_EVENT_WINDOW = timedelta(days=30)
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
        "contact_phone": p.contact_phone,
        "contact_telegram": p.contact_telegram,
        "contact_instagram": p.contact_instagram,
        "contact_website": p.contact_website,
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
            # Same key as _provider_brief()'s service/provider items (WS5 of
            # docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md) — gates the Book
            # button on FeedEventBanner the same way it already does on
            # FeedServiceCard/FeedProviderCard.
            "is_coming_soon": bool(e.get("provider_is_coming_soon", False)),
            # Carried so FeedEventBanner can route straight to the RSVP screen
            # with everything it renders (see serialize_event).
            "contact_phone": e.get("provider_contact_phone"),
            "contact_telegram": e.get("provider_contact_telegram"),
            "contact_instagram": e.get("provider_contact_instagram"),
            "contact_website": e.get("provider_contact_website"),
        },
    }


def _build_event_items(db: Session, now: datetime) -> tuple[list, list]:
    """Returns (this week's events, coming-soon events).

    One query over the whole 30-day window, split in Python on the 7-day
    boundary — two queries would double the round trips to say the same
    thing, and the pool is capped at MAX_NON_POST_POOL either way.
    """
    events, _ = query_upcoming_events(
        db, from_date=now, to_date=now + FEED_EVENT_WINDOW,
        boosted_only=True, limit=MAX_NON_POST_POOL, with_total=False,
    )
    cutoff = now + FEED_THIS_WEEK_WINDOW
    this_week, coming_soon = [], []
    for e in events:
        starts_at = e["starts_at"]
        # starts_at is a DB datetime; naive rows are stored as UTC.
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        bucket = this_week if starts_at <= cutoff else coming_soon
        bucket.append(_event_item(e, "event"))
    return this_week, coming_soon


def _build_past_event_items(db: Session) -> list:
    """Recaps of sessions that already ran. They can't be booked, so the card
    converts the "I'd have gone to that" reaction into the provider's next
    session rather than showing a dead CTA."""
    events, _ = query_past_events(db, limit=MAX_NON_POST_POOL)
    return [_event_item(e, "past_event") for e in events]


def _post_has_image(item: dict) -> bool:
    return bool(item.get("post", {}).get("photo_url"))


def _event_has_image(item: dict) -> bool:
    return bool(item.get("provider", {}).get("cover_photo_url"))


def partition_by_image(items: list, has_image) -> list:
    """Stable partition: items with an image first, then the rest, each
    keeping its existing relative order (WS3 of
    docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — image-led feed)."""
    with_image = [i for i in items if has_image(i)]
    without_image = [i for i in items if not has_image(i)]
    return with_image + without_image


def _order_feed(
    post_items: list,
    event_items: list,
    service_items: list,
    provider_items: list,
    past_event_items: list,
    coming_soon_event_items: list,
    *,
    include_events: bool,
    include_provider_content: bool,
) -> list:
    """Lay the feed out in four sections: this week's events, member posts,
    coming-soon events, then provider content.

    `include_events` / `include_provider_content` are the page guards. This
    week's events belong to the top of the feed as a whole, so only the first
    page carries them; the coming-soon block and provider content belong to
    the bottom, so only the last page does. Without those guards every scroll
    page would repeat the same event cards and drop provider cards into the
    middle of the post stream.

    Within the events blocks and the posts block, items with an image are
    partitioned to the front (stable, per-page) — the provider/service/
    past-event block keeps its existing order since it is already image-led.
    """
    result = []

    if include_events:
        result.extend(partition_by_image(event_items, _event_has_image))

    result.extend(partition_by_image(post_items, _post_has_image))

    if include_provider_content:
        result.extend(partition_by_image(coming_soon_event_items, _event_has_image))
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
    the event and provider sections are additional and outside that cursor.

    `text_only` builds the post stream and nothing else — one keyset query
    instead of five, and no event/provider sections. It is what GET
    /api/home/lite serves so the For You screen can paint readable text while
    the other pools are still being assembled for the full payload (see
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
        ordered = partition_by_image(post_items, _post_has_image)
        return {"items": ordered, "next_before": next_before, "partial": True}

    providers = section(db, "feed_providers", lambda: _feed_providers(db), [])
    event_items, coming_soon_event_items = section(
        db, "feed_events", lambda: _build_event_items(db, now), ([], []),
    )
    service_items = section(db, "feed_service_items", lambda: _build_service_items(providers), [])
    provider_items = section(db, "feed_provider_items", lambda: _build_provider_items(db, providers), [])
    past_event_items = section(db, "feed_past_events", lambda: _build_past_event_items(db), [])

    items = _order_feed(
        post_items, event_items, service_items, provider_items, past_event_items,
        coming_soon_event_items,
        # First page opens with this week's events; the last one closes with
        # the coming-soon and provider blocks. A short feed is both at once.
        include_events=before is None,
        include_provider_content=next_before is None,
    )

    return {"items": items, "next_before": next_before}
