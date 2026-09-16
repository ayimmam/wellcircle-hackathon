# Well Circle Audit — Implementation Plan (Sep 2026)

Source: `docs/Wellcircle audit.docx`. Context: `docs/HANDOFF.md`
through Phase 22. This plan is the proposed **Phase 23**.

Every product decision below was confirmed with the product owner on
2026-09-16 (see §1). Anything this plan picked on its own is listed in
§15 **Defaults to confirm**. Please check that list before starting.

---

## 0. TL;DR

| # | Audit item | Workstream | Size |
|---|---|---|---|
| 1 | Stories don't work | **WS0** prod fix → **WS1** rebuild as public, user-level stories | L |
| 2 | Story images ≤ 2 MB, optimistic, rings, top of FYP | WS1 | (in L) |
| 3 | +20 pts per story | WS1 + WS2 shared "capped earn" helper | S |
| 4 | Community opens on "My Circles" | WS4 | XS |
| 5 | Explore opens on Events, past events shown | WS4 | S |
| 6 | Profile lists collapsed to 2 + expand arrow | WS4 | S |
| 7 | Check-in card appears after 2 min | WS4 | S |
| 8 | "Studios" pill → "Providers" | WS4 | XS |
| 9 | Only Boston Day Spa bookable | WS5 | S |
| 10 | FYP prioritizes posts/events with images | WS3 | M |
| 11 | Optimistic UI everywhere | WS7 (cross-cutting) | L |
| 12 | Chatbot → Explore; "+" post button (images, +10 pts) | WS2 | M |
| 13 | Seed events from `events/` posters | WS6 | M |
| 14 | Leave circle / delete circle (creator) | WS8 | M |
| 15 | Change profile picture (−10 pts) | WS9 | M |
| 16 | Remove "taking longer than usual" and similar noise | WS10 | S |

Order: **WS0 → (WS10, WS4, WS5) → WS7 foundation → WS1, WS2, WS3, WS8, WS9 → WS6**.
Rationale in §13.

---

## 1. Confirmed decisions

| Topic | Decision |
|---|---|
| Story model | **User-level, visible to all users.** Not tied to a circle. The viewer has a **Follow** button at the bottom of someone else's story. |
| Story bug as observed | The file shows up in the Cloudinary folder, but the story can't be viewed, not even by a circle member. |
| "+" post target | **Standalone public post.** No circle required; it goes into the For You feed. |
| Point farming | **Daily caps** on story and post points. |
| Post points scope | **All user posts** (standalone + circle Activity) earn +10, sharing **one** daily cap. |
| Conflicting posters | **Latest poster wins** where they overlap. |
| Event banner | The **provider's cover photo** (no new event image column). |
| New event hosts | **Create provider + community** for each new host. Spelling variants are merged. "OFFLINE Events" (TBD) is skipped. |
| Host identity | **Zumba with Vahe, Zumba Dance Fitness and AfroHeat Fitness are separate providers.** SUP Studio is **one** provider hosting both "AfroBeat Dance with Seble" and "Sup Running Community / Enitewawek". |
| Event prices | `price_etb = 0`, and the description says to confirm the price with the host. |
| Cover images for new hosts | **Cropped from the posters.** |
| Profile photo cost | **Always 10 points, never blocked.** The balance floors at 0, which `apply_transaction` already does. |
| Delete circle | **Soft delete** (`deleted_at`). Members removed, posts/stories hidden, admin-recoverable. **Blocked (409) while a paid subscription is active.** |
| Owner leaves | **Allowed, ownership transfers** to the longest-standing member. If there is no other member, the circle is soft-deleted. |
| Error toasts | **Silence network noise only.** Timeouts, offline errors and background-refresh failures are logged, never toasted. A failed *user-initiated* action still gets one short message when its optimistic change is rolled back. |
| Check-in delay | **2 minutes, once per day.** After today's first 2 minutes of foreground time, the card shows immediately for the rest of the day. |
| Booking gate reach | **Providers + events.** Events from coming-soon hosts stay visible but show no Book button. |
| Booking gate method | **Data flip.** `is_coming_soon = true` on every provider except Boston Day Spa. No hardcoded allowlist. |
| App scope | **Mini App only** (`frontend/` + `backend/`). `wellcircle-web/` gets the backend changes but no UI work. |

---

## 2. WS0 — Diagnose and fix the production story bug (do first)

### Hypothesis (from reading the code)

Posting a story takes **two requests**. First `POST /api/uploads`
(folder=`stories`) sends the bytes to Cloudinary, which succeeds, so the file
appears in the folder. Then `POST /api/circles/{id}/stories` writes the row.
The row lives in `circle_stories`, which is created **only** by Alembic
migration `018_circle_stories_and_banner.py`. Nothing applies Alembic in
production. `app/database_schema.py::ensure_db_schema` runs on boot but does
**not** create `circle_stories` / `circle_story_views` or the
`circles.banner_*` columns. This is the same class of outage as the Phase 14
and Phase 15 post-deploy incidents in HANDOFF.

If the table is missing, then:

- the row insert 500s → Cloudinary asset orphaned ("shows in the folder");
- `GET /home/bootstrap` wraps the rail in `section("stories", …, [])`, which
  swallows the error → an empty rail, not a crash ("can't be viewed");
- `GET /circles/{id}/stories` 500s → the circle page rail stays empty.

### Tasks

1. **Confirm before fixing.** Check Vercel runtime logs for the backend project
   (`get_runtime_logs`, filter `circle_stories`) and look for
   `relation "circle_stories" does not exist` or `UndefinedTable`. Also run
   `select to_regclass('public.circle_stories')` in the Supabase SQL editor.
   Record what you find in HANDOFF.
   - If the table **does** exist, the hypothesis is wrong. Next suspects:
     `StoryViewer` rendering, the `section()`-swallowed exception (look for
     the `section stories failed` log line), or `has_circle_access` returning
     false. Don't continue to step 2 until the cause is known.
2. **Stop the bleeding (hotfix PR, ahead of WS1).** Add
   `CREATE TABLE IF NOT EXISTS` for the story tables and
   `ADD COLUMN IF NOT EXISTS` for `circles.banner_url/banner_public_id` to
   `ensure_db_schema`. WS1 replaces these tables, but the hotfix makes
   circle stories work today.
3. **Prevent a repeat: schema-drift report.** New
   `app/database_schema.py::schema_drift(engine) -> dict` compares
   `Base.metadata` to `sqlalchemy.inspect(engine)` and returns missing tables
   and columns. Call it at the end of `ensure_db_schema`, logging **ERROR**
   with the full list when drift exists. Operators get a single greppable
   line (`SCHEMA DRIFT`) instead of a 500 spread across endpoints. It never
   raises, so boot still works.
4. **Orphan-proof story writes** (carried into WS1): a single multipart
   request uploads and inserts, and deletes the Cloudinary asset if the
   insert fails.

### Tests

- `backend/app/tests/test_schema_drift.py` (new)
  - SQLite DB created from `Base.metadata` minus one table and one column →
    `schema_drift()` reports exactly those two.
  - Full metadata → empty report.
  - `ensure_db_schema` on SQLite is still a no-op and doesn't raise.

---

## 3. WS1 — Public, user-level stories

### Backend

**Schema — migration `019_public_stories.py`** (+ matching `ensure_db_schema`
statements, per the WS0 rule that every new table ships in both):

```
stories
  id UUID PK
  user_id UUID FK users NOT NULL
  image_url VARCHAR(500) NOT NULL
  image_public_id VARCHAR(255) NOT NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  expires_at TIMESTAMPTZ NOT NULL
  deleted_at TIMESTAMPTZ NULL
  INDEX ix_stories_active (expires_at, deleted_at)
  INDEX ix_stories_user (user_id, created_at)

story_views (story_id FK stories, user_id FK users, viewed_at) PK(story_id, user_id)
```

- New `app/models/story.py`. Keep the two-clock design from
  `circle_story.py` (`expires_at` = visibility, `deleted_at` = storage purge).
- **Copy any rows in `circle_stories` into `stories`** in the migration and
  the ensure step (`INSERT … SELECT … ON CONFLICT DO NOTHING`), then leave
  the old tables in place for one release. Drop them in a later migration.
- `CircleStory` model and `crud/circle_story.py` are deleted once nothing
  imports them. The `purge_expired_stories` maintenance job moves to
  `crud/story.py`.

**CRUD — `app/crud/story.py`** (port of `circle_story.py`, circle logic removed):

- `create_story(db, user, file_bytes, content_type)`: upload to Cloudinary
  folder `stories`. If the DB insert fails, call `_destroy_asset(public_id)`
  and re-raise. Enforces `MAX_ACTIVE_STORIES_PER_USER = 10`.
- `get_story_rail(db, viewer_id, limit_groups=30)`: all active stories from
  **all users**, grouped by author. Order:
  1. the viewer's own group,
  2. authors the viewer **follows** with unseen stories,
  3. everyone else with unseen stories,
  4. fully seen groups;
  each tier sorted by `latest_at` desc. Each group adds
  `is_following: bool`. **Batched**: stories, authors, seen-set, view counts
  and follow-set are one query each, with no per-story or per-group queries.
- `mark_story_viewed`: no membership check (stories are public).
- `delete_story`: author or super admin.

**Points — shared capped-earn helper in `app/services/points.py`:**

```python
POINTS_STORY = 20
POINTS_POST = 10
STORY_POINTS_DAILY_CAP = 1   # stories that earn per UTC day (default; see §15)
POST_POINTS_DAILY_CAP = 3    # posts that earn per UTC day (default; see §15)
TXN_STORY = "story"
TXN_POST = "post"

def award_capped(db, user, txn_type, amount, daily_cap, reference_id) -> int:
    """Award `amount` unless the user already has `daily_cap` ledger rows of
    `txn_type` since UTC midnight. Returns the points awarded (0 or amount).
    Counts ledger rows, not live content, so posting then deleting can't
    reset the cap."""
```

UTC midnight matches the existing check-in "today" boundary
(`crud/community.py`). Add both types to `VALID_TXN_TYPES`.
`point_transactions.type` has no DB constraint, so no migration is needed.

**Upload rule.** `cloudinary_service.FOLDER_RULES["stories"]["max_size"]`
goes from 10 MB to **2 MB**. The client compresses before upload (below);
the server limit is the backstop and returns a 422 whose `detail` is written
for users.

**API — `app/api/stories.py`** (new router, mounted at `/api/stories`):

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/stories` | multipart `file`. 201 → `{story, points_awarded, points_balance}`. 422 bad type/size, 429 active cap, 503 Cloudinary unset |
| `GET` | `/api/stories/feed` | `{groups: [...]}` |
| `POST` | `/api/stories/{id}/view` | `{view_count}` |
| `DELETE` | `/api/stories/{id}` | 204 |

- `api/home.py` bootstrap and lite payloads switch to the new
  `get_story_rail`.
- **Deploy-order safety:** keep `GET /api/circles/stories/feed` as an alias
  for the new rail for one release, and make the old
  `POST /circles/{id}/stories` return 410 with a user-safe message. The
  frontend falls back on 404 the way `getHomeBootstrap` already does.
- Update `docs/API_CONTRACT.md` (new "Stories" section; mark the circle
  story endpoints deprecated).

### Frontend

- **`src/utils/imageCompress.js`** (new, shared with WS2 and WS9):
  `compressImage(file, { maxBytes: 2_000_000, maxEdge: 1440 })`.
  It draws to a canvas and exports `image/jpeg`, stepping quality
  0.85 → 0.5, then shrinking the edge until the output is ≤ maxBytes.
  Files already small enough are returned untouched. Throws
  `ImageTooLargeError` only when it can't reach the limit.
- **`src/api/client.js`**
  - `createStory(file, { onProgress })`: sends via `XMLHttpRequest`, because
    `fetch` has no upload progress, and uses the same auth header and error
    mapping as `request()`.
  - `getStoryRail`, `markStoryViewed`, `deleteStory` repointed to
    `/stories/*`.
  - Mock mode: `MOCK_STORIES` become user-level, and the rail grouping matches
    the backend order (own → followed-unseen → unseen → seen).
- **Optimistic posting (`src/hooks/useStoryUpload.js`, new):**
  1. When a file is picked, create `URL.createObjectURL(file)` and insert a
     **pending** story at the front of the viewer's own group, both in the
     cache (`cacheKeys.storyRail()`) and in the bootstrap/lite state
     `ForYouScreen` holds.
  2. The "Your story" ring shows a **progress arc** (conic-gradient driven by
     `onProgress`).
  3. The upload continues in the background. Navigating away doesn't cancel
     it, because the hook lives in a module-level upload queue rather than in
     component state.
  4. On success, swap the pending id/url for the server's. The points badge
     is updated from `points_balance`.
  5. On failure, the ring turns red with a retry tap target. One short toast
     ("Story didn't post — tap to retry") is allowed by the WS10 rule. Revoke
     the object URL when the story is replaced or discarded.
- **`StoryRail.jsx` on Home**: `canAddStory` is on. Tapping "Your story"
  opens the file picker directly (no circle picker). The add badge also shows
  on your own ring when you already have stories.
- **`StoryViewer.jsx`**: on other people's stories, a bottom bar shows a
  **Follow / Following** button that calls `followUser` / `unfollowUser`
  optimistically (WS7 helper) and updates `is_following` for that group in
  the cache. The author name links to `/users/:id`. Your own stories keep the
  view count and delete.
- **`CircleDetailScreen.jsx`**: remove the circle story rail and
  `StoryComposer` (see §15 for whether circle pages should show members'
  stories instead). Delete `StoryComposer.jsx` once it has no importers.
- **FYP priority**: the rail stays the first thing under the greeting, and is
  rendered from the **lite** payload so it paints before the full feed.

### Tests

Backend — `backend/app/tests/test_public_stories.py` (new; SQLite harness pattern from `test_for_you_feed.py`, pytest-collected `test_all`):

- Any authenticated user sees any other user's active story (no membership needed).
- Expired stories and soft-deleted stories are excluded.
- Rail order: own → followed+unseen → unseen → seen; `is_following` correct.
- **Query count for the rail is constant** for 1 vs 25 authors (same event-listener counting technique as `test_for_you_feed`).
- `create_story` awards +20 the first time and 0 the second time on the same UTC day; deleting the first and posting again still awards 0; the next UTC day awards again (freeze time via monkeypatched `_now`).
- DB insert failure → `_destroy_asset` called with the uploaded `public_id` (mock `cloudinary_service`).
- Active-story cap → 429; >2 MB → 422; bad content type → 422; Cloudinary unset → 503 (TestClient + dependency override for `get_current_user`).
- View receipt is idempotent; `view_count` is only returned to the author.
- Delete: author ok, super admin ok, other user 403.
- Migration data copy: `circle_stories` rows appear in `stories` (run the ensure SQL against a SQLite-compatible variant, or test the copy function in isolation).

Frontend (Vitest, mock mode):

- `src/test/imageCompress.test.js`: stub `HTMLCanvasElement.prototype.toBlob`. A 5 MB input comes out ≤ 2 MB; a small input is returned unchanged; an impossible input throws `ImageTooLargeError`.
- `src/test/useStoryUpload.test.jsx`: the pending story appears **synchronously** before the upload resolves, progress updates the arc, success swaps the id, failure marks it failed and retry re-sends.
- `src/test/StoryRail.test.jsx` (extend): the add tile shows on Home; own ring with stories still offers add; pending and failed ring classes render.
- `src/test/StoryViewer.follow.test.jsx` (new): Follow shows on others' stories and not your own; tapping it flips to "Following" before the promise resolves; a rejected promise reverts it.
- `src/test/CircleStories.test.jsx`: delete or rewrite for the removed circle rail.
- `routes.smoke.test.jsx` still green.

---

## 4. WS2 — "+" post button, chatbot moved to Explore, points per post

### Backend

- `crud/post.py::create_post`: remove the
  `"Either community_id or circle_id must be provided"` check. A post with
  neither is a **standalone public post**.
- `get_public_feed_posts`: add the branch
  `and_(Post.circle_id.is_(None), Post.community_id.is_(None))` to the
  `or_`. `source` is `null` for these, and the serializer adds
  `author: {id, name, photo_url}` so the card links to `/users/:id`.
- `api/posts.py::api_create_post`
  - Require non-empty `content` **or** a `photo_url` (make `content` default
    `""` and validate).
  - After create, call
    `award_capped(db, user, TXN_POST, POINTS_POST, POST_POINTS_DAILY_CAP, post.id)`
    for **all non-system posts**, standalone or in a circle.
  - Response gains `points_awarded`, `points_balance` and the serialized
    `post`, so the client can reconcile its optimistic item without
    refetching.
- `cloudinary_service.FOLDER_RULES["posts"]`: 2 MB, jpeg/png/webp.
- Update `API_CONTRACT.md` (`POST /api/posts` request/response; feed `source: null` case).

### Frontend

- **Remove `<AskWellCircle />` from `ForYouScreen.jsx`; render it in
  `ExploreScreen.jsx`.** Check the FAB doesn't overlap Explore's list bottom
  padding.
- **`src/components/PostComposerFab.jsx`** (new) on Home, in the chatbot's
  old position: a "+" icon that opens **`PostComposerSheet.jsx`** (new).
  - Textarea plus an optional photo (the `compressImage` → `uploadFile(file, 'posts')` path).
  - Post is disabled until there is text or a photo.
- **Optimistic flow:**
  1. On submit, close the sheet immediately.
  2. Prepend a pending `FeedPostCard` (`pending: true`, local blob image) to
     the first feed page in state and in `cacheKeys.homeBootstrap`.
  3. Bump the points badge by +10 **only if the client-side counter says the
     cap isn't reached**. The server's `points_balance` is authoritative and
     reconciles either way.
  4. Upload the photo, then create the post, in the background.
  5. On success, replace the pending item with the server's `post`.
  6. On failure, mark the card failed with Retry/Discard, revert the points
     bump, and show one toast.
- **`PostFeed.jsx`** (circle Activity composer) uses the same optimistic
  helper and reads `points_awarded` for the badge.
- **`FeedPostCard.jsx`**: when `source` is null, the header shows the author
  (tap → `/users/:id`) instead of a circle chip.

### Tests

Backend — extend `test_circle_activity.py` + new `test_public_posts.py`:

- Standalone post created with neither id; appears in `build_for_you_feed` with `source is None` and `author` populated.
- Photo-only post is accepted; empty text with no photo → 422.
- Private and paid circle posts are still excluded (regression).
- Points: posts 1–3 in a UTC day award +10 each, the 4th awards 0; circle and standalone posts share the cap; a system event post awards nothing.
- Feed query count stays constant with standalone posts mixed in.

Frontend:

- `src/test/ForYouScreen.test.jsx`: no `AskWellCircle` FAB; the "+" FAB is present.
- `src/test/ExploreScreen.chatbot.test.jsx` (new): the FAB renders on Explore.
- `src/test/PostComposerSheet.test.jsx` (new):
  - submit disabled when empty;
  - pending card appears before the create promise resolves;
  - success swaps in the server post;
  - failure shows retry and reverts the points badge;
  - a photo goes through `compressImage` (mocked).
- `src/test/FeedPostCard.test.jsx`: standalone post renders the author header and links to the profile.
- `AskWellCircle.chips.test.jsx` unchanged and still green.

---

## 5. WS3 — For You feed prioritizes items with images

### Current behavior

`feed_service._order_feed` lays out [upcoming events] → [posts newest-first]
→ [services, providers, past events]. Before settling, `ForYouScreen`
deliberately puts **text-only** items first ("instant-first"), which is the
opposite of the audit.

### Design

- Backend `_order_feed`: inside the events block and the posts block, apply a
  **stable partition**: items with an image first, then the rest, each keeping
  its existing order.
  - `has_image(item)`: a post has `photo_url`; an event or past event has
    `provider.cover_photo_url`. Story items aren't feed items; the rail
    already leads.
  - Partition **per page**. The keyset cursor still comes from the posts
    query, so pagination stays correct. Images lead each page rather than
    the whole feed, which is accepted.
  - The provider/service block keeps its order (it's the tail and already
    image-led).
- Frontend `ForYouScreen.orderedFirstPage`: replace instant-first with the
  **same media-first partition**, so the cached paint, lite phase and settled
  feed agree and nothing reshuffles. The lite payload carries `photo_url` on
  posts already, so partition it the same way.
- `SmartImage` keeps `fetchPriority="high"` for the first item. With media
  first, that is now an image, which is correct.
- `src/data/mock.js` feed builder mirrors the partition, as the Phase 20 note
  requires.

### Tests

- `test_for_you_feed.py` (extend):
  - a mix of photo and text posts → photo posts first within the page, each
    group newest-first;
  - an event without a cover sorts below events with covers;
  - page 2 is partitioned independently and the cursor is unchanged;
  - lite payload has the same partition.
- `src/test/feedOrdering.test.js` (new): the pure partition function is stable, handles an empty pool, and handles all-text or all-media input.
- `src/test/ForYouScreen.test.jsx`: first rendered feed item is the image post both before and after settle.
- `feedLeadIn.test.js`: update expectations to the new order.

---

## 6. WS4 — Minimal UI defaults

| Task | Change | Tests |
|---|---|---|
| Community → My Circles | `CommunityList.jsx`: `useState('circles')`, and move the **My Circles** chip first. Honor `location.state?.tab` when present so existing deep links still work. | `CommunityList.test.jsx`: My Circles is the active chip on mount and circles render; `state.tab='ranks'` opens Ranks. |
| Explore → Events + past | `ExploreScreen.jsx`: `useState('events')`, Events chip first. The Events view shows **Upcoming**, then a **"Past events"** section from `getEvents({ past: true })` using the recap card from `EventsScreen`. When there is no upcoming event, the empty upcoming state is one line and Past follows directly. | `ExploreScreen.events.test.jsx` (new): Events active on mount; upcoming and past sections render from mock; category filter applies to both; `explore_view` fires with `view: 'events'`. |
| Studios → Providers | Rename state key `'studios'` → `'providers'` and the label to `t('Providers')`. Add the i18n key in en/am/fr/it. Remove the unused `"Studios"` key. Update the LocationNudge copy ("events & providers near you"). | Existing `ExploreScreen.*` tests updated; assert "Providers" appears and "Studios" doesn't. |
| Profile collapse | New `src/components/CollapsibleList.jsx` (`items`, `renderItem`, `max = 2`, chevron button with `aria-expanded`, animated height). Used in `AccountSection.jsx` for **Recent Activity** (currently slices 5) and **Joined Circles**. **Bug to fix at the same time:** `ProfileScreen.jsx` builds "Joined Circles" from `MOCK_COMMUNITIES` even in live mode. Source it from the user's real circles (`useResource(cacheKeys.circles(...))`, already warmed by bootstrap). | `CollapsibleList.test.jsx` (new): 5 items → 2 visible plus toggle; click → 5 visible and `aria-expanded=true`; ≤2 items → no toggle. `ProfileScreen.collapse.test.jsx` (new): both sections collapsed on mount. |
| Check-in after 2 min | New `src/hooks/useDailyReveal.js`: `useDailyReveal(key, ms = 120_000)`. It stores `wc_reveal_<key>` = today's local date once revealed, so it returns `true` at once if already revealed today. Otherwise it accumulates **foreground** time (pauses on `document.hidden`, like `usePolling`) and flips at 2 min. `ForYouScreen` gates `CheckinCard` on it. `StreakBadge`'s at-risk dot is unaffected. | `useDailyReveal.test.jsx` (new, fake timers): hidden before 120 s; visible after; background time doesn't count; same-day reload is visible at once; the next day hides again. `CheckinCard.test.jsx` unchanged. `ForYouScreen.test.jsx`: no check-in card at mount; present after advancing timers. |

---

## 7. WS5 — Only Boston Day Spa is bookable

### Data

- `backend/set_boston_only_live.py` (new; idempotent psycopg2, same style as
  `seed_boston_day_spa.py`):
  - `--dry-run` (default) prints every provider and its before/after
    `is_coming_soon`.
  - `--apply` sets `is_coming_soon = (name NOT ILIKE '%boston day spa%')`.
  - Aborts unless **exactly one** provider matches Boston Day Spa.
- Keep using the admin `PATCH /admin/providers/{id}/launch-state` for later
  toggles. No hardcoded allowlist.

### Code

- The backend already rejects bookings for coming-soon providers
  (`api/bookings.py:64`). **Events go through the same path**
  (`/booking/:providerId?event_id=`), but that needs a test.
- `api/events.py` event serializer adds `provider_is_coming_soon`, and the
  feed `_event_item` carries `provider.is_coming_soon`.
- `EventCard.jsx`, `FeedEventBanner.jsx` and the Explore/Events lists: when
  the host is coming soon, show a **"Coming soon"** badge in place of **Book
  This Session**. Tapping the card opens the provider page (info only).
- `mock.js`: every provider except Boston Day Spa gets
  `is_coming_soon: true`, and mock events inherit the flag.

### Tests

- `test_coming_soon.py` (extend):
  - booking with `event_id` for a coming-soon host is rejected with the same
    status and detail as a service booking;
  - `provider_is_coming_soon` is present on upcoming and past event payloads
    and on feed event items.
- `backend/app/tests/test_set_boston_only_live.py` (new): the core update runs as a function against SQLite. Exactly one live provider remains; zero or two Boston matches abort; a second run changes nothing.
- `src/test/EventCard.comingSoon.test.jsx` (new): no Book button and the badge shows for a coming-soon host; a live host still shows Book.
- `src/test/FeedEventBanner.test.jsx`: same assertions.

---

## 8. WS6 — Seed events from `events/` posters

### Rules

- **Year 2026, Addis time (EAT, UTC+3).**
- **Latest poster wins:** the "UPDATED" poster replaces the whole Aug 20–23
  "UPCOMING" poster. The Sep 16 file replaces the overlapping Sep 13–14 rows
  of the Sep 11 file.
- Rows from the existing `seed_upcoming_events.py` that a newer poster
  replaces are set to **`is_cancelled = true`**, not deleted, so bookings or
  feed references don't break. Cancelled events are already excluded from
  upcoming and past lists.
- **Idempotent:** match providers on canonical name **or alias**, and events
  on `(provider_id, starts_at)`.
- New providers: `is_coming_soon = true` (WS5), `price_range = "Price on request"`,
  and a community with the same name, matching the existing seed pattern.
- `price_etb = 0`, and the description ends with "Confirm price with the host."
- `capacity = 50`, **`spots_remaining = capacity`**. No invented attendance;
  the recap card already hides counts of 0.

### Canonical providers and aliases

| Canonical provider | Aliases matched | Category | Exists? |
|---|---|---|---|
| Bole Burners | Boleburners | running | yes |
| Satenaw Runclub | Satenaw Running Club, Satenaw Run Club, Satenaw Afterwork Run | running | yes |
| Bertusew Runningclub | Bertusew Running Club, Birtu sew Running Club | running | yes |
| AfroHeat Fitness | — | gym | yes (no new events) |
| Zumba with Vahe | Zumba With Vahe | gym | **new** |
| Zumba Dance Fitness | — | gym | **new** |
| SUP Studio | Sup Studio, Sub Studio, Sup Running Community, Sub Running Community, Enitewawek | gym | **new** |
| Great Ethiopian Run Team | Great Ethiopian run team | running | **new** |
| Sip and Serve Tennis | — | other | **new** |
| Let's Hike Ethiopia | — | other | **new** |
| Guzo Adwa Hiking | Guzo_Adwa_Hiking | other | **new** |
| Ereft Ethiopia | — | other | **new** |
| Sonder Running Club | — | running | **new** |

### Events to seed (after conflict resolution)

| # | Date (EAT) | Host | Event title | Location | Source file |
|---|---|---|---|---|---|
| 1 | Aug 20 18:00 | Bole Burners | Bole Burners Evening Run | Riverside Park | 20.36.02 (UPDATED) |
| 2 | Aug 20 17:30 | Satenaw Runclub | Satenaw Afterwork Run | Friendship Park | 20.36.02 |
| 3 | Aug 22 18:15 | Zumba with Vahe | Zumba with Vahe | SUP Studio, Bole Matemiya | 20.36.02 |
| 4 | Aug 23 07:00 | Bertusew Runningclub | Bertusew Morning Run | Yetebaberut Square Sport Center, CMC | 20.36.02 (**update existing row**) |
| 5 | Aug 24 18:15 | Zumba Dance Fitness | Zumba Dance Fitness | Armenian Club, 5 Kilo | 20.36.12 |
| 6 | Aug 24 18:00 | SUP Studio | AfroBeat Dance with Seble | SUP Studio, Bole Matemiya | 20.36.12 |
| 7 | Aug 26 18:00 | Bole Burners | Bole Burners Evening Run | TBD | 20.36.12 |
| 8 | Aug 26 17:30 | Satenaw Runclub | Satenaw Running Club | TBD | 20.36.12 |
| 9 | Aug 26 06:00 | Great Ethiopian Run Team | Great Ethiopian Run Team | Friendship Park | 20.36.18 |
| 10 | Aug 26 18:15 | Zumba with Vahe | Zumba with Vahe | SUP Studio | 20.36.18 |
| 11 | Aug 27 17:45 | Satenaw Runclub | Satenaw Running Club | Friendship Park | 20.36.18 |
| 12 | Aug 30 17:30 | Bertusew Runningclub | Bertusew Running Club | Yetebaberut Square Sport Center, CMC | 20.36.18 |
| 13 | Aug 29 09:00 | Sip and Serve Tennis | Sip and Serve Tennis | Addis Sport Park, St. Urael | 20.36.24 |
| 14 | Aug 30 07:30 | Let's Hike Ethiopia | Let's Hike Ethiopia | Gullele Botanical Garden (meet: Sansuse Road) | 20.36.24 |
| 15 | Aug 30 06:30 | Guzo Adwa Hiking | Maru Waterfall Hike | Maru Waterfall | 20.36.24 |
| 16 | Sep 2 18:15 | Zumba with Vahe | Zumba with Vahe | SUP Studio | 20.36.29 |
| 17 | Sep 2 18:00 | Bole Burners | Break Your Record | Riverside Park, Toto Grill parking | 20.36.29 |
| 18 | Sep 2 17:45 | Satenaw Runclub | Satenaw Running Club | Friendship Park | 20.36.29 |
| 19 | Sep 5 06:00 | Ereft Ethiopia | Overnight Trip: Doho Lodge & Benuna Village | Meet: Mexico, Wabi Shebele Hotel | 20.36.29 |
| 20 | Sep 11 06:30 | Sonder Running Club | 19km to Welcome 2019 | Bole Brass | 20.36.41 |
| 21 | Sep 13 06:30 | Satenaw Runclub | Satenaw Run Club | Filwuha Bridge | 16.21.46 (replaces 20.36.41's 06:45 Friendship Park) |
| 22 | Sep 13 06:45 | Bertusew Runningclub | Bertusew Running Club | CMC Yetebaberut Adebabay | 16.21.46 |
| 23 | Sep 13 09:30 | SUP Studio | Sup Running Community / Enitewawek | Bole Mega, 50 m behind Makush Gallery, TM5 Apt | 16.21.46 (replaces 20.36.41's row) |
| 24 | Sep 14 18:15 | Zumba with Vahe | Zumba with Vahe | Armenian Club | 16.21.46 |

Skipped: "OFFLINE Events", Sep 6, Suba Mengesha Park (TBD time and host).
Cancelled from the existing seed: AfroHeat Zumba Aug 20 18:15, Bole Burners
Aug 22 06:00, Satenaw Aug 23 06:30.

> **Note:** today is 2026-09-16, so **all 24 events are already past**. They
> show as recaps (Explore → Past events, FYP past-event cards), and there will
> be **no upcoming events** after seeding. Explore now opens on Events (WS4),
> so its first screen will be an empty "Upcoming" line followed by recaps.

### Cover images (cropped from posters)

- `backend/seed_assets/event_covers/` (new, committed): one cropped JPEG per
  **new** provider, ≤ 2 MB, 1200×630.
  - **Zumba with Vahe**: the group photo from `2026-09-10 20.36.07.jpg`
    ("1 DAY LEFT"), cropped above the "1 DAY" text.
  - **Everyone else**: the poster backgrounds have event text over most of
    the image, so crop the clearest text-free band (usually the bottom
    scenery strip above the footer). **These crops need your visual sign-off
    before upload** (§15).
- The seed uploads each through `cloudinary_service.upload_file(folder="providers", public_id=<slug>)`
  (already idempotent via fixed `public_id`) and writes `cover_photo_url`.
  `--skip-upload` reuses existing URLs.
- The existing 4 providers keep their current covers unless you ask otherwise.

### Implementation

- Rewrite `backend/seed_upcoming_events.py` into a data table
  (`PROVIDERS`, `EVENTS`, `SUPERSEDED`) plus pure functions:
  - `resolve_provider(name) -> canonical`
  - `plan_changes(existing_rows) -> [insert|update|cancel]`
  - `apply(conn, plan)`

  `main()` stays thin and supports `--dry-run`.
- Durations are required (`ends_at`) but not on the posters. Defaults: runs
  90 min, dance/tennis 60 min, hikes 4 h, overnight trip ends Sep 6 18:00
  (§15).

### Tests

`backend/app/tests/test_seed_poster_events.py` (new, pure functions — no DB):

- Every alias resolves to its canonical name; unknown names raise.
- Final event list has 24 rows, no duplicate `(provider, starts_at)`, every `starts_at` is timezone-aware EAT.
- Superseded rows are exactly the three listed; Bertusew Aug 23 07:00 is an **update**, not an insert.
- A second run against the post-seed state produces an empty plan (idempotency).
- All new providers are `is_coming_soon=True`; all prices 0 with the "Confirm price" description.
- No event has `spots_remaining < capacity`.

---

## 9. WS7 — Optimistic UI (cross-cutting)

"As soon as the user performs an action they shouldn't see any loading
delay."

### Foundation

`src/hooks/useOptimisticAction.js` (new):

```js
const run = useOptimisticAction();
run({
  apply:    () => { /* write the expected result to cache/state */ return undo; },
  request:  () => api.call(...),
  reconcile:(serverResult) => { /* replace optimistic value with truth */ },
  failureMessage: 'Couldn’t join — try again',   // one toast on rollback (WS10 rule)
});
```

- `apply` runs synchronously. `request` runs in the background. On rejection
  the hook calls `undo()`, shows `failureMessage` once, and logs through the
  WS10 logger.
- Writes go through the existing `useResource` cache (`cacheWrite` with
  `cacheKeys.*`), so every screen reading that key updates together.
- Buttons never show spinners for these actions. `busy` state is only used
  to block double-submits.

### Actions to convert (audit each; ✓ = already optimistic)

| Action | File(s) | Today |
|---|---|---|
| Check-in | `useCheckin.js`, `CheckinCard.jsx`, `CommunityDetail.jsx` | awaits request; `busyId` spinner |
| Join/leave community | `CommunityList.jsx`, `CommunityDetail.jsx` | awaits |
| Join circle | `CommunityList.jsx`, `CircleDetailScreen.jsx`, `OnboardingFlow.jsx` | awaits |
| Leave/delete circle | WS8 | new |
| React / gift points | `PostFeed.jsx`, `FeedPostCard.jsx` | check |
| Comment / reply | `PostFeed.jsx` | check |
| Create post | WS2 | new |
| Story post / view / delete | WS1 | view ✓, delete ✓ |
| Follow / unfollow | `PublicProfile.jsx`, `FollowersList.jsx`, `StoryViewer` | check |
| Profile edits (bio, prefs, theme, neighbourhood, privacy, time format) | `pages/profile/*` | check |
| Profile photo | WS9 | new |
| Notification mark read / read all | `NotificationsScreen.jsx` | check |
| High-five / nudge | `Leaderboard.jsx` | check |

Out of scope, because the server is the source of truth and a fake success
would mislead: **booking creation, product redemption, paid-circle
subscription, trainer application**. These keep an immediate "Sending…"
button state but no fake success screen. See §15.

### Tests

- `src/test/useOptimisticAction.test.jsx` (new):
  - `apply` runs before `request` resolves;
  - success calls `reconcile`;
  - failure calls `undo`, toasts `failureMessage` exactly once, and logs;
  - double-invocation while in flight is ignored.
- One test per converted action asserting **the UI state changes before the
  mocked request resolves** (use a deferred promise), and that rejection
  reverts it. Put each in the screen's existing test file, e.g.
  `CheckinCard.test.jsx`, `CommunityList.test.jsx`, `PostFeed.test.jsx`,
  `PublicProfile.test.jsx`, `ProfileScreen.*.test.jsx`,
  `NotificationsScreen.test.jsx`.

---

## 10. WS8 — Leave and delete circles

### Backend

- **Migration `020_circle_soft_delete.py`** (+ ensure statement):
  `circles.deleted_at TIMESTAMPTZ NULL`, index `(deleted_at)`.
- Every circle read filters `Circle.deleted_at IS NULL`: list, detail,
  join-by-code, leaderboard, social-proof, ranks, feed posts
  (`get_public_feed_posts`), home bootstrap, onboarding "available circles".
  Grep for `db.query(Circle)` and add a shared `active_circles(db)` helper so
  none are missed.
- `crud/circle.py`
  - `leave_circle(db, circle_id, user_id)`:
    - Not a member → 404.
    - **Owner leaving:** transfer `owner_id` to the member with the earliest
      `joined_at`, excluding the owner, then remove the owner's membership. If
      the owner is the only member, soft-delete instead.
    - Paid circle with the leaver's own active subscription: allowed; the
      subscription runs to expiry, and access ends because membership is
      removed.
    - Ownership transfer of a **paid** circle is blocked (409, "Paid circles
      can't change owner yet — contact support"), because revenue-ledger
      payouts are tied to the owner (§15).
    - Returns `{left: true, new_owner_id?: uuid, deleted?: bool}`.
  - `delete_circle(db, circle_id, user_id)`:
    - Owner only → else 403.
    - Any `CircleSubscription` with status `active` → **409**
      ("This circle has active paid members…").
    - Set `deleted_at`, delete `CircleMember` rows, soft-hide stories by
      setting `expires_at = now()` for stories posted *into this circle* from
      legacy rows (WS1 stories are user-level and unaffected). Posts stay in
      the DB but are hidden by the `deleted_at` filter.
    - Notify members through `UserNotification` (`circle_deleted`), batched.
- Routes: `POST /api/circles/{id}/leave`, `DELETE /api/circles/{id}`.
- Admin restore: `POST /api/admin/circles/{id}/restore` (super admin) clears
  `deleted_at`. Members aren't restored; they rejoin via invite link.
- `API_CONTRACT.md` updated.

### Frontend

- `CircleDetailScreen.jsx` overflow menu:
  - members see **Leave circle**;
  - owners see **Leave circle** (a confirm sheet explains the ownership
    transfer) and **Delete circle** (a confirm sheet that requires typing the
    circle name).
  - Both are optimistic (WS7): navigate to `/community` with the My Circles
    tab and drop the circle from `cacheKeys.circles` immediately; on failure,
    restore it and toast.
- The 409 messages come from the server and are user-written, so they show
  as-is.

### Tests

Backend — `backend/app/tests/test_circle_leave_delete.py` (new):

- Member leaves → membership gone; circle unchanged.
- Owner leaves with 3 members → owner becomes the earliest-joined remaining member; old owner not a member.
- Owner leaves as sole member → circle soft-deleted.
- Owner leaves a paid circle → 409.
- Non-member leave → 404.
- Delete by non-owner → 403; delete with an active subscription → 409; delete with only expired subscriptions → ok.
- After delete, the circle is absent from `GET /circles`, detail (404), join-by-code (404), public feed posts, ranks, and social proof.
- Members get a `circle_deleted` notification; the notification insert is batched (query count constant for 2 vs 20 members).
- Admin restore clears `deleted_at`; a non-admin gets 403.

Frontend — `src/test/CircleDetailScreen.leaveDelete.test.jsx` (new):

- Member sees Leave only; owner sees Leave + Delete.
- Delete confirm stays disabled until the typed name matches.
- Leave navigates away and removes the circle from the My Circles list **before** the request resolves; a rejected request restores it and shows the toast.

---

## 11. WS9 — Change profile picture (−10 points)

### Backend

- **The problem to solve first:** `api/auth.py:87` overwrites `user.photo_url`
  with the Telegram photo on **every** login, so a custom photo would revert
  on the next app open.
  - Add `users.photo_is_custom BOOLEAN NOT NULL DEFAULT FALSE` and
    `users.photo_public_id VARCHAR(255)` (migration `021_custom_avatar.py`
    + ensure statements).
  - Telegram, Google and widget logins only sync `photo_url` when
    `photo_is_custom` is false.
- `POST /api/users/me/photo` (multipart `file`):
  1. compress check (≤ 2 MB, jpeg/png/webp) and upload to Cloudinary folder
     `avatars`;
  2. in one transaction, set `photo_url`, `photo_public_id` and
     `photo_is_custom = true`, and call
     `apply_transaction(db, user, -10, TXN_PROFILE_PHOTO, reference_id=…)`
     (never blocked; the balance floors at 0 in `apply_transaction`);
  3. commit, then best-effort destroy the **previous** custom
     `photo_public_id`;
  4. if the DB step fails, destroy the new asset.

  Response: `{photo_url, points_balance, points_charged: 10}`.
- Add `TXN_PROFILE_PHOTO = "profile_photo"` to `VALID_TXN_TYPES`. It shows in
  points history as "Profile photo".
- `DELETE /api/users/me/photo` (optional, see §15): reverts to the Telegram
  photo on the next login and charges nothing.
- `API_CONTRACT.md` updated.

### Frontend

- `ProfileHeader.jsx`: a camera badge on the avatar opens the file picker.
  Before picking, a small sheet says "Changing your photo costs 10 points".
- Optimistic:
  1. After `compressImage`, swap the avatar to the local blob immediately,
     both in `AuthContext` user state and in any cached author avatars for the
     current user, such as the story rail's own ring.
  2. Decrement the points badge by `min(10, balance)`.
  3. Upload in the background.
  4. On success, replace with the Cloudinary URL and the server balance.
  5. On failure, restore the previous photo and balance and toast once.
- `AccountSection` points history label for `profile_photo`.

### Tests

Backend — `backend/app/tests/test_profile_photo.py` (new):

- Upload sets `photo_url` and `photo_is_custom`, writes one −10 ledger row, and the balance drops by 10.
- Balance 4 → balance 0; the ledger row still records −10 (confirm this matches the existing floor semantics in `apply_transaction`).
- A second change charges again and destroys the previous `public_id` (mock Cloudinary).
- DB failure → the new asset is destroyed and no ledger row is written.
- **Telegram re-login does not overwrite a custom photo**; it still syncs when `photo_is_custom` is false.
- >2 MB → 422, unsupported type → 422, both without charging points.

Frontend — `src/test/ProfileHeader.photo.test.jsx` (new):

- The cost notice shows before the picker opens.
- The avatar `src` becomes the blob URL and the badge drops by 10 before the request resolves.
- Success swaps in the server URL; failure restores both the photo and the balance.

---

## 12. WS10 — Remove "taking longer than usual" and similar noise

### Design

- New `src/utils/log.js`: `logIssue(kind, detail)` writes `console.error`
  with a `[WellCircle]` prefix and sends a PostHog event `client_issue`
  (`kind`, `path`, `status`, `request_id`, `duration_ms`). It's a no-op when
  PostHog is unset, matching `analytics.js`.
- `client.js`
  - `wrapNetworkError` keeps the log and attaches `err.isNetworkNoise = true`
    to timeout/offline errors, using a neutral message
    (`"Request failed"`) that is **never** meant for display.
  - Remove the "This is taking longer than usual…" and "We couldn't connect
    right now…" strings from user-facing paths.
- `Toast.jsx::showToast`: if passed an `Error` with `isNetworkNoise`, **drop
  it and `logIssue` instead**. That covers the ~80 existing
  `showToast(err.message …)` call sites in one place, without editing each.
- Background loads (`useResource` revalidation, `usePolling`, prefetch,
  bootstrap fallbacks) never toast. Audit and remove any that do.
- User-initiated failures show only the WS7 `failureMessage`.
- Search for other "slow" or diagnostic copy shown to users (e.g. "waking
  up", "still loading", request ids in toasts) and apply the same treatment.

### Tests

- `src/test/client.networkErrors.test.js` (new): an aborted fetch rejects with `isNetworkNoise` and a message that doesn't contain "longer than usual"; `logIssue` is called with `kind: 'timeout'`.
- `src/test/Toast.noise.test.jsx` (new): `showToast(noiseError)` renders nothing and logs; a normal message still renders.
- `src/test/useResource.test.jsx` (extend or new): a revalidation failure keeps the stale data and shows no toast.
- Grep guard in CI (`frontend · lint` job step or a Vitest test that reads `src/**`): fails if the string "taking longer than usual" reappears.

---

## 13. Sequencing and PRs

All branches come off `dev` and PR into `dev` (CLAUDE.md flow). Each PR must
pass the full CI gate and update `docs/API_CONTRACT.md` when shapes change.

| PR | Contents | Depends on |
|---|---|---|
| 1 | **WS0** hotfix: ensure story tables + schema-drift report + test | — (ship ASAP) |
| 2 | **WS10** noise removal + logger | — |
| 3 | **WS4** defaults, rename, collapse, daily reveal, Joined Circles bug | — |
| 4 | **WS5** event coming-soon UI + event booking test + `set_boston_only_live.py` | — |
| 5 | **WS7** `useOptimisticAction` + conversions of existing actions | 2 |
| 6 | **WS1** public stories (migration 019, API, rail, viewer follow, compression, points helper) | 1, 5 |
| 7 | **WS2** "+" composer, standalone posts, post points, chatbot → Explore | 5, 6 (compressImage, award_capped) |
| 8 | **WS3** feed media-first ordering | 7 (standalone posts in feed) |
| 9 | **WS8** leave/delete circle (migration 020) | 5 |
| 10 | **WS9** profile photo (migration 021) | 5, 6 (compressImage) |
| 11 | **WS6** poster events seed + cover crops | 4; crops approved (§15) |

### Production run-book (after the release PR merges)

1. Confirm boot logs show **no** `SCHEMA DRIFT` line. If one appears, the
   ensure statements missed something; fix before announcing.
2. `python set_boston_only_live.py` (dry run), review, then `--apply`.
3. `python seed_upcoming_events.py --dry-run`, review the plan, then run for real.
4. Set the Cloudinary env var if A1 (HANDOFF Phase 22) is still open. Stories,
   posts with photos, avatars and seed covers all depend on it.
5. Manual Telegram pass (§14).

---

## 14. Manual verification (real Telegram client, after deploy)

- [ ] Post a story from Home → the ring appears instantly with a progress arc and completes; a second account sees it without being in any circle; Follow in the viewer works; the points badge +20 the first time only.
- [ ] Try a 10 MB photo → it compresses and posts; nothing ≤ 2 MB is rejected.
- [ ] "+" on Home posts text + photo → it shows at the top instantly; +10 up to the cap; the chatbot FAB is on Explore, not Home.
- [ ] Community opens on My Circles; Explore opens on Events with Past events below; the "Providers" pill label is right.
- [ ] Profile Recent Activity and Joined Circles show 2 items + arrow; Joined Circles shows real circles.
- [ ] Check-in card absent for the first 2 minutes of the day, present after, and on later opens the same day.
- [ ] Only Boston Day Spa shows a booking CTA anywhere (provider page, feed, Explore, event cards).
- [ ] Leave a circle as a member; as owner with members (ownership moves); delete as owner (members notified; circle gone everywhere).
- [ ] Change profile photo → instant swap, −10 points; close and reopen the Mini App → the photo persists (not reverted to Telegram's).
- [ ] Turn on airplane mode, navigate around → no "taking longer" or connection toasts; tap Join → one short rollback message.
- [ ] FYP: image posts and events lead the page.

---

## 15. Defaults this plan picked — please confirm or override

1. **Daily caps:** 1 story/day earns +20; 3 posts/day earn +10. UTC day boundary, matching check-ins.
2. **Story lifetime** stays **72 h** (existing), not Instagram's 24 h.
3. **Circle pages no longer show a story rail** (stories are user-level). Alternative: show the rail filtered to that circle's members.
4. **Post photos** use the same 2 MB limit and compression as stories.
5. **Owner transfer is blocked for paid circles** (revenue ledger is owner-bound); deletion is blocked while any subscription is active.
6. **Not optimistic:** booking creation, redemption, paid subscription, trainer application (real-world commitments). They get instant button feedback but no fake success.
7. **Event durations:** runs 90 min, dance/tennis 60 min, hikes 4 h, Ereft overnight trip ends Sep 6 18:00.
8. **Categories for new hosts:** tennis, hiking and trips go under `other`, because there's no sports/outdoor category. Say if you want a new `outdoor` category.
9. **Poster crops for new provider covers** need visual sign-off. Most posters have text over the scenery, so the crops may look weak; "Zumba with Vahe" is the only real photo.
10. **Same host, different day across posters** (Satenaw Aug 26 on one poster, Aug 27 on the next) is treated as two separate sessions, not a reschedule.
11. **Rank and decay side effects:** story and post points are positive ledger rows, so they count toward weekly ranks and reset the decay clock. Say if they should be excluded from either.
12. **No `DELETE /users/me/photo`** in this pass unless wanted.
13. **Existing 4 seeded providers** keep their Unsplash covers.
14. **i18n** for "Providers": am "አቅራቢዎች", fr "Prestataires", it "Fornitori". Needs a native-speaker check.
