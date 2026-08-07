# MVP

TidyTrack is a workforce-management tool for a cleaning business. It lets internal staff track their work at each property, gives internal staff and clients visibility into what got done (by whom, with photo proof), and supports the money side — invoicing clients, paying staff, and seeing profit.

## Users

Internal (works for the cleaning company) and Clients (hired the cleaning company) never overlap — every account is one or the other.

**Internal**

- **Owner**: Runs the cleaning company. Full access to everything.
- **Lead**: An employee with extra permissions (e.g. approve assignments, edit shift times). Still does cleaning work like an Employee. Formerly called "Manager".
- **Employee** (aka Cleaner): Does the cleaning. Works assignments, completes tasks.

**Clients**

- **Property Manager**: Hires the cleaning company. Creates/uploads assignments and manages their property info.
- **Property Owner**: Owns the building/unit tied to a Property Manager's account. Same portal as Property Manager, with a different badge/permissions.
- **PM Staff**: Works for the Property Manager. Same portal view as Property Manager, EXCEPT they must never see invoices/billing — that visibility is reserved for Property Manager and Property Owner only.

> Note: the codebase currently names the internal "Lead" role `manager` internally. This is a naming collision with the client-side "Property Manager" — the two are unrelated people. Until the code is updated, "Lead" in this doc maps to the `manager` role/value in code.

## Key concepts

- **Property**: A single site, or a multi-unit site broken into units (e.g. bedrooms).
- **Assignment**: A planned piece of work (what needs cleaning, and when). Created internally, or requested by a Property Manager/Owner and approved by an Owner or Lead before Employees see it.
- **Work block**: The span of time an Employee is clocked in at a property (start/end). The doc may say "session" for this idea; in code it's tracked as clock-in/out and work blocks — not the login session.
- **Task**: A specific cleaning item completed during a work block, verified with a photo.

## Core workflow

1. Work is planned: an assignment exists (created internally, or requested by a client and approved internally).
2. An Employee signs in, picks a property, and clocks in.
3. The Employee works an assignment, completing tasks with photo verification.
4. The Employee clocks out.
5. Internal staff and clients can see history of work across properties — assignments, completed units, tasks, and photos.
6. The Owner invoices clients for completed work, exports payroll for staff, and reviews profit/loss.

## MVP must include

Everything below needs to work together as one complete workflow, not as separate features.

**Work tracking**

- Sign-in distinguishing Internal staff from Clients (currently PIN-based; mechanism may change).
- Owners/Leads can manage properties, staff, and assignments.
- Employees can pick a property, clock in, work an assignment, complete tasks with photo verification, and clock out.
- Owners/Leads can view work history with photos across properties and staff.

**Client portal**

- Property Managers and Property Owners can request work, view cleaning status/history, and manage property info.
- PM Staff share the portal view but must never see invoices/billing.

**Money**

- Invoicing and billing (draft, price book, send to clients).
- Payroll export for staff.
- Profit/loss reporting for the Owner.
- **Portal invoice visibility (implementation):** opt-in per portal user via `can_view_invoices` (owner toggles in admin; default off for all kinds). Previewing owner always sees invoices. This is what the code does today — not kind-based defaults. Aspirational kind rules in the Users section above may differ; treat code behavior as authoritative until explicitly changed.

## Flexible / can change

These are in the product today but implementation details are not locked:

- Sign-in mechanism (PIN vs password, etc.)
- Data model naming (`session` vs work block, etc.)
- Notification system (see out of scope)
- UI and page structure

## Out of scope for now

- Messaging and notifications (nice-to-have polish, not part of the core loop)
- Specific UI/page structure
