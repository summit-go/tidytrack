# Changelog

Concise history of changes for each commit, reverse chronological order

## 2026-08-07 - Phase A6: Manager tabs (`src/apps/staff/manager/`)

- Extracted 48 manager tab symbols into five folders: `daily/` (10), `dashboard/` (12), `team/` (4), `properties/` (13), `assignments/` (9)
- Co-located label helpers `buildTargetTitle`, `unitSizeLabel`, `shortenBedroom` → `src/lib/labels.js`
- Manager tab files bridge-import A9/cleaner symbols still in `App.jsx`: `LiveCleanersSheet`, `ChecklistAssignmentWizard`, `ChecklistAssignmentView`, `AssignmentViewer`, `ReassignModal`, `AssignPicker`, `BedBathPicker`, `DateRangePicker`, `InboxView`, `MoveBlockModal`, `SearchableUnitPicker`, `SupplyChecklistManager`, `WorkBlockAssignmentLink`, `AttachmentModal`, `SpanishTranslationPanel`, `TranslationOverridesModal`, `BlockedNoteModal`
- `App.jsx` ~18,100 lines removed (~56k → ~38k); `npm run build` passes

## 2026-08-07 - Phase A4: Shared leaf components (`src/components/`)

- Extracted 19 shared leaf components to `src/components/` (chips, progress bars, photo modals, translation UI, `Header`, `NotificationBell`, etc.)
- Early bridge extractions for A4 dependencies: `LeaveWorkblockModal` and `ItemsDropdown` → `src/apps/staff/cleaner/`; `splitTaskName` → `src/lib/tasks.js`
- `App.jsx` imports all A4 symbols; ~2,400 lines removed from monolith
- `npm run build` passes

## 2026-08-07 - Phase A2 + A3: Hooks and contexts

- Extracted 7 hooks to `src/hooks/`: `useAssignmentSync`, `useIdleDetector`, `usePagePersistence`, `useItemLabelOverrides`, `useTick`, `useUnreadCount`, `useAssignmentsForBedroomOnDate`
- Extracted contexts to `src/contexts/`: `LocaleContext.jsx` (`LocaleContext`, `useLocale`, `TranslationProvider` as a unit), `PreviewContext.jsx` (definition only; provider remains inline in `ManagerShell`)
- Restored `TranslationProvider` and `useTick` from pre-A1 baseline — both were accidentally removed during A1 lib extraction
- `App.jsx` imports hooks and contexts; ~700 lines removed from monolith
- `npm run build` passes

## 2026-08-07 - Phase A1: Foundations (`src/lib/`)

- Extracted 8 lib modules from `App.jsx`: `supabase.js`, `constants.js`, `permissions.js`, `format.js`, `compare.js`, `photos.js`, `sessionStore.js`, `translation.js`
- `App.jsx` now imports all A1 symbols from `src/lib/`; ~1,150 lines removed from monolith
- `npm run build` passes (does not catch undefined function references); smoke checklist not yet run on this batch — would have failed on app load due to symbols accidentally removed from `App.jsx` alongside the lib cut

## 2026-08-07 - Phase 0 audit & doc fixes

- Verified Phase 0 deliverables: smoke checklist complete, inventory current (275 symbols), `src/lib/` empty, `npm run build` passes on `dev`
- Roadmap header status updated to "Phase 0 complete — ready for Phase A"; added smoke-checklist link; clarified `dev` as extraction branch
- `aiDocs/context.md`: linked split roadmap/plan/inventory and smoke-test checklist for agent discoverability

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
