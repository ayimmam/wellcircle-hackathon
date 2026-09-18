**Well Circle — Polish Sprint Implementation Plan**

_Closing the team's UX testing findings, with dependency mapping_

| Prepared for      | Anteneh Yimmam (Project Manager)                                                              |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Team              | Beza — chatbot · Yoni — Telegram bot · Bini — mini app · Anteneh — scoping, deployment health |
| Sources           | docs/app flow suggestions.pdf · docs/UX Testing Report & Marketing Recommendations.pdf        |
| Baseline          | branch dev @ 40935bd — CI green, 263 frontend / 21 backend / 36 chatbot / 1 bot tests         |
| Issued            | Wednesday 9 September 2026                                                                    |
| Delivery deadline | Friday 18 September 2026 (end of next week)                                                   |

# 1\. Executive summary

Two testing documents produced nine distinct findings. Every one has been traced to a specific file and line in the codebase before this plan was written — none are restated second-hand. Tracing them changed the picture in three ways that matter for scheduling:

- **The highest-impact defect is not a code bug.** Story posting fails with _"invalid cloud name well circle"_ because the production CLOUDINARY_CLOUD_NAME environment variable contains a space. Cloud names cannot. This is a ten-minute dashboard fix that only Anteneh can make, and it restores a whole feature.
- **Two "not visible enough" complaints are measurable, not subjective.** The active filter pill scores 3.05:1 in dark theme and the coming-soon badge 2.19:1, against a WCAG AA floor of 4.5:1. That converts vague feedback into a pass/fail acceptance test anyone can verify — see Appendix A.
- **The reported work is almost entirely in Bini's area.** Eight of nine findings are frontend. Assigning strictly by the domain split would leave Beza and Yoni idle for the week, so their tracks are drawn from the standing instruction to refactor for maintainability, efficiency and performance — against real defects found in their services, listed in §5. This is flagged rather than quietly rebalanced.

Of the thirteen engineering tasks, **six are fully independent and can start on day one** in parallel across all three engineers. Only two are blocked on anything, and both wait on a single scoping decision that is yours to make (D-1, §4). The dependency graph is deliberately shallow — see §6.

# 2\. Scope

## 2.1 In scope

- All five items from _app flow suggestions.pdf_.
- All four UX/technical findings from §1 of the _UX Testing Report_ (Critical, High, and both Mediums).
- Refactoring for maintainability, efficiency and performance where the work touches it — per the standing instruction. Three such items are included, each tied to a concrete defect rather than a general tidy-up.

## 2.2 Out of scope

§2 of the UX report — _Strategic Marketing Recommendations_ — is excluded on your instruction to focus on implementation. That defers the acquisition and intent surveys, the flagship event, diaspora/WhatsApp onboarding, location QR codes and branded merchandise.

_Worth noting for a later cycle: the two survey items are the only ones of those that are really engineering work, and they would need a new backend table, an API endpoint and a frontend prompt component — roughly a sprint of their own, which is why they do not fit this one._

## 2.3 Deferred with a reason

| **Item**                                                         | **Source**      | **Why it is not in this sprint**                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing transparency — blank currency fields, "Price on enquiry" | UX report, High | The code renders whatever the provider row holds; the gap is missing partner data, not a defect. Fixing it means collecting base prices from partners — a business task with an external dependency that cannot be guaranteed inside nine days. Tracked as D-2 in §4. |
| react-hooks v7 lint backlog (~48 findings)                       | CI, Phase 21    | Real refactors that would collide with B5 and B6 across the same files. Sequencing them after this sprint avoids merge pain for no user-visible gain this week.                                                                                                       |
| vite 5→8 / vitest 2→5 major upgrades                             | CI, Phase 21    | Dev-only dependencies, nothing ships to users. A major bundler upgrade during a polish sprint risks the release for zero user benefit.                                                                                                                                |

# 3\. Findings traced to code

_Every row was verified against the working tree at dev @ 40935bd. Line numbers are exact._

| **#** | **Finding (as reported)**                                  | **Where it actually lives**                                                                                                                                                                                                     | **Nature**        | **Task** |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- |
| 1     | Story posting: "invalid cloud name well circle"            | Not code. CLOUDINARY_CLOUD_NAME in Vercel prod env. cloudinary_service.py is correct and raises properly when unconfigured.                                                                                                     | Config            | A1       |
| 2     | Email booking throws ERR_UNKNOWN_URL_SCHEME and locks Back | frontend/src/pages/BookingFlow.jsx:335 — raw mailto: anchor. The tel: link beside it works because the OS dialer accepts it; Telegram's WebView has no mailto handler.                                                          | Code — Critical   | B7       |
| 3     | Explore coming-soon badge not visible enough               | ExploreScreen.jsx:187 — --text-tertiary background over an image dimmed to brightness(0.35). Dark theme measures 2.19:1. Also the only untranslated badge — a bare string, not t().                                             | Code — CSS + i18n | B1       |
| 4     | Provider profile banner not visible enough                 | ExploreScreen.jsx:183 brightness(0.35)/(0.5) filter; ProviderDetail.jsx:91 cover render.                                                                                                                                        | Code — CSS        | B2       |
| 5     | Events page calendar SVG should be centred                 | EventsScreen.jsx:178 — the icon is dropped straight into .empty-state, which only does text-align:center. The codebase already has an .empty-state-icon flex-centring class (index.css:1273) that this one screen does not use. | Code — CSS        | B3       |
| 6     | Filter pills and toggles lack contrast when active         | index.css:1216 .chip.active. Measured: 4.02:1 light, 3.05:1 dark, 3.77:1 green theme — all below the 4.5:1 AA floor. Amber theme passes at 8.55:1.                                                                              | Code — CSS        | B4       |
| 7     | Empty community feeds have no direction                    | PostFeed.jsx, CommunityList.jsx, CommunityDetail.jsx — empty states render text with no call to action.                                                                                                                         | Code — UX         | B5       |
| 8     | Settings are one continuous unstructured screen            | ProfileScreen.jsx — 644 lines, 15 flat profile-section-title blocks in a single component.                                                                                                                                      | Code — refactor   | B6       |
| 9     | Blank currency fields / "Price on enquiry"                 | Provider rows lack price data. Rendering is correct.                                                                                                                                                                            | Partner data      | D-2      |

# 4\. Decisions needed from Anteneh

Two items cannot be specified without a scoping call. Both are yours. B7 and Y3 stay blocked until D-1 is answered, so answering it early is the single biggest schedule lever in this plan.

## D-1 — How should "Email this provider" behave? (needed by Fri 11 Sep)

The Critical defect. Telegram's WebView cannot open mailto:, and the failed navigation locks the Back button. Removing the button entirely is not acceptable — email is the only contact route for providers without a phone number. Three viable options:

| **Option**               | **What the user gets**                                                                                                      | **Cost**                                                                                                           | **Assessment**                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Copy address + toast | Button copies the address to the clipboard and confirms with a toast; the address stays visible on screen to type manually. | Bini, ~half a day. Frontend only.                                                                                  | RECOMMENDED. Fixes the crash this week with near-zero risk. The codebase already has this exact pattern in utils/circleInvite.js and ProductRedeem.jsx, so it is a known-good path, not a new one. |
| B — In-app inquiry form  | A form inside the app; the message reaches the provider by backend email.                                                   | Backend endpoint + email transport + frontend form. Several days, and needs an email provider chosen and paid for. | Best end state, wrong week. The transport decision alone could outlast the sprint.                                                                                                                 |
| C — Telegram bot handoff | Hands off to the bot, which relays the inquiry to the provider.                                                             | Cross-service: Bini and Yoni together, plus a backend route.                                                       | Matches the report's "controlled Telegram handoff" wording, but coupling two engineers on the critical fix in a nine-day sprint is how deadlines are missed.                                       |

**Recommendation:** Option A now, Option B logged for the next cycle. A is reversible — if B ships later it simply replaces the copy button. Choosing C also activates Y3 and changes Yoni's week.

## D-2 — Who collects base prices from partners?

The High-severity pricing finding is not fixable in code. Someone has to ask each partner for a starting price and update their row. That is outreach, not engineering, and it needs an owner and a date from you. It is excluded from the engineering schedule below so it cannot silently slip the release; the app already degrades acceptably by showing "Price on enquiry".

# 5\. Task inventory

_Sizes: XS under an hour · S half a day · M one day · L two days. Every task is scoped to one service so no two people edit the same file._

## 5.1 Anteneh — scoping, access-gated work, deployment health

_These are the tasks nobody else can do: they need dashboard credentials or repo-admin rights._

| **ID** | **Task**                                            | **Detail**                                                                                                                                                                                                                                                                                                                                                            | **Size** | **Blocks**                                                    |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| A1     | Fix the Cloudinary cloud name in production         | Vercel → backend project → Settings → Environment Variables. CLOUDINARY_CLOUD_NAME currently holds a value with a space (the error echoes it back as "well circle"). Set it to the exact cloud name from the Cloudinary dashboard — no spaces — then redeploy and post a test story. Restores story posting, circle banners and provider image uploads in one change. | XS       | Nothing — but it is the biggest user-visible win in this plan |
| A2     | Turn on branch protection and Actions PR permission | Carried over from the CI work. Require the 7 blocking checks on main and dev — not security · npm audit (advisory), which is continue-on-error by design — plus one review, and block force-pushes. Then Settings → Actions → General → allow Actions to create pull requests.                                                                                        | XS       | Makes every PR below actually gated                           |
| A3     | Run the bot test suite in CI, and correct the docs  | telegram-bot/bot/tests/test_nudges.py exists and passes, but CI only byte-compiles the bot — so the suite has never run in CI. Add pytest bot/tests to the telegram-bot job. CLAUDE.md, README.md and HANDOFF.md all currently state the bot has no test suite; that is my error and needs correcting alongside.                                                      | XS       | Y1 — makes Yoni's new tests enforced rather than decorative   |
| A4     | Answer D-1 and D-2                                  | See §4. D-1 by Fri 11 Sep or B7 cannot start on Monday.                                                                                                                                                                                                                                                                                                               | —        | B7, Y3                                                        |
| A5     | Release and verify                                  | Merge the release PR dev → main, confirm Vercel and Railway deploys land, then walk the retest script in §8.3 against production.                                                                                                                                                                                                                                     | S        | Final gate                                                    |

## 5.2 Bini — mini app (frontend)

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>ID</strong></p></th><th><p><strong>Task</strong></p></th><th><p><strong>Files</strong></p></th><th><p><strong>Acceptance criteria</strong></p></th><th><p><strong>Size</strong></p></th><th><p><strong>Dep</strong></p></th></tr><tr><td><p>B1</p></td><td><p>Coming-soon badge: contrast + missing translation</p></td><td><pre><code>src/pages/ExploreScreen.jsx:187</code></pre></td><td><p>Badge text scores ≥ 4.5:1 against its own background in all four themes (verify with the script in Appendix A). Currently 2.19:1 in dark. Also wrap the bare string in t('Coming soon') — every other badge in the app is translated and this one was missed.</p></td><td><p>S</p></td><td><p>none</p></td></tr><tr><td><p>B2</p></td><td><p>Provider cover image visibility</p></td><td><p>ExploreScreen.jsx:183, ProviderDetail.jsx:91</p></td><td><p>Raise the brightness() filter until the photo reads clearly, while any text overlaid on it still meets 4.5:1. Prefer a bottom-up gradient scrim over a flat dim — it keeps the image bright where there is no text. Check both themes and a light and a dark photo.</p></td><td><p>S</p></td><td><p>none</p></td></tr><tr><td><p>B3</p></td><td><p>Centre the events empty-state icon</p></td><td><pre><code>src/pages/EventsScreen.jsx:178</code></pre></td><td><p>Wrap the icon in the existing .empty-state-icon class (index.css:1273) rather than adding new CSS — that class already flex-centres and applies the right colour. Icon sits centred; the EventsScreen tests still pass.</p></td><td><p>XS</p></td><td><p>none</p></td></tr><tr><td><p>B4</p></td><td><p>Active filter-pill contrast</p></td><td><p>src/index.css:1216 (.chip.active)</p></td><td><p>≥ 4.5:1 in all four themes. Measured today: light 4.02, dark 3.05, green 3.77, amber 8.55 (only amber passes). Adjust the --accent/--text-on-accent pairing per theme, not the chip rule, so every accent-coloured surface benefits. Re-run the whole frontend suite — --accent is used widely.</p></td><td><p>S</p></td><td><p>none</p></td></tr><tr><td><p>B5</p></td><td><p>Actionable empty states for community and circle feeds</p></td><td><p>PostFeed.jsx, CommunityList.jsx, CommunityDetail.jsx</p></td><td><p>Every empty feed offers a next step — "Create first post", "Browse circles" — following the pattern already used in EventsScreen.jsx:184. Add one test per screen asserting the CTA renders and navigates.</p></td><td><p>M</p></td><td><p>none</p></td></tr><tr><td><p>B6</p></td><td><p>Group the settings screen, and split the component</p></td><td><p>src/pages/ProfileScreen.jsx (644 lines)</p></td><td><p>Group the 15 flat sections into Account, Preferences, Privacy and Integrations, in that order. Extract each group into its own component under src/pages/profile/ — the file is too large to review safely and this is the refactor the maintainability instruction is aimed at. No behaviour change: every existing ProfileScreen test must pass untouched.</p></td><td><p>L</p></td><td><p>none</p></td></tr><tr><td><p>B7</p></td><td><p>Fix the email contact button</p></td><td><pre><code>src/pages/BookingFlow.jsx:335</code></pre></td><td><p>Per D-1. If Option A: replace the mailto: anchor with a copy-to-clipboard button using the existing navigator.clipboard + toast pattern from utils/circleInvite.js. No navigation is attempted, so the Back button cannot lock. Update BookingFlow.phoneBooking.test.jsx:65, which currently asserts the mailto href. Keep the tel: button exactly as it is — it works.</p></td><td><p>M</p></td><td><p>D-1</p></td></tr></tbody></table></div>

## 5.3 Beza — chatbot service

_No chatbot defects were reported in testing, so this track is drawn from the refactor instruction. Both items are real problems found while verifying the service, not filler._

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>ID</strong></p></th><th><p><strong>Task</strong></p></th><th><p><strong>Files</strong></p></th><th><p><strong>Acceptance criteria</strong></p></th><th><p><strong>Size</strong></p></th><th><p><strong>Dep</strong></p></th></tr><tr><td><p>C1</p></td><td><p>Pin the chatbot dependencies</p></td><td><pre><code>chatbot/requirements.txt</code></pre></td><td><p>Every dependency is currently unpinned (fastapi, uvicorn, pydantic, groq, supabase, python-dotenv), so CI resolves different versions on different days and a breaking upstream release lands with no warning. Pin each to the version currently installed (pip freeze), keeping requirements-dev.txt separate. The 36 tests must pass against the pinned set.</p></td><td><p>XS</p></td><td><p>none</p></td></tr><tr><td><p>C2</p></td><td><p>Split main.py into modules</p></td><td><p>chatbot/main.py (645 lines) → config.py, models.py, memory.py, data.py, prompt.py</p></td><td><p>The file already carries section banners (--- ENVIRONMENT VARIABLES ---, --- SESSION MEMORY --- and so on) that mark the natural seams — follow them rather than inventing a new structure. Behaviour must not change: all 36 tests pass. Where a test monkeypatches main.something that has moved, update the patch target and nothing else — if an assertion needs changing, the refactor changed behaviour and has gone wrong.</p></td><td><p>L</p></td><td><p>C1</p></td></tr></tbody></table></div>

## 5.4 Yoni — Telegram bot

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>ID</strong></p></th><th><p><strong>Task</strong></p></th><th><p><strong>Files</strong></p></th><th><p><strong>Acceptance criteria</strong></p></th><th><p><strong>Size</strong></p></th><th><p><strong>Dep</strong></p></th></tr><tr><td><p>Y1</p></td><td><p>Expand bot test coverage</p></td><td><pre><code>telegram-bot/bot/tests/</code></pre></td><td><p>976 lines of bot code are covered by a single test. Add tests for services/api_client.py (mock httpx; assert URL, headers and timeout per call), utils/messages.py and handlers/start.py. Follow the existing test_nudges.py style. Target: every module in services/ and utils/ has at least one test. These become a CI gate once A3 lands.</p></td><td><p>M</p></td><td><p>soft: A3</p></td></tr><tr><td><p>Y2</p></td><td><p>Share one HTTP client instead of eight</p></td><td><pre><code>telegram-bot/bot/services/api_client.py</code></pre></td><td><p>All 8 functions open their own httpx.AsyncClient per call, so every backend request pays a fresh connection setup and TLS handshake and no pooling ever happens. Introduce one module-level client with proper startup/shutdown lifecycle, keeping the existing per-call timeouts (10s, and 15s for get_circle_digests). Y1's tests must still pass — write them first if the ordering suits you.</p></td><td><p>M</p></td><td><p>none</p></td></tr><tr><td><p>Y3</p></td><td><p>Bot-side provider inquiry handoff</p></td><td><pre><code>telegram-bot/bot/handlers/</code></pre></td><td><p>ONLY IF D-1 selects Option C. Otherwise this task does not exist and Yoni's week is Y1 + Y2.</p></td><td><p>M</p></td><td><p>D-1 = C</p></td></tr></tbody></table></div>

# 6\. Dependency map

The graph was kept deliberately shallow so the sprint parallelises. Of thirteen engineering tasks, nine have no dependency at all and six of those can start on day one.

## 6.1 The only four dependencies

| **Dependency** | **Type**    | **Why it exists**                                                                                                                           | **If it slips**                                                                                                         |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| D-1 → B7       | Hard        | The email fix cannot be specified until the approach is chosen.                                                                             | The Critical defect ships unfixed. Answer D-1 by Fri 11 Sep.                                                            |
| D-1 → Y3       | Conditional | Y3 only exists if D-1 selects Option C.                                                                                                     | No impact — under Options A or B, Yoni simply has a two-task week.                                                      |
| C1 → C2        | Soft        | Pin dependencies before refactoring, so a failure during C2 is unambiguously the refactor and not an upstream release that landed mid-week. | C2 stays possible, but debugging it gets harder. C1 is under an hour — just do it first.                                |
| A3 → Y1        | Soft        | Y1's tests only become a gate once CI runs the bot suite.                                                                                   | Y1 can be written and merged regardless; it is simply unenforced until A3 lands. A3 is an XS task, so do it on day one. |

## 6.2 Execution waves

Wave 1 is the answer to "execute the independent tasks first": six tasks, three engineers, zero coordination needed between them.

| **Wave**                     | **When**            | **Tasks**                                                                           | **Parallelism**                                                                                                                                    |
| ---------------------------- | ------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wave 0 — unblock             | Wed 10 – Thu 11 Sep | A1 (Cloudinary), A2 (branch protection), A3 (bot tests in CI), A4 (answer D-1, D-2) | Anteneh alone. All four are XS. Nothing else waits on them except that answering D-1 releases B7.                                                  |
| Wave 1 — independent         | Mon 14 – Tue 15 Sep | B1, B2, B3, B4 (Bini) · C1 (Beza) · Y1 (Yoni)                                       | Fully parallel, no shared files. Four of the six are XS or S. This wave alone closes four of the nine reported findings.                           |
| Wave 2 — independent, larger | Tue 15 – Thu 17 Sep | B5, B6 (Bini) · C2 (Beza) · Y2 (Yoni)                                               | Still fully parallel — one service each. These are the refactor-heavy items, deliberately placed after the quick wins are already merged and safe. |
| Wave 3 — decision-gated      | Mon 14 – Wed 16 Sep | B7 (Bini) · Y3 only if D-1 = Option C                                               | Starts the moment D-1 is answered. Under the recommended Option A, B7 runs alongside Wave 1 and is done by Tuesday.                                |
| Wave 4 — release             | Thu 17 – Fri 18 Sep | A5: freeze dev, retest, release PR, deploy, verify                                  | Anteneh alone.                                                                                                                                     |

## 6.3 Critical path

**D-1 (you) → B7 (Bini, 1 day) → merge → release.** Everything else has slack. The sprint's only real risk of missing Friday is D-1 going unanswered — which is why it is the first thing in Wave 0 and why Option A is recommended: it is the one option that cannot overrun.

# 7\. Schedule

| **Day**    | **Anteneh**                            | **Bini**         | **Beza**         | **Yoni**         |
| ---------- | -------------------------------------- | ---------------- | ---------------- | ---------------- |
| Wed 10 Sep | A1, A2, A3                             | —                | —                | —                |
| Thu 11 Sep | A4: answer D-1 + D-2. Brief the team.  | —                | —                | —                |
| Mon 14 Sep | Review PRs                             | B3, B1           | C1, start C2     | Y1               |
| Tue 15 Sep | Review PRs                             | B2, B4, start B7 | C2               | Y1 → Y2          |
| Wed 16 Sep | Review PRs                             | B7, start B5     | C2               | Y2               |
| Thu 17 Sep | Freeze dev 17:00. Full retest.         | B5, B6           | C2 done          | Y2 done          |
| Fri 18 Sep | A5: release PR, deploy, verify in prod | Fix-forward only | Fix-forward only | Fix-forward only |

**Thursday 17:00 is a real freeze, not a target.** Anything not merged into dev by then ships next cycle. Friday is for the release and for verifying production — not for landing work, because a deploy that is verified on a Friday evening with nobody watching is not verified at all.

# 8\. How the team works this sprint

## 8.1 Branching — every task, no exceptions

The repository now runs a two-branch flow. main is what deploys, so nothing lands on it directly.

```
git checkout dev && git pull
git checkout -b fix/B3-events-icon-centering
# ...make the change...
npm test && npm run lint          # or pytest, per service
git push -u origin fix/B3-events-icon-centering
# open a PR into dev — never into main
```

- Branch off dev, never main.
- One task per PR. Put the task ID in the branch name and title — _B3: centre events empty-state icon_.
- All seven CI checks must be green before merge. They run automatically on the PR.
- If CI fails, read the failing job's log and fix it. A red check is information, not an obstacle to route around.

## 8.2 Using a free-tier LLM effectively

Every task above is sized to be completed with free-tier LLM assistance. The difference between a good and a bad result is almost entirely how much real context you paste in. Use this shape:

```
I'm working in a React 18 + Vite app (plain JavaScript, no TypeScript).
Task <ID>: <paste the acceptance criteria from this document verbatim>

Here is the current code:
<paste the whole file, or the function plus 20 lines either side>

Here is the relevant CSS / the test that covers it:
<paste it>

Give me the smallest change that satisfies the criteria. Do not restructure anything
I did not ask about. Explain what you changed and why in two sentences.
```

- **Paste real code, not a description of it.** A model guessing at your file will invent plausible-looking code that does not exist in this repo.
- **Ask for the smallest change.** Free-tier models love to rewrite whole files. A large diff for a small task will be sent back in review.
- **Always run the tests yourself before pushing.** The model cannot run them and will confidently tell you it passes.
- **If the model's change breaks a test, do not delete the test.** The test is the specification — say so to the model and ask again.

## 8.3 Definition of done, and the retest script

A task is done when its PR is merged into dev with CI green. The sprint is done when all nine original findings are re-verified in production after the Friday release:

- **1\.** Post a story with a photo — uploads and appears, no "invalid cloud name" error (A1).
- **2\.** Boston Day Spa → select service → Email — no error screen, Back button still works (B7).
- **3\.** Explore in dark theme — coming-soon badge readable, provider photos clearly visible (B1, B2).
- **4\.** Events page with no events — calendar icon centred (B3).
- **5\.** Explore in each theme — active category pill clearly distinct from inactive (B4).
- **6\.** Open an empty community feed — a clear next action is offered (B5).
- **7\.** Profile → settings — grouped into Account, Preferences, Privacy, Integrations (B6).
- **8\.** Confirm nothing regressed: bookings, check-ins, points, circles still work end to end.

# 9\. Risks

| **Risk**                                                                        | **Likelihood** | **Impact**                                       | **Mitigation**                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 goes unanswered and B7 never starts                                         | Medium         | High — the Critical defect ships                 | It is the first item in Wave 0 with a Fri 11 Sep date. Option A is recommended precisely because it is the one that cannot overrun.                                                                                                                                                    |
| A1 is not the whole story — the cloud name is right and something else is wrong | Low            | Medium — story posting stays broken              | The error text echoes the bad value back, which is strong evidence. If correcting it does not fix posting, the next step is the backend logs from cloudinary_service.py:\_configure, which raises a clear error when unconfigured. Escalate to Anteneh same day — do not let it drift. |
| B4 changes --accent and something unrelated regresses                           | Medium         | Medium — visual regressions across the app       | \--accent is used widely. Run the full 263-test frontend suite, and eyeball Home, Explore, Booking and Profile in all four themes before opening the PR.                                                                                                                               |
| B6 and C2 are the two largest tasks and both land late                          | Medium         | Low — they are the least user-visible items here | Both are pure refactors behind existing tests. If either is not merged by Thursday 17:00, drop it to the next cycle; no reported finding goes unfixed as a result.                                                                                                                     |
| A free-tier LLM produces plausible but wrong code                               | High           | Medium                                           | This is the expected failure mode, which is why every task has explicit acceptance criteria and CI gates every merge. The 320 automated tests are the safety net — that is what they are for.                                                                                          |
| Two engineers edit the same file                                                | Low            | Low                                              | Tasks were allocated so each person owns a separate service. Within the frontend, B1–B7 touch different files; only B4 (index.css) is shared, so merge it early.                                                                                                                       |

# Appendix A — Contrast measurements and how to verify

The two "not visible enough" findings were measured rather than eyeballed, so B1 and B4 have a pass/fail test instead of an opinion. WCAG AA requires 4.5:1 for normal text.

| **Element**                | **Foreground / background**   | **Light** | **Dark** | **Amber** | **Green** | **Verdict**                                                                          |
| -------------------------- | ----------------------------- | --------- | -------- | --------- | --------- | ------------------------------------------------------------------------------------ |
| .chip.active (filter pill) | \--text-on-accent on --accent | 4.02      | 3.05     | 8.55      | 3.77      | FAILS in 3 of 4 themes                                                               |
| Coming-soon badge          | white on --text-tertiary      | 4.83      | 2.19     | —         | —         | FAILS in dark; light only passes before the image dimming behind it is accounted for |

_Verify a proposed colour pair with this — no dependencies, runs anywhere Python does:_

```
def contrast(hex_a, hex_b):
    def lum(h):
        h = h.lstrip('#')
        c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
        c = [x/12.92 if x <= 0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
        return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]
    a, b = sorted((lum(hex_a), lum(hex_b)), reverse=True)
    return round((a + 0.05) / (b + 0.05), 2)

print(contrast('#FFFFFF', '#007AFF'))   # 4.02 -> fails AA
# target: >= 4.5
```

# Appendix B — File and line index

_Verified against dev @ 40935bd on 9 September 2026. Line numbers move as the sprint progresses; search the surrounding code rather than trusting the number blindly if it does not match._

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Task</strong></p></th><th><p><strong>Path</strong></p></th><th><p><strong>Line</strong></p></th><th><p><strong>What is there now</strong></p></th></tr><tr><td><p>B1</p></td><td><pre><code>frontend/src/pages/ExploreScreen.jsx</code></pre></td><td><p>187</p></td><td><p>Coming-soon badge, --text-tertiary background, untranslated string</p></td></tr><tr><td><p>B2</p></td><td><pre><code>frontend/src/pages/ExploreScreen.jsx</code></pre></td><td><p>183</p></td><td><p>filter: brightness(0.35) when coming soon, (0.5) otherwise</p></td></tr><tr><td><p>B2</p></td><td><pre><code>frontend/src/pages/ProviderDetail.jsx</code></pre></td><td><p>91</p></td><td><p>Cover photo / gallery render</p></td></tr><tr><td><p>B3</p></td><td><pre><code>frontend/src/pages/EventsScreen.jsx</code></pre></td><td><p>178</p></td><td><p>Bare &lt;Icon name="calendar"&gt; inside .empty-state</p></td></tr><tr><td><p>B3</p></td><td><pre><code>frontend/src/index.css</code></pre></td><td><p>1273</p></td><td><p>.empty-state-icon — the flex-centring class to reuse</p></td></tr><tr><td><p>B4</p></td><td><pre><code>frontend/src/index.css</code></pre></td><td><p>1216</p></td><td><pre><code>.chip.active</code></pre></td></tr><tr><td><p>B4</p></td><td><pre><code>frontend/src/index.css</code></pre></td><td><p>47, 124, 202, 220</p></td><td><p>--accent per theme: light, dark, amber, green</p></td></tr><tr><td><p>B6</p></td><td><pre><code>frontend/src/pages/ProfileScreen.jsx</code></pre></td><td><p>255–600</p></td><td><p>15 flat profile-section-title blocks</p></td></tr><tr><td><p>B7</p></td><td><pre><code>frontend/src/pages/BookingFlow.jsx</code></pre></td><td><p>335</p></td><td><p>The mailto: anchor that breaks the WebView</p></td></tr><tr><td><p>B7</p></td><td><pre><code>frontend/src/test/BookingFlow.phoneBooking.test.jsx</code></pre></td><td><p>65</p></td><td><p>Asserts the mailto href — must be updated with B7</p></td></tr><tr><td><p>B7</p></td><td><pre><code>frontend/src/utils/circleInvite.js</code></pre></td><td><p>25</p></td><td><p>Existing clipboard-with-toast pattern to copy</p></td></tr><tr><td><p>C1</p></td><td><pre><code>chatbot/requirements.txt</code></pre></td><td><p>—</p></td><td><p>Six unpinned dependencies</p></td></tr><tr><td><p>C2</p></td><td><pre><code>chatbot/main.py</code></pre></td><td><p>18–645</p></td><td><p>Section banners marking the natural module seams</p></td></tr><tr><td><p>Y1</p></td><td><pre><code>telegram-bot/bot/tests/test_nudges.py</code></pre></td><td><p>—</p></td><td><p>The single existing test; follow its style</p></td></tr><tr><td><p>Y2</p></td><td><pre><code>telegram-bot/bot/services/api_client.py</code></pre></td><td><p>20, 36, 47, 59, 70, 81, 93, 109</p></td><td><p>Eight separate httpx.AsyncClient instantiations</p></td></tr><tr><td><p>A1</p></td><td><pre><code>backend/app/services/cloudinary_service.py</code></pre></td><td><p>34</p></td><td><p>_configure() — raises when the cloud name is missing</p></td></tr><tr><td><p>A3</p></td><td><pre><code>.github/workflows/ci.yml</code></pre></td><td><p>—</p></td><td><p>telegram-bot · compile job to extend with pytest</p></td></tr></tbody></table></div>

_Prepared by Claude Opus 5 for Anteneh Yimmam · 9 September 2026 · Well Circle polish sprint_