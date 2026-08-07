# Changelog

Concise history of changes, reverse chronological order

## 2026-08-07 - Baseline reset (main → dev)

- Merged `main` into `dev` (`06708bf`, "app from main, pre-refactor")
- `App.jsx` baseline: ~40,935 lines, 275 top-level symbols (regenerated inventory)
- Five new symbols from `main`: `ConfirmModal`, `InlineBedroomTasks`, `AttachmentModal`, `CompletedAssignmentsView`, `clearPmAssignmentNotification`
- Split plan/roadmap updated for new baseline; Phase 0 complete, Phase A not yet started (`src/lib/` empty)
- Smoke-test checklist: removed stale line-number refs; added `InlineBedroomTasks`, SMS stub non-regression

## 2026-08-06 - Docs & agent setup (dev branch)

- Added `AGENTS.md` — agent operating rules (read context, ask before complex work)
- Added `aiDocs/context.md` — entry point linking MVP, architecture, changelog, and code locations
- Added `aiDocs/mvp.md` — product scope, users, core workflow, must-haves vs out-of-scope
- Added `aiDocs/old_architecture.md` — baseline pre-split monolith architecture
- Expanded `aiDocs/old_architecture.md`: auth/sessions, hash routing, realtime, Google APIs, full table inventory, security notes; fixed BetaShell precedence, portal code format, owner-only preview wording

## 2026-08-06 - App (`src/App.jsx`)

- Removed duplicate task label entry `general:lt_switches` ("Light switches")

## 2026-08-06 - Repo hygiene

- Added `.gitignore` (node_modules, dist, .env, .vercel, OS files, local `ai/` agent docs)
- Committed `package-lock.json`
