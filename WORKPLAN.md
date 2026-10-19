# Agent Debugger — readiness work

- [x] Read repository/skills, confirm clean Git tree, trace data flow; original 120 tests pass.
- [x] Capture 1,000/10,000 span baseline (including deep parents).
- [x] Add local OTLP JSON adapter and import preview, preserve strict v1 validation.
- [x] Add deterministic insights, structural A/B suggestions and JSON diff.
- [x] Add redacted export preview without mutating originals.
- [x] Bound timeline DOM at 100 rows; measured parse/validate >50 ms, added file Worker with cancellation.
- [x] Migrate IndexedDB transactionally to per-run records; preserve failed migrations.
- [x] Refresh Thai UI, accessible themes, JSON viewer and responsive panels.
- [x] Run 161 behavioral/integration tests, browser QA (13 flow checks), typecheck/build; document actual limits in docs/readiness-qa.md.

Initial development remained local with no services, model calls or CDN assets. The user subsequently authorized GitHub push and deployment on 2026-10-19.
