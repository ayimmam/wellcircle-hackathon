# WellCircle Telegram Mini App: 30-day activity review

**Observation period:** September 17–October 16, 2026, inclusive, in Africa/Addis_Ababa (UTC+03:00).  
**Query boundaries:** `2026-09-16T21:00:00Z <= timestamp < 2026-10-16T21:00:00Z`.  
**Prepared:** October 17, 2026, from live PostHog queries.  
**Project:** Well Circle organization, Default project, project ID `508615`.  
**Purpose:** Improve consistent weekly engagement, smooth onboarding, and community participation/network effects. Bookings are outside this review.  
**Deliverable:** Analysis and recommendations only. No application, dashboard, cohort, flag, or experiment changes were applied.

## Decision overview

Prioritize **reliability and the path from onboarding to a first community action**. There is some interest in browsing, sharing, stories, and posting, but this sample does not establish a healthy weekly habit or a community network effect.

The strongest evidence is:

- **15 people** recorded an authenticated Telegram Mini App open after the four requested exclusions.
- **7/15 (46.7%)** opened on at least two different Addis Ababa calendar days; **8/15 (53.3%)** appeared on only one day.
- **98/147 opens (66.7%)** came from two people. Opens should not be interpreted as 147 visits.
- **2/6 onboarding starters (33.3%)** recorded completion within the ordered, one-day funnel.
- **5 people** saw a check-in prompt, **1** clicked, and **0** recorded a successful check-in. Three check-in-related optimistic-action failure records were captured for one person.
- **13/15 people** generated at least one `client_issue` event. This is issue-event incidence, not a request failure rate.
- **7 people** clicked Community navigation, **4** initiated adding a story, and **3** opened the post composer. These are intentions/interactions, not proof of successful contributions.
- **4/9 card viewers (44.4%)** subsequently shared or downloaded a card within one day. All observed cards in the included audience were join cards.

### Feature categories: modify, keep, or remove

“Confidence” describes the strength of the recommendation from this dataset, not a statistical confidence interval.

| Category | Decision | Evidence in the included audience | Recommended direction | Tradeoff | Confidence |
| --- | --- | --- | --- | --- | --- |
| Home loading, requests, and recovery | **Modify first** | 708 issue records across 13 people; 595 timeout records across 12; 61 home-bootstrap failure records across 7 | Investigate affected requests and recovery behavior before expanding engagement mechanics. Make successful loading and retry outcomes measurable. | Reliability work delays new features; caching and retries can add complexity or show stale data. | High that a reliability investigation is warranted; root cause unknown |
| Onboarding and first value | **Modify** | Name step: 6 people → goal: 4 → avatar: 3 → circles: 3 → completion: 2 | Test a shorter route to a relevant community and first useful action. Consider moving optional goal/avatar setup until after that action. | Less early profile data and personalization; completion could improve without improving retention, so measure both. | Medium directionally; only 6 starters |
| Check-ins, streaks, and points | **Modify; retain the core capability** | 5 prompt viewers → 1 clicker → 0 recorded successes; 3 check-in failure diagnostics for one person | Resolve the action path and measurement first. Then test a weekly participation goal aligned with the stated product goal, alongside existing streak recognition. | Lower-frequency goals may reduce daily pressure but also weaken a daily habit signal; more rewards alone may mask a broken action. | High for investigating the action; low for which habit design will work |
| Community discovery and joining | **Keep and modify** | 7 Community-nav users; 3 people recorded any circle/community join; only 1 home discovery opener | Preserve discovery and make the next useful action after joining clear. Distinguish explicit joins from onboarding auto-joins. | A more guided journey reduces browsing freedom; narrowing suggestions may reduce choice. | Medium |
| Stories, feed contributions, and peer interaction | **Keep; verify completion and feedback** | 4 story-add users, 3 composer users, 2 interacting with the story viewer, 1 clicking story-like | Instrument successful publishing, viewing, reacting, replying, and return visits. Investigate recorded like/follow failures. | Instrumentation and workflow repair take effort before new social features; extra prompts could interrupt browsing. | Medium for preserving demonstrated interest; low for outcome impact |
| Share cards and invitations | **Keep sharing; modify its timing and attribution** | 9 card viewers; 2 native sharers; 3 downloaders; union of exporters: 4; 7 close-button users; 0 included circle-invite-share users | Preserve manual image sharing. Test an inline or user-invoked invitation to share against the automatic popup. Measure invite recipient → join → contribution/return. | Fewer automatic prompts may reduce exports; more prompts may interrupt first value. Export is not evidence of acquired users. | Medium for preserving card export; low for network acquisition effect |
| Explore and wellness-category browsing | **Keep; limit expansion during this phase** | 6 Explore users; “gym” selected by 2, “nutrition” by 1, “yoga” by 1 | Retain a lightweight path for interest discovery and community relevance. Prioritize participation outcomes over additional catalog breadth. | Less variety may reduce perceived richness; browsing alone may not support weekly participation. | Medium for retaining demonstrated use |
| Entire user-facing features | **No outright removal justified yet** | Only 15 included openers; several contribution outcomes are unmeasured | Use targeted simplification experiments before deleting capabilities. | Keeping features retains maintenance/navigation cost; deleting now risks removing behavior that current telemetry cannot see. | High that the current evidence is insufficient for hard deletion |

## Scope and population

The final exclusion rule follows the user's clarification: **exclude only Anteneh, Yonatan, Bezawit Assefa, and Biniyam; retain Yonatan Tsegaye**. Additional provider/admin accounts were not inferred or removed.

The four names were resolved to current PostHog person records, including recorded trailing spaces, and excluded by immutable person ID rather than by historical name properties:

| Excluded person | PostHog person ID |
| --- | --- |
| Anteneh | `b8008753-7024-54df-9da5-9a25de6835a5` |
| Yonatan | `02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e` |
| Bezawit Assefa | `eeb112e8-8c9c-52f9-a495-74b5c4786dbd` |
| Biniyam | `786413bd-7ef5-522f-b74c-af481f6a8a5a` |

The main population requires:

1. The observed Mini App deployment host, `wellcircle-hackathon.vercel.app`.
2. An `app_open` with `entry = 'telegram'` on that host within the observation period.
3. A person ID outside the four exclusions.

Feature and diagnostic events are restricted to that population and deployment. Thus blocked browser access and people with only an unauthenticated pageview are not counted as engaged users. This also means genuine users whose successful app-open telemetry was lost are outside the main population; it is an observed authenticated audience, not a complete census of registered accounts.

PostHog currently records no usable person role field. Its existing [Internal / Test users cohort](https://us.posthog.com/project/508615/cohorts/407744) contains **0 people**, so relying on that cohort would not implement the requested exclusions. The project has person-on-events querying enabled; using fixed person IDs avoids exclusion changes caused by historical name values.

### Why the exclusions materially change the story

| Recorded activity | Before the four exclusions | Excluded team contribution | Included audience |
| --- | --- | --- | --- |
| Authenticated app-open people | 19 | 4 | 15 |
| App-open records | 642 | 495 | 147 |
| Successful check-in records | 12 | 12, from 3 people | 0 |
| Circle-invite-share records | 1 | 1 | 0 |
| Community-activity-open records | 4 | 4 | 0 |
| Post-card-share records | 3 | 3 | 0 |
| Concierge-chip-click records | 4 | 4 | 0 |

The excluded people produced **77.1% of app-open records**. An unfiltered overview would substantially overstate external adoption of the habit and invitation features.

The existing [Weekly check-in retention insight](https://us.posthog.com/project/508615/insights/JqfgONQg) was inspected. Its stored query has no explicit person exclusions and uses its own date window; its default result should not be substituted for this report.

## Weekly engagement

An `app_open` records successful authentication/session restoration in the inspected code. It can fire repeatedly during authentication activity, so neither its total nor repeat events on the same day prove separate visits.

The included audience generated **147 opens across 34 PostHog SDK sessions containing an app-open event**. Session counts and open counts have different meanings.

### Frequency across local days

| Distinct active days in the 30-day window | People |
| --- | ---: |
| 1 | 8 |
| 2 | 4 |
| 3 | 1 |
| 4 | 1 |
| 7 | 1 |
| **Total** | **15** |

The highest individual frequency was seven active days. Two people generated 98 opens, so total open volume is a poor stand-alone indicator of broad engagement.

### Consistency across complete seven-day blocks

The following are **custom, disjoint activity blocks aligned to Addis Ababa dates**, not standard PostHog retention cohorts or rolling WAU. The last two days are reported separately to avoid comparing them with full weeks.

| Local date block | People with an app open | Open records | Also opened in the next complete block |
| --- | ---: | ---: | --- |
| Sep 17–23 | 4 | 66 | 2/4 |
| Sep 24–30 | 5 | 38 | 1/5 |
| Oct 1–7 | 5 | 10 | 2/5 |
| Oct 8–14 | 6 | 22 | Not calculated: next block is incomplete |
| Oct 15–16, partial block | 2 | 11 | Not calculated |

Across the four complete blocks, 13 people appeared at least once:

- 9 appeared in one block.
- 1 appeared in two blocks.
- 3 appeared in three blocks.
- 0 appeared in all four blocks.

The two people in the final partial block did not appear in the first four blocks. These distributions are not adjusted for when a person first entered the observation window. In particular, **0 of the 4 people present in the first complete block appeared in all three following complete blocks**; this is a small observed cohort, not a product-wide retention estimate.

**Implication:** There is some repeat usage, but it is uneven and concentrated. The next engagement intervention should help users reliably complete a useful community action and return for a response or next activity. The data does not show that more streak rewards or catalog content will create that behavior.

## Onboarding

The ordered funnel allows intervening events and a maximum of one day from the first step. Both recorded completion names, `onboarding_complete` and `onboarding_completed`, are combined as one OR step.

| Funnel step | People | Share of starters |
| --- | ---: | ---: |
| Name | 6 | 100% |
| Goal | 4 | 66.7% |
| Avatar | 3 | 50.0% |
| Interest | 3 | 50.0% |
| Frequency | 3 | 50.0% |
| Circles | 3 | 50.0% |
| Either completion event | 2 | 33.3% |

Two people did not progress from name to goal, one more did not reach avatar, and one of the three circle-step users did not record completion in this funnel. The completion funnel reports a median of **45 seconds among the two converters**, which does not describe the experience of nonconverters.

The onboarding route generated 11 timeout diagnostics across four people in the included audience. This supports investigating reliability during onboarding, but does not establish that those timeouts caused the observed funnel exits.

**Modify:** Test moving optional early setup out of the initial journey and making the first useful community action the immediate destination. Keep interest collection if it is needed to make community suggestions relevant.

**Tradeoff:** Removing profile steps from the initial path reduces initial personalization and profile completeness. Evaluate the change using both completion and subsequent community participation/weekly return; a higher completion count alone is insufficient.

**Removal candidate:** Optional goal/avatar steps *from the required initial sequence*, subject to a measured test. This is a recommendation to simplify placement, not evidence that goal-setting or avatars have no value.

## Habit loop and reliability

### Check-in progression

The ordered one-day funnel is **5 prompt viewers → 1 clicker → 0 recorded successes**. The first transition is 20%; the overall observed prompt-to-success conversion is 0/5.

The diagnostic event stream contains **three `optimistic_action_failed` records with check-in action keys**, all from one included person. This is stronger evidence of attempted-but-failed interaction than the missing dedicated attempt event alone.

Dedicated `checkin_attempt` and `checkin_failure` events first appear in project traffic on October 2, and only for excluded team members in this period. Consequently, missing attempt events do not demonstrate that included users never attempted a check-in, especially earlier in the window. Likewise, zero tracked successes is not a database audit proving zero actual check-ins.

**Modify:** Investigate the failed check-in action and make completion/recovery explicit before tuning rewards. Once the action is dependable, test a weekly participation target; this is a product hypothesis aligned with the user's goal, not a demonstrated winner.

### Recorded issues

| Diagnostic kind | Records | Affected people |
| --- | ---: | ---: |
| Timeout | 595 | 12 |
| Home bootstrap failed | 61 | 7 |
| Offline | 42 | 4 |
| Optimistic action failed | 10 | 1 |
| **Any issue** | **708** | **13** |

People overlap across rows. Multiple records may describe the same underlying request or episode. These are **not** 708 distinct outages, nor a request failure rate.

The largest timeout concentrations were on Home (**307 records / 7 people**), Profile (**104 / 4**), Explore (**49 / 4**), and Community list (**25 / 4**). The 10 optimistic-action failures comprise three check-in, four story-like, two story-follow, and one notification-read records, all for one person.

No included `client_issue` events were recorded on October 15–16, when two people opened the app. That small tail is insufficient to conclude that reliability is fixed.

**Priority:** Diagnose request/episode causes and verify recovery using endpoint, status, latency, retry and success evidence. Current records do not establish whether the dominant cause is network quality, backend performance, client behavior, or a combination.

## Community and network effects

| Observed signal | People | Records | Interpretation |
| --- | ---: | ---: | --- |
| Community navigation control | 7 | 32 clicks | Interest in the community area |
| Any recorded circle/community join | 3 | 5 events | Join activity; not five unique memberships |
| Social-circle join | 2 | 4 events | All marked `source = onboarding`; repeated circle IDs exist |
| Provider-community join | 1 | 1 event | Marked `source = onboarding`; current flow emits this for an auto-join |
| Home community-discovery opener | 1 | 1 event | Limited observed use of this specific entry point |
| Story-add tile | 4 | 6 clicks | Intent to add a story |
| Post composer FAB | 3 | 5 clicks | Intent to create a post |
| Story viewer interaction | 2 | 24 clicks | Interaction inside viewer, not a viewer-open count |
| Story-like button | 1 | 3 clicks | Reaction intent; not confirmed successful likes |

**Keep:** Community discovery, stories, and posting have visible interaction interest. Removing them now would ignore the gap between interaction telemetry and completion telemetry.

**Modify:** Focus on the end-to-end contribution and feedback loop: discover a relevant community → join → contribute or react successfully → receive a peer response → return. The current data covers only parts of that chain.

There are no dedicated recent events for successful post publication, comment/reply creation, story-upload success, or invite-recipient conversion in the discovered taxonomy. Autocaptured controls cannot reliably substitute for successful outcomes. There is also no usable group dimension in this project for quantifying community-level member density or peer-to-peer interaction.

**Network effect conclusion:** Not demonstrated. Join events and export actions are not enough to show that one member brings in another or that additional members make existing members return more often. Do not call the missing outcome events zero usage.

## Sharing and discovery

All included share-card events have `type = joined`:

| Share-card signal | People | Events |
| --- | ---: | ---: |
| Card shown | 9 | 11 |
| Native share completed | 2 | 2 |
| Download action | 3 | 3 |
| Either native share or download | 4 | 5 |
| Close-button interaction | 7 | 8 |

One person used both export routes, so the union is four rather than five people. The ordered shown → export funnel converts **4/9 people (44.4%) within one day**. Close-button users can overlap with exporters; closing does not demonstrate dissatisfaction. Download tracking records the initiated download action, not proof the image was saved or posted.

**Keep image export. Modify when it is offered.** The current automatic join-card popup reaches more included people than the check-in prompt, but the report does not show that it caused lower engagement. An inline or user-invoked prompt is a sensible test of whether the first visit can reach community value with less interruption.

No included circle-invite-share events or downstream invite acceptances were observed. The source data cannot show whether card sharing produced new users.

Explore reached **6/15 people (40.0%)**. Within Explore, two selected gym, one nutrition, and one yoga; categories overlap and the “all” view reached all six. Keep browsing as an interest/community-discovery route. These small category counts do not justify deleting a wellness category, and booking conclusions are intentionally excluded.

## Recommended sequence and tradeoffs

1. **Repair and measure the critical action paths.** Investigate Home/bootstrap timeouts, onboarding failures, and failed check-in/social actions. Expected benefit: users can complete the behavior the product already asks for. Cost: less feature delivery in the short term. Verify actual successful requests/actions and recovery rather than just fewer log events.
2. **Test a shorter first-value journey.** Route users to a relevant community and a successful first action before optional profile enrichment or an automatic share popup. Expected benefit: fewer interruptions before usefulness. Risk: lower profile completeness and fewer share exports. Measure onboarding completion, successful participation and return together.
3. **Test a repeatable weekly community reason to return.** For example, a community participation goal and visible response from peers. Expected benefit is hypothetical; this dataset has not validated a winning mechanism. Risk: prompts/rewards create activity without peer value. Measure successful actions on different days, consecutive eligible weeks, and peer-response return.
4. **Preserve exports and contribution features while closing measurement gaps.** Track publish/upload/reaction success and invitation attribution before using them to justify expansion or removal. Cost: instrumentation effort. Benefit: future decisions distinguish poor discovery, broken completion, and genuinely low demand.

### Removal decisions

**No entire feature should be removed on the strength of this window.** There are too few users and too many missing completion signals.

The reasonable removal/simplification candidates are *placements and steps*: optional profile setup before first value and the automatic share-popup interruption. Treat both as experiments with counter-metrics, not as proven causes of churn. Bookable-service functionality remains outside the decision scope, as requested.

## Measurement limits and proposed checks

- The governed metric catalog was empty. All report calculations are **one-off definitions**, not approved business metrics.
- An active day here means at least one authenticated `app_open` on a local calendar day. It does not mean meaningful participation.
- App-open events can repeat during authentication/restoration; 147 opens are not 147 visits or engagement successes.
- The main cohort is conditioned on a successful app-open event in this window. It does not estimate the total acquisition-to-authentication funnel or every pre-authentication failure.
- The project timezone is UTC. Primary date bounds and custom activity blocks explicitly use Addis Ababa time. A native weekly-retention query was also inspected, but its output uses Sunday UTC cohort buckets; it is not mixed into the local seven-day-block figures.
- Events for a person in the included cohort can precede that person's first successful open in the window. Thus issue-event incidence is not automatically an authenticated-session error rate.
- PostHog SDK collection, network loss, blockers, identity merges, repeated captures, and instrumentation changes can affect coverage. No sampling was requested; the returned aggregates do not establish statistical significance.
- People/person IDs count observed analytics identities, not independently verified individuals. No claims about causation, experiment lift, or population-wide retention are supported by this sample.
- Current repository code was inspected to interpret event semantics. It is not proof that the same code/version was deployed throughout the period.
- The completion-name union matters: one included user emitted `onboarding_complete`, another `onboarding_completed`. Looking at only the newer name would undercount observed completion.
- Record app surface separately from UI location. In the inspected wrapper, callers can overwrite `surface` with values such as `home`; filtering every event to `surface = telegram_miniapp` would lose legitimate activity.
- Future checks should use successful post/upload/reaction events, invite token/referrer and recipient conversion, reliable role/internal-user markers, and action/request outcome identifiers. These are recommendations only; no tracking changes were made.

## Evidence and reproducibility

All findings were queried live through the connected PostHog tools. No new saved insights were created.

Use the [project SQL workspace](https://us.posthog.com/project/508615/sql) for the SQL below and [Insights](https://us.posthog.com/project/508615/insights) for the typed-query configurations. Relevant method references: [PostHog funnels](https://posthog.com/docs/product-analytics/funnels), [retention](https://posthog.com/docs/product-analytics/retention), and [insights](https://posthog.com/docs/product-analytics/insights), retrieved through the connected documentation search.

### Common query rules

- Date range: the exact boundaries stated at the start of this report.
- `filterTestAccounts = false` in typed queries, because the four requested exclusions are supplied explicitly rather than through the empty existing cohort.
- Unique users: PostHog person IDs, not distinct browser IDs.
- All primary feature queries apply the authenticated-population predicate below.
- Aggregate feature reach: `query-trends`, `math = dau`, `ActionsTable` display, aggregated over the entire range. The returned table is unique people over the range, not a sum of daily unique counts.
- Combined reach uses OR groups for the two onboarding completion names, two join event names, and two share/export event names.
- Onboarding, check-in and sharing funnels use `query-funnel`, ordered steps, a one-day conversion window, and the same population/date filters. “Ordered” allows intervening events; no strict adjacency is required.

### Authenticated population predicate

```sql
properties.$host = 'wellcircle-hackathon.vercel.app'
  AND person_id NOT IN ('b8008753-7024-54df-9da5-9a25de6835a5','02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e','eeb112e8-8c9c-52f9-a495-74b5c4786dbd','786413bd-7ef5-522f-b74c-af481f6a8a5a')
  AND person_id IN (SELECT person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND event = 'app_open'
  AND properties.entry = 'telegram')
```

### Feature and diagnostic event inventory

The following executed query supplies the event counts and unique-person cross-checks:

```sql
SELECT event, count() AS events, uniq(person_id) AS people
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND person_id NOT IN ('b8008753-7024-54df-9da5-9a25de6835a5','02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e','eeb112e8-8c9c-52f9-a495-74b5c4786dbd','786413bd-7ef5-522f-b74c-af481f6a8a5a')
  AND person_id IN (SELECT person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND event = 'app_open'
  AND properties.entry = 'telegram')
GROUP BY event
ORDER BY events DESC
LIMIT 100
```

### Exact local-day and seven-day-block calculation

The following executed query supplies person-level activity counts. Its person-level results were aggregated into the anonymous frequency/block tables above; individual activity histories are not reproduced here.

```sql
SELECT person_id, count() AS opens, uniq(toDate(toTimeZone(timestamp,'Africa/Addis_Ababa'))) AS active_days, min(timestamp) AS first_open_in_window, max(timestamp) AS last_open_in_window, countIf(timestamp < toDateTime('2026-09-23 21:00:00','UTC')) AS week1, countIf(timestamp >= toDateTime('2026-09-23 21:00:00','UTC')
  AND timestamp < toDateTime('2026-09-30 21:00:00','UTC')) AS week2, countIf(timestamp >= toDateTime('2026-09-30 21:00:00','UTC')
  AND timestamp < toDateTime('2026-10-07 21:00:00','UTC')) AS week3, countIf(timestamp >= toDateTime('2026-10-07 21:00:00','UTC')
  AND timestamp < toDateTime('2026-10-14 21:00:00','UTC')) AS week4, countIf(timestamp >= toDateTime('2026-10-14 21:00:00','UTC')) AS final2days
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND person_id NOT IN ('b8008753-7024-54df-9da5-9a25de6835a5','02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e','eeb112e8-8c9c-52f9-a495-74b5c4786dbd','786413bd-7ef5-522f-b74c-af481f6a8a5a')
  AND person_id IN (SELECT person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND event = 'app_open'
  AND properties.entry = 'telegram')
  AND event = 'app_open'
GROUP BY person_id
ORDER BY opens DESC
LIMIT 100
```

### Diagnostic records by kind, route and message

```sql
SELECT event, properties.kind AS issue_kind, properties.path AS path, properties.message AS message, properties.status AS status, count() AS records, uniq(person_id) AS people
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND person_id NOT IN ('b8008753-7024-54df-9da5-9a25de6835a5','02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e','eeb112e8-8c9c-52f9-a495-74b5c4786dbd','786413bd-7ef5-522f-b74c-af481f6a8a5a')
  AND person_id IN (SELECT person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND event = 'app_open'
  AND properties.entry = 'telegram')
  AND event IN ('client_issue','checkin_failure')
GROUP BY event, issue_kind, path, message, status
ORDER BY records DESC
LIMIT 50
```

### Structural contribution/control evidence

These counts describe captured control interactions, not confirmed action outcomes.

```sql
SELECT control, count() AS captured_clicks, uniq(person_id) AS people
FROM (SELECT arrayJoin(elements_chain_ids) AS control, person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND person_id NOT IN ('b8008753-7024-54df-9da5-9a25de6835a5','02fa0d1a-6fbf-59c4-8ccc-dc4c8f6aa20e','eeb112e8-8c9c-52f9-a495-74b5c4786dbd','786413bd-7ef5-522f-b74c-af481f6a8a5a')
  AND person_id IN (SELECT person_id
FROM events
WHERE timestamp >= toDateTime('2026-09-16 21:00:00', 'UTC')
  AND timestamp < toDateTime('2026-10-16 21:00:00', 'UTC')
  AND properties.$host = 'wellcircle-hackathon.vercel.app'
  AND event = 'app_open'
  AND properties.entry = 'telegram')
  AND event = '$autocapture')
WHERE control IN ('nav-community','story-add-tile','story-file-input','story-viewer','story-like-btn','post-composer-fab','share-card-close-btn','share-card-share-btn','points-badge','header-notif-btn')
GROUP BY control
ORDER BY people DESC
LIMIT 30
```

### Exact funnel series

| Analysis | Ordered steps | Result |
| --- | --- | --- |
| Onboarding | `onboarding_step_view` filtered to name → goal → avatar → interest → frequency → circles → (`onboarding_complete` OR `onboarding_completed`) | 6 → 4 → 3 → 3 → 3 → 3 → 2 |
| Check-in | `checkin_prompt_view` → `checkin_prompt_click` → `checkin` | 5 → 1 → 0 |
| Share export | `share_card_shown` → (`share_card_shared` OR `share_card_downloaded`) | 9 → 4 |

