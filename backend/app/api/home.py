"""Aggregate payload for the Home screen."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.events import query_upcoming_events
from app.crud.circle import get_circle_social_proof
from app.crud.circle_story import get_story_rail
from app.crud.community import get_all_communities
from app.crud.provider import get_all_providers
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_notification import UserNotification
from app.services.feed_service import build_for_you_feed
from app.utils.logger import get_logger
from app.utils.resilient import section as _section

logger = get_logger(__name__)

router = APIRouter()

FEATURED_LIMIT = 10
EVENTS_LIMIT = 20
EVENT_WINDOW = timedelta(days=7)
FEED_LIMIT = 10


@router.get("/home/lite")
async def home_lite(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The cheap half of /home/bootstrap, so For You can paint text at once.

    The full bootstrap fans out over the provider directory, every provider's
    services, upcoming events, past-event recaps and the circle lists. On a
    cold free-tier function that is seconds of work before *anything* reaches
    the screen — and none of it is needed to render the part of the feed that
    is just words: member posts, and the check-in card.

    So the client asks for both at once. This endpoint answers with the two
    queries the first screenful actually depends on plus two counters, the
    screen paints from whichever lands first, and /home/bootstrap fills in the
    events and provider cards when it arrives.

    Keys are a strict subset of /home/bootstrap's and carry the same shapes, so
    the client renders either payload through one code path. `partial: true`
    marks the payload as one that must not be cached as if it were the whole
    thing.
    """
    def section(name, fn, fallback):
        return _section(db, name, fn, fallback)

    # Only the user's own circles: the check-in card is all this list feeds,
    # and joined_only skips the provider join for every circle they aren't in.
    communities = section(
        "lite_communities",
        lambda: get_all_communities(db, user_id=user.id, joined_only=True, category=None),
        [],
    )
    social_proof = section("lite_social_proof", lambda: get_circle_social_proof(db, user.id), None)
    unread_count = section(
        "lite_unread_count",
        lambda: db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.is_read == False)
        .count(),
        0,
    )
    feed = section(
        "lite_feed",
        lambda: build_for_you_feed(db, limit=FEED_LIMIT, text_only=True),
        {"items": [], "next_before": None},
    )
    # The story rail sits at the very top of For You, so it ships in the cheap
    # payload: two indexed queries over the user's own circles, no provider
    # fan-out to wait behind.
    stories = section("lite_stories", lambda: get_story_rail(db, user.id), [])

    return {
        "partial": True,
        "communities": communities,
        "social_proof": social_proof,
        "unread_count": unread_count,
        "feed": feed,
        "stories": stories,
    }


@router.get("/home/bootstrap")
async def home_bootstrap(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Everything Home renders, in one round trip.

    Home previously opened with six parallel requests, each able to hit its own
    cold serverless function — on a free-tier deploy that is six cold starts for
    one screen. Collapsing them into a single invocation means the whole screen
    pays for at most one.

    Each section is independent, so one failing section degrades to an empty
    list rather than blanking the screen; the client's per-endpoint fallbacks
    can still fill it in.
    """
    now = datetime.now(timezone.utc)
    window_end = now + EVENT_WINDOW

    def section(name, fn, fallback):
        return _section(db, name, fn, fallback)

    providers = section("providers", lambda: get_all_providers(db), [])
    communities = section(
        "communities",
        lambda: get_all_communities(db, user_id=user.id, joined_only=False, category=None),
        [],
    )
    events, _ = section(
        "events",
        lambda: query_upcoming_events(
            db, from_date=now, to_date=window_end, limit=EVENTS_LIMIT, with_total=False
        ),
        ([], 0),
    )
    featured_events, _ = section(
        "featured_events",
        lambda: query_upcoming_events(
            db,
            from_date=now,
            to_date=window_end,
            boosted_only=True,
            limit=FEATURED_LIMIT,
            with_total=False,
        ),
        ([], 0),
    )
    social_proof = section("social_proof", lambda: get_circle_social_proof(db, user.id), None)
    unread_count = section(
        "unread_count",
        lambda: db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.is_read == False)
        .count(),
        0,
    )
    # For You feed's first page — the screen paints from this bootstrap on
    # open (one request, per Phase 2) and only hits GET /api/feed/for-you on
    # scroll for subsequent pages.
    feed = section("feed", lambda: build_for_you_feed(db, limit=FEED_LIMIT), {"items": [], "next_before": None})
    stories = section("stories", lambda: get_story_rail(db, user.id), [])

    return {
        "providers": providers,
        "communities": communities,
        "events": events,
        "featured_events": featured_events,
        "social_proof": social_proof,
        "unread_count": unread_count,
        "feed": feed,
        "stories": stories,
    }
