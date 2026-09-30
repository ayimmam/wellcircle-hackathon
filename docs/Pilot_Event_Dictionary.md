# Well Circle pilot event dictionary

Version: 1.0 · 30 September 2026 · Status: engineering draft pending product and Kuriftu approval

This dictionary separates observable product actions from pilot outcomes. Analytics must never be treated as proof that a server transaction succeeded; reconcile successful actions to API or database records. QA, staff, and synthetic accounts are excluded from pilot outcome denominators.

## Shared properties

| Property | Definition |
| --- | --- |
| `source` | Entry channel such as `onboarding`, `qr`, `circle_invite`, `explore`, or `direct`. Preserve QR/campaign tags through authentication. |
| `surface` | `telegram_miniapp` or `web` when known; action surfaces can further specify `home` or `community_detail`. |
| `group_type` | `provider_community` for check-in communities; `social_circle` for member-created circles. Never combine their membership counts. |
| `local_date` | Event date in `Africa/Addis_Ababa`; use server timestamps for canonical transaction dates. |
| `entity_id` | Stable server identifier for the community, circle, booking, or reward involved. |
| `is_qa` | True for controlled QA/staff accounts; filter these from pilot outcome counts. |

PostHog identity uses the authenticated Well Circle user ID. Controlled QA URLs may add `?qa=1`; this marks the browser session so the dashboard can exclude its actions. Do not send Telegram `initData`, access tokens, full phone numbers, or health details as event properties. Anonymous QR visits remain a separate cohort until identity can be joined lawfully and reliably.

## Canonical actions

| Event | Trigger and success condition | Required properties / deduplication |
| --- | --- | --- |
| `explore_view` | Explore surface or category changes. This is a view, not a unique user. | `view`, `category` (`all` when unfiltered), `surface`; one per distinct view/category state. |
| `onboarding_step_view` | A named onboarding step is displayed. | `step`, `step_index`; views may repeat after back navigation. |
| `onboarding_completed` | Onboarding API succeeds. | `selected_community_count`, `joined_community_count`, goal/frequency fields; one per successful completion. |
| `community_joined` | Server confirms a provider-community membership. | `community_id`, `group_type=provider_community`, `source`; deduplicate by user + community membership. |
| `circle_joined` | Circle API confirms a social-circle join. | `circle_id`, `group_type=social_circle`, `source`; deduplicate by user + circle membership. |
| `checkin_attempt` | Client sends a check-in request. | `community_id`, `surface`; attempts can repeat. |
| `checkin` | Check-in API returns success. | `community_id`, `surface`, `streak`; reconcile by feed-event ID / user / Addis date. |
| `checkin_failure` | Check-in request fails. | `community_id`, `surface`, `status` (`409`, HTTP code, `network`, `unknown`); no auth payload. |
| `booking_start` | Booking flow opens. | `provider_id`, `source`, `surface`; unique starts use user + session. |
| `booking_requested` | Booking API creates a persisted request. | `booking_id`, `provider_id`, service, days, amount and payment status; deduplicate by booking ID. This does not mean staff accepted it. |
| `booking_confirmed` (legacy) | Historical feed/notification label used for a payment-success side effect. | Do not use it as the new staff-acceptance event or in the booking acceptance denominator; retain historical dashboards with this annotation. |
| `booking_accepted` / `booking_rejected` / `booking_fulfilled` / `booking_cancelled` | The corresponding server lifecycle transition succeeds. | `booking_id`, actor/source; reconcile to persisted status history or booking row. |
| `share_card_shown` | Share card is rendered. | `card_instance_id`, milestone type; a unique shown card is one instance. |
| `share_card_downloaded` / `share_card_shared` | User completes the respective action. | Same `card_instance_id`; each repeat is a separate action. |
| `day1_return` / `day7_return` | Derived scorecard outcome: authenticated user completes a qualifying action within the window after first activation. | Derived from successful server events, not emitted by opening the app. Preserve historical app-open retention separately. |

## Scorecard definitions to ratify

- Open-to-explore = distinct eligible openers with an Explore view ÷ distinct eligible openers. Baseline 12/15 = 80%.
- Explore-to-request-start = distinct explorers with a booking start ÷ distinct explorers. Baseline 6/12 = 50%.
- Open-to-request-start = distinct openers with a booking start ÷ distinct openers. Baseline 6/15 = 40%.
- Booking acceptance = persisted requests accepted within one business day ÷ eligible persisted requests with a complete service, slot, price, and reachable contact.
- Check-in completion = distinct eligible users with a successful persisted check-in ÷ distinct eligible users who attempted one. Report HTTP failures separately.
- Day 1 and Day 7 action retention use first qualifying activation as cohort entry and successful server actions in the following observation windows. Use at least 20 mature users per read; otherwise report insufficient evidence.
- Event coverage rates require a defined source population. For card downloads, compare unique download sessions with a preceding card-show event and report anonymous unmatched sessions separately.

All target percentages in the implementation plan remain proposals until Anteneh and the Kuriftu pilot representative approve numerators, denominators, exclusions, observation windows, and minimum cohort size.
