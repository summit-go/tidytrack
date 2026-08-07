# Changelog

Concise history of changes for each commit, reverse chronological order

## 2026-08-07 - Phase C1 complete: Shared work-loop read models

- Finished C1: `fetchOpenAssignmentTargets`, `fetchOpenTargetsAtProperty`, filter/sort helpers in `lib/assignments.js`; `buildWhosHereByParty` in `lib/workBlocks.js`
- Added `usePropertyAssignmentTargets` hook; wired `AssignmentTabContent`, `SuggestedTabContent`, `AssignmentsTab`
- All four assignment/work-block consumers now share paginated queries; `npm run build` passes

## 2026-08-07 - Phase C1: Shared work-loop read models (partial)

- Added Track 1 roadmap at `ai/roadmaps/2026-08-07_phase-c-work-loop_roadmap.md`
- Added `src/lib/workBlocks.js` — `fetchOpenWorkBlocksAtProperty`, `buildWhosHereLookup`
- Extended `src/lib/assignments.js` — `fetchPropertyAssignmentTargets`, `computeAssignmentStatusCounts`, shared select strings
- Added `src/domains/work/hooks/useAssignmentStatusCounts.js`, `useOpenWorkBlocksAtProperty.js`
- Wired `AssignmentsPanel` and `AssignmentTabContent` to shared hooks/helpers
- Remaining C1 deferred to next commit

## 2026-08-07 - Phase B2: Trivial read-model consolidation

- Added `src/lib/assignments.js` — `isPmApprovedAssignment`, `isVisibleAssignmentTarget`, `assignmentKeyFromTarget`, `dominantAssignmentStatus`
- Added `fetchAllPages`, `updateAssignmentScheduledDate` to `lib/supabase.js`; `unitNumberFromLabel` to `lib/compare.js`; `localTodayStart` / `localTodayStartISO` to `lib/format.js`
- Wired shared helpers across assignment/work-block consumers (cleaner, manager, portal, hooks)
- Substantive read-model unification (shared hooks, history views, presence) deferred to Phase C track 1; `npm run build` passes

## 2026-08-07 - Phase B1: MVP-aligned folder reshape

- Restructured `src/` into MVP domain folders: `domains/{work,properties,billing,auth}/`, `apps/{internal,client}/`, `features/messaging/` (messaging unchanged)
- **Work** — manager assignments/dashboard/daily, cross-cutting assignment components, cleaner work-block/task UI, portal work/history/photo tabs → `domains/work/`
- **Properties** — `PropertyAdmin` tree + portal property screens → `domains/properties/`
- **Billing** — `MoneyView` tree + `PortalInvoicesTab` → `domains/billing/`
- **Auth** — staff/portal sign-in screens + `sessionStore` → `domains/auth/`
- **Apps** — `StaffApp`/`BetaShell`/`ManagerShell`/`EmployeeApp` composers → `apps/internal/`; `PortalApp` shells → `apps/client/`
- Pure moves + import updates only; `npm run build` passes; read-model consolidation deferred to Phase C

## 2026-08-07 - Phase A bridge-import fix

- Fixed missing `isBetaFeaturesEnabled` import in `DailyCalendar.jsx` (runtime crash on manager daily view after sign-in)
- Patched `extract-a6-manager-tabs.mjs` and `extract-a10-a5b.mjs` to add bridge import for `isBetaFeaturesEnabled` consumers
- Roadmap/plan v1.4: documented deferred `money/` tab; filled changelog gaps for A5a and A7

## 2026-08-07 - Phase A10 + A5b: Messaging + late shells (Phase A exit)

- **A10** — Extracted 7 messaging symbols to `src/features/messaging/`: `StaffMessagesTab`, `ConversationList`, `NewDmPicker`, `NewPropertyThreadPicker`, `MessageThread`, `PortalMessagesTab`, `InboxView`
- **A5b** — Extracted late shells: `StaffApp`, `BetaShell` (+ `readBetaView`/`writeBetaView`/`isBetaFeaturesEnabled`), `ManagerShell`, `PortalApp`, `PortalSignIn`, `PortalPropertyPicker`, `PortalDashboard`
- **Deferred A6 money** — Also extracted money tab symbols still in `App.jsx` to `src/apps/staff/manager/money/` (required for thin entry)
- Co-located lib orphans: `resolveItemLabel` + picker dictionaries → `src/lib/pickerLabels.js`; `generatePortalUserCode` → `src/lib/portal.js`; `readPhotoTakenAt`/`sharePhotos`, `shiftBillableAmount`/`isoToLocalInput`/`localInputToISO` → existing lib modules
- `App.jsx` is now ~37 lines (route switch + `TranslationProvider` only); inventory regenerated (1 symbol)
- Updated bridge imports across portal, manager, cleaner consumers; `npm run build` passes

## 2026-08-07 - Phase A9: Cross-cutting assignments (`src/apps/cross-cutting/`)

- Extracted 20 cross-cutting assignment symbols into `src/apps/cross-cutting/`: modals/leaves (`WorkBlockAssignmentLink`, `SpanishTranslationPanel`, `WelcomeModal`, `IdleWarningModal`, `ChangePinModal`, `TranslationOverridesModal`, `SheetQuickViewModal`, `ReviewLine`, `NextUpModal`, `SwitchBedroomModal`, `ReassignModal`, `AttachmentModal`, `BlockedNoteModal`, `RequestNewItemModal`, `ReviewAssignmentModal`), views (`ChecklistAssignmentView`, `AssignmentViewer`, `SuggestedTabContent`), megacomponents (`ChecklistAssignmentWizard`, `AssignmentTabContent`)
- Co-located `QUICK_TYPES` → `src/lib/constants.js` (used by manager quick-assignment forms)
- Updated bridge imports in portal, manager, and cleaner consumers; `App.jsx` imports A9 symbols for `InboxView` (A10) internal use
- `App.jsx` ~9,100 lines removed (~18.8k → ~9.7k); `npm run build` passes

## 2026-08-07 - Phase A8: Portal tree (`src/apps/portal/`)

- Extracted 18 portal component symbols into `src/apps/portal/`: menu/team/code modals, home, history, invoices, schedule, assignments (list/form/detail/sections), photo upload/sections, unit-day view, resolved-damage history, recheck modals
- Shells remain in `App.jsx` for A5b: `PortalApp`, `PortalSignIn`, `PortalPropertyPicker`, `PortalDashboard`
- Portal files bridge-import symbols still in `App.jsx`: `WelcomeModal`, `PortalMessagesTab` (A10), `ChecklistAssignmentWizard`, `InvoiceDocument`, `SpanishTranslationPanel`; plus `QuickAssignmentForm` from manager and `SearchableUnitPicker` from cleaner
- `App.jsx` ~5,400 lines removed (~24k → ~18.8k); `npm run build` passes

## 2026-08-07 - Phase A7: Cleaner tree (`src/apps/staff/cleaner/`)

- Extracted 47 cleaner symbols into `src/apps/staff/cleaner/`: `EmployeeApp` shell, supply/property/unit pickers, work-block flow (including `InlineBedroomTasks`), tasks/photos, team-on-site, cards/lists, nav/menu, `AssignmentsPanel`
- Early bridge extractions for A7 dependencies: `ItemsDropdown`, `LeaveWorkblockModal` (pulled forward from A4/A7 boundary)
- Co-located label helpers → `src/lib/labels.js` where shared with manager tabs
- Cleaner files bridge-import symbols still in `App.jsx` at extraction time (A9 megacomponents, messaging, cross-cutting modals)
- `App.jsx` ~8,700 lines removed (~38k → ~29k); `npm run build` passes

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

## 2026-08-07 - Phase A5a: Early routing shells (`src/apps/`)

- Extracted `RootRouter`, `LandingPage` → `src/apps/`
- Extracted `SignIn`, `ConfigError` → `src/apps/staff/`
- `RootRouter` bridge-imports `StaffApp` (moved to A5b); hash routing unchanged
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
