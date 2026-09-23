"""For You feed builder — shared by GET /api/feed/for-you and
home_bootstrap's `feed` key (Phase 4 of the For You / Boston Day Spa pilot
plan). Ranking is a fixed, deterministic cycle, documented in
docs/API_CONTRACT.md — not a scoring model.

**The feed round-robins five lanes**, taking one item from each in turn and
repeating, so the reader never gets a wall of the same kind of card:

    1. **This week's events** — boosted events starting within 7 days. The
       ones a reader can still act on today.
    2. **User posts with an image** — the posts that carry the feed visually.
    3. **User posts** — the rest of the post stream. Paginated by `before`.
    4. **Upcoming events** — boosted events 8-30 days out. Worth planning
       around, but not actionable today.
    5. **Provider services** — what a provider sells.

A lane that runs dry is skipped and the cycle continues with the rest, so a
feed with two events and thirty posts degrades to alternating posts rather
than stalling. **Provider cards and past-event recaps** are not in the cycle
— they are appended after it, in that order.

Within each lane the order is shuffled from `seed` (see `build_for_you_feed`)
so the mix feels fresh per session while staying stable across the pages of
one scroll. The *lane order itself never varies*: position 1 of every cycle
is an event, position 2 an image post, and so on.

Lanes 1, 4 and 5 are bound to the ends of the *whole* feed, not of each
page: events and services are emitted only on the first page (`before is
None`) and provider cards / recaps only on the last (`next_before is None`).
Emitting them per-page would repeat the same event cards on every scroll and
strand provider cards mid-stream. Pages after the first therefore cycle over
lanes 2 and 3 alone — image post, post, image post — which is the same rule
applied to the lanes that still have anything in them.

Both live and coming-soon providers may appear as `service` or `provider`
items (coming-soon ones render with a "Coming soon" badge and no booking CTA
— see FeedProviderCard/FeedServiceCard — so the pilot stays visible in the
feed pre-launch). An `event` item is emitted only for a boosted/featured
event. A `past_event` item carries `attendee_count` and renders a recap with
no booking CTA.
"""
import random
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


def round_robin(lanes: list) -> list:
    """Interleave lanes, one item from each per cycle, in the given lane
    order. An exhausted lane drops out and the cycle continues without it.

    >>> round_robin([[1, 2, 3], ["a"], ["x", "y"]])
    [1, 'a', 'x', 2, 'y', 3]

    Shared with the frontend's mock builder (data/mock.js) so offline mode
    and the tests lay out the same feed the server does.
    """
    result = []
    cursors = [0] * len(lanes)
    remaining = sum(len(lane) for lane in lanes)
    while remaining:
        for i, lane in enumerate(lanes):
            if cursors[i] < len(lane):
                result.append(lane[cursors[i]])
                cursors[i] += 1
                remaining -= 1
    return result


class _NoShuffle:
    """Stands in for a seeded Random when no seed was given. Leaves every
    lane in its natural order (events soonest-first, posts newest-first)
    rather than reshuffling per request, which would break pagination."""

    @staticmethod
    def shuffle(_items):
        return None


def _shuffled(items: list, rng) -> list:
    """A copy of `items` in `rng`'s order. `rng` is seeded per session, so
    the same request twice gives the same feed and one scroll stays stable
    across its pages."""
    out = list(items)
    rng.shuffle(out)
    return out


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
    rng,
) -> list:
    """Round-robin the five lanes, then append provider cards and recaps.

    `include_events` / `include_provider_content` are the page guards.
    Events and services are finite pools that belong to the feed as a whole,
    so only the first page cycles them in; provider cards and past-event
    recaps close the feed, so only the last page appends them. Without those
    guards every scroll page would repeat the same event cards and strand
    provider cards mid-stream.

    Pages after the first therefore cycle lanes 2 and 3 only. That is not a
    special case — it is what the same cycle does when three of its five
    lanes are empty.
    """
    image_posts = [i for i in post_items if _post_has_image(i)]
    text_posts = [i for i in post_items if not _post_has_image(i)]

    # Event lanes are shuffled and *then* image-partitioned, so an event
    # with a cover photo still surfaces before one without (WS3) while the
    # order inside each of those two groups is the seed's. The banner is
    # 180px tall — leading with a coverless event means leading with a grey
    # box. The post lanes need no such partition: lane 2 is the image posts.
    def event_lane(items):
        return partition_by_image(_shuffled(items, rng), _event_has_image) if include_events else []

    lanes = [
        event_lane(event_items),
        _shuffled(image_posts, rng),
        _shuffled(text_posts, rng),
        event_lane(coming_soon_event_items),
        _shuffled(service_items, rng) if include_events else [],
    ]

    result = round_robin(lanes)

    if include_provider_content:
        result.extend(provider_items)
        result.extend(past_event_items)

    return result


def build_for_you_feed(
    db: Session,
    limit: int = 10,
    before: Optional[datetime] = None,
    text_only: bool = False,
    seed: Optional[str] = None,
) -> dict:
    """`limit`/`before` paginate the underlying posts (keyset on created_at);
    the event and provider lanes are additional and outside that cursor.

    `seed` fixes the shuffle inside each lane. The client generates one per
    session and sends the same value for every page of that scroll, so the
    mix is fresh each time the app is opened but never reshuffles mid-scroll
    — a reshuffle between pages would repeat some posts and skip others.
    Omitted, the feed falls back to an unshuffled lane order, which keeps
    this callable from a script or a test without inventing a seed.

    Note the cursor is derived from `posts` (still newest-first off the
    keyset query), never from the shuffled output, so shuffling cannot
    corrupt pagination.

    `text_only` builds the post stream and nothing else — one keyset query
    instead of five, and no event/provider lanes. It is what GET
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

    # `random.Random(None)` seeds itself from the OS, which would reshuffle
    # between pages. No seed means no shuffle at all instead. The isinstance
    # check also covers callers that invoke the endpoint functions directly
    # (the test suite does), where an unresolved FastAPI Query object arrives
    # here in place of the string.
    rng = random.Random(seed) if isinstance(seed, str) and seed else _NoShuffle()

    if text_only:
        # The lite payload is posts only, so the cycle reduces to the two
        # post lanes — image post, post, image post — which is what the full
        # payload does with those same posts once it lands. Nothing
        # reshuffles on the swap.
        ordered = round_robin([
            _shuffled([i for i in post_items if _post_has_image(i)], rng),
            _shuffled([i for i in post_items if not _post_has_image(i)], rng),
        ])
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
        rng=rng,
        # The first page cycles in the finite event and service pools; the
        # last one appends the provider cards and recaps. A short feed is
        # both at once.
        include_events=before is None,
        include_provider_content=next_before is None,
    )

    return {"items": items, "next_before": next_before}
