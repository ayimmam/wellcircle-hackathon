# Documentation

Reference and design docs for Well Circle. Start with the [project README](../README.md) for
setup and architecture, and [`../CLAUDE.md`](../CLAUDE.md) if you're a coding agent working in
this repo. Everything below is a design/status doc, not source of truth for current code — if a
doc and the code disagree, trust the code.

**Contributing:** `main` deploys, so nothing lands on it directly — branch off `dev`, PR into
`dev`, and let the release PR carry it to `main`. The branching model and the CI gate are
documented in [`../CLAUDE.md`](../CLAUDE.md#branching-and-ci), with the change log in
[HANDOFF.md](./HANDOFF.md) under Phase 21.

## Reference
- [API_CONTRACT.md](./API_CONTRACT.md) — full endpoint specification, request/response shapes, and flow diagrams (source of truth across services).
- [BACKEND_REFERENCE.md](./BACKEND_REFERENCE.md) — backend internals and conventions from the original Phase-1 build. **Stale since Phase 2** (see the warning at the top of that file) — use `API_CONTRACT.md` for current endpoint shapes.

## Product
- [PRD.md](./PRD.md) — product requirements document.
- [WellCircle_Pitch.pdf](./WellCircle_Pitch.pdf) — pitch deck.
- [WellCircle_Dev_Timeline.docx](./WellCircle_Dev_Timeline.docx) — per-person sprint timeline (source for the sprint docs below).
- [POINTS_ECONOMY_PLAN.md](./POINTS_ECONOMY_PLAN.md) — points economy, provider tools, and social growth loop plan.
- [fable5_planning_prompt.md](./fable5_planning_prompt.md) — the planning prompt that produced POINTS_ECONOMY_PLAN.md.

## Current sprint (Jul 13–19, 2026 — Kuriftu Resort pilot)
- [USER_FLOW_AUDIT.md](./USER_FLOW_AUDIT.md) — user-flow map and friction-point audit (Monday deliverable).
- [SPRINT_TEAM_HANDOFF.md](./SPRINT_TEAM_HANDOFF.md) — per-person handoff notes for the rest of the team's remaining tasks.
- [BINIYAM_SPRINT_PLAN.md](./BINIYAM_SPRINT_PLAN.md) — Biniyam's presale-promo + re-entry-loop track: one-page sketch, day-by-day map, and test commands (Phase 7 in `HANDOFF.md`).
- [kuriftu-gap-analysis.md](./kuriftu-gap-analysis.md) — Bezi's Wed Jul 15 gap analysis (real Kuriftu call) comparing the app's booking flow to Kuriftu's actual process, plus confirmed pricing and the direct-contact booking fix that came out of it (Phase 9 in `HANDOFF.md`).
- [Kuriftu Resort.html](./Kuriftu%20Resort.html) — reference page used to prioritize Kuriftu across front-page surfaces.
- Supabase Observability PDFs — dashboard snapshots used to validate free-tier capacity during load testing (not narrative docs).

## Growth / UX
- [UX_GROWTH_LOOP_PLAN.md](./UX_GROWTH_LOOP_PLAN.md) — 4-stage onboarding → habit-loop → conversion workflow, mapped to specific UX psychology principles and this app's actual features (Phase 8 in `HANDOFF.md`).
- [FEATURE_PLAN_CIRCLES_AND_POLISH.md](./FEATURE_PLAN_CIRCLES_AND_POLISH.md) — pay-on-site booking, Strava-style circle activity feed, and emoji cleanup plan (Phase 13 in `HANDOFF.md`).
- [FEATURE_PLAN_V2_UX_UPGRADES.md](./FEATURE_PLAN_V2_UX_UPGRADES.md) — location-aware nearby surfacing, weekly ranks, feedback, and concierge chips plan (Phase 14 in `HANDOFF.md`).
- [new_implementation_plan.md](./new_implementation_plan.md) — paid circles, verified trainers, and profile/Strava integration plan (Phase 15 in `HANDOFF.md`; see that entry for deviations from this plan as actually built).

## Current sprint (Sep 9–18, 2026 — polish sprint, Phase 22)
- [POLISH_SPRINT_PLAN_SEP2026.docx](./POLISH_SPRINT_PLAN_SEP2026.docx) — implementation plan for the UX testing findings: 13 tasks, per-person assignments, dependency map and wave sequencing. The working document for this sprint.
- [app flow suggestions.pdf](./app%20flow%20suggestions.pdf) — the team's raw testing notes (5 findings).
- [UX Testing Report & Marketing Recommendations .pdf](./UX%20Testing%20Report%20&%20Marketing%20Recommendations%20.pdf) — UX audit (4 findings, severity-ranked) plus marketing recommendations. The marketing half is explicitly out of scope for Phase 22.

## Implementation history
- [HANDOFF.md](./HANDOFF.md) — implementation status and change log, by phase. Phase 21 covers CI, the `dev` integration branch, and the manual repo settings still outstanding.
- [PHASE3_HANDOFF.md](./PHASE3_HANDOFF.md) — Phase 3 (events, challenges, notifications, subscriptions) notes.
- [CONCIERGE_HANDOFF.md](./CONCIERGE_HANDOFF.md) — AI Concierge microservice integration notes.
- [IMPLEMENTATION_PROMPT.md](./IMPLEMENTATION_PROMPT.md) — original build specification.
