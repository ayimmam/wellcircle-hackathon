# Phase H — CI/CD verification pipeline report

Status at write time: **CI configuration prepared locally; feature branch is NOT
yet ready to merge to `dev` until a clean CI run and documented baseline issues
are closed.**

## 1. Existing workflows discovered

Root-level `.github/workflows/`:

- `ci.yml` — existing standing gate. It runs `frontend` lint/test/build,
  `web` build/parity/test, `backend`, `chatbot`, `telegram-bot`, and an npm
  audit. It is already reasonably complete for the base repo, but its trigger
  list is `dev`/`main` only.
- `deploy-cpanel-web.yml` — production website/cPanel deployment gating.
- `promote-dev-to-main.yml` — intentional human merge promotion workflow.
- `.github/dependabot.yml` — existing dependency updates.

Testing/config already present:

- Backend: pytest, `requirements.txt`, SQLite test boilerplate, no pytest config.
- Chatbot: pytest plus `migration_check.py` / `quality_eval.py`.
- Frontend: Vitest config, `vite.web.config.js`, `npm test`, `npm run test:web`,
  website production build, parity check, ESLint.
- Migration: Phase F introduced a working `backend/alembic.ini` + standard env.
  Phase F/A/B/C/D migration tests already use `DISPOSABLE_DB` and simulate the
  post-032 schema directly — there is no invented historical base migration.
- Browser testing: no Playwright/real-browser runtime is already present.

## 2. Changes made

- Added `.github/workflows/integrated-br-ci.yml`, a feature-branch companion
  workflow to the existing `ci.yml`. It triggers on:
  - `feature/circler-chat-experience` push;
  - PRs targeting `dev` and the feature branch;
  - manual dispatch.
  I deliberately did not change the existing `dev`/`main` workflow, which stays
  usable unchanged.
- Jobs included:
  - **backend** — full FastAPI suite on disposable Postgres, `compileall`, plus
    a no-external-service smoke run.
  - **migrations** — migration chain 032 → 035, exactly one head, upgrade from
    a deliberately created post-032 schema, schema/index/FK inspection, then the
    existing revision-level drift/downgrade drills. No production endpoint.
  - **chatbot** — full suite, static migration checks, quality evaluations,
    ownership/continuity subset, syntax gate.
  - **frontend-lint**, **frontend-test**, **frontend-build**,
    **web-tests**, **web-build** — lint, full default suite, Mini App build,
    web suite, and website build/parity.
  - **browser-staging** — deliberately disabled placeholder, representing
    real-browser/staging E2E rather than pretending to run it.
  - **security-artifacts** — npm audit and a tracked-secret-like file scan.
- No existing test was weakened, skipped, or replaced.
- No staging credentials are required for this workflow.
- No hosted staging, hosted Supabase, or hosted browser-hosted service is
  introduced.

## 3. Tests covered by CI

### Backend

- Full backend suite.
- Identity consistency.
- Account linking (Telegram ↔ Google, both directions).
- Account reconciliation dry run.
- Circler ownership and continuity.
- Dry-run rate limiting.
- CORS allow-list, security headers and security middleware.
- Identity journeys, `conflict path`, client-supplied proof safety.
- `mypy`/type checking intentionally not introduced because it is not an
  existing project contract.

### PostgreSQL migration job

- Chain `032 → 033 → 034 → 035` with exactly one head.
- Upgrade from a deliberately created minimal post-032 schema.
- Table/index/FK inspection.
- Drift detection for 033/034/035.
- Safe downgrade behavior via the existing revision tests.
- No connection to a production or shared database.

### Chatbot

- Full suite.
- Conversation ownership tests.
- Linked identity continuity tests.
- Anonymous session isolation and invalid/expired-JWT rejection.
- Static migration checks.
- Quality evaluations.

### Frontend / website

- `npm run lint`.
- Full default frontend suite.
- Web API/UI/parity tests.
- Website production build.
- Mini App production build.
- `check:parity`.
- Connected Accounts, linking UI, dry-run, cancellation, and security-header
  tests are all part of the suite.
- Existing rate-limit, CORS and auth regression tests also run.
- Route tests include the new Connected Sign-ins route.

## 4. Tests that still require staging

These cannot be honestly replaced by ordinary CI:

- Real Telegram Mini App login.
- Real Telegram Login Widget login.
- Real Google/Firebase login.
- Hosted Supabase/PostgREST/RLS/service-role verification.
- Real Circler `chat_memory`/`chat_profile` ownership on hosted Supabase.
- Real staged Telegram/Google account → link → sign-out → provider login.
- Real browser/CSP/security-header behavior (not mocked).
- Real staged mobile/desktop layout screenshots.
- Account reconciliation dry run against staged duplicate accounts.

The `browser-staging` placeholder is deliberately disabled rather than faked.

## 5. Test execution results locally

| Suite | Result |
|---|---|
| Backend full suite, disposable PostgreSQL | **166 passed, 0 skipped** |
| Live migration tests (033/034/035/recon) | **11 passed** |
| CORS/security-header tests | **11 passed** |
| Rate-limit tests | **3 passed** |
| Phase A identity tests | **21 passed** |
| Phase B linking tests | **33 passed** |
| Phase D dry-run tests | **13 passed** |
| Phase E identity journeys | **4 passed** |
| Chatbot suite | **251 passed** |
| Chatbot migration checks | **47/47 passed** |
| Chatbot quality evaluations | **23/23 passed** |
| Web suite | **122 passed, 1 failed** (known lazy-load timing) |
| Default frontend suite | **501 passed, 3 failed, 1 skipped** (known baseline/UI timing issues) |
| Website production build | **Passed** |
| Mini App production build | **Passed** |
| Web parity check | **Passed** |
| Workflow YAML validation | **Passed** |
| Backend `compileall` | **Passed** |
| Local migration job script drill | **10 migration tests passed** |

## 6. Known baseline failures

- `parity.test.jsx > lets browser users sign out ...` is a lazy-chunk/timing
  condition in this environment; it also affects the untouched base.
- `ForYouScreen.joinCard.test.jsx`, `NotificationsScreen.test.jsx`, and
  one streak-image test are baseline/UI environment failures, not new Phase
  changes. They also reproduce when the Phase A–F/Phase H changes are stashed.
- `noNetworkNoiseCopy` is an environment-sensitive file-walk timeout under full
  parallel load; it passes when run alone.
- None of these are hidden or skipped. They are documented so the PR review can
  distinguish a new regression from the existing ones.

## 7. Required GitHub Actions secrets

**No additional secrets are required for this workflow.** It uses only the
GitHub-hosted Postgres service and seeded, non-secret test credentials.

Names referenced by existing workflows, not added here:
- `GITHUB_TOKEN` (implicit)
- `CPANEL_SSH_PRIVATE_KEY`
- `CPANEL_KNOWN_HOSTS`
- `CPANEL_HOST`, `CPANEL_USER`, `CPANEL_PORT`, `CPANEL_REMOTE_PATH`
- `WEB_API_BASE_URL`, `WEB_BOT_USERNAME`
- `WEB_FIREBASE_API_KEY`, `WEB_FIREBASE_AUTH_DOMAIN`,
  `WEB_FIREBASE_PROJECT_ID`, `WEB_FIREBASE_APP_ID`

Optional future **staging-only** secrets would include:
- `STAGING_DATABASE_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_KEY`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_TELEGRAM_BOT_TOKEN`
- `STAGING_TELEGRAM_BOT_ID`
- `STAGING_GOOGLE_CLIENT_ID`
- `STAGING_FIREBASE_PROJECT_ID`
- `STAGING_FIREBASE_AUTH_DOMAIN`
- These are not used by the new workflow.

## 8. Is the branch ready for local commit and push?

**Not as a clean PR yet.** The CI configuration itself is complete and locally
exercised. However:

1. The default frontend suite currently contains known baseline/UI timing
   failures, so a full current CI run cannot be assumed green.
2. The new integrated workflow is not yet proven by the actual Actions runner.
3. Staging E2E and real_provider verification remain outstanding because there
   is no isolated staging target.

Ready to merge to `dev`? **No.**
Ready to push a feature commit and run CI? **Only after resolving or explicitly
tracking the known frontend baseline failures; otherwise the PR will show
failing checks.**

I did not commit; this is a local change only.

## 9. Recommended PR checks before merging into `dev`

Once CI is actually green:

- Confirm the migration job chain reaches **035** and the revision-level
  migration drills pass.
- Confirm backend full suite.
- Confirm `check:parity`, website and Mini App builds.
- Confirm frontend lint/test and web tests.
- Confirm identity/journey, rate limit and CORS/security tests.
- Confirm chatbot ownership/continuity/static checks.
- Review the known frontend baseline failures and explicitly confirm whether
  they are tracker-only issues or actual regressions.
- Confirm no secret/`.env`-like tracked file appears in the security job.
- Then open a PR from `feature/circler-chat-experience` → `dev` with every required
  job green.

## Safety confirmation

- No shared or production database was touched, and the local CI jobs never
  connect to hosted databases or the internet.
- No production or shared environment was deployed to.
- No feature branch or PR was pushed; no merge occurred; no existing Phase A–F
  work was overwritten.
- `dev` and `main` were not modified.
- Branch remains `feature/circler-chat-experience` at `06c3431` with all
  uncommitted work intact.
- No tracked secret or `.env`-like private file was introduced; only
  `.env.example` and the current `.env.production` files exist.
