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
- Most of the app lives in one large `App.jsx` (~51,000 lines, 2.6 MB), compiled with esbuild.
- A `BUILD_TAG` constant tracks the version (current series: `tap2xx`). **Bump it on every release.** Saved snapshots are named to match, e.g. `App-aug6-tap132.jsx`.
- Three roles, three shells:
  - **Owner / staff** → `ManagerShell`
  - **Cleaners** → `EmployeeApp`, `PropertyHub`, `BlockView`
  - **Property managers** → `PortalApp`
- Properties served: Carriage Cove, Bridges Apartments, Citifront Apartments, Cinnamon Tree Apartments, Legends.
- Billing: Carriage Cove is hourly / per-bedroom. Bridges and Citifront are flat-rate by unit size. This matters for anything that touches time, because at an hourly property block durations **are** money — and Allan sometimes pays cleaners hourly at the flat-rate properties too, so treat minutes as money everywhere.
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


---

# Added by Claude sessions — keep this current

Every new rule we agree on and every new *kind* of bug goes in this section.

## Getting changes to Allan (read this before promising a PR)

- A Claude session cannot push to this repo unless `summit-go/tidytrack` is added to the
  session's authorized sources. Without that, `git push` returns 403 from the proxy and the
  only delivery is a file Allan uploads himself. **Check push access before promising a branch
  or a preview link.**
- `App.jsx` is ~2.6 MB, over GitHub's ~1 MB inline-edit limit. The pencil icon will not open it.
  The path is **Add file → Upload files**, dropping the new `App.jsx` into `src/`.
- Allan can still get a Vercel preview without a terminal: on the commit screen choose
  **"Create a new branch for this commit and start a pull request"**. Vercel builds a preview
  for the PR. That is how Definition of done #1 gets satisfied when we cannot push.
- Deliver one file per release with a dated name (`App-oct12-tap238.jsx`) because repeat
  downloads of the same filename collide in his Downloads folder.

## SQL scripts

- Convention `vNN_description.sql`. **Taken: v70 (company_settings), v71 (its RLS policies),
  v72 (customers.presence_window_minutes), v73 (work_blocks.auto_closed).** Next is v74.
- Every script must be **safe to paste whole and press Run**. No placeholders to fill in, no
  `'PASTE-THE-ID-HERE'`, no `drop column`, no destructive statement mixed in with reads.
  Undo statements are included **commented out**. Allan pastes the entire file; anything that
  needs editing first will error.
- The Supabase editor shows only the **last** result. Put the one query whose output matters at
  the bottom, and say in the file which number he should read back.
- Beware `ilike '%name%'` property matchers — they are a trap when a property name is a
  substring of another. Match explicitly and return the affected rows so the result proves it.

## Security — the real state, which differs from the stance above

The "RLS is scoped per role" rule is the right stance but is not what the database does today.
The app signs everyone in through a **single shared anon key** with no per-user auth session,
so `auth.uid()` is always null and a per-role policy cannot resolve a role. Consequences:

- `company_settings` (v70/v71) has `using (true)` read/insert/update policies. Those were
  needed to make saving work at all, and they match the access level the rest of the tables
  already run at. **This is a known deviation from the rule above, not an endorsement of it.**
  It is why the payment-instructions field must never hold bank account numbers.
- Do not add a new `using (true)` policy without saying so out loud to Allan.
- Real per-role enforcement needs per-user Supabase auth sessions. That is a project, not a fix.
- Because the key is shared, **the client is the only thing filtering PM-facing data.** Any
  query reachable from `PortalApp` must filter in the query itself. Three separate PM data
  leaks this year were all of this shape, including one that exposed cleaner names and raw
  notes on photos.

## Time, presence and money — the rules that cost real money

- **`end_time IS NULL` is not presence.** An open row means "nobody closed this", which is
  usually a forgotten block, not a person standing in a bedroom. Presence is
  `blockIsStale()` / `presentOpenBlockIds()` and nothing else.
- **There is exactly one presence rule and it lives in `blockIsStale()`.** Never write a second
  cutoff next to a screen. Four screens had independently drifting copies; that was a bug class.
- The window is **per property**, on `customers.presence_window_minutes` (v72), read through
  `presenceWindowFor(blockPropertyId(b))`. Carriage Cove 120, Bridges / Citifront / Legends 300.
- **`InvoiceView.generate()` bills hourly work from raw `end_time - start_time` with no cap.**
  `MAX_BLOCK_HOURS = 8` exists only in `ProfitReportView`'s runaway filter and never reaches an
  invoice. Therefore **anything that changes how or when a work block is closed changes an
  invoice.** Treat every edit to a closing path as a billing change.
- A sweep that stamps `end_time = NOW()` on an abandoned block makes the recorded duration
  depend on when someone happened to open a screen. Close an abandoned row at a *derived* time
  (start + window, or last activity), never at `NOW()`.
- Auto clock-out: `IDLE_WARN_MS` 45 min (warning), `IDLE_LIMIT_MS` 1 hour (clock out, shift
  end set back to last activity), `STALE_IDLE_MIN` 90 min (server-side sweep when the app is
  closed). Every clock-out path closes only `activeBlock`, so other open blocks are orphaned.
- `reload()` in `EmployeeApp` is **mount-only** by design. A realtime refresh must not adopt a
  task; adopting one unmounted the picker under a cleaner's thumb.

## On-screen numbers drift from the constants behind them

A recurring bug class: help text and modals hardcode a number that a constant also defines,
then the constant changes. Found live this session — `IdleWarningModal` told cleaners
"no activity for 2 hours" and "3 more hours" when the real values were 45 minutes and
15 minutes, so a cleaner who trusted it lost pay. The Edit Property help text claimed the
bedroom limit "never closes anything or changes anyone's hours", which was false above 120.

**Rule:** any sentence stating a duration, a price or a limit must interpolate the constant, or
be checked against it in the same change. And never write UI copy that promises something is
safe unless you have read the code that would make it unsafe.

## Working rules for the agent crew

- Scratch files, plans, build notes and test reports go in `/home/claude/crew-work/<project>/`.
  **Never inside the repo** — a stop hook fails the run.
- Re-fetch `origin/main` and diff before building anything. A stale base once nearly reverted
  three shipped fixes silently.
- **Do not relay an alarming finding to Allan until it has been verified against the code.**
  One unverified billing alarm this session was wrong and cost real trust.
- Triage by blast radius rather than running the full pipeline on everything: copy and layout
  get fixed directly; behaviour that cannot lose data goes coder + review; anything touching
  money, permissions, deletion or the PM portal gets the full crew.
- A verification query that reports success while skipping the rows it was meant to check is
  worse than no check. State what a *failing* result would look like.


## A number the owner can type is never an input to a stored duration

The load-bearing rule of this project, learned by getting it wrong twice in one session.
Three concerns that happen to be measured in minutes, and **no two of them may ever be merged**:

| Concern | Who decides | Rule |
|---|---|---|
| What a **screen says** | `customers.presence_window_minutes`, owner-editable, 15–1440 | display only |
| **Whether** to close an abandoned row | `max(STALE_FORCE_MIN, that property's window)` | floored at 120 so lowering a window can never close anything early |
| **What `end_time` to write** | the row's own child records — the last task that actually finished, else `start_time` | never `NOW()`, never derived from a setting |

What went wrong when they were merged: closing a block at `start_time + window` turned the
bedroom-limit field into a billing multiplier in both directions. Lowering a property to 15
turned 90 minutes of real work into `0.25 h`; raising it to the field's own 1440 ceiling put
24 hours on one bedroom. `NOW()` is the other failure — it makes a recorded duration depend on
when somebody happened to open a screen, so the same abandoned block bills differently
depending on nothing.

Related: **do not tell Allan to set a value as a test** without reading what that value does.
A one-minute acceptance check of "set the limit to 15 and watch her disappear" would have
closed every live shift at that property.

## Three more bug classes found the hard way

- **When a fix makes an error smaller, check what used to detect it.** Closing abandoned blocks
  honestly made them slip *under* `MAX_BLOCK_HOURS = 8`, so the loud red "forgot to clock out"
  banner went quiet and the rows moved from excluded to counted as real labour. Small and
  undetectable is worse than large and flagged. `work_blocks.auto_closed` (v73) and
  `shifts.auto_clocked_out` exist for exactly this.
- **A missing-column fallback is needed on the WRITE as well as the READ.** An `UPDATE` naming a
  column absent from the schema cache fails outright and changes nothing — so a half-guarded
  feature does not degrade, it silently stops working. `autoClosedWrite` / `audienceWrite` are
  the shape to copy.
- **Never compare two timestamps as strings.** `toISOString()` gives `…T13:30:00.000Z`;
  PostgREST gives `…T13:30:00+00:00`, sometimes with microseconds. Equal instants, unequal
  strings, every time.

## Paying employees is not billing the property

- `dayPayBreakdown` (~17300) is the **only** function that decides what a cleaner is owed, and
  it reads `bill_mode` once to choose hourly vs flat. Of the 9 `bill_mode` references in the
  file, that one is payroll and the other 8 are billing. Otherwise the two are already separate:
  no invoice path reads `employee_pay_days`, no pay path writes an invoice. Keep it that way.
- Hourly pay lines use `shiftBillableMs` (idle-deducted, capped). Flat lines use raw
  `end_time - start_time` summed per assignment, with no cap and no idle deduction. They are
  different numbers; say which one a screen is showing.
- **`employee_pay_days.amount` is written on "Mark paid" and read nowhere.** Every total is a
  live recompute, so an hourly day already marked paid changes if its times later change. Flat
  is safe because the amount is typed. Freeze paid lines with the `.is(col, null)` guard
  `writeCompanySnapshot` already uses.
- One hourly rate per employee (`employees.pay_rate_hourly`), no per-property rate. Flat pay per
  apartment size lives in the price book as `__aptpay__:<size>` rows.
- "Adjust hours" on one apartment's pay line rewrites the **whole property-day** — `saveAdjust`
  zeroes every non-anchor shift to its own `start_time` and closes open blocks at that instant,
  and a zero-duration block bills $0. This is the one route a pay action leaks into billing.

## Shift cards lead with the four facts, in this order

Allan reads a shift card as: **which complex, which apartment, what size, what kind of clean.**
Clock times, visit counts, block counts and money come after that and are visually quieter.
The Shifts tab has **three** sub-views and all three must agree — "By cleaner"
(`ShiftsByCleanerView`), "All shifts" (`ShiftList`), "By apartment" (`GroupedByPartyView`) —
plus `ShiftsByCleanerView` is mounted again under Money → Payroll. `ShiftDetail` is the
drill-in and is deliberately different. Use `AssignmentTypeChip` for the cleaning type, never a
bare `assignmentTypeLabel()` string, so it stays colour-coded with the rest of the app. Put
`flex-wrap` on any row holding several pills — a footer without it let pills run off the card
edge on a phone.

Don't print the complex on every row. Name it once per run of apartments in it, and when a
card-level line also names it, that line must name **only** the complexes the visible rows do
not — a day can span two properties, and the per-apartment rows are capped at six.

## "Not set" is not the same as "not selected"

`ShiftsByCleanerView` is mounted on **two different queries**: the Shifts tab's selects
`bedrooms` and the `assignment` embed, Money → Payroll's does not. So a chip gated only on a
falsy value showed "No type" on every Payroll row for jobs that were in fact labelled, sending
Allan hunting for nothing. PostgREST **omits an unselected embed's key entirely** and returns
`null` when it is selected but empty, so `'assignment' in row` is what distinguishes them.
`DailyUnitDayDetail` had already written this rule down: "No type" has to mean *nobody labelled
it*, never *we haven't asked yet*. Check it on every mount of a shared component, not just the
one you are looking at.

## Screen names

The A/B/C/D letters Allan uses are the **cleaner** screens (`CL-A` 11034, `CL-B` 11203,
`CL-C` 12537, `CL-D` 11914). Owner screens have their own names — `OW-SHIFTS`, `OW-MONEY`,
`OW-PROPS`. Don't ask him for a letter on an owner-side request.
