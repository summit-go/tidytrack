# Changelog

Concise history of changes

## 2026-08-06 - Docs & agent setup (dev branch)

- Added `AGENTS.md` — agent operating rules (read context, ask before complex work)
- Added `aiDocs/context.md` — entry point linking MVP, architecture, changelog, and code locations
- Added `aiDocs/mvp.md` — product scope, users, core workflow, must-haves vs out-of-scope
- Added `aiDocs/old_architecture.md` — baseline pre-split monolith architecture
- Expanded `aiDocs/old_architecture.md`: auth/sessions, hash routing, realtime, Google APIs, full table inventory, security notes; fixed BetaShell precedence, portal code format, owner-only preview wording

## 2026-08-06 - Repo hygiene

- Added `.gitignore` (node_modules, dist, .env, .vercel, OS files, local `ai/` agent docs)
- Committed `package-lock.json`

## 2026-08-06 - App (`src/App.jsx`)

- Large update (~40k → ~60k lines)
- Removed duplicate task label entry `general:lt_switches` ("Light switches")
