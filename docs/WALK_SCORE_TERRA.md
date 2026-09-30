# Walk Score via Terra

## Setup

1. Apply `backend/supabase/migrations/023_walk_score.sql` in the Supabase SQL editor before deploying the API. The Alembic revision `023_walk_score.py` expresses the same migration for environments that run Alembic; do not apply both independently.
2. In Terra Dashboard, enable the cloud integrations your account supports and configure the HTTPS webhook destination as `https://<backend-host>/api/wearables/webhook`. Subscribe to `auth`, `user_reauth`, `deauth`, `access_revoked`, and `daily`. Copy the **webhook signing secret** to the backend. Do not put it in Vite variables.
3. Set `TERRA_DEV_ID`, `TERRA_API_KEY`, `TERRA_WEBHOOK_SECRET`, and `TERRA_PROVIDERS` on the backend. Set the last value to the exact enabled provider enums. The default list is `FITBIT,GARMIN,STRAVA,GOOGLE`.
4. Deploy the backend and frontend. No frontend secret is needed. Open Profile → Integrations → Connect Fitness Tracker. Terra's external widget collects consent; the Mini App refreshes connection status on return and during the first 90 seconds.

## Accounting

Terra `daily` payloads provide cumulative steps for each provider's local activity date. `wearable_daily_steps` stores the largest total observed per provider/date; `walk_score_days` stores the largest verified total across providers/date. Only a positive increase in that second watermark increments `users.walk_score`. The user row is locked for each webhook so concurrent requests on separate serverless workers cannot both add the same delta. `last_sync_timestamp` reports when a payload was processed; it is not a deduplication key, because older days can be revised after newer ones.

The score starts at zero and can include historical days if Terra sends them after connection. It is a monotonic game score: downward corrections do not reduce an earned score. Multiple providers for one day are merged by taking the largest total, which avoids straightforward double counting but can undercount two independent devices that record disjoint walks. This is deliberate until a verified per-sample deduplication strategy exists.

Only Terra-signed webhooks can add steps. The migration's trigger also blocks Supabase `anon` and `authenticated` roles from editing the score despite the existing broad `users_update_own` policy. Terra and connected providers may still accept manually edited fitness data; this design cannot prove physical walking. A 100,000-step daily ceiling rejects extreme totals, but is not a fraud guarantee. Google Fit's cloud integration and Samsung Health → Google Fit sync availability depend on the user's apps and Terra's enabled integration; direct Health Connect/Samsung Health access requires a native SDK and is not available inside a Telegram WebView.

## Verification

```bash
cd backend
./.venv/bin/python -m app.tests.test_walk_score
cd ../frontend
npm test -- --run src/test/WalkScore.test.jsx
npm run build
```

For a live smoke test, connect a Terra test account, confirm `/api/wearables/status` changes to `connected: true`, send a signed daily test payload twice, and verify the second delivery adds zero steps. Confirm that increasing the same date by 100 adds exactly 100. Do not post unsigned sample payloads to production.
