# Well Circle — Round 2 Feedback Implementation Plan (Sep 2026)

Source: stakeholder comments received after shipping
`docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md` (Phase 23, branch
`fix/userexperience`). Context: `docs/HANDOFF.md` through Phase 23. This plan
is the proposed **Phase 24**.

Every workstream below was grounded by reading the actual current code, not
just the feedback text — file paths, existing helpers, and pattern reuse are
called out per item.  Two pieces of new source material turned up while
scoping this that materially change WS6/WS9's shape (see §0 note):

- `events/2026-09-18 07.28.18.jpg` and `.../07.28.39.jpg` — two **new**
  poster photos (dated today) listing genuinely upcoming events, Sep 17–28
  2026. Round 1's seed only covered Aug 20 – Sep 14, all already past by the
  time it shipped. This is exactly "this week's events."
- `events/assets/<provider_slug>/*.jpg` — real, text-free provider photos
  (group photos, action shots) for 8 of the 9 new providers from Round 1.
  This resolves Round 1's WS6 gap: cover crops no longer need to be
  guessed from posters with text over them, because clean source photos
  already exist for most providers.

---

## 0. TL;DR

| # | Feedback item | Workstream | Size | Depends on |
|---|---|---|---|---|
| 1 | Story overflows into the status bar / battery indicator | **WS11** | XS | — |
| 2 | Story like (heart) button | WS11 | S | — |
| 3 | Story deletion | WS11 | — (already shipped, verify only) | — |
| 4 | Story "who viewed" list (Instagram-style) | WS11 | S | — |
| 5 | Stories shareable to Instagram/outside apps, bot link burned in | **WS12** | M | — |
| 6 | Share button on every event/provider ("poster") | WS12 | S | WS12's share util |
| 7 | Comments + like under posts, minimal icons (like Notifications) | **WS13** | M | — |
| 8 | Duolingo/LinkedIn-style engaging bot notification, clickbait copy | **WS14** | M | — |
| 9 | Purchasable Well Circle reaction icon (50 pts) | **WS15** | M | WS13 |
| 10 | 5 more reactions on long-press (🔥 👏 ❤️ 💪 + Well Circle icon) | WS15 | (in M) | WS13 |
| 11 | Reactions stacked LinkedIn-style, multiple reactions per user | WS15 | (in M) | WS13 |
| 12 | This week's events under Explore, keep events weekly | **WS16** | S | — |
| 13 | Real provider banner assets from `events/assets/` | **WS17** | S | — |

Order: **WS11 → WS17, WS16 → WS12 → WS13 → WS15 → WS14**. Rationale in §9.
WS17 and WS16 are cheap, low-risk, and unblock real content quickly; WS11 is
a one-line CSS fix plus two small additions. WS15 depends on WS13 existing
(you need a reaction bar before you can add a purchasable reaction to it).
WS14 is last because "engaging" push copy is easiest to get right once
comments/reactions (WS13) exist as things worth notifying about.

---

## 1. WS11 — Story polish: safe-area fix, like, viewer list

### 1a. Overflow into the status bar (the "battery indicator" bug)

**Root cause, confirmed by reading the CSS.** `.story-viewer` (`frontend/src/index.css:3260`)
is `position: fixed; inset: 0`, i.e. edge-to-edge against the physical
screen. Its two top children use flat pixel padding instead of the app's
safe-area tokens:

```css
.story-viewer-progress { padding: 10px 10px 0; }      /* index.css:3270 */
.story-viewer-header   { padding: 12px 12px 8px; }     /* index.css:3289 */
```

Every other full-bleed surface in the app (`.page-panel`, `.header`, the
sheet overlays) instead uses the pattern defined at `index.css:36-38` and
used at lines 411/431-432/505/567/781/1974/3021:

```css
padding-top: calc(var(--safe-top) + var(--tg-top) + <n>px);
```

`--safe-top` is the OS-level safe-area inset (notch/status bar, including
the battery indicator); `--tg-top` is Telegram's own WebApp header inset on
top of that. `.story-viewer-progress`/`.story-viewer-header` never picked
this up when WS1 (Phase 23) built the viewer, so the progress bar and header
draw underneath the status bar on any phone with a notch or Telegram's own
top chrome expanded.

**Fix:** change `.story-viewer-progress`'s top padding from `10px` to
`calc(10px + var(--safe-top) + var(--tg-top))`, and drop
`.story-viewer-header`'s top padding correspondingly (it sits right below
the progress row, so it doesn't need the offset twice — verify visually).

### 1b. Like (heart) button

No story-level reaction exists today — `Story`/`story_views` (backend/app/models/story.py`)
has no like table. Add one, following the exact shape of `story_views`
(`(story_id, user_id)` composite key — one like per user per story, a
second tap un-likes rather than double-counting, matching how a heart
toggle behaves everywhere else this app has one).

**Backend**
- Migration `022_story_likes.py` (+ `ensure_db_schema` statement, per the
  WS0 rule every new table ships in both):
  ```
  story_likes (story_id FK stories, user_id FK users, liked_at) PK(story_id, user_id)
  ```
- `crud/story.py`:
  - `toggle_story_like(db, story_id, user_id) -> {"liked": bool, "like_count": int}` —
    delete the row if it exists, insert if it doesn't (one round trip either
    way, no separate exists-check).
  - `get_story_rail`/single-story fetch gain `like_count` (COUNT, batched
    with the existing view-count query) and `liked_by_viewer` (batched
    against the viewer's own like set — same batching discipline as
    `is_following` in the current rail query, no per-story query).
- Route: `POST /api/stories/{id}/like` → `{liked, like_count}`. No auth
  restriction beyond being signed in — like `mark_story_viewed`, stories are
  public.
- `docs/API_CONTRACT.md`: add to the Stories section.

**Frontend**
- `StoryViewer.jsx`: heart icon button next to (or replacing part of) the
  existing `story-viewer-count` eye icon — tap fills the heart, bumps
  `like_count` **optimistically** (WS7's `useOptimisticAction` pattern, same
  as the existing Follow button in this same file), reverts on failure.
  `Icon.jsx` already has a heart glyph used elsewhere (`reactions`/likes in
  `PostFeed.jsx` if present — verify name, likely `heart`).
- `src/api/client.js`: `toggleStoryLike(storyId)`; mock mode flips a flag on
  the matching `MOCK_STORIES` entry.

**Tests**
- `backend/app/tests/test_public_stories.py` (extend): like/unlike toggles;
  `like_count` batched (constant query count for 1 vs 25 stories, same
  event-listener counting technique already used for the rail); liking your
  own story is allowed (unlike a real Instagram restriction — no reason to
  block it here).
- `src/test/StoryViewer.follow.test.jsx` or a new `StoryViewer.like.test.jsx`:
  tap fills the heart and increments the count before the request resolves;
  a rejected request reverts both.

### 1c. Story deletion — verify only, no new work

Already shipped in Round 1 (WS1): `DELETE /api/stories/{id}`
(`backend/app/api/stories.py`), author-or-super-admin only
(`backend/app/tests/test_public_stories.py`), and `StoryViewer.jsx` already
has a delete button + `handleDelete`. Nothing to build. Re-run
`test_public_stories.py`'s delete section as part of this phase's CI pass to
confirm it's still green before telling the stakeholder it's done — it's
easy for feedback like this to arrive because the *shipped* behavior wasn't
actually verified end-to-end in the real Telegram client (see the Manual
verification checklist in Round 1, item 1, which was never checked off).

### 1d. "See who viewed" (Instagram-style list)

Today, `story.view_count` (author-only) is a bare number
(`StoryViewer.jsx:177-181`, `Icon name="eye"`). There's no endpoint that
returns *who* viewed it — `story_views` has the rows, but nothing surfaces
them as a list.

**Backend**
- `crud/story.py::get_story_viewers(db, story_id, requester_id, limit=50) -> list[dict]`:
  author-only (403 for anyone else, matching the delete-author-check
  pattern); returns `[{user_id, name, photo_url, viewed_at}]`, most-recent
  first, one JOIN query.
- Route: `GET /api/stories/{id}/viewers` → `{viewers: [...]}`, 403 if not
  the author.
- `docs/API_CONTRACT.md` update.

**Frontend**
- `StoryViewer.jsx`: tapping the existing eye-icon count (author's own
  story only, `story.is_mine`) opens a bottom sheet — `StoryViewersSheet.jsx`
  (new) — listing avatar + name + relative time, reusing the same
  `avatar`/list-row classes as `FollowersList.jsx` (grep for that component
  to match styling exactly rather than inventing new CSS).
- Playback **pauses** while the sheet is open (same convention the app
  likely already uses if a confirm/report sheet can open over the viewer —
  verify `StoryViewer.jsx`'s existing pause behavior, e.g. around
  `handleDelete`'s confirm, and reuse it).

**Tests**
- Backend: non-author gets 403; author sees viewers ordered most-recent
  first; a story with zero views returns an empty list, not an error.
- Frontend: tapping the count opens the sheet with mock viewers; tapping a
  viewer row navigates to `/users/:id`; the sheet doesn't appear on someone
  else's story (no tap target rendered at all, since `is_mine` gates it
  today).

---

## 2. WS12 — Shareability: stories to Instagram/outside apps, poster share buttons

### Design

The app already has the exact mechanism this needs, twice over — this is
mostly wiring, not new infrastructure:

- `src/components/ShareCard.jsx` — canvas-rendered branded image
  (`@wellcirclebot on Telegram` burned into the bottom of the PNG), shared
  via the **Web Share API** (`navigator.share` with a `File`), which is what
  actually gets you into Instagram's native share sheet (Instagram Stories
  isn't reachable via a URL scheme from a Mini App's WebView — the Web Share
  API's file-share path is the only route that works outside Telegram).
  Falls back to a plain download when `navigator.share` can't take files.
- `src/utils/circleInvite.js::shareCircleInvite` — the **in-Telegram**
  share path via `tg.switchInlineQuery`, for when the target is another
  Telegram chat rather than an external app.

**Story sharing** needs the ShareCard *image-generation* pattern applied to
a story's own photo (not a stats card), plus both share paths:

- `src/utils/storyShareImage.js` (new): given a story's `image_url`, draw it
  onto a canvas at 1080×1920 (Instagram Story aspect), with a bottom gradient
  band and `@wellcirclebot on Telegram` + a small wordmark burned in — same
  drawing technique as `ShareCard.jsx`, reused rather than duplicated (factor
  the wordmark/caption-drawing helpers out of `ShareCard.jsx` into
  `src/utils/brandedCanvas.js` so both call sites share one implementation).
- `StoryViewer.jsx`: a share icon button next to like/delete. Tapping it:
  1. draws the branded image via the new util,
  2. tries `navigator.share({ files: [file], text: 'Join me on Well Circle — https://t.me/<bot>?startapp=... ' })` (Web Share, works for Instagram/WhatsApp/etc. outside Telegram),
  3. falls back to `tg.switchInlineQuery` **only if** `navigator.share` is
     unavailable **and** `window.Telegram?.WebApp` is present (i.e. we're
     actually inside Telegram, so the in-app share sheet is the right
     fallback rather than a silent no-op),
  4. falls back to clipboard-copy + toast as the last resort — mirroring
     `shareCircleInvite`'s existing three-tier fallback exactly.
- Bot deep link uses the same `startapp=` convention as
  `circleInvite.js`/`VisitScreen.jsx` (`src_<tag>` style tagging), tagged
  `startapp=story_share` so PostHog can attribute installs originating from
  a shared story, same as the QR-stand `?src=` tagging already does.

### Poster share button ("make similar shareability on every poster")

"Poster" here means a **provider/event card** — the thing users currently
see on Explore/event detail, not the raw JPEGs in `events/`. Add a share
button to:
- `ProviderDetail.jsx` (provider page — has a cover photo already, per WS6/WS17)
- `EventsScreen.jsx` / event detail (event has `provider.cover_photo_url`)
- `FeedEventBanner.jsx` (For You feed event card, optional stretch — confirm
  scope before building; see §8 defaults)

Same `brandedCanvas.js` helper, fed the provider's `cover_photo_url` instead
of a story photo, with event/provider name + date drawn on top rather than
a stats headline. Same three-tier share fallback. One shared component,
`ShareButton.jsx` (new, wraps the "generate branded image → share" flow so
it isn't reimplemented per screen), used by `StoryViewer.jsx`, `ProviderDetail.jsx`,
and `EventsScreen.jsx` alike.

### Tests

- `src/test/brandedCanvas.test.js` (new): stub canvas/`toBlob` as
  `ShareCard.test.jsx` already does; verify the wordmark/caption draw calls
  happen and the bot username is present in the generated caption text.
- `src/test/ShareButton.test.jsx` (new): `navigator.share` present → called
  with a `File`; absent + inside Telegram (`window.Telegram.WebApp` stubbed)
  → `switchInlineQuery` called; absent + outside Telegram → clipboard copy +
  toast.
- `src/test/StoryViewer.share.test.jsx` (new): share button renders and
  invokes the shared flow with the story's own image.
- Extend `ShareCard.test.jsx` only if `brandedCanvas.js` extraction changes
  its public behavior — it shouldn't; this is a refactor-safety check.

---

## 3. WS13 — Comments and likes on posts (minimal icons, matches Notifications)

### Current state — read carefully before building

The backend for this **already exists and already works**:
`backend/app/api/posts.py` has `POST /{post_id}/react` and
`POST /{post_id}/comments`, and `backend/app/crud/post.py::_assemble_posts`
already batches reactions + one-level-deep comment threads with no
per-post query. `frontend/src/components/PostFeed.jsx` (the circle Activity
tab) already renders full comment threads, replies, and a reaction bar —
see lines 412-520 read during scoping.

What's actually missing is narrower than the feedback implies:

1. **`FeedPostCard.jsx`** (the For You feed's post card — a different,
   deliberately lighter component per its own doc-comment: *"no composer,
   gifting sheet, or comment threads (those live on the destination
   circle/community screen)"*) only shows a 🔥 quick-react and a
   **read-only** comment *count*. There's no way to comment from the FYP
   feed itself, and no way to see who liked something ("all minimal icons")
   there.
2. **Icon style.** The feedback specifically asks to match
   `NotificationsScreen.jsx`'s icon treatment (`Icon name={iconName} size={24}
   strokeWidth={1.5}` — outline, 1.5 stroke, no fill) rather than the emoji
   glyphs (`🔥`) `FeedPostCard.jsx`/`PostFeed.jsx` currently use for
   reactions. This is a design-language ask more than a features-missing
   ask.

### Design

- Bring `FeedPostCard.jsx` up to the same interaction level as `PostFeed.jsx`
  (comment + reply inline, not just a count), reusing `PostFeed.jsx`'s
  existing optimistic comment/reply logic (`handleComment`/`handleReply`,
  lines 139-210) — extract it into a shared hook,
  `src/hooks/usePostComments.js` (new), so both components call the same
  optimistic-apply/reconcile code instead of drifting into two
  implementations of the same thing.
- Replace the emoji-glyph reaction buttons in **both** `FeedPostCard.jsx`
  and `PostFeed.jsx` with the `Icon` component, outline style, matching
  `NotificationsScreen.jsx`'s `size={24} strokeWidth={1.5}` convention (scale
  down to something like `size={16}` for the denser feed-card context, but
  keep the outline/1.5-stroke treatment — check `Icon.jsx` for a heart/like
  icon; add one if missing, matching the existing icon-path authoring
  pattern used for `'more-vertical'`/`'log-out'` in Round 1's WS8).
- A comment button (`message-circle`, already used for the count today) and
  a like/heart button sit side by side, minimal-icon style, no button chrome
  beyond what `Icon.jsx` glyphs already render as — this is the "like the
  notification" ask: icons that read as glyphs, not pill-shaped buttons with
  emoji.
- **The reaction/reaction-picker itself is WS15's job** (multiple reaction
  types, purchasable icon, stacking, long-press) — WS13 only gets the
  baseline single like + comment thread working on the FYP feed with the
  right icon language; WS15 builds on top of it rather than this workstream
  reinventing the reaction bar twice.

### Tests

- `src/test/FeedPostCard.test.jsx` (extend): tapping the comment icon opens
  an inline composer (or a sheet — pick one, see §8); a submitted comment
  appears optimistically before the request resolves; the icon set matches
  the outline style (snapshot or explicit `Icon name=` assertions, not pixel
  comparison).
- `src/test/usePostComments.test.jsx` (new): the extracted hook's
  apply/reconcile/rollback behavior, independent of which component uses it.
- `src/test/PostFeed.test.jsx`: update existing reaction-button assertions
  if the emoji glyphs are replaced with `Icon` — check this file's current
  assertions before changing markup so the diff is deliberate, not a
  surprise breakage.

---

## 4. WS14 — Engaging, bot-triggered re-engagement notifications

### What already exists (read before building — a lot is reusable)

`telegram-bot/bot/services/` already has three scheduled push jobs, all
following the same shape (`bot/utils/nudges.py` builds pure, unit-tested
message text; the service job fetches data, builds the nudge, sends via
`context.bot.send_message`, marks sent):

- `reengagement.py` — weekly, users inactive 7+ days, promo-aware copy.
- `streak_nudge.py` — daily 16:00 UTC, "your streak is at risk tonight."
- `weekly_digest.py` — Sundays, per-circle top scorer.

This is already very close to Duolingo/LinkedIn-style behavior
architecturally (scheduled, personalized, deep-links back into the app).
What's missing is:

1. **Event-driven** pushes (not just scheduled) — "X reacted to your post,"
   "X commented on your story" — the LinkedIn pattern of a near-real-time
   nudge tied to something that just happened, not a weekly batch.
2. **Clickbait-style copy** — the existing nudges are direct/functional
   ("we miss you," "your streak is at risk"). The ask is for curiosity-gap
   copy ("Someone you know just hit a 30-day streak 👀") — a copy/tone
   change plus new trigger content, not new plumbing for the scheduled ones.
3. A **frequency cap**, since event-driven pushes can spam if every
   reaction/comment fires a DM — Duolingo/LinkedIn both batch or throttle.

### Design

**Event-driven pushes, batched not instant.** Don't DM on every single
reaction — that's how apps get muted. Reuse the existing
`UserNotification` in-app row (already created for `circle_activity`/
`circle_deleted` in `crud/post.py`/`crud/circle.py`) as the **source of
truth for what's push-worthy**, and add a periodic bot job that DMs a
**digest** of unread high-value notifications since the last push, at most
once per `N` hours per user (see §8 for the default).

- Backend: `UserNotification` gains `type` values `post_liked`,
  `post_commented`, `story_liked` (created at the same call sites WS13/WS15
  already touch — `react_to_post`/`create_comment`/`toggle_story_like` —
  batched the same way `_notify_circle_of_new_post` already batches its
  inserts, so this isn't a new pattern).
- New `GET /api/bot/engagement-digest?since_hours=N` (mirrors the existing
  `GET /api/bot/inactive-users` shape): returns users with ≥1 unread
  push-worthy `UserNotification` created in the window and not yet
  DM'd, grouped per user with a summary (`{name, unread_count, top_type,
  top_actor_name}` — enough for the bot to build one clickbait line without
  a second query per user).
- `backend/app/api/bot.py`: new route following the exact pattern of
  `inactive_users`/`bot_reengagement_sent` (batched promo lookup already
  shows the right batching discipline to copy).
- `telegram-bot/bot/utils/nudges.py`: new `build_engagement_nudge(digest_entry)`,
  pure function, unit-tested exactly like `build_reengagement_nudge`/
  `build_streak_nudge` — curiosity-gap copy templates keyed by `top_type`
  (e.g. `"{actor} just reacted to your post — see what they said 👀"` for a
  reaction, `"You've got {n} new replies waiting"` for comments), never
  fabricating a specific person's name if `top_actor_name` is null (privacy:
  fall back to "someone" rather than guessing).
- `telegram-bot/bot/services/engagement_push.py` (new): same shape as
  `reengagement.py` — fetch digest, build nudge, send, mark sent — scheduled
  via `job_queue` in `bot/main.py` alongside the other three jobs.
- **Mark-sent** endpoint mirrors `mark_reengagement_sent`: marks the
  underlying `UserNotification` rows as pushed (not the same as `is_read`,
  which tracks in-app read state separately) so the next digest window
  doesn't re-send the same event.

### Tests

- `backend/app/tests/test_engagement_digest.py` (new): digest groups by
  user; only unread + not-yet-pushed rows count; `top_type`/`top_actor_name`
  picked correctly when a user has multiple pending notification types;
  empty when nothing qualifies.
- `telegram-bot/bot/tests/test_nudges.py` (extend): `build_engagement_nudge`
  — one test per `top_type` template, an anonymized-actor case, and that the
  deep link uses the same `startapp=` pattern as the other nudges.
- `telegram-bot/bot/tests/test_services_jobs.py` (extend): the new job
  fetches, sends, and marks sent, following the existing
  `test_schedule_reengagement_*` tests as the template (including the
  "send failure skips mark-sent" case).

---

## 5. WS15 — Purchasable reaction, 6-reaction long-press picker, stacked display, multi-react

### Design

This sits directly on top of the existing `Reaction` model
(`backend/app/models/post.py`) and `react_to_post` crud, which **already**
permits multiple reaction rows per `(post_id, user_id)` — there's no unique
constraint today, so "allow multiple reactions by a single user" is already
possible at the data layer. What's missing is (a) a fixed reaction-type
vocabulary instead of a free-text `emoji` string, (b) a way to *toggle off*
a reaction the user already gave (today you can only add, never remove —
needed so long-press-then-tap-again behaves correctly), (c) the purchasable
6th icon, and (d) the stacked-avatar LinkedIn display.

**Backend**
- `Reaction.emoji` stays a string column (no schema change), but the
  frontend/API contract now constrains it to a fixed set:
  `🔥 (fire), 👏 (clap), ❤️ (heart, default), 💪 (strong-arm), wc (Well Circle icon)`.
  Validate server-side in `ReactionCreate` (`api/posts.py`) against this set
  — reject anything else with 422, closing off the current free-text
  surface.
- `toggle_reaction(db, post_id, user_id, emoji) -> {"reacted": bool, "reactions": {...}}`
  (new, replaces the add-only `react_to_post` at the call site — keep
  `react_to_post` itself for the points-gifting path, which is a separate
  concern per the existing code's own comment about `points_gifted`): if a
  `(post_id, user_id, emoji)` row exists, delete it; otherwise insert.
  **This does require a new unique-ish lookup** (not a DB constraint, a
  query) — `db.query(Reaction).filter_by(post_id=, user_id=, emoji=).first()` —
  one extra query per reaction tap, acceptable since it's a single-row
  user-initiated write, not a feed read.
- **Purchasable icon.** `users.has_wellcircle_reaction BOOLEAN NOT NULL DEFAULT FALSE`
  (migration `023_wellcircle_reaction_unlock.py` + ensure statement, same
  pattern as WS9's `photo_is_custom`). `POST /api/users/me/unlock-reaction`:
  one-time `apply_transaction(db, user, -50, TXN_REACTION_UNLOCK,
  reference_id=user.id)` (never blocked, balance floors at 0 — same rule
  Round 1 set for the profile-photo charge), sets the flag, 409 if already
  unlocked (no double-charging). Add `TXN_REACTION_UNLOCK = "reaction_unlock"`
  to `VALID_TXN_TYPES`; shows in points history as "Well Circle reaction."
  Reacting with the `wc` emoji server-side checks `has_wellcircle_reaction`
  and 403s if not unlocked (never trust the client to only offer it after
  purchase).
- `_assemble_posts` (crud/post.py) already returns `reactions: {emoji: count}`
  — extend it to also return, per post, **which emoji(s) the requesting
  viewer used** (`viewer_reactions: [emoji, ...]`) and, for the stacked
  display, up to N reactor names/avatars per emoji
  (`reactors_preview: {emoji: [{id, name, photo_url}, ...]}`, capped at e.g.
  5 — batched the same way `reactions_by_post` already is, no per-post
  query).
- `docs/API_CONTRACT.md` update for all of the above.

**Frontend**
- `ReactionPicker.jsx` (new, shared by `FeedPostCard.jsx` and `PostFeed.jsx`
  post-WS13-extraction): default tap = ❤️ (or toggles the user's most recent
  reaction — pick one, see §8); **long-press** (reuse whatever long-press
  primitive the app already has, if any — grep for `onTouchStart`/`onContextMenu`
  patterns before writing a new one) reveals a horizontal row of all 6
  icons. The 6th (Well Circle) renders locked/greyed if
  `!user.has_wellcircle_reaction`, tapping it opens a purchase confirm sheet
  ("Unlock the Well Circle reaction — 50 points", matching WS9's
  `profile-photo-cost-notice` sheet pattern exactly) rather than reacting
  directly the first time.
- **Stacked display**, LinkedIn-style: overlapping small avatar circles
  (from `reactors_preview`) topped by the dominant emoji, with a `+N` tail
  for the remainder — new `ReactionStack.jsx` component, replacing the
  current flat `{emoji} {count}` pill row in both `FeedPostCard.jsx` and
  `PostFeed.jsx`.
- `src/api/client.js`: `toggleReaction(postId, emoji)`, `unlockReaction()`.
  Mock mode: `MOCK_USER.has_wellcircle_reaction` toggle, mock posts carry a
  small fixed `reactors_preview`.
- Optimistic via the WS7 helper: tapping a reaction updates the stack and
  the viewer's own highlighted state immediately; purchase-then-react is
  two sequential optimistic actions (unlock, then react), not one — don't
  collapse them, since the purchase can fail independently (insufficient
  points is impossible per the floor-at-zero rule, but a network failure
  isn't).

### Tests

- Backend — `test_reactions.py` (new, or extend an existing post-reactions
  test file if one exists — check before creating):
  - toggle on/off; a second tap with the same emoji removes it, a different
    emoji adds a second reaction from the same user (multi-react).
  - `wc` emoji rejected (403) before unlock, accepted after.
  - unlock: charges 50 exactly once, 409 on a second attempt, balance floors
    at 0 (mirrors WS9's existing floor test).
  - invalid emoji string → 422.
  - `reactors_preview` capped and batched (constant query count, N posts).
- Frontend — `src/test/ReactionPicker.test.jsx`, `ReactionStack.test.jsx`
  (new): long-press reveals all 6; locked 6th icon opens the purchase sheet
  instead of reacting; purchase success unlocks and reacts in one flow;
  purchase failure leaves it locked and toasts once; stacked avatars render
  from `reactors_preview` with a correct `+N` tail.

---

## 6. WS16 — This week's events under Explore

### What changed the shape of this item

Round 1's WS6 seed only covered events through Sep 14, 2026 — by the time it
would ship, **every seeded event is already in the past** (today is Sep 18).
Two new poster photos appeared in `events/` *after* that plan was written —
dated today — listing events from **Sep 17 through Sep 28, 2026**, which are
the actual "this week" events the feedback is asking for:

| Provider | Event | Date/time (EAT) | Location | New host? |
|---|---|---|---|---|
| Satenaw Running Club | Satenaw Running Club | Sep 17, 17:30 | Friendship Park | existing |
| Zumba with Vahe | Zumba with Vahe | Sep 19, 10:00 | SUP Studio, Addis Ababa | existing |
| **Debol Running Club** | Friendship Park Social 5k | Sep 20, 06:30 | Friendship Park | **new** |
| Bertusew Runningclub | Bertusew Running Club | Sep 20, 06:45 | Yetebaberut Square Sport Center, CMC | existing |
| Let's Hike Ethiopia | Botanical Garden Hike and Suba National Park Hiking | Sep 19–20, 07:00–07:30 | Gullele Botanical Garden / Suba National Park | existing |
| Ereft Ethiopia | Camping Trip to Abijata Shalla and Lake Langano | Sep 19–20, 06:00 | Meet TBD | existing |
| Guzo Adwa Hiking | Merete-Wegeram Village Meskel Trip (Gurage) | Sep 25–27, 06:00 | Gurage | existing |
| Ereft Ethiopia | Gurage Special Meskel Trip | Sep 25–28, 05:30 | Gurage | existing |

Only **Debol Running Club** is a genuinely new provider not in Round 1's
`PROVIDERS` table.

### Design

- Extend `backend/seed_upcoming_events.py` (the WS6 data-table rewrite from
  Round 1 is exactly the right shape for this — don't rewrite it, add to
  it): append `"Debol Running Club"` to `PROVIDERS` (category `running`,
  `exists: False`), append these 8 rows to `EVENTS`. Multi-day events (Let's
  Hike, both Ereft entries, Guzo Adwa) need a `starts_at`/`ends_at` span
  rather than the `DURATIONS` lookup Round 1 used for single-session events
  — extend `_ends_at()` to accept an explicit `ends_at` field on the event
  dict (the function already supports this per Round 1's summary: "24 dicts
  with provider/service_name/starts_at/location_text/kind (or ends_at)").
- **"Make sure to make weekly events"** — read as: this needs to become a
  *recurring* process, not another one-off script run. Add a short
  operational note to `docs/HANDOFF.md` (not new code) describing the
  cadence: whoever posts a new "Upcoming Wellness Events" poster to the
  Telegram channel should also drop the photo in `events/`, and a human
  (or a follow-up scripted step, out of scope here — see §8) transcribes it
  into `seed_upcoming_events.py`'s `EVENTS` list and re-runs `--dry-run`
  then `--apply`. This plan does **not** build an OCR/auto-ingestion
  pipeline for reading posters — that's a materially bigger, riskier lift
  (misreads on a real event time are worse than no automation) and isn't
  what "make sure to make weekly events" asks for; flagged as a default to
  confirm in §8 in case the stakeholder actually wants that.
- Explore already opens on Events with an Upcoming/Past split (Round 1's
  WS4) — once these rows are seeded, they show there automatically with no
  frontend change needed. Verify the "Upcoming" section is non-empty after
  seeding (Round 1 shipped it expecting to be empty on day one — this is
  the first real content it'll show).

### Tests

- `backend/app/tests/test_seed_poster_events.py` (extend): the 8 new rows
  parse; Debol Running Club resolves and is flagged as a new provider;
  multi-day events have `ends_at > starts_at` spanning the stated range;
  re-running `plan_changes()` against a state that already has Round 1's 24
  events plus these 8 is idempotent (empty plan).
- No frontend test changes expected (Explore's Events view already renders
  from real data per Round 1's WS4 tests) — spot-check
  `ExploreScreen.events.test.jsx` still passes with a non-empty upcoming
  mock list.

---

## 7. WS17 — Real provider banner assets from `events/assets/`

### What's there

`events/assets/` has one subfolder per provider slug, each with 2-5 real
photos (group shots, action shots) — **no poster text overlay**, unlike the
raw poster JPEGs Round 1 had to work around:

| Folder | Maps to provider | Files |
|---|---|---|
| `boleburners` | Bole Burners | `boleburners.jpg` |
| `satenaw_runclub` | Satenaw Runclub | `image.jpg`, `image-01.jpg`, `image-03.jpg` |
| `birtu_sew_running_club` | Bertusew Runningclub | `image.HEIC`, `image-01.jpg`, `image-02.jpg`, `image-03.jpg` |
| `afroheatfitness` | AfroHeat Fitness | `image.jpg`/`imag.jpg`, `image-01.jpg`, `image-02.jpg`, `image-03.jpg` |
| `lets_hike_ethiopia` | Let's Hike Ethiopia | `image.jpg`, `image-01.jpg`, `image-02.jpg`, `image-03.jpg` |
| `ereft_ethiopia` | Ereft Ethiopia | `image.jpg`, `image-01.jpg`, `image-02.jpg` |
| `sipandserve101` | Sip and Serve Tennis | `image.jpg`, `imagw-01.jpg`, `image-02.jpg` |
| `guzo_adwa_hiking_events` | Guzo Adwa Hiking | `image.jpg`, `image-01.jpg`, `image-02.jpg`, `image-03.jpg`, `image-04.jpg` |

**Not covered** (no folder exists): Zumba with Vahe (Round 1 already has a
plan for this one — the group photo in the dated poster JPEG itself), Zumba
Dance Fitness, SUP Studio, Great Ethiopian Run Team, Sonder Running Club,
and the new Debol Running Club (WS16). These still need either a real photo
supplied later or a poster-crop sign-off as Round 1 originally scoped —
unchanged blocker for those five/six.

Spot-checked `boleburners/boleburners.jpg` directly: a clean, well-composed
group photo, no text, ready to use as-is (1920px wide — downscale to the
1200×630 convention Round 1 set).

### Design

- Extend `backend/seed_upcoming_events.py`'s upload step (Round 1's plan
  already calls for `cloudinary_service.upload_file(folder="providers",
  public_id=<slug>)`, idempotent via the fixed `public_id`) to source from
  `backend/seed_assets/event_covers/<slug>.jpg` as before, but now
  **pre-populate** that directory by copying/resizing the best single photo
  from each `events/assets/<folder>/` (pick the first non-`.HEIC` file per
  folder unless it's visibly worse — that's a one-time manual/visual pick,
  same "needs a human eye" gate Round 1 flagged, just a much smaller version
  of it now that most folders only have 2-5 candidates and none have text
  overlay to work around).
  - `birtu_sew_running_club/image.HEIC` needs conversion to JPEG first — not
    web-servable as-is; use whichever of the sibling `.jpg` files reads
    best, or convert the HEIC if it's actually the best shot.
- Resize/compress to the existing convention (≤2MB, 1200×630) — reuse
  `imageCompress.js`'s logic conceptually, but this is a one-time backend/
  build-time step, not a runtime upload, so a simple PIL/Pillow resize
  script (`backend/scripts/prepare_event_covers.py`, new, not itself part of
  the app) is more appropriate than pulling frontend canvas code into the
  backend.
- Run `seed_upcoming_events.py --dry-run` first to confirm the plan only
  *updates* `cover_photo_url` for these 8 already-existing providers (no
  insert/cancel side effects), then `--apply`.

### Tests

No new pure-function tests needed beyond what Round 1's
`test_seed_poster_events.py` already covers for `upsert_provider`/plan
shape — this workstream is asset preparation + an `--apply` run, not new
branchy logic. Add one assertion if `_new_provider_row`/`upsert_provider`
gains a "source from local file vs. skip-upload" branch: a
`--skip-upload` dry run doesn't fail when a slug's cover file is missing
(Zumba Dance Fitness etc. — still `cover_photo_url: null`, unblocked
separately).

---

## 8. Defaults this plan picked — please confirm or override

1. **Engagement-push frequency cap (WS14):** defaulted to at most one
   digest DM per user per 6 hours, batching everything that piled up in
   that window into one message rather than one DM per event. Say if you
   want a different window, or a daily cap instead.
2. **Clickbait copy tone (WS14):** curiosity-gap phrasing ("Someone just
   reacted to your post — see what they said 👀") rather than pure urgency
   ("You have 3 new notifications!"). Both are used by the apps you
   referenced; pick one if you have a preference, or approve a copy review
   pass before this ships to real users, since tone here is genuinely
   subjective.
3. **No poster OCR/auto-ingestion pipeline (WS16):** "this week's events"
   and "make sure to make weekly events" is treated as "seed this week's
   real events now, and hand-transcribe future posters the same way,"
   **not** "build automation that reads a poster photo and creates events
   without a human." Say if you actually want the latter — it's a
   materially larger, separate piece of work (image → structured data is
   error-prone for something as consequential as a real event's date/time).
4. **Story share caption / deep-link tag (WS12):** `startapp=story_share`,
   matching the existing `?src=` attribution convention. Confirm this is
   the tag format you want tracked in PostHog.
5. **Reaction picker default tap (WS15):** tapping (not long-pressing) a
   post reacts with ❤️ by default, matching LinkedIn's "thumbs up is the
   one-tap default, everything else needs a long-press" pattern. Say if you
   want the default to instead be "repeat whatever I last used."
6. **Poster/event share scope (WS12):** share buttons on `ProviderDetail.jsx`
   and `EventsScreen.jsx`/event detail are in scope; the compact
   `FeedEventBanner.jsx` card in the For You feed is called out as optional
   stretch, not committed, to keep this workstream's size from creeping —
   confirm if you want it there too.
7. **Comment entry point on the For You feed (WS13):** an inline composer
   that expands in place (matching `PostFeed.jsx`'s existing pattern)
   rather than a separate bottom sheet. Say if you'd rather it open a sheet
   (keeps the feed card height stable, more like Instagram).
8. **`events/assets/` photo picks (WS17):** "first non-HEIC file per
   folder" is a placeholder rule, not a real editorial choice — these 7-8
   photos genuinely need a quick human glance (a few seconds each, much
   lighter than Round 1's poster-crop ask) before upload. Treated as a
   blocking step for this workstream specifically, same as Round 1 treated
   poster crops.
9. **Well Circle reaction icon art (WS15):** assumed to be the same
   wordmark/logo mark already used in `ShareCard.jsx`'s canvas drawing
   (`caps('Well Circle', ...)`) and the app's existing brand assets, not a
   new icon to be designed. Confirm there's an existing square icon asset
   to use, or flag that one needs to be produced first.

---

## 9. Sequencing and PRs

All branches come off `dev` and PR into `dev` (CLAUDE.md flow), same as
Round 1. Each PR updates `docs/API_CONTRACT.md` when shapes change and
passes the full CI gate.

| PR | Contents | Depends on |
|---|---|---|
| 1 | **WS11** story safe-area fix, like, viewer list | — |
| 2 | **WS17** real provider banner assets (needs your photo picks first, §8.8) | — |
| 3 | **WS16** this week's events seed (extends Round 1's `seed_upcoming_events.py`) | — |
| 4 | **WS12** shareability (`brandedCanvas.js` extraction, story share, poster share) | 1 (story share button lives in `StoryViewer.jsx`) |
| 5 | **WS13** FYP feed comments/likes, minimal-icon language | — |
| 6 | **WS15** purchasable reaction, long-press picker, stacked display, multi-react | 5 (builds the real reaction bar WS13 sets up) |
| 7 | **WS14** engagement digest push, clickbait copy | 5, 6 (more worth notifying about once they exist) |

### Manual verification (real Telegram client, after each deploy)

- [ ] Open a story on a phone with a notch/Dynamic Island — the progress
      bar and header clear the status bar, no overlap with the battery icon.
- [ ] Like a story, close and reopen it — the like persisted; tap again to
      unlike.
- [ ] As a story's author, tap the view count — a real list of viewers
      appears, most recent first.
- [ ] Share a story — outside Telegram (a regular mobile browser opening the
      web app URL, or Telegram's "Open in browser") the OS share sheet
      offers Instagram; inside Telegram it opens the chat-forward picker.
      The shared image has the bot link/branding visible.
- [ ] Share a provider/event page the same way.
- [ ] From the For You feed, comment on a post without navigating away —
      the comment appears, and the icons read as outline glyphs, not emoji.
- [ ] Long-press a post's reaction area — 6 icons appear; the Well Circle
      one is greyed out until purchased; buying it charges exactly 50 points
      once.
- [ ] React to the same post with two different icons as one user — both
      show, stacked, with your avatar in both.
- [ ] Explore → Events shows this week's real events under Upcoming.
- [ ] Trigger a reaction/comment from a second test account on your post,
      wait for the digest window — a bot DM arrives with curiosity-gap copy
      and a working deep link back into the app.
