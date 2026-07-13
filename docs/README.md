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
- [Kuriftu Resort.html](./Kuriftu%20Resort.html) — reference page used to prioritize Kuriftu across front-page surfaces.
- Supabase Observability PDFs — dashboard snapshots used to validate free-tier capacity during load testing (not narrative docs).

## Implementation history
- [HANDOFF.md](./HANDOFF.md) — implementation status and change log, by phase.
- [PHASE3_HANDOFF.md](./PHASE3_HANDOFF.md) — Phase 3 (events, challenges, notifications, subscriptions) notes.
- [CONCIERGE_HANDOFF.md](./CONCIERGE_HANDOFF.md) — AI Concierge microservice integration notes.
- [IMPLEMENTATION_PROMPT.md](./IMPLEMENTATION_PROMPT.md) — original build specification.
