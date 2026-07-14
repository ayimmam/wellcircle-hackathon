# Documentation

Reference and design docs for Well Circle. Start with the [project README](../README.md) for
setup and architecture, and [`../CLAUDE.md`](../CLAUDE.md) if you're a coding agent working in
this repo. Everything below is a design/status doc, not source of truth for current code — if a
doc and the code disagree, trust the code.

## Reference
- [API_CONTRACT.md](./API_CONTRACT.md) — full endpoint specification, request/response shapes, and flow diagrams (source of truth across services).
- [BACKEND_REFERENCE.md](./BACKEND_REFERENCE.md) — backend internals and conventions.

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

## Implementation history
- [HANDOFF.md](./HANDOFF.md) — implementation status and change log, by phase.
- [PHASE3_HANDOFF.md](./PHASE3_HANDOFF.md) — Phase 3 (events, challenges, notifications, subscriptions) notes.
- [CONCIERGE_HANDOFF.md](./CONCIERGE_HANDOFF.md) — AI Concierge microservice integration notes.
- [IMPLEMENTATION_PROMPT.md](./IMPLEMENTATION_PROMPT.md) — original build specification.
