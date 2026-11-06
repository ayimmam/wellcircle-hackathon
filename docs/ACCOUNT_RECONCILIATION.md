# Phase D — Duplicate Account Reconciliation

**Status: read-only investigation + dry-run tool implemented. No destructive
merge is enabled.**

The investigation found several places where a merge would have to choose a
business rule that does not exist in the product yet (points aggregation,
Circler profile conflicts, multiple Telegram identities, provider/admin roles,
external wearable identity, source-row retention/audit). Phase D therefore
implements the complete ownership map and a side-effect-free planner. It does
not delete, merge or reassign anything.

The canonical account is always an existing `users.id`; no third user is
created.

---

## 1. Complete user-data ownership map

`users` is the canonical account row. The source row is **retained** in every
future design so audit references and foreign keys remain valid; it is never
deleted as part of a merge.

Strategies:

* `direct_transfer` — move the ownership column to the canonical UUID.
* `dedupe` — move rows, merging duplicate composite-key rows into one.
* `aggregate` — the row is history, but a cached/derived value needs an
  approved aggregation rule.
* `special` — a business/identity decision is required before moving.
* `never_auto` — audit or ephemeral rows are never rewritten.
* `not_user_owned` — no user ownership column; untouched.

| Table | User ownership column | Relationship | Data sensitivity | Merge strategy |
| --- | --- | --- | --- | --- |
| `users` | `id` | canonical account row; source retained | critical | special |
| `auth_identities` | `user_id` | many-to-one `users.id` (CASCADE) | authentication | special |
| `account_link_challenges` | `user_id` | many-to-one `users.id` (CASCADE) | authentication, ephemeral | never_auto |
| `bookings` | `user_id` | many-to-one `users.id` | financial / personal | direct_transfer |
| `point_transactions` | `user_id` | many-to-one `users.id` | financial | aggregate |
| `user_redemptions` | `user_id` | many-to-one `users.id` | financial / fulfilment | direct_transfer |
| `posts` | `user_id` | many-to-one `users.id` | content | direct_transfer |
| `reactions` | `user_id` | many-to-one `users.id` | content / social | dedupe |
| `post_comments` | `user_id` | many-to-one `users.id` | content | direct_transfer |
| `community_members` | `user_id` | composite PK `(community_id, user_id)` | membership | dedupe |
| `community_feed_events` | `user_id` | many-to-one `users.id` | activity | direct_transfer |
| `challenge_awards` | `user_id` | unique `(challenge_id, user_id)` | gamification | dedupe |
| `circle_members` | `user_id` | composite PK `(circle_id, user_id)` | membership | dedupe |
| `circle_subscriptions` | `user_id` | unique `(circle_id, user_id, period_start)` | financial | direct_transfer |
| `circle_stories` | `user_id` | many-to-one `users.id` | content | direct_transfer |
| `circle_story_views` | `user_id` | composite PK `(story_id, user_id)` | activity | dedupe |
| `stories` | `user_id` | many-to-one `users.id` | content | direct_transfer |
| `story_views` | `user_id` | composite PK `(story_id, user_id)` | activity | dedupe |
| `story_likes` | `user_id` | composite PK `(story_id, user_id)` | social | dedupe |
| `feedback` | `user_id` | many-to-one `users.id` | support / personal | direct_transfer |
| `user_notifications` | `user_id` | many-to-one `users.id` (CASCADE) | activity | direct_transfer |
| `evidence_submissions` | `submitter_user_id` | many-to-one `users.id` | content / moderation | direct_transfer |
| `trainer_verifications` | `user_id` | one-to-one `users.id` (UNIQUE) | verification / personal | direct_transfer |
| `strava_activity_cache` | `user_id` | many-to-one `users.id` (CASCADE) | health | direct_transfer |
| `user_wearables` | `user_id` | many-to-one `users.id` (CASCADE) | health / external identity | special (blocked when active) |
| `wearable_daily_steps` | `wearable_id` | many-to-one `user_wearables.id` | health | special |
| `walk_score_days` | `user_id` | PK `(user_id, activity_date)` | health | aggregate |
| `followers` | `follower_id`, `following_id` | composite PK, many-to-many `users.id` | social | dedupe |
| `circles` | `owner_id` | many-to-one `users.id` | business / ownership | special (blocked) |
| `providers` | `owner_user_id` | many-to-one `users.id` | business / ownership | special (blocked) |
| `provider_events` | `staff_user_id` | many-to-one `users.id` | business / staffing | special (blocked) |
| `provider_invites` | `created_by_user_id`, `used_by_user_id` | many-to-one `users.id` | business / audit | never_auto |
| `admin_notifications` | `admin_user_id`, `related_user_id` | many-to-one `users.id` | admin audit | never_auto |
| `booking_status_events` | `actor_user_id` | many-to-one `users.id` (SET NULL) | financial audit | never_auto |
| `circle_revenue_ledger` | `subscription_id` | derived from `circle_subscriptions` | financial | not_user_owned |
| `event_inventory_log` | `booking_id` | derived from bookings/events | financial audit | not_user_owned |
| `chat_memory` | `owner_id` where `owner_type='user'` | **no FK**; chatbot ownership key | conversation history | direct_transfer |
| `chat_profile` | `owner_id` where `owner_type='user'` | **no FK**; PK `(owner_type, owner_id)` | personalization | special (conflict-blocked) |
| `communities` | — | provider-owned | — | not_user_owned |
| `community_challenges` | — | community-owned | — | not_user_owned |
| `products` | — | provider-owned | — | not_user_owned |
| `provider_promotions` | — | provider-owned | — | not_user_owned |
| `provider_subscriptions` | — | provider-owned | — | not_user_owned |
| `whatsapp_otp_challenges` | — | phone-only ephemeral auth | — | not_user_owned |

### Classification

1. **Directly transferable:** `bookings`, `user_redemptions`, `posts`,
   `post_comments`, `community_feed_events`, `circle_stories`, `stories`,
   `feedback`, `user_notifications`, `evidence_submissions` (submitter),
   `strava_activity_cache`, and `chat_memory` (without session-id collisions).
2. **Requiring deduplication:** `community_members`, `circle_members`,
   `challenge_awards`, `circle_story_views`, `story_views`, `story_likes`,
   `followers`, `reactions` (semantic duplicate), and duplicate
   `auth_identities` pairs.
3. **Requiring aggregation:** `point_transactions`/`users.points_balance`,
   `walk_score_days`/`users.walk_score`, and streak counters
   (`current_streak`, `longest_streak`, `freeze_count`).
4. **Requiring special business rules:** `users` profile/credentials/roles,
   `auth_identities` (Telegram/WhatsApp uniqueness), `chat_profile`
   preferences/consent, `trainer_verifications`, `user_wearables`,
   `circles.owner_id`, `providers.owner_user_id`, `provider_events.staff_user_id`,
   and `users.referred_by`.
5. **Never automatically transferred:** `account_link_challenges`,
   `provider_invites`, `admin_notifications`, `booking_status_events.actor_user_id`,
   `evidence_submissions.reviewed_by`, `trainer_verifications.reviewed_by`,
   `user_notifications.actor_user_id` (no FK), and the source `users` row.
6. **Not safe to merge automatically:** active Terra wearables, provider/admin
   accounts, conflicting Circler profiles, conflicting Telegram/WhatsApp
   identities, and any table whose unique constraint would require deleting a
   user-owned row.

### Supabase/Circler functions

`public.append_chat_turn(...)` is the only owner-aware write RPC. It locks the
`chat_memory` row, checks `(owner_type, owner_id)` while holding the lock and
rejects a different owner. A future merge must update `owner_id` directly under
the same transaction/row lock; it must not call the RPC with a new owner, and it
must never weaken the RPC's ownership check. `chat_memory`'s original base DDL
is not in this repository, so its PK/RLS/grants require a target-project check.

Supabase RLS policies reference `auth.uid()` (`backend/apply_rls.py`), but the
application uses its own JWT and server-side DB role. There is no formal FK to
`auth.users`; no `auth.users` row is merged or deleted by this plan. If
client-direct Supabase access is enabled for the affected tables, the RLS
impact of changing `users.id` references must be reviewed separately.

### Tables with no formal foreign key

These were found by repository search, not by FK metadata:

* `chat_memory.owner_id` / `owner_type` — the chatbot ownership key.
* `chat_profile.owner_id` / `owner_type` — the chatbot profile key.
* `user_notifications.actor_user_id` — actor reference with no FK.
* `point_transactions.reference_id` — polymorphic trigger reference, not
  ownership.
* `bookings.booking_group_id` — correlation id, not a user reference.
* `users.referred_by` — self-FK, not a normal owned row.

---

## 2. Data conflicts discovered

| Conflict | Evidence in schema/code | Why automatic merge is unsafe |
| --- | --- | --- |
| Multiple Telegram identities | `users.telegram_id` is a single UNIQUE column and the bot resolves by it; `auth_identities` can hold another Telegram subject | One source identity would become unreachable or one user row would need two values |
| Phone/WhatsApp conflict | `users.phone_number` is a single field; WhatsApp identity resolves by phone | Two different verified phones cannot both remain credentials |
| Strava conflict | `users.strava_athlete_id` is UNIQUE | One user row cannot point at two athletes |
| Referral conflict/self-referral | `users.referred_by` self-FK; referral credit is a ledger reward | Choosing one referrer silently discards the other's reward relationship |
| Pin-bot bonus | partial unique index `uq_point_transactions_pin_bot_bonus (user_id) WHERE type='pin_bot_bonus'` | Both accounts may hold one; keeping both violates the index, deleting one loses history |
| Challenge award | unique `(challenge_id, user_id)` | Both accounts may have the same award |
| Circle subscription | unique `(circle_id, user_id, period_start)` | Both accounts may have the same paid period |
| Booking idempotency | unique `(user_id, idempotency_key)` | Same key can exist once per account |
| Trainer verification | unique `user_id` | One canonical user cannot have two verification rows |
| `chat_profile` | PK `(owner_type, owner_id)` | Both owners may have different names/preferences; one row cannot silently replace the other |
| Terra wearable | `user_wearables.reference_id` is the user UUID used by Terra webhooks | Repointing the row does not change Terra's stored reference; future events would target the merged source |
| Provider/admin roles | `providers.owner_user_id`, `is_provider`, `login_username`, `password_hash`, `is_super_admin` | Merging roles/credentials can escalate privileges or break the provider portal |
| Audit references | `booking_status_events.actor_user_id`, `evidence_submissions.reviewed_by`, `trainer_verifications.reviewed_by`, `admin_notifications`, `provider_invites` | Rewriting audit history is not a data transfer; source row retention preserves it |
| Ephemeral auth rows | `account_link_challenges`, `whatsapp_otp_challenges` | Not durable user data; must expire rather than transfer |
| Social self-edges | `followers` composite PK | Repointing can create `(canonical, canonical)` edges and duplicate edges |
| Chat session collision | `chat_memory.session_id` is a PK | A collision would block a simple `owner_id` update |

Additional conflict found in code: `CircleMember.weekly_points` is a dead column
(leaderboards recompute weekly points from `point_transactions`), so it should
not be summed.

---

## 3. Dry-run tool

### User-facing endpoint (canonical from JWT, source from fresh provider proof)

```http
POST /api/account-reconciliation/dry-run
Authorization: Bearer <canonical user JWT>
Content-Type: application/json

{
  "source_provider": "google",
  "google_id_token": "<fresh Google/Firebase ID token>"
}
```

or:

```json
{
  "source_provider": "telegram",
  "telegram_login": { "...": "fresh Login Widget callback" }
}
```

The source account is discovered from the server-verified subject using the
same verifier/lookup as login and Phase B linking. The client cannot supply a
source UUID or subject. A proof that resolves to the canonical account returns
`400 SAME_ACCOUNT`; an unlinked identity returns `404` with a non-enumerating
message. No challenge is created and neither account row is written. The endpoint uses a
read-only auth dependency that does **not** run the normal `last_activity_at`
touch. Phase F adds a short-lived `api_rate_limits` counter row before the
provider proof is checked; that operational row is the only write, and it
contains no proof, token or account data.

### Super-admin endpoint (explicit UUIDs, support/operations)

```http
POST /api/admin/accounts/reconciliation/dry-run
Authorization: Bearer <super-admin JWT>

{
  "canonical_user_id": "11111111-1111-1111-1111-111111111111",
  "source_user_id": "22222222-2222-2222-2222-222222222222"
}
```

### CLI (local/disposable DB only)

```bash
cd backend
python reconcile_accounts_dry_run.py \
  --canonical 11111111-1111-1111-1111-111111111111 \
  --source    22222222-2222-2222-2222-222222222222 --pretty
```

The CLI refuses a non-local database unless
`RECONCILIATION_ALLOW_REMOTE=1` is explicitly set. It only issues SELECTs.

### Example output (trimmed)

```json
{
  "canonical_user_id": "11111111-1111-1111-1111-111111111111",
  "source_user_id": "22222222-2222-2222-2222-222222222222",
  "read_only": true,
  "merge_implemented": false,
  "safe_to_merge": false,
  "merge_status": "blocked_pending_rules",
  "blockers": [],
  "manual_decisions": [
    {
      "code": "POINTS_AGGREGATION_RULE",
      "table": "point_transactions",
      "message": "Define the approved balance rule (and ledger-break handling) before merging cached points_balance and ledger history."
    }
  ],
  "summary": {
    "canonical": { "providers": ["telegram"], "points_balance": 120 },
    "source": { "providers": ["google"], "points_balance": 80 },
    "total_tables_inspected": 44,
    "transferable_records": 3,
    "duplicate_records": 1,
    "conflicting_records": 0,
    "excluded_records": 0
  },
  "circler": {
    "chat_memory": {
      "canonical_count": 1,
      "source_count": 2,
      "transferable": 2,
      "duplicates": 0,
      "conflicts": 0
    },
    "chat_profile": {
      "canonical": { "exists": true, "display_name_present": true, "preference_keys": [] },
      "source": { "exists": false, "preference_keys": [] },
      "display_name_conflict": false,
      "conflicting_preference_keys": []
    }
  },
  "unresolved_rules": [
    "POINTS_AGGREGATION_RULE",
    "CHAT_PROFILE_MERGE",
    "MULTIPLE_TELEGRAM_IDENTITIES",
    "ACTIVE_WEARABLE_EXTERNAL_IDENTITY",
    "PROVIDER_AND_ADMIN_ROLES",
    "SOURCE_ACCOUNT_RETENTION",
    "AUDIT_TRAIL"
  ]
}
```

The planner never returns conversation text, names, emails, phone numbers,
handles, provider subjects, hashes or tokens. It returns counts, provider
names, booleans and preference **keys**.

---

## 4. Circler preservation

* `chat_memory` has no formal FK. A future transfer must update
  `owner_id` to the canonical UUID while leaving `session_id`, `messages` and
  `updated_at` untouched. Any `session_id` collision blocks the merge.
* `chat_profile` has PK `(owner_type, owner_id)`, so the source and canonical
  rows cannot both simply be repointed. The dry run reports:
  * existence on each side;
  * whether a display name is present (not its value);
  * whether preference consent was recorded;
  * preference **keys**;
  * conflicting keys where both sides hold different values.
* A future merge may only combine non-conflicting keys under an explicit
  consent decision; conflicting names/keys are blockers, never silent
  overrides. The source row must be retained for audit.
* Future Circler requests use the canonical JWT `sub`; existing source JWTs
  expire normally. New source logins are prevented by moving/rejecting
  identities in the approved future design.

---

## 5. Why no destructive merge was enabled

A safe merge requires all of the following decisions, none of which is present
in the current product/architecture:

1. **Points:** `points_balance` is a cached, floor-at-zero value while
   `point_transactions` is immutable history. Summing cached balances can
   diverge from the ledger; the `pin_bot_bonus` partial unique index can also
   conflict. Need an approved balance/bridge rule.
2. **Circler profile:** conflicting display names and preference keys need an
   explicit user choice and consent record.
3. **Identities:** the single `users.telegram_id`/`phone_number` model cannot
   represent a second Telegram/WhatsApp identity; the bot resolves by the
   single column.
4. **Wearables:** Terra stores the source UUID as `reference_id`; repointing
   the row does not update Terra. The connection must be deactivated and
   reconnected.
5. **Roles:** provider ownership, provider-portal credentials and super-admin
   flags are business/privilege decisions and must be handled administratively.
6. **Audit and source retention:** the source `users` row cannot be deleted
   without cascading or orphaning audit references. A `merged_into_user_id`
   marker and reconciliation audit tables do not exist yet.
7. **Two-account confirmation:** a fresh, single-use confirmation challenge
   bound to both verified users (not just a read-only query) is not
   implemented.
8. **Unique conflicts:** challenge awards, circle subscriptions, booking
   idempotency, trainer verification and pin-bonus rows may require keeping two
   user-owned rows, which the schema forbids.
9. **Walk score:** same-day step rows need a max/sum decision before
   recomputing the cached score.

Until these are approved, `safe_to_merge` is always `false` and no merge
endpoint exists.

---

## 6. Tables deliberately excluded from any automatic merge

* `account_link_challenges`, `whatsapp_otp_challenges` — ephemeral auth.
* `admin_notifications` — admin audit.
* `booking_status_events.actor_user_id` — historical actor.
* `evidence_submissions.reviewed_by`, `trainer_verifications.reviewed_by` —
  reviewer audit.
* `provider_invites.created_by_user_id` — business/audit provenance.
* `user_notifications.actor_user_id` — actor reference without FK.
* `circle_revenue_ledger`, `event_inventory_log` — derived financial/audit
  records; never rewritten directly.
* `communities`, `community_challenges`, `products`, `provider_promotions`,
  `provider_subscriptions` — provider/community-owned, not user-owned.
* The source `users` row — retained for audit/FKs; never deleted by the planner.

---

## 7. Migration requirements

**Planner: none.** The planner adds no business table or column and performs no
target writes. Phase F adds migration `035` for the ephemeral
`api_rate_limits` counter table used before the planner runs; it stores only
user id, action and timestamp.

A future destructive merge would require a separate, reviewed migration (not
created in Phase D):

* `users.merged_into_user_id UUID NULL REFERENCES users(id)` plus
  `users.merged_at TIMESTAMPTZ NULL`; unique/index so a source can only be
  merged once.
* `account_reconciliation_runs` (id, canonical_user_id, source_user_id,
  status, plan JSONB, blockers JSONB, performed_by, created_at, completed_at).
* `account_reconciliation_actions` (run_id, table, action, row_count,
  conflict_count) for an auditable per-table summary.
* No changes to points/challenge/subscription/telegram uniqueness constraints
  without an explicit product decision; those conflicts remain blockers.
* A separate confirmation-challenge table bound to both verified accounts.

The exact `chat_memory` base-table DDL is not in this repository (only the
ownership/profile migrations), so a future merge must verify the target
project's actual PK/RLS/grants before writing to it.

---

## 8. Tests

Run the unit/integration suite:

```bash
cd backend
pytest app/tests/test_account_reconciliation.py -q
```

Live PostgreSQL (disposable database only):

```bash
DISPOSABLE_DB=postgresql://postgres@127.0.0.1:<port>/phasea_recon \
  pytest app/tests/test_account_reconciliation_pg.py -q
```

Covered:

* dry run does not modify any target row (table counts, user rows, chat rows and
  profile rows compared before/after);
* canonical/source IDs derived from JWT + verified proof, not client IDs;
* unauthorized/missing JWT rejected;
* same account and missing accounts rejected;
* 409-style duplicate/unique conflicts detected (booking idempotency, challenge
  award, pin-bonus, circle membership, trainer verification);
* provider/admin/credential/active-wearable blockers;
* multiple Telegram, phone, Strava and referral conflicts;
* Circler chat/profile counts and conflicting preference keys;
* PII/chat text/provider subjects/tokens absent from the report;
* live jsonb `chat_memory`/`chat_profile` read without mutation;
* existing backend suite unchanged.

---

## 9. Production/shared database safety

No shared or production database was accessed or modified. The live test ran
only against the disposable local PostgreSQL database `phasea_recon` on the
loopback interface. The planner and both endpoints issue SELECTs only against account/Circler
data; the Phase F rate limiter may insert one short-lived counter row before a
request is accepted. The CLI refuses non-local targets by default. No migration, commit, push, merge
or deployment was performed.
