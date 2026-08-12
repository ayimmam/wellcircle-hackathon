# Well Circle — Navigation & UX Audit (August 2026)

Scope: the Telegram Mini App's navigation model, the Profile screen, and the
For You feed, audited against three goals — **circle engagement**, **booking
rate**, and **app reopen rate**.

Part 1 is what shipped in Phase 20. Part 2 is what I found but did **not**
ship, with the reasoning, so it can be approved (or rejected) deliberately
rather than discovered later.

---

## Part 1 — Shipped

### 1. The menu duplicated the chrome

**Found.** The burger menu carried eight items. Five of them — Home, Explore,
Communities, Profile, Notifications — were already permanently on screen via
the bottom nav and the header bell. A user tapping the menu was paying an
interaction to reach something that was already one tap away, and the three
items that genuinely had no other entry point (Points Store, Bookings,
Become Provider) were buried among them.

**Why it matters.** A menu whose first five entries are things you can already
see teaches people the menu is not worth opening. That is exactly the surface
that should have carried Points Store — the screen that converts accumulated
points into a reason to come back.

**Shipped.** Four items, each with a one-line description:

| Item | Route | Why it's here |
| --- | --- | --- |
| Points Store | `/products` | No other permanent entry point; it's the payoff of the points loop |
| Bookings | `/my-bookings` | No other permanent entry point |
| Events | `/events` | New screen (below) |
| About | `/about` | New screen (below) |

Everything role-gated (Provider Dashboard, Admin) and the one-time provider
pitch moved to About.

### 2. Events had no home

**Found.** Events existed only as a carousel inside Explore. No URL of their
own, no way to see past the first few, nowhere for a past event to live, and
no way to link someone to "what's on".

**Why it matters.** Events are the highest-intent bookable thing in the app —
they're time-boxed, so they carry natural urgency that a standing service
doesn't. Burying them under a tab meant that urgency never got a chance to work.

**Shipped.** `/events` with an Upcoming tab (grouped *This week* / *Later* over
a 90-day window — the default `/events` window was 7 days, shorter than most
studios plan ahead) and a **Past** tab.

### 3. A past event was a dead card

**Found.** The feed had no concept of an event that already happened. Once a
session passed it simply vanished.

**Why it matters.** A past event is the single best piece of social proof the
app produces — *22 members went to this*. Deleting it throws that away, but
showing it with a "Book This Session" button is worse: it's a dead end.

**Shipped.** A `past_event` item type and `FeedPastEventCard`: dimmed cover,
"Happened N days ago" badge, attendance as social proof, and a CTA that routes
to that provider's **upcoming** sessions (`/events?provider=<id>`). The
intent the recap creates lands somewhere.

### 4. The feed opened on the wrong provider

**Found.** The mock feed builder had a comment saying it pinned Boston Day Spa
first. It actually pinned `MOCK_PROVIDERS[0]` — Lifestyle Fitness Center. The
backend sorted featured-first and got it right; the mock (which is what runs
in tests and demos) did not.

**Also found.** Everything commercial arrived on the every-3rd-post cadence, so
on a light post day the pilot could be pushed past the fold or off page one.

**Shipped.** A four-item **lead-in** — spotlight provider, one of its services,
its next event, its last event's recap — each separated by a member post, in
both the mock and `feed_service.py`. The alternating rhythm matters: four
commercial cards stacked together reads as an ad break, which is the fastest
way to teach someone to scroll past the top of your feed.

### 5. Profile was a settings page with a profile stapled on top

**Found.** Fifteen sections, no grouping, interleaved content and
configuration. The bio was a permanently open `<textarea>`, so the first thing
below your own name was an unsaved form. "My Bookings", "Redeem Points" and
"Provider Dashboard" were repeated here despite living elsewhere. Appearance
sat below five preference panels.

**Shipped.**
- Header as a card; bio behind an explicit Edit action.
- **Appearance directly below Milestones** (as requested) — it's the one
  setting people change for pleasure rather than need, and it was buried.
- A **pink** accent, light and dark.
- A `Settings` divider separating content from configuration.
- The three duplicated entries removed.

### 6. The entire test suite was red

**Found, unrelated to any of the above.** 155 of 207 tests were failing on
`main` before this session's changes. Node 22+ defines `localStorage` and
`sessionStorage` globals that are `undefined` unless the process is started
with `--localstorage-file`; those shadow the ones happy-dom installs, so every
component that reads a saved token, theme, or seen-flag threw on mount.

**Shipped.** `src/test/setup.js` installs an in-memory implementation when the
environment didn't provide one. Suite is green: **232/232**.

---

## Part 2 — Found but not shipped

Ordered by expected impact per unit of risk. Each of these is a real finding;
none is a safe unilateral change.

### A. Home's pre-settle reordering now fights the feed lead-in

`ForYouScreen` reorders the first page on a cached paint, floating
`render_cost: 'instant'` items above `media` ones until the revalidated
bootstrap lands. That was a sound call when the feed was undifferentiated. It
is no longer: the lead-in is a deliberate sequence, and the reorder scrambles
it for the first few hundred milliseconds, then reflows.

**Recommendation.** Exempt the lead-in items from the pre-settle sort (keep
them pinned at their server positions and only reorder the tail), or drop the
two-tier paint now that `useResource` renders from cache anyway. Needs a
before/after on a throttled connection to decide which — that's why I didn't
pick one.

### B. The check-in loop and the feed don't reinforce each other

`CheckinCard` sits above the feed and disappears once every circle is checked
in. The moment right after a check-in — the highest-affinity moment in the
session — currently leads nowhere.

**Recommendation.** On check-in completion, replace the card in place with a
single next action tied to that circle's provider: their next event, or their
top service. This is the cheapest available booking-rate lever, because it
fires at the one moment the user has already demonstrated intent. Needs a copy
decision and probably a product opinion on how hard to push, so it's a
proposal, not a patch.

### C. Explore and For You overlap without a clear division

Both surface providers and events. Explore adds filters and "near me"; For You
adds posts and ranking. A user has no model for which one to open, and the
"Happening Soon" carousel now competes with `/events`.

**Recommendation.** Make Explore explicitly *search + filter* (a query-first
screen) and let For You own browse-without-intent. Concretely: replace
Explore's events carousel with a single "See all events →" row pointing at
`/events`. I left the carousel alone because removing a surface the marketing
team asked for is a call for the product owner, not the audit.

### D. Booking has three entry shapes for the same action

`FeedServiceCard` → `/booking/:id` with `state.selectedService`;
`FeedEventBanner` → `/booking/:id?event_id=` with three state keys;
`ProviderDetail` service rows → a third variant. The flow reconstructs its
starting step differently depending on which one it got, and the event path
duplicates the same data in both the query string and router state.

**Recommendation.** One `startBooking({ providerId, service?, event? })` helper
that owns the URL shape, with the query string as the single source of truth
(router state doesn't survive a Telegram deep link or a reload — an event
booking opened from a shared link today loses its price and service name).
This is a refactor with real regression surface across four booking test files;
it deserves its own change, not a rider on a navigation pass.

### E. `/my-bookings` is a list, not a re-entry hook

It shows bookings. It does not surface *the next one*, doesn't offer add-to-
calendar, and doesn't prompt anything after a session completes.

**Recommendation.** Pin the next upcoming booking as a hero card with the date,
the provider's location link (`map_url` already exists), and a call button.
After a session's end time passes, show a one-tap "How was it?" that writes a
post to the provider's circle — that turns a completed booking into circle
content, which is the loop the app is built on. Needs a backend field for
"session completed, not yet reviewed"; out of scope here.

### F. Notifications are a bell with no strategy

The header polls unread count every 30s. The screen lists notifications. There
is no distinction between "someone reacted to your post" (social, drives circle
engagement) and "your booking is tomorrow" (transactional, drives attendance),
and nothing routes back into the app differently.

**Recommendation.** Two tabs or two visual weights, and make the transactional
ones deep-link to the booking rather than to the list. Low risk, but it's a
design decision about tone that should be made deliberately.

### G. Accessibility gaps worth a dedicated pass

Not blocking, but consistent across the app:
- Tab-like chip groups (`filter-chips`) use `role="tab"` without a
  `role="tablist"` container and `aria-controls` — screen readers announce
  them as loose buttons. I added `role="tablist"` on the new Events screen
  only.
- Several tappable `<div>`s with `onClick` and no keyboard handler or role —
  `neighbourhood-card`, the joined-circle rows, `FeedServiceCard`'s outer card.
  Keyboard and switch-control users can't reach them.
- Icon-only buttons are labelled inconsistently (`aria-label` on some, a
  `title` on others, nothing on a few).

**Recommendation.** One focused accessibility pass rather than piecemeal fixes,
since the right answer for the tappable cards is a shared `<CardButton>`
primitive rather than 12 individual patches.

---

## Suggested order of work

1. **A** — cheap, and it undermines something that just shipped.
2. **B** — highest booking-rate return for the effort.
3. **E** — highest reopen-rate return, but needs backend support.
4. **D** — do it before more booking entry points get added, not after.
5. **C**, **F**, **G** — deliberate, schedulable, no urgency.
