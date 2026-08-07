# Manual Smoke-Test Checklist — App.jsx Split

**Purpose:** run this click-through after every extraction batch during the [App.jsx split](../ai/roadmaps/2026-08-06_app-jsx-split_roadmap.md) (Phase A/B). Verification is local-dev only (`npm run dev` / `npm run build`) — no staging/Vercel preview deploy is used for this effort.

**How to use:** `npm run build` first (catches import errors immediately), then `npm run dev` and walk through the sections below relevant to what changed. High-risk items (marked ⚠️) should be checked specifically any time a batch touches their code.

---

## 1. Staff — sign-in & cleaner flow

- [ ] Staff PIN sign-in succeeds with a known employee PIN
- [ ] Cleaner clock-in at a property/unit
- [ ] Cleaner completes a task with photo verification (includes `InlineBedroomTasks` in work-block flow when applicable)
- [ ] Cleaner clock-out

## 2. Staff — manager/owner flow

- [ ] Manager daily view loads and shows expected data
- [ ] Assignments tab: list loads, open an assignment detail
- [ ] Property admin: open property list, view/edit a property
- [ ] Money/invoice view loads (e.g. `MoneyView` / invoice list)

## 3. Client portal

- [ ] Portal sign-in succeeds with a known portal user
- [ ] Submit a new request (assignment request)
- [ ] View request/cleaning history

## 4. Messaging (all three realtime surfaces) ⚠️

- [ ] Assignment sync updates live (`useAssignmentSync`) — e.g. change on one client reflected on another without reload
- [ ] Message list channel updates live (new conversation/message appears without reload)
- [ ] Message thread channel updates live (new message in an open thread appears without reload)
- [ ] No duplicate/doubled realtime events in dev (watch for `React.StrictMode` double-subscribe artifacts — see plan §Technical considerations)

## 5. Owner preview flows ⚠️

- [ ] Cleaner preview: `ManagerShell` → `EmployeeApp` — enter preview, confirm `previewMode`/`onSignOut` contract, exit preview
- [ ] PM preview: `ManagerShell` → `PortalApp` — enter preview, confirm `previewMode`/`previewEmployee`/`onExitPreview` contract, exit preview
- [ ] Preview persistence survives a reload (`manager_preview_cleaner_{id}` / `manager_preview_pm_{id}` via `usePagePersistence`)
- [ ] Sign-out from `StaffApp` clears `tidytrack_page_manager_preview_*` keys

## 6. Locale / translation ⚠️

- [ ] Toggle to Spanish — UI text translates via `TranslationProvider`
- [ ] Toggle back to English — page reloads correctly (`window.location.reload()` path)

## 7. Known non-regressions (do not treat as bugs)

- [ ] `BetaShell` PM stub (`BetaShell` → PM view: "Coming soon" / PortalShell adapter message) — intentionally non-functional; stays that way post-split
- [ ] SMS alerts stub ("Coming soon: text-message alerts…") — intentionally non-functional; stays that way post-split

---

## Branch / commit strategy (resolved)

- Human (not the agent) performs all git operations — commits, staging, pushes. The agent only edits the working tree and reports changes for review, per `aiDocs/context.md`.
- No Vitest/RTL until Phase A exit; verification per batch is `npm run build` + this checklist.
