# Applying The Cold Start Problem to WellCircle

Source: Andrew Chen, *The Cold Start Problem* (2021), supplied in `docs/Book.pdf`.
Page references below use printed book pages; PDF page numbers are eight higher.
These are product hypotheses derived from the book, not proven WellCircle outcomes.

## Highest value applications

| Priority | Insight and source | WellCircle application |
| --- | --- | --- |
| 1 | Start with a small network that delivers value consistently. Chapter 6, pp. 71-79. | Concentrate onboarding in one or two communities that match the member's interests. Rank by distinct weekly check-in participants before lifetime membership. |
| 2 | Reduce the steps to an experience that demonstrates the network's value. Chapter 10, pp. 111-119. | Home recommends a community directly until membership is confirmed; the existing Home check-in then provides the first daily action. The empty-directory fallback opens Explore explicitly. |
| 3 | Close the loop between a member's action and other participants. Chapter 19, pp. 204-207. | After a successful daily check-in, offer the community activity feed so the member can see and encourage others. Track first check-ins and visits to community activity. |

## Implemented behavior

- Both the Telegram frontend and standalone web frontend use the same ranking rules: interest match, weekly participation, then membership count. Missing activity data from an older backend does not claim that a community is active or inactive.
- Onboarding reserves its two suggestion slots for relevant provider communities first. Public free social circles fill remaining slots; private and paid circles stay excluded. Selections remain optional and can be undone before submission.
- Discovery cards and onboarding show the actual number of distinct members who checked in during the past rolling seven days. Zero activity invites the member to be the first; it does not invent social proof.
- The backend calculates `active_members_7d` in one aggregate query across the bounded community list. Repeat check-ins by one person count once; signup events, older events and future timestamps do not count. No database migration is required.
- Home waits for the directory response and avoids showing a join prompt when the user record already confirms membership. A recommended community opens its detail screen; when no recommendation exists, the button opens the Explore tab.
- Check-in success now leads to an invitation to community activity. The existing points, server-confirmed check-in, error recovery and streak flow remain the source of truth.

## Pilot and measurement

Use one provider-led group with a shared wellness interest as the first pilot network. Choose a provider willing to host a recurring activity and personally welcome new members. Start with its existing customers or one workplace team; recruit adjacent groups after members reliably participate and respond to each other. The book's chapter 7, pp. 81-89, motivates supporting providers and community hosts as the scarce contributors. This operational work is proposed; no invitations or messages were sent.

In PostHog, compare onboarding cohorts before and after this release, segmented by the first community joined and surface. Use existing `onboarding_completed`, `community_joined`, `checkin` and `app_open` events with:

- `community_start_view`: exposure to the persistent Home community prompt.
- `community_discovery_open`: includes the recommended community ID, or null for directory discovery.
- `first_checkin`: successful check-in when the previous longest streak is zero and the confirmed current streak is one.
- `community_activity_open`: visit from the completed check-in card (`source=home_after_checkin`).

Measure the share of onboarded users who join and check in within 24 hours, median time to first check-in, repeat check-ins within seven days, and day-7 return rate. Also inspect weekly distinct participants per community and whether new members receive a response to their posts. A check-in is an activation proxy; a meaningful interaction is stronger evidence of network value. Client analytics are best effort and can miss events, so reconcile check-in totals with the backend before making rollout decisions.

Treat a before/after improvement as a correlation. Use randomized cohorts if traffic supports an experiment, as chapter 19, pp. 199-204 recommends. Avoid copying the book's numerical examples as universal thresholds for this pilot. No retention improvement has been measured yet.

## Deferred ideas

Referral rewards, more broadcast reminders and expansion into many new groups have lower immediate value while local participation is sparse. Validate the initial groups and provider capacity first. Geographic ranking needs reliable neighborhood data; the current implementation claims interest relevance only.
