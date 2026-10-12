# TidyTrack — Project Notes for Claude

Read this whole file before making any change. It holds the rules that past sessions had to learn the hard way.

## What this is
TidyTrack is the cleaning-operations app for Summit Clean (Utah), live at **app.gosummitclean.com**.
Stack: React single-page app + Supabase (database, auth, Edge Functions), deployed by Vercel from this repo.

## How Allan works
- Allan is non-technical and works **only in a browser on a Chromebook**: GitHub web editor, Vercel auto-deploy, Supabase SQL editor. No terminal, no local installs.
- Never hand back code to paste when you can commit it. Work on a branch, open a PR, and give Allan the **Vercel preview link** to test.
- Any database change must be a **single SQL script** he can paste into the Supabase SQL editor, with a one-line note on what it does and whether it's safe to re-run.
- Allan refers to screens by letter (A/B/C/D). Ask which screen if unsure.
- Plain-language summaries. Say what changed and what to test, not how the code works.

## Architecture
- Most of the app lives in one large `App.jsx` (~40,000+ lines), compiled with esbuild.
- A `BUILD_TAG` constant tracks the version (current series: `tap2xx`). **Bump it on every release.** Saved snapshots are named to match, e.g. `App-aug6-tap132.jsx`.
- Three roles, three shells:
  - **Owner / staff** → `ManagerShell`
  - **Cleaners** → `EmployeeApp`, `PropertyHub`, `BlockView`
  - **Property managers** → `PortalApp`
- Properties served: Carriage Cove, Bridges Apartments, Citifront Apartments, Cinnamon Tree Apartments.
- Billing: Carriage Cove is hourly / per-bedroom. Bridges and Citifront are flat-rate by unit size.
- Multi-cleaner assignments use the `assignment_assignees` table.

## Rules that must not break (UI stances)
- Cleaners **cannot** mark priority.
- No Quick Glance eye icons in any cleaner-facing view.
- Workblock cards: the **section name is always the headline**; items go in a dropdown.
- Each section gets its own workblock. The active one is labeled **"active job"**.
- Assignments board: the date filter applies **only to the Done tab**.
- Done button uses brand gold **#C99B5C**.
- Invoice print output omits "DRAFT", timestamps, the app name, and the URL.
- Don't propose items from the future-features list (e.g. messaging badges, group threads) unless Allan asks.

## Known pitfalls — check every time
- **Duplicate renderers:** many card types exist in several near-identical copies. When you change a UI pattern, **find and update every copy**, then list in the PR which ones you touched. This is the #1 source of repeat bugs.
- **Supabase 1,000-row cap:** PostgREST silently truncates at 1,000 rows. Any query that could grow must page with `.range()` loops.
- **Dates:** never build day windows in UTC. Use local-day logic. `localDayKey` must use 1-indexed, zero-padded months.
- **React hooks order:** no hooks after an early `return`.
- **Components defined inside other components** lose state on re-render (e.g. ticking timers). Keep card components like `WorkblockCard` at module scope.
- **Task inserts** need an active workblock first. Use `ensureActiveBlock()`.
- **Shift timer** is capped at 10pm of the start day. Don't remove the cap.
- **Stale overnight workblocks** still pile up and need periodic SQL cleanup.

## Security — do not loosen
- Row Level Security is scoped per role. Never open a policy back up to "allow all" to make something work. Fix the policy properly.
- PINs / codes are hashed with PBKDF2 (Web Crypto), with bcrypt fallback verification. Never store or log them in plaintext.
- Sign-in goes through the `secure-signin` Edge Function, with an automatic fallback.
- SELECT is revoked on credential columns. Don't re-grant it.

## Definition of done
1. Change works on the Vercel preview for every role it affects.
2. All duplicate renderers updated (listed in the PR).
3. `BUILD_TAG` bumped.
4. Any SQL provided as one paste-ready script.
5. Short plain-language note for Allan: what changed, what to test, by screen letter.
