import React, { useState } from "react";
import {
  Search,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Building2,
  Settings,
} from "lucide-react";
import { supabase, updateAssignmentScheduledDate } from "../../../lib/supabase.js";
import { assignmentTypeLabel } from "../../../lib/constants.js";
import { can, isOwner } from "../../../lib/permissions.js";
import { fmtDateWithDay, assignmentDueKind } from "../../../lib/format.js";
import { naturalCompare, floorFromLabel } from "../../../lib/compare.js";
import { shortenBedroom } from "../../../lib/labels.js";
import { AssignmentCard } from "../assignments/AssignmentCard.jsx";
import { AssignmentViewer } from "./AssignmentViewer.jsx";
import { BlockedNoteModal } from "./BlockedNoteModal.jsx";
import { ChecklistAssignmentView } from "./ChecklistAssignmentView.jsx";
import { ReassignModal } from "./ReassignModal.jsx";
import { AssignmentTargetCard } from "./AssignmentTargetCard.jsx";
import { AssignmentDoneGroups } from "./AssignmentDoneGroups.jsx";
import { useAssignmentTabLoad } from "../hooks/useAssignmentTabLoad.js";
import { PriorityChip } from "../../../components/chips/PriorityChip.jsx";

export function AssignmentTabContent({
  propertyId,
  employee,
  statusFilter,
  onUpdate,
  onGoToBedroom,
  onOpenBedroomHistory,
  onJoinBlock,
}) {
  const [opened, setOpened] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [collapsedBuildings, setCollapsedBuildings] = useState({});
  const [collapsedFloors, setCollapsedFloors] = useState({});
  const [bundleOpen, setBundleOpen] = useState({});

  const {
    targets,
    setTargets,
    loaded,
    loadError,
    reload,
    whosHereByParty,
    filterBuildings,
    setFilterBuildings,
    filterTypes,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    aptSearch,
    setAptSearch,
    doneWindow,
    setDoneWindow,
    filterCategories,
    setFilterCategories,
    filtersOpen,
    setFiltersOpen,
    isDoneView,
    filteredTargets,
    availableTypes,
    availableCleaners,
    availableCategories,
    activeFilterCount,
    toggleType,
    toggleBuilding,
    clearAllFilters,
    buildings,
    buildingKeys,
    visibleBuildings,
    countBedrooms,
    globalPriorityItems,
  } = useAssignmentTabLoad({ propertyId, statusFilter, employeeId: employee?.id });

  const [editDueId, setEditDueId] = useState(null);
  const canEditDatesT = can(employee, "edit_due_dates");
  const canViewTimelineT = can(employee, "view_submission_timeline");
  const [timelineOpenT, setTimelineOpenT] = useState(null);
  const [dueDraftT, setDueDraftT] = useState("");
  const saveDueT = async (id, date) => {
    setEditDueId(null);
    if (id) {
      await updateAssignmentScheduledDate(id, date);
      reload();
    }
  };

  const toggleCollapse = (b) =>
    setCollapsedBuildings((prev) => ({ ...prev, [b]: !prev[b] }));

  const isPostCutoff = (_t) => true;


  const bulkUpdateStatus = async (rows, newStatus, statusNotes) => {
    if (!rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab) {
      setTargets((prev) => prev.filter((t) => !ids.includes(t.id)));
    } else {
      setTargets((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t)),
      );
    }
    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (newStatus === "pending") {
      patch.started_at = null;
      patch.started_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .in("id", ids);
    setBusy(false);
    if (error) {
      reload();
      alert("Could not update: " + error.message);
      return;
    }
    reload();
    if (onUpdate) onUpdate();
  };

  const bulkTogglePriority = async (rows) => {
    if (!rows || rows.length === 0) return;
    const anyOn = rows.some((r) => r.priority);
    const next = !anyOn;
    const ids = rows.map((r) => r.id);
    setTargets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, priority: next } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .in("id", ids);
    if (error) {
      alert("Could not update priority: " + error.message);
      reload();
    }
  };

  const updateStatus = async (target, newStatus, statusNotes) => {
    // OPTIMISTIC: since this tab filters by statusFilter, an item that
    // just changed status no longer belongs in the current view —
    // remove it immediately so the cleaner sees the result of their
    // tap with zero delay. Reload below fetches the authoritative
    // state; realtime reconciles any discrepancy.
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab) {
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    } else {
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, status: newStatus } : t)),
      );
    }

    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (target.status === "done") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    // Move-to-pending wipes started_by/at so the assignment appears
    // fully unstarted in the Pending tab.
    if (
      newStatus === "pending" &&
      (target.status === "paused" ||
        target.status === "in_progress" ||
        target.status === "blocked")
    ) {
      patch.started_at = null;
      patch.started_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", target.id);
    setBusy(false);
    if (error) {
      // Roll back optimistic on failure so the user sees the truth
      reload();
      alert("Could not update: " + error.message);
      return;
    }
    setStatusModal(null);
    reload();
    if (onUpdate) onUpdate();
  };

  // Reopen a DONE item back to the state it was actually in — not a blanket
  // reset to "new". "We are done here" sweeps every item at a bedroom to done,
  // including ones never touched, so on reopen we use the work evidence to
  // restore each item honestly:
  //   • worked (has a real start / started_by) → in_progress (Active), so the
  //     cleaner picks it back up where they left off
  //   • never started (no started_at) → pending (New)
  // Completion stamps are cleared since it's no longer done.
  const reopenTarget = async (target) => {
    const wasWorked = !!target.started_at || !!target.started_by;
    const newStatus = wasWorked ? "in_progress" : "pending";
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab)
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    else
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, status: newStatus } : t)),
      );

    setBusy(true);
    const patch = { status: newStatus, completed_at: null, completed_by: null };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = target.started_by || employee?.id || null;
    } else {
      patch.started_at = null;
      patch.started_by = null;
    }
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", target.id);
    setBusy(false);
    if (error) {
      reload();
      alert("Could not reopen: " + error.message);
      return;
    }
    reload();
    if (onUpdate) onUpdate();
  };

  // Flip the priority flag on a single target.
  const togglePriority = async (target) => {
    const next = !target.priority;
    setTargets((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, priority: next } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .eq("id", target.id);
    if (error) {
      alert("Could not update priority: " + error.message);
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, priority: !next } : t)),
      );
    } else if (onUpdate) {
      onUpdate();
    }
  };

  // Tapping "Start" / "Resume" / "Go to this bedroom" on an assignment
  // card no longer mutates status. It just navigates to the prep
  // screen. The cleaner confirms with the big Start cleaning button
  // there — that's the SINGLE confirmation point. confirmPendingStart
  // → autoStartAssignmentsAtBedroom is what actually flips pending/
  // paused targets to in_progress. This stops "I clicked Go and now
  // the assignment is in_progress even though I didn't start work."
  const startAndGo = async (target) => {
    if (onGoToBedroom && target.unit_id && target.party_id) {
      onGoToBedroom(target);
    }
  };
  const reviewRequest = async (items, decision) => {
    const ids = (items || [])
      .filter(
        (t) => t.requested_by && (t.request_status || "pending") === "pending",
      )
      .map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("assignment_targets")
      .update({ request_status: decision })
      .in("id", ids);
    if (error) {
      alert("Could not update request: " + error.message);
      return;
    }
    reload();
    if (onUpdate) onUpdate();
  };
  const toggleBundle = (unitId) =>
    setBundleOpen((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  if (!loaded)
    return (
      <div className="text-center py-8 text-stone-400 text-xs">Loading…</div>
    );
  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        <div className="flex items-start gap-2 mb-1">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">Couldn't load assignments</span>
        </div>
        <div className="text-xs font-mono mt-2">{loadError}</div>
      </div>
    );
  }
  if (targets.length === 0) {
    const empties = {
      pending: "No pending assignments.",
      paused: "No paused assignments.",
      in_progress: "No assignments are in progress.",
      done: "No completed assignments yet.",
    };
    return (
      <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
        {empties[statusFilter]}
      </div>
    );
  }
  const renderGroupedItems = (items) => {
    if (items.length === 0) return null;

    // Group by unit_id (apartment). Items without a unit go in their own bucket.
    const groups = new Map(); // unitId or 'no-unit' -> { unit, items: [] }
    items.forEach((t) => {
      const key = t.unit_id || "no-unit";
      if (!groups.has(key)) {
        groups.set(key, { unit: t.unit, unitId: t.unit_id, items: [] });
      }
      groups.get(key).items.push(t);
    });

    // Sort apartments strictly by their label (natural compare). Per
    // the owner's request, multi-assignment apartments no longer
    // automatically jump to the top — order stays numerical so the
    // cleaner reads top-down 101, 102, 103, 201, 202, etc.
    const entries = Array.from(groups.entries()).sort((a, b) =>
      naturalCompare(a[1].unit?.label || "", b[1].unit?.label || ""),
    );

    return (
      <div className="space-y-2">
        {entries.map(([key, group]) => {
          // Distinct ASSIGNMENTS (jobs) in this apartment with open
          // work. The chip on the apartment pill counts jobs, not item
          // rows (which can hit the hundreds in a Fail-Entire scenario)
          // and not bedrooms (since one bedroom can carry a cleaning-
          // check AND a move-out check as two separate jobs). This
          // makes the chip number match the number of cards the cleaner
          // sees when they expand the apartment.
          const asgnIds = new Set();
          group.items.forEach((t) =>
            asgnIds.add(t.assignment_id || `${t.party_id || "no-party"}`),
          );
          const bedroomCount = asgnIds.size;

          // Single-job + single-item apartments render as a plain
          // card with no extra nesting. Saves a click.
          if (group.items.length === 1) {
            const t = group.items[0];
            return (
              <AssignmentCard
                key={t.id}
                target={t}
                busy={busy}
                propertyId={propertyId}
                onView={() => setOpened(t)}
                onStart={() => startAndGo(t)}
                onPause={() => updateStatus(t, "paused")}
                onMoveToPending={() => updateStatus(t, "pending")}
                onDone={() => updateStatus(t, "done")}
                onReopen={() => reopenTarget(t)}
                onBlocked={() => setStatusModal({ target: t })}
                onReassign={() => setReassignTarget(t)}
                onTogglePriority={togglePriority}
                canPrioritize={
                  can(employee, "mark_assignments_done") ||
                  can(employee, "upload_assignments")
                }
                canMarkDone={
                  can(employee, "mark_assignments_done") ||
                  t.started_by === employee?.id
                }
                canMarkDoneAlways={can(employee, "mark_assignments_done")}
                ownerView={isOwner(employee)}
                currentEmployeeId={employee?.id}
                onGoToBedroom={onGoToBedroom ? () => startAndGo(t) : null}
                canEditDates={can(employee, "edit_due_dates")}
                onSetDueDate={async (aid, date) => {
                  if (aid) {
                    await updateAssignmentScheduledDate(aid, date);
                    reload();
                  }
                }}
                onOpenBedroomHistory={onOpenBedroomHistory}
              />
            );
          }
          // Apartment-level expandable card. When expanded, we don't
          // dump every item — we group by BEDROOM (party_id) and
          // then by main SECTION inside each bedroom. Three taps
          // total to reach the item: apartment → bedroom → section.
          const isOpen = !!bundleOpen[key];
          const unitLabel =
            group.unit?.label || (key === "no-unit" ? "No unit" : key);
          const bundleHasPriority = group.items.some((t) => t.priority);
          // Most-urgent due status across this apartment's jobs.
          // Overdue only counts UNFINISHED work. A done item with a past
          // scheduled date is not overdue — it's done. Including it made a
          // fully-cleaned bedroom show "Overdue", which is nonsense.
          const unitDueKinds = group.items
            .filter((t) => t.status !== "done")
            .map((t) => assignmentDueKind(t.assignment?.scheduled_date))
            .filter(Boolean);
          const unitDue = unitDueKinds.includes("overdue")
            ? "overdue"
            : unitDueKinds.includes("today")
              ? "today"
              : unitDueKinds.includes("upcoming")
                ? "upcoming"
                : null;
          const earliestUpcoming = group.items
            .map((t) => t.assignment?.scheduled_date)
            .filter((d) => d && assignmentDueKind(d) === "upcoming")
            .sort()[0];
          // Build the assignment → section breakdown for the expanded
          // view. We key by party_id + assignment_id (NOT just party_id)
          // so two independent assignments at the same bedroom — e.g. a
          // cleaning-check done last week and a move-out check pending
          // this week — render as TWO separate cards. Each assignment is
          // its own job with its own lifecycle; marking one done must
          // never affect the other.
          const byBedroom = new Map(); // `${partyId}::${assignmentId}` -> { party, items, sections }
          group.items.forEach((t) => {
            const pid = t.party_id || "no-party";
            const aid = t.assignment_id || "no-asgn";
            const groupKey = `${pid}::${aid}`;
            if (!byBedroom.has(groupKey)) {
              byBedroom.set(groupKey, {
                party: t.party,
                partyId: t.party_id,
                assignmentId: t.assignment_id,
                assignment: t.assignment,
                items: [],
                sectionItems: {
                  bedroom: [],
                  vanity: [],
                  bathroom: [],
                  general: [],
                },
                hasPriority: false,
              });
            }
            const b = byBedroom.get(groupKey);
            b.items.push(t);
            const sec = (t.template_section || "").toLowerCase();
            if (b.sectionItems[sec]) b.sectionItems[sec].push(t);
            if (t.priority) b.hasPriority = true;
          });
          // Sort by bedroom label, then by assignment creation so a
          // bedroom's multiple assignments appear in a stable order.
          const bedroomEntries = Array.from(byBedroom.entries()).sort(
            (a, b) =>
              naturalCompare(
                a[1].party?.label || "",
                b[1].party?.label || "",
              ) ||
              naturalCompare(
                a[1].assignment?.created_at || "",
                b[1].assignment?.created_at || "",
              ),
          );
          return (
            <div
              key={key}
              className="rounded-xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden"
            >
              <button
                onClick={() => toggleBundle(key)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2
                    size={16}
                    className="text-amber-700 flex-shrink-0"
                  />
                  <span className="font-serif text-base text-stone-900 truncate">
                    {unitLabel}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex-shrink-0">
                    {(() => {
                      // Show WHICH bedrooms have work (e.g. "1, 3") instead of a
                      // bare job count — more useful at a glance. Pull the number
                      // out of each bedroom label ("Bedroom 3" / "BR 3" → 3),
                      // dedupe, sort numerically. Falls back to the count if a
                      // label has no number.
                      const nums = bedroomEntries
                        .map(([, b]) => {
                          const m = String(b.party?.label || "").match(/(\d+)/);
                          return m ? Number(m[1]) : null;
                        })
                        .filter((n) => n != null);
                      const uniq = Array.from(new Set(nums)).sort(
                        (a, b) => a - b,
                      );
                      if (uniq.length === 0)
                        return `${bedroomCount} job${bedroomCount === 1 ? "" : "s"}`;
                      return uniq.join(", ");
                    })()}
                  </span>
                  {unitDue === "overdue" && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                      Overdue
                    </span>
                  )}
                  {unitDue === "today" && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">
                      Today
                    </span>
                  )}
                  {unitDue === "upcoming" && earliestUpcoming && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 flex-shrink-0">
                      {fmtDateWithDay(earliestUpcoming)}
                    </span>
                  )}
                  {bundleHasPriority && <PriorityChip on={true} size="xs" />}
                </div>
                <ChevronRight
                  size={14}
                  className={`text-amber-700 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-amber-100 pt-3">
                  {bedroomEntries.map(([groupKey, bed]) => {
                    // Real party_id for this entry — used for whosHere
                    // lookups (which are per-bedroom) and as a stable
                    // React key suffix. The map key is partyId::asgnId
                    // so two assignments at one bedroom stay separate.
                    const pid = bed.partyId || "no-party";
                    const bedLabel = shortenBedroom(
                      bed.party?.label ||
                        (pid === "no-party" ? "Unassigned" : pid),
                    );
                    const sectionCounts = {
                      bedroom: bed.sectionItems.bedroom.length,
                      vanity: bed.sectionItems.vanity.length,
                      bathroom: bed.sectionItems.bathroom.length,
                      general: bed.sectionItems.general.length,
                    };
                    // Items not in any of the 4 known sections (legacy
                    // targets with no template_section, or one-offs).
                    const knownSectioned =
                      sectionCounts.bedroom +
                      sectionCounts.vanity +
                      sectionCounts.bathroom +
                      sectionCounts.general;
                    const otherCount = bed.items.length - knownSectioned;
                    const sectionBits = [];
                    if (sectionCounts.bedroom)
                      sectionBits.push(`Bedroom (${sectionCounts.bedroom})`);
                    if (sectionCounts.vanity)
                      sectionBits.push(`Vanity (${sectionCounts.vanity})`);
                    if (sectionCounts.bathroom)
                      sectionBits.push(`Bathroom (${sectionCounts.bathroom})`);
                    if (sectionCounts.general)
                      sectionBits.push(`General (${sectionCounts.general})`);
                    if (otherCount > 0)
                      sectionBits.push(`Other (${otherCount})`);

                    // Split this bedroom's items by cutoff. LEGACY
                    // (pre-cutoff) items render as the original per-item
                    // AssignmentCards — that's the contract the user
                    // asked for, so the Mon-Wed assignments behave
                    // exactly the way the cleaners are already used
                    // to. NEW (post-cutoff) items collapse into ONE
                    // bedroom-level card with the section breakdown +
                    // bulk action buttons.
                    const legacyItems = bed.items.filter(
                      (t) => !isPostCutoff(t),
                    );
                    const newItems = bed.items.filter((t) => isPostCutoff(t));

                    const firstTarget = bed.items[0];
                    const canGoToBedroom = !!(
                      onGoToBedroom &&
                      firstTarget?.unit_id &&
                      firstTarget?.party_id
                    );

                    // Build the bedroom-level bulk card (only when there
                    // are NEW items at this bedroom). We compute a few
                    // derived flags from the new-items subset:
                    //  - hasPriority: any new item has priority on
                    //  - statusBucket: the dominant status to display
                    //    in the read-only pill (pending wins, then
                    //    in_progress, then paused, then blocked, then done)
                    //  - allDone: every new item is already done
                    //  - canBulkComplete: at least one item can move to
                    //    done (i.e. not already done)
                    const bulkCard =
                      newItems.length > 0 ? (
                        <AssignmentTargetCard
                          groupKey={groupKey}
                          newItems={newItems}
                          firstTarget={firstTarget}
                          bedLabel={bedLabel}
                          group={group}
                          unitLabel={unitLabel}
                          sectionBits={sectionBits}
                          partyId={pid}
                          canGoToBedroom={canGoToBedroom}
                          busy={busy}
                          employee={employee}
                          whosHereByParty={whosHereByParty}
                          onJoinBlock={onJoinBlock}
                          reviewRequest={reviewRequest}
                          startAndGo={startAndGo}
                          bulkTogglePriority={bulkTogglePriority}
                          bulkUpdateStatus={bulkUpdateStatus}
                          setOpened={setOpened}
                          onOpenBedroomHistory={onOpenBedroomHistory}
                          canViewTimelineT={canViewTimelineT}
                          timelineOpenT={timelineOpenT}
                          setTimelineOpenT={setTimelineOpenT}
                          canEditDatesT={canEditDatesT}
                          editDueId={editDueId}
                          setEditDueId={setEditDueId}
                          dueDraftT={dueDraftT}
                          setDueDraftT={setDueDraftT}
                          saveDueT={saveDueT}
                          setStatusModal={setStatusModal}
                          setReassignTarget={setReassignTarget}
                          reload={reload}
                          onUpdate={onUpdate}
                        />
                      ) : null;
                    return (
                      <React.Fragment key={groupKey}>
                        {/* Legacy items at this bedroom — keep the
                           original per-item rendering so Mon-Wed
                           assignments stay exactly as the cleaners
                           are used to. */}
                        {legacyItems.map((t) => (
                          <AssignmentCard
                            key={t.id}
                            target={t}
                            busy={busy}
                            propertyId={propertyId}
                            onView={() => setOpened(t)}
                            onStart={() => startAndGo(t)}
                            onPause={() => updateStatus(t, "paused")}
                            onMoveToPending={() => updateStatus(t, "pending")}
                            onDone={() => updateStatus(t, "done")}
                            onReopen={() => reopenTarget(t)}
                            onBlocked={() => setStatusModal({ target: t })}
                            onReassign={() => setReassignTarget(t)}
                            onTogglePriority={togglePriority}
                            canPrioritize={
                              can(employee, "mark_assignments_done") ||
                              can(employee, "upload_assignments")
                            }
                            canMarkDone={
                              can(employee, "mark_assignments_done") ||
                              t.started_by === employee?.id
                            }
                            canMarkDoneAlways={can(
                              employee,
                              "mark_assignments_done",
                            )}
                            ownerView={isOwner(employee)}
                            currentEmployeeId={employee?.id}
                            onGoToBedroom={
                              onGoToBedroom ? () => startAndGo(t) : null
                            }
                            canEditDates={can(employee, "edit_due_dates")}
                            onSetDueDate={async (aid, date) => {
                              if (aid) {
                                await updateAssignmentScheduledDate(aid, date);
                                reload();
                              }
                            }}
                            onOpenBedroomHistory={onOpenBedroomHistory}
                          />
                        ))}
                        {/* NEW items at this bedroom: ONE bedroom-level
                           bulk card with section breakdown + all the
                           same action buttons as legacy. */}
                        {bulkCard}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  const renderAssignmentList = (items) => {
    // For non-Pending tabs we previously rendered each assignment_target
    // as a separate AssignmentCard. That meant a bedroom with 16 items
    // showed up as 16 cards on In progress / Paused / Blocked, which is
    // exactly the "ton of cards" the cleaner reported. Routing every
    // tab through renderGroupedItems collapses those rows down to ONE
    // bedroom-level card with the bulk-action chrome — same model as
    // Pending. We keep the priority-split below for the Pending tab
    // only since priority callouts are most useful when planning what
    // to do next.
    if (statusFilter !== "pending") {
      return renderGroupedItems(items);
    }

    // PENDING TAB: split priority vs the rest, render with visual divider.
    // Done / blocked excluded from priority since they've already been
    // resolved — "do these first" implies work still to do.
    const priorityItems = items.filter(
      (t) => t.priority && t.status !== "done" && t.status !== "blocked",
    );
    const normalItems = items.filter((t) => !t.priority);

    return (
      <div className="space-y-2">
        {priorityItems.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-1">
              <AlertCircle size={12} className="text-red-700 flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-red-700">
                Priority — do these first ({priorityItems.length})
              </span>
              <div className="flex-1 h-px bg-red-200" />
            </div>
            {renderGroupedItems(priorityItems)}
          </>
        )}
        {priorityItems.length > 0 && normalItems.length > 0 && (
          <div className="py-2 flex items-center gap-2 px-1">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
              Everything else
            </span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
        )}
        {normalItems.length > 0 && renderGroupedItems(normalItems)}
      </div>
    );
  };
  return (
    <div>
      {/* Apartment search — Done view only. Type an apartment/bedroom
         number to jump to it. */}
      {isDoneView && targets.length > 0 && (
        <div className="mb-3 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={aptSearch}
            onChange={(e) => setAptSearch(e.target.value)}
            placeholder="Search apartment number…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-700 focus:outline-none focus:border-stone-900"
          />
          {aptSearch && (
            <button
              onClick={() => setAptSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-stone-100 text-stone-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {/* Filters bar: toggle to expand, pills inside. Counts active filters
         on the button so the user knows when filters are narrowing things. */}
      {targets.length > 0 &&
        (availableTypes.length > 1 ||
          availableCleaners.length > 0 ||
          availableCategories.length > 0 ||
          isDoneView) && (
          <div className="mb-3">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${activeFilterCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
            >
              <div className="flex items-center gap-2">
                <Settings size={14} />
                <span className="text-xs uppercase tracking-wider font-mono">
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  Showing {countBedrooms(filteredTargets)} of{" "}
                  {countBedrooms(targets)}
                </span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
              />
            </button>
            {filtersOpen && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mt-1 space-y-3">
                {/* Type — multi-select chips. Click to add/remove from filter. */}
                {availableTypes.length > 1 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                      Cleaning type
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableTypes.map((typeVal) => {
                        const active = filterTypes.has(typeVal);
                        return (
                          <button
                            key={typeVal}
                            onClick={() => toggleType(typeVal)}
                            className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                          >
                            {active && <Check size={10} />}
                            {assignmentTypeLabel(typeVal)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Cleaner and Task-category filters removed per request —
                 the Done tab keeps only Cleaning type + a date range. */}
                {/* Completed-date RANGE — pick a start and end day. Leave a
                 side blank for an open-ended range. Only shown on the
                 Done-family tabs where completed dates exist. */}
                {isDoneView && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                      Specific range
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <label className="flex items-center gap-1 text-xs font-mono text-stone-600">
                        <span className="text-stone-400">From</span>
                        <input
                          type="date"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-stone-700"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs font-mono text-stone-600">
                        <span className="text-stone-400">To</span>
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-stone-700"
                        />
                      </label>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => {
                            setDateFrom("");
                            setDateTo("");
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-mono bg-stone-200 text-stone-600 hover:bg-stone-300"
                        >
                          Clear dates
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 mt-1">
                      Leave blank to show all. Pick the same day twice for one
                      day, or a span for a range.
                    </div>
                  </div>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[10px] uppercase tracking-wider font-mono text-amber-700 hover:text-amber-900"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      {/* Building filter pills — multi-select. Empty = all buildings. */}
      {buildingKeys.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilterBuildings(new Set())}
            className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${filterBuildings.size === 0 ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
          >
            All ({countBedrooms(filteredTargets)})
          </button>
          {buildingKeys.map((b) => {
            const on = filterBuildings.has(b);
            return (
              <button
                key={b}
                onClick={() => toggleBuilding(b)}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap flex items-center gap-1 ${on ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
              >
                {on && <Check size={10} />}
                {b === "—" ? "No unit" : b} ({countBedrooms(buildings[b])})
              </button>
            );
          })}
        </div>
      )}

      {/* Last 2 days / All time — placed here, below the building pills
         and directly above the results, where it's actually in view when
         scanning the list. (It also lives inside Filters, but only power
         users open that.) Only meaningful on the Done family of tabs. */}
      {isDoneView && !dateFrom && !dateTo && (
        <div className="flex p-0.5 bg-stone-100 rounded-lg mb-3 max-w-xs">
          <button
            onClick={() => setDoneWindow("recent")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-mono ${doneWindow === "recent" ? "bg-white shadow-sm text-stone-900 font-medium" : "text-stone-500"}`}
          >
            Last 2 days
          </button>
          <button
            onClick={() => setDoneWindow("all")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-mono ${doneWindow === "all" ? "bg-white shadow-sm text-stone-900 font-medium" : "text-stone-500"}`}
          >
            All time
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Global priority section — shows all priority items across
           buildings as a single block at the top of Pending. Pulled out
           of the per-building loop so they're never hidden behind a
           building they don't belong to.
           CRITICAL: priority items render as FLAT CARDS (no bundling,
           no collapse). The whole point of priority is "do this first" —
           if we hide priority items inside collapsed apartment bundles,
           the user has to tap to find them. Flat cards = every priority
           visible at a glance. */}
        {globalPriorityItems.length > 0 && (
          <div className="rounded-2xl border-2 border-red-300 bg-red-50/50 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <AlertCircle size={14} className="text-red-700 flex-shrink-0" />
              <span className="text-xs uppercase tracking-wider font-mono font-bold text-red-700">
                Priority — do these first ({countBedrooms(globalPriorityItems)})
              </span>
              <div className="flex-1 h-px bg-red-200" />
            </div>
            {/* Route priority items through renderGroupedItems so each
               BEDROOM collapses to one card — not one card per target.
               Move-out checks flag every one of their 8 items as
               priority, which previously rendered the same bedroom 8
               times. The count above and the cards below now both
               reflect distinct bedrooms. */}
            {renderGroupedItems(globalPriorityItems)}
          </div>
        )}

        {visibleBuildings.map((b) => {
          const items = buildings[b];
          // When global priority section is showing, exclude priority
          // items from the building loop so they don't appear twice.
          const itemsForBuilding =
            globalPriorityItems.length > 0
              ? items.filter((t) => !t.priority)
              : items;
          // If a building has ONLY priority items, skip rendering its
          // section entirely — its items are all in the top block.
          if (itemsForBuilding.length === 0) return null;
          const collapsed = !!collapsedBuildings[b];
          // Only show group header if there's more than 1 building total
          const showHeader = buildingKeys.length > 1;

          // Sub-group by FLOOR (first digit of the apartment number).
          // The owner asked for Floor 1 → Floor 2 → Floor 3 sections
          // so the cleaner reads the building top-down in the order
          // they'd physically walk it. Items without a parseable floor
          // (e.g. property-level no-unit) land in a "—" bucket.
          const byFloor = {};
          itemsForBuilding.forEach((t) => {
            const f = floorFromLabel(t.unit?.label);
            const key = f != null ? String(f) : "—";
            if (!byFloor[key]) byFloor[key] = [];
            byFloor[key].push(t);
          });
          const floorKeys = Object.keys(byFloor).sort((a, b) => {
            if (a === "—") return 1;
            if (b === "—") return -1;
            return parseInt(a, 10) - parseInt(b, 10);
          });
          // If there's only one floor's worth of items, skip the floor
          // labels — they'd be noise.
          const showFloorHeaders = floorKeys.length > 1;

          return (
            <div key={b}>
              {showHeader && (
                <button
                  onClick={() => toggleCollapse(b)}
                  className="w-full flex items-center justify-between mb-2 px-1 py-2 hover:bg-stone-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-stone-700" />
                    <span className="font-serif text-sm text-stone-900 font-bold">
                      {b === "—"
                        ? "No unit"
                        : `Building ${b.replace(/^B/i, "")}`}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      ({countBedrooms(itemsForBuilding)})
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-stone-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
                  />
                </button>
              )}
              {!collapsed &&
                (statusFilter === "done" ? (
                  <AssignmentDoneGroups
                    items={itemsForBuilding}
                    doneWindow={doneWindow}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    countBedrooms={countBedrooms}
                    renderAssignmentList={renderAssignmentList}
                  />
                ) : showFloorHeaders ? (
                  <div className="space-y-3">
                    {floorKeys.map((fk) => {
                      const floorKey = `${b}::${fk}`;
                      const floorOpen = !collapsedFloors[floorKey];
                      return (
                        <div key={fk}>
                          <button
                            onClick={() =>
                              setCollapsedFloors((prev) => ({
                                ...prev,
                                [floorKey]: !prev[floorKey],
                              }))
                            }
                            className="w-full flex items-center gap-2 mb-1.5 px-1 hover:bg-stone-50 rounded transition-colors text-left"
                          >
                            <ChevronRight
                              size={12}
                              className={`text-stone-500 flex-shrink-0 transition-transform ${floorOpen ? "rotate-90" : ""}`}
                            />
                            <span className="text-sm font-bold text-stone-800 tracking-wide">
                              {fk === "—" ? "Other" : `Floor ${fk}`}
                            </span>
                            <span className="text-xs font-mono text-stone-500">
                              ({countBedrooms(byFloor[fk])})
                            </span>
                            <div className="flex-1 h-px bg-stone-300" />
                          </button>
                          {floorOpen && renderAssignmentList(byFloor[fk])}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  renderAssignmentList(itemsForBuilding)
                ))}
            </div>
          );
        })}
      </div>

      {opened &&
        (opened.assignment?.template_set_id ? (
          <ChecklistAssignmentView
            assignment={opened.assignment}
            onOpenSibling={(a) => setOpened((o) => ({ ...o, assignment: a }))}
            employee={employee}
            quickGlance={true}
            onClose={() => setOpened(null)}
            onOpenSheet={
              opened.assignment?.file_url
                ? () =>
                    window.open(
                      opened.assignment.file_url,
                      "_blank",
                      "noopener",
                    )
                : null
            }
          />
        ) : (
          <AssignmentViewer
            target={opened}
            employee={employee}
            onClose={() => setOpened(null)}
          />
        ))}
      {statusModal && (
        <BlockedNoteModal
          target={statusModal.target}
          onSave={(notes) => {
            // When the bedroom-level "Blocked" button opens this modal
            // it sets bulkRows = every new item at the bedroom. We
            // apply the same blocked + note to all of them in one call.
            // Per-item Blocked (legacy AssignmentCard) doesn't set
            // bulkRows, so it falls back to single-target update.
            if (statusModal.bulkRows && statusModal.bulkRows.length > 0) {
              bulkUpdateStatus(statusModal.bulkRows, "blocked", notes);
              setStatusModal(null);
            } else {
              updateStatus(statusModal.target, "blocked", notes);
            }
          }}
          onClose={() => setStatusModal(null)}
          busy={busy}
        />
      )}
      {reassignTarget && (
        <ReassignModal
          target={reassignTarget}
          propertyId={propertyId}
          onSaved={() => {
            setReassignTarget(null);
            reload();
            if (onUpdate) onUpdate();
          }}
          onClose={() => setReassignTarget(null)}
        />
      )}
    </div>
  );
}
