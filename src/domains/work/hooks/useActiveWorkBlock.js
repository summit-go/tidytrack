import { useState, useEffect } from "react";
import { supabase, PHOTO_BUCKET } from "../../../lib/supabase.js";
import { KIND_CANNOT } from "../../../lib/constants.js";
import { isPmApprovedAssignment } from "../../../lib/assignments.js";
import { isLead } from "../../../lib/permissions.js";
import { compressImage, readPhotoTakenAt } from "../../../lib/photos.js";
import {
  isTextTranslateConfigured,
  translateText,
} from "../../../lib/translation.js";

export function useActiveWorkBlock({
  employee,
  previewMode,
  onSignOut,
  navigationRef,
}) {
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);

  const [newTaskName, setNewTaskName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, []);

  const reload = async () => {
    // Only re-attach to shifts matching the current mode. Without this,
    // an owner who left a preview shift open and then opened the app
    // normally would resume the preview shift as a real one (or vice
    // versa). Strict mode-match prevents that.
    const { data: activeShift } = await supabase
      .from("shifts")
      .select("*, customer:customers(*)")
      .eq("employee_id", employee.id)
      .eq("is_preview", previewMode)
      .is("end_time", null)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShift) {
      setShift(activeShift);
      if (activeShift.customer?.property_type === "multi_unit") {
        const { data: blocks } = await supabase
          .from("work_blocks")
          .select(
            "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
          )
          .eq("shift_id", activeShift.id)
          .order("start_time", { ascending: true });
        let allBlocks = blocks || [];
        // The query above only sees blocks from THIS shift. If the cleaner
        // clocked out and back in (or the phone reloaded the app into a new
        // shift), their earlier blocks — and the photos in them — live under
        // the previous shift and would vanish for them, even though other
        // cleaners still see them. Pull this cleaner's OWN closed blocks from
        // today at this property and merge any that aren't already loaded, so
        // their photos always come back with them.
        try {
          // Same rolling window as the Done tab (see doneBlocks) — a block
          // the cleaner started on a previous day and is continuing today
          // should come back with its photos, not just today's blocks.
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - 6);
          const { data: mine } = await supabase
            .from("work_blocks")
            .select(
              "*, unit:units(*), party:parties(*), shift:shifts!inner(id, employee_id, customer_id), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
            )
            .eq("shift.employee_id", employee.id)
            .eq("shift.customer_id", activeShift.customer_id)
            .gte("start_time", dayStart.toISOString())
            .order("start_time", { ascending: true });
          if (mine && mine.length) {
            const have = new Set(allBlocks.map((b) => b.id));
            const extra = mine.filter((b) => !have.has(b.id));
            if (extra.length) {
              allBlocks = [...allBlocks, ...extra].sort(
                (a, b) => new Date(a.start_time) - new Date(b.start_time),
              );
            }
          }
        } catch (e) {
          console.warn("[reload] could not merge own earlier blocks", e);
        }
        setWorkBlocks(allBlocks);
        const live = allBlocks.find((b) => !b.end_time);
        if (live) {
          setActiveBlock(live);
          // A cleaner can end up with more than one open block at the SAME
          // bedroom (e.g. a stale earlier shift never closed). Each block's
          // tasks — and the before/after photos on them — would otherwise be
          // split, and the ones on the non-active block would look "missing".
          // So gather tasks from EVERY open block at this same unit+party, not
          // just the one we picked as active. Dedupe by task id.
          const sameSpotOpen = allBlocks.filter(
            (b) =>
              !b.end_time &&
              b.unit_id === live.unit_id &&
              b.party_id === live.party_id,
          );
          const seen = new Set();
          const mergedTasks = [];
          sameSpotOpen.forEach((b) =>
            (b.tasks || []).forEach((t) => {
              if (!seen.has(t.id)) {
                seen.add(t.id);
                mergedTasks.push(t);
              }
            }),
          );
          setTasks(mergedTasks.length ? mergedTasks : live.tasks || []);
          const liveTask =
            mergedTasks.find((t) => !t.end_time) ||
            (live.tasks || []).find((t) => !t.end_time);
          if (liveTask) setActiveTask(liveTask.id);
        }
      } else {
        const { data: ts } = await supabase
          .from("tasks")
          .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
          .eq("shift_id", activeShift.id)
          .is("work_block_id", null)
          .order("start_time");
        setTasks(ts || []);
        const live = (ts || []).find((t) => !t.end_time);
        if (live) setActiveTask(live.id);
      }
    }
    setLoaded(true);
  };

  const doClockIn = async ({ customerId, billRate, propertyType }) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        employee_id: employee.id,
        customer_id: customerId || null,
        bill_rate_at_work: propertyType === "simple" ? billRate : null,
        // Tag preview-mode shifts so reports/payroll exclude them
        is_preview: previewMode,
      })
      .select("*, customer:customers(*)")
      .single();
    setBusy(false);
    if (error) {
      alert("Could not clock in: " + error.message);
      return;
    }
    setShift(data);
    setWorkBlocks([]);
    setTasks([]);
    navigationRef.current.setClockInFlow(null);
  };

  const clockOut = async () => {
    const hasOpen = activeBlock && !activeBlock.end_time;
    const msg = hasOpen
      ? "You have an active work block. End shift anyway?"
      : "End your shift?";
    if (!confirm(msg)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({ end_time: new Date().toISOString() })
      .eq("id", shift.id);
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setBusy(false);
  };

  // Sign-out wrapper that force-clocks-out any active shift before
  // exiting. This prevents ghost shifts from cleaners who tap "Sign out"
  // while still on the clock. Note we do NOT pop a confirm dialog here
  // because the user already confirmed (by tapping Sign out); we just
  // close out their work cleanly in the background.
  const signOutWithCleanup = async () => {
    try {
      if (activeTask) {
        try {
          await stopTask(activeTask, false);
        } catch (e) {
          console.warn("[signOut] stopTask failed", e);
        }
      }
      // Before closing the block, park any in-progress items at this
      // shift as 'paused' rather than leaving them 'in_progress' with no
      // open block behind them. An orphaned in_progress item claims
      // someone is actively cleaning when nobody is, and it doesn't
      // surface in the Paused bucket where a cleaner would look to
      // resume. This is the same routing the manual back-out uses.
      if (shift?.id) {
        try {
          await supabase
            .from("assignment_targets")
            .update({ status: "paused" })
            .eq("started_by", employee.id)
            .eq("status", "in_progress");
        } catch (e) {
          console.warn("[signOut] pause-in-progress failed", e);
        }
      }
      if (activeBlock && !activeBlock.end_time) {
        await supabase
          .from("work_blocks")
          .update({ end_time: new Date().toISOString() })
          .eq("id", activeBlock.id);
      }
      if (shift && !shift.end_time) {
        await supabase
          .from("shifts")
          .update({ end_time: new Date().toISOString() })
          .eq("id", shift.id);
      }
      // Also close any open view-only session so the audit trail is clean
      if (navigationRef.current.viewOnlySession && !navigationRef.current.viewOnlySession.end_time) {
        try {
          await supabase
            .from("view_only_sessions")
            .update({ end_time: new Date().toISOString() })
            .eq("id", navigationRef.current.viewOnlySession.id);
        } catch (e) {
          console.warn("[signOut] view-only close failed", e);
        }
      }
    } catch (e) {
      console.warn(
        "[signOutWithCleanup] cleanup error (proceeding with sign out)",
        e,
      );
    }
    // Clear local state, then let the parent finish the sign-out
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    navigationRef.current.setViewOnlySession(null);
    navigationRef.current.setViewOnlyProperty(null);
    onSignOut();
  };

  // Auto clock-out triggered by idle detector. endTs = the last activity time;
  // we use that as the shift's end_time so billable time excludes the idle gap.
  const autoClockOut = async (endTs) => {
    if (!shift) return;
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date(endTs).toISOString() })
        .eq("id", activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({
        end_time: new Date(endTs).toISOString(),
        auto_clocked_out: true,
      })
      .eq("id", shift.id);
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    alert(
      "You were clocked out automatically after 1 hour of inactivity. Your time was adjusted to your last activity. Talk to your manager if this is a mistake.",
    );
  };

  const autoStartAssignmentsAtBedroom = async (unitId, partyId) => {
    if (!shift?.customer_id) return;
    try {
      // Find pending OR paused targets at this exact bedroom OR property-wide for this customer
      const { data: targets } = await supabase
        .from("assignment_targets")
        .select(
          "id, status, assignment:assignments!inner(id, customer_id, active, source, pm_status, deleted_at)",
        )
        .in("status", ["pending", "paused"])
        .or(
          `and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`,
        );
      const eligible = (targets || []).filter(
        (t) =>
          t.assignment?.customer_id === shift.customer_id &&
          t.assignment?.active &&
          !t.assignment?.deleted_at &&
          isPmApprovedAssignment(t.assignment),
      );
      if (eligible.length === 0) return;
      const ids = eligible.map((t) => t.id);
      await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          started_by: employee.id,
        })
        .in("id", ids);
    } catch (e) {
      console.warn("[auto-start assignments] failed", e);
    }
  };

  const onPickBlockParty = async (party, workNotes) => {
    setBusy(true);
    const { unit } = navigationRef.current.blockStartFlow;
    // Defensive safety: only one open work block per shift. If another open
    // block exists (could happen across devices / stale state), close it
    // first so the new one's start time is correct and we never end up
    // double-clocked.
    try {
      const { data: openBlocks } = await supabase
        .from("work_blocks")
        .select("id")
        .eq("shift_id", shift.id)
        .is("end_time", null);
      if (openBlocks && openBlocks.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in(
            "id",
            openBlocks.map((b) => b.id),
          );
      }
    } catch (e) {
      console.warn("[onPickBlockParty] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: unit.id,
        party_id: party.id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        work_notes: workNotes || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    navigationRef.current.setBlockStartFlow(null);
  };

  const _DEPRECATED_onPickBlockParty_LEGACY_UNUSED = async (
    party,
    workNotes,
  ) => {
    setBusy(true);
    const { unit } = navigationRef.current.blockStartFlow;
    // Defensive safety: only one open work block per shift. If another open
    // block exists (could happen across devices / stale state), close it
    // first so the new one's start time is correct and we never end up
    // double-clocked.
    try {
      const { data: openBlocks } = await supabase
        .from("work_blocks")
        .select("id")
        .eq("shift_id", shift.id)
        .is("end_time", null);
      if (openBlocks && openBlocks.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in(
            "id",
            openBlocks.map((b) => b.id),
          );
      }
    } catch (e) {
      console.warn("[onPickBlockParty] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: unit.id,
        party_id: party.id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        work_notes: workNotes || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      // Reflect any pre-closed blocks in local state too
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    navigationRef.current.setBlockStartFlow(null);
    // No auto-start: tapping "Start cleaning" only starts the WORK BLOCK
    // timer. Targets stay pending until the cleaner explicitly picks
    // them in the task picker. This stops the surprise where every
    // assignment at the bedroom flipped to in_progress on entry.
  };

  const undoClosedBlock = async (block) => {
    if (!block?.id) return;
    const canUndoAnyone =
      isLead(employee);
    const isMine = block.shift_id === shift?.id;
    if (!canUndoAnyone && !isMine) {
      alert(tt("You can only undo work blocks you started yourself."));
      return;
    }
    const taskCount = (block.tasks || []).length;
    const photoCount = (block.tasks || []).reduce(
      (sum, t) =>
        sum + ((t.photos || []).filter((p) => !p.deleted_at).length || 0),
      0,
    );
    const detail = [
      taskCount > 0 && `${taskCount} task${taskCount === 1 ? "" : "s"}`,
      photoCount > 0 && `${photoCount} photo${photoCount === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const msg = tt(
      `Undo this finished workblock at ${block.unit?.label} · ${block.party?.label}? ${detail ? `${detail} will be deleted. ` : ""}Items marked done during this block will go back to pending. This cannot be reversed.`,
    );
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      // Revert in_progress + done items that this cleaner advanced
      // during the block's time window. We can't precisely tell
      // which items were touched in THIS block vs others, so we use
      // a conservative scope: items at this bedroom where the
      // started_by OR completed_by matches the block's shift's
      // employee. Owners/managers undoing someone else's block
      // revert based on the shift owner's id.
      const targetCleanerId = block.shift?.employee?.id;
      if (targetCleanerId && block.unit_id && block.party_id) {
        // Reset items started by this cleaner that are still in flight
        await supabase
          .from("assignment_targets")
          .update({
            status: "pending",
            started_at: null,
            started_by: null,
            completed_at: null,
            completed_by: null,
          })
          .eq("unit_id", block.unit_id)
          .eq("party_id", block.party_id)
          .or(
            `started_by.eq.${targetCleanerId},completed_by.eq.${targetCleanerId}`,
          )
          .gte("started_at", block.start_time)
          .lte("started_at", block.end_time || new Date().toISOString());
      }
      // Delete tasks belonging to this block (FK cascades photos +
      // participants will cascade from work_block FK).
      await supabase.from("tasks").delete().eq("work_block_id", block.id);
      // Delete the block itself.
      await supabase.from("work_blocks").delete().eq("id", block.id);
      // Drop from local state.
      setWorkBlocks((prev) => prev.filter((b) => b.id !== block.id));
    } catch (e) {
      alert("Could not undo: " + (e.message || e));
    }
    setBusy(false);
  };

  // moveClosedBlock — opens the existing move modal but targeting a
  // specific (non-active) block from the list. Reuses the
  // moveMultipleWorkBlocksTo handler under the hood since it accepts
  // any block ids.
  const [closedMoveTarget, setClosedMoveTarget] = useState(null);
  const moveClosedBlock = (block) => {
    if (!block?.id) return;
    const canMoveAnyone =
      isLead(employee);
    const isMine = block.shift_id === shift?.id;
    if (!canMoveAnyone && !isMine) {
      alert(tt("You can only move work blocks you started yourself."));
      return;
    }
    setClosedMoveTarget(block);
  };


  const undoBlock = async () => {
    if (!activeBlock) return;
    const canUndoAnyone =
      isLead(employee);
    const isMine = activeBlock.shift_id === shift?.id;
    if (!canUndoAnyone && !isMine) {
      alert(tt("You can only undo a work block you started yourself."));
      return;
    }
    const taskCount = (tasks || []).length;
    // Count non-deleted photos so the cleaner sees what'll be wiped.
    // FK cascade on tasks.delete drops photos too, so this is real loss.
    const photoCount = (tasks || []).reduce(
      (sum, t) => sum + (t.photos || []).filter((p) => !p.deleted_at).length,
      0,
    );
    const parts = [];
    if (taskCount > 0)
      parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);
    if (photoCount > 0)
      parts.push(`${photoCount} photo${photoCount === 1 ? "" : "s"}`);
    const detail =
      parts.length > 0 ? `${parts.join(" · ")} will be deleted. ` : "";
    const heavy = photoCount > 0;
    const msg = tt(
      `${heavy ? "\u26A0 " : ""}Undo this work block? ${detail}Any items you marked in-progress will go back to pending. This cannot be reversed.`,
    );
    if (!confirm(msg)) return;
    // Photos are often the whole point of a job (before/after proof). Deleting
    // them is permanent, so when any exist require a SECOND explicit yes — a
    // single mis-tap should never wipe evidence photos.
    if (photoCount > 0) {
      if (
        !confirm(
          tt(
            `This will permanently delete ${photoCount} photo${photoCount === 1 ? "" : "s"} that can't be recovered. Are you absolutely sure?`,
          ),
        )
      )
        return;
    }
    setBusy(true);
    try {
      // 1. Revert assignment_targets the cleaner advanced during this
      //    block. Scope to (unit_id, party_id, started_by=employee.id,
      //    status='in_progress'). Reset status to pending and clear
      //    the started_at / started_by stamps.
      if (employee?.id && activeBlock.unit_id && activeBlock.party_id) {
        await supabase
          .from("assignment_targets")
          .update({ status: "pending", started_at: null, started_by: null })
          .eq("unit_id", activeBlock.unit_id)
          .eq("party_id", activeBlock.party_id)
          .eq("started_by", employee.id)
          .eq("status", "in_progress");
      }
      // 2. Delete tasks belonging to this block (cascades photos via FK).
      await supabase.from("tasks").delete().eq("work_block_id", activeBlock.id);
      // 3. Delete the work_block itself.
      await supabase.from("work_blocks").delete().eq("id", activeBlock.id);
      // 4. Reset local state — drop from list, clear active.
      setWorkBlocks((prev) => prev.filter((b) => b.id !== activeBlock.id));
      setActiveBlock(null);
      setTasks([]);
      setActiveTask(null);
    } catch (e) {
      alert("Could not undo: " + (e.message || e));
    }
    setBusy(false);
  };

  // ===== Multi-cleaner workblock helpers =====
  // joinBlock — cleaner taps "Join" on another cleaner's active
  // workblock (from Suggested tab or Who's-here popup). Creates a
  // work_block_participants row for THIS cleaner under their shift,
  // then opens the BlockView with that block as activeBlock. The
  // helper cleaner now shares the block: same items, same task list,
  // photos attributed to whoever takes them.
  //
  // Cap: 4 participants per block. Includes the original starter.
  const PARTICIPANT_CAP = 4;
  // Close EVERY open work block this cleaner owns, across ALL their shifts —
  // not just the current one. A cleaner should only ever have one block open
  // at a time; scoping the pre-close to the current shift let a stale block
  // from an earlier still-open shift stay running, which is how someone ended
  // up "active" in two different bedrooms (101 and 312) at once. Returns the
  // ids it closed so callers can update local state.
  const closeAllMyOpenBlocks = async (exceptId = null) => {
    if (!employee?.id) return [];
    try {
      // Find this cleaner's open blocks via their shifts (any shift, open or
      // not) — the block is "mine" if its shift belongs to me.
      const { data: myShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("employee_id", employee.id);
      const shiftIds = (myShifts || []).map((s) => s.id);
      if (shiftIds.length === 0) return [];
      let q = supabase
        .from("work_blocks")
        .select("id")
        .in("shift_id", shiftIds)
        .is("end_time", null);
      if (exceptId) q = q.neq("id", exceptId);
      const { data: openBlocks } = await q;
      const ids = (openBlocks || []).map((b) => b.id);
      if (ids.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in("id", ids);
        setWorkBlocks((prev) =>
          prev.map((b) => (ids.includes(b.id) ? { ...b, end_time: ts } : b)),
        );
      }
      return ids;
    } catch (e) {
      console.warn("[closeAllMyOpenBlocks] failed", e);
      return [];
    }
  };

  const joinBlock = async (targetBlock) => {
    if (!targetBlock?.id) return;
    if (!shift?.id) {
      alert("Clock in first to join a workblock.");
      return;
    }
    if (activeBlock?.id === targetBlock.id) {
      // Already in this block — just snap the tab back to Home
      navigationRef.current.setCleanerTab("home");
      return;
    }
    setBusy(true);
    // Close THIS cleaner's other open workblocks under this shift first
    // so we don't end up with B owning a stale open block while also
    // being a participant in A's. Mirrors the pre-close pattern in
    // onPickBlockParty. The block's items stay in whatever status they
    // were in (paused / in_progress) — nothing is lost.
    try {
      if (activeTask) await stopTask(activeTask, false);
      // Close every open block I own (across all my shifts), except the one
      // I'm joining — prevents being active in two bedrooms via a stale shift.
      await closeAllMyOpenBlocks(targetBlock.id);
    } catch (e) {
      console.warn("[joinBlock] could not pre-close own open blocks", e);
    }
    try {
      // Count current participants (joined and not yet left)
      const { data: current } = await supabase
        .from("work_block_participants")
        .select("id, employee_id")
        .eq("work_block_id", targetBlock.id)
        .is("left_at", null);
      const alreadyHere = (current || []).some(
        (p) => p.employee_id === employee.id,
      );
      if (!alreadyHere && (current || []).length >= PARTICIPANT_CAP) {
        setBusy(false);
        alert(`This workblock is full (${PARTICIPANT_CAP} cleaners max).`);
        return;
      }
      // Create participant row (or no-op if cleaner already has one)
      if (!alreadyHere) {
        const { error: e1 } = await supabase
          .from("work_block_participants")
          .insert({
            work_block_id: targetBlock.id,
            employee_id: employee.id,
            shift_id: shift.id,
            joined_at: new Date().toISOString(),
          });
        if (e1 && !e1.message?.includes("duplicate key")) {
          setBusy(false);
          alert("Could not join: " + e1.message);
          return;
        }
      }
      // Pull full block details + tasks (shared task list with the
      // original starter — anyone in the block can add tasks)
      const { data: refreshed } = await supabase
        .from("work_blocks")
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("id", targetBlock.id)
        .single();
      if (refreshed) {
        setActiveBlock(refreshed);
        setTasks(refreshed.tasks || []);
        navigationRef.current.setCleanerTab("home");
      }
    } catch (e) {
      alert("Could not join: " + (e.message || e));
    }
    setBusy(false);
  };

  // leaveBlock — current cleaner steps out of the active block but
  // doesn't end it for others. Sets their participant row's left_at.
  // If they're the last remaining participant, we prompt and auto-
  // finish the block (per spec: last to leave finishes).
  const leaveBlock = async () => {
    if (!activeBlock || !employee?.id) return;
    // Are there OTHER cleaners still active here (besides me)? That decides
    // whether I'm just leaving (they stay) or closing the whole bedroom.
    const { data: others } = await supabase
      .from("work_block_participants")
      .select("id")
      .eq("work_block_id", activeBlock.id)
      .is("left_at", null)
      .neq("employee_id", employee.id);
    const othersCount = (others || []).length;
    const nowISO = new Date().toISOString();

    if (othersCount > 0) {
      // Not the last one — leaving ends MY session; the block stays open.
      if (
        !confirm(
          tt(
            "Finished your part in this bedroom? Your session here closes and you'll go back to your assignments — the other cleaner(s) stay until they finish.",
          ),
        )
      )
        return;
      setBusy(true);
      try {
        await supabase
          .from("work_block_participants")
          .update({ left_at: nowISO })
          .eq("work_block_id", activeBlock.id)
          .eq("employee_id", employee.id)
          .is("left_at", null);
      } catch (e) {
        setBusy(false);
        alert("Could not leave: " + (e.message || e));
        return;
      }
    } else {
      // Last one here — this closes out the WHOLE bedroom.
      const { data: openTargets } = await supabase
        .from("assignment_targets")
        .select("id")
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .in("status", ["pending", "in_progress", "paused"]);
      const stillOpen = (openTargets || []).length;
      const msg =
        stillOpen > 0
          ? tt(
              `You're closing out this whole bedroom. ${stillOpen} item${stillOpen === 1 ? " is" : "s are"} still not done — finish anyway and go back to your assignments?`,
            )
          : tt("Close out this whole bedroom and go back to your assignments?");
      if (!confirm(msg)) return;
      setBusy(true);
      try {
        await supabase
          .from("work_block_participants")
          .update({ left_at: nowISO })
          .eq("work_block_id", activeBlock.id)
          .eq("employee_id", employee.id)
          .is("left_at", null);
        if (activeTask) await stopTask(activeTask, false);
        await supabase
          .from("work_blocks")
          .update({ end_time: nowISO })
          .eq("id", activeBlock.id);
        setWorkBlocks((prev) =>
          prev.map((b) =>
            b.id === activeBlock.id ? { ...b, end_time: nowISO } : b,
          ),
        );
      } catch (e) {
        setBusy(false);
        alert("Could not finish: " + (e.message || e));
        return;
      }
    }
    // Either way: drop out locally and land on the assignments list.
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    navigationRef.current.setCleanerTab("home");
    setBusy(false);
  };

  // deletePhoto — soft-delete (cleaner can remove a bad / accidental
  // photo). Only the cleaner who took it OR an owner/manager can
  // delete; enforced both client + server side. We use deleted_at /
  // deleted_by columns instead of hard-deleting so we keep evidence
  // if needed later.
  const deletePhoto = async (photoId, taskId) => {
    if (!photoId) return;
    const photo = (tasks || [])
      .flatMap((t) => t.photos || [])
      .find((p) => p.id === photoId);
    if (!photo) return;
    const canDeleteAny =
      isLead(employee);
    const isMine = photo.taken_by === employee?.id;
    if (!canDeleteAny && !isMine) {
      alert(tt("You can only delete photos you took."));
      return;
    }
    if (!confirm(tt("Delete this photo? This cannot be reversed."))) return;
    const { error } = await supabase
      .from("photos")
      .update({ deleted_at: new Date().toISOString(), deleted_by: employee.id })
      .eq("id", photoId);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    // Drop from local state so the photo disappears immediately
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, photos: (t.photos || []).filter((p) => p.id !== photoId) }
          : t,
      ),
    );
  };

  function tt(s) {
    try {
      const loc =
        (typeof window !== "undefined" && window.__tidytrack_locale) || "en";
      if (loc !== "es") return s;
      const dict =
        (typeof window !== "undefined" && window.__tidytrack_es) || {};
      return dict[s] || s;
    } catch {
      return s;
    }
  }

  const finishBlock = async () => {
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", activeBlock.id);
    // Auto-complete on close-out: EVERY still-open target at this (unit,
    // party) — pending, in_progress OR paused — gets flipped to done. The
    // earlier version only caught in_progress, so an assignment the cleaner
    // never tapped "Start" on stayed pending and lingered in All Pending
    // after they hit "I'm done here". "Done here" means done here.
    //
    // Limited to active assignments at this customer. PM-sourced
    // assignments must be approved before they count.
    try {
      const { data: inProg } = await supabase
        .from("assignment_targets")
        .select(
          "id, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
        )
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .in("status", ["pending", "in_progress", "paused"]);
      const ids = (inProg || [])
        .filter(
          (t) =>
            t.assignment?.customer_id === shift?.customer_id &&
            t.assignment?.active &&
            !t.assignment?.deleted_at &&
            isPmApprovedAssignment(t.assignment),
        )
        .map((t) => t.id);
      if (ids.length > 0) {
        await supabase
          .from("assignment_targets")
          .update({
            status: "done",
            completed_at: ts,
            completed_by: employee?.id || null,
          })
          .in("id", ids);
      }
    } catch (e) {
      console.warn("[finishBlock auto-complete] failed", e);
    }
    const updated = { ...activeBlock, end_time: ts, tasks };
    setWorkBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? updated : b)),
    );
    // Capture the bedroom we just finished so the NextUpPrompt knows
    // which apartment / floor / building to suggest from.
    const finishedFrom = {
      unitId: activeBlock.unit_id,
      unitLabel: activeBlock.unit?.label,
      partyId: activeBlock.party_id,
      partyLabel: activeBlock.party?.label,
      propertyId: shift.customer_id,
    };
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setBusy(false);
    // Back to the assignments list, with the "what's next?" prompt on top.
    navigationRef.current.setCleanerTab("home");
    navigationRef.current.setNextUpPrompt(finishedFrom);
  };

  // Generic end-block — closes ANY block by id, including the one
  // surfaced in the PropertyHub resume banner. Differs from
  // finishBlock above which only operates on the currently-active
  // block (held in state).
  const endBlock = async (block) => {
    if (!block) return;
    if (
      !confirm(
        `End work block at ${block.unit?.label} · ${block.party?.label}?`,
      )
    )
      return;
    setBusy(true);
    // If they're ending the block that happens to be active right now,
    // stop any running task too so we don't leave orphaned timing.
    if (activeBlock?.id === block.id && activeTask) {
      await stopTask(activeTask, false);
    }
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", block.id);
    setWorkBlocks((prev) =>
      prev.map((b) => (b.id === block.id ? { ...b, end_time: ts } : b)),
    );
    if (activeBlock?.id === block.id) {
      setActiveBlock(null);
      setTasks([]);
      setActiveTask(null);
    }
    setBusy(false);
  };

  const reopenBlock = async (block) => {
    setBusy(true);
    // Pre-close any of MY currently-open blocks so we don't end up with
    // two open at once. We scope this to the current shift since those
    // are the only blocks "I" own right now. A block closed by mistake
    // can belong to an earlier shift or another cleaner — we still
    // reopen it below regardless of whose shift it's under, so anyone
    // can recover a block that was closed by accident.
    try {
      // Close every open block I own across all my shifts (not just the
      // current one), except the one being reopened.
      await closeAllMyOpenBlocks(block.id);
    } catch (e) {
      console.warn("[reopenBlock] could not pre-close open blocks", e);
    }
    // Reopen the target. Surface any error instead of silently failing
    // (the old version assumed success and updated local state even if
    // the DB write was rejected, which looked like "reopen does
    // nothing").
    const { error: reErr } = await supabase
      .from("work_blocks")
      .update({ end_time: null })
      .eq("id", block.id);
    if (reErr) {
      console.error("[reopenBlock] reopen failed", reErr);
      alert("Could not reopen this work block: " + reErr.message);
      setBusy(false);
      return;
    }
    const { data: blockTasks } = await supabase
      .from("tasks")
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .eq("work_block_id", block.id)
      .order("start_time");
    const updated = { ...block, end_time: null, tasks: blockTasks || [] };
    setWorkBlocks((prev) => {
      const exists = prev.some((b) => b.id === block.id);
      const next = prev.map((b) => {
        if (b.id === block.id) return updated;
        // Reflect the pre-closure in local state for any other currently-open blocks
        if (!b.end_time) return { ...b, end_time: new Date().toISOString() };
        return b;
      });
      // If the reopened block wasn't already in local state (e.g. it
      // belonged to another shift / the Others list), add it so the
      // active-block view has it.
      return exists ? next : [updated, ...next];
    });
    setActiveBlock(updated);
    setTasks(blockTasks || []);
    // Resume always sends the cleaner back to the Home tab (BlockView).
    // Without this, if they tapped Resume from the Assignments tab,
    // they'd stay on Assignments with the block now in state — the
    // active workblock useEffect only fires on activeBlock.id change,
    // so a same-block reopen wouldn't trigger it.
    navigationRef.current.setCleanerTab("home");
    setBusy(false);
  };

  // Move the active work block to a different bedroom in this property.
  // Used when the cleaner (or owner in preview) opened the wrong bedroom
  // and put their tasks/photos/notes there — instead of redoing all
  // that data entry, we just relabel the block by updating its unit_id
  // + party_id. Tasks/photos follow via foreign keys. The old bedroom
  // is left clean (no leftover row).
  const moveActiveBlockTo = async (newUnit, newParty, resetIds = []) => {
    if (!activeBlock) return;
    if (!newUnit?.id || !newParty?.id) {
      alert("Pick a unit and bedroom.");
      return;
    }
    if (
      newUnit.id === activeBlock.unit_id &&
      newParty.id === activeBlock.party_id
    ) {
      alert("That's already where this block is.");
      return;
    }
    setBusy(true);
    // Conflict check — if a separate block already exists at the target
    // bedroom in this shift, ask before creating a duplicate.
    try {
      const { data: existing } = await supabase
        .from("work_blocks")
        .select("id, end_time")
        .eq("shift_id", shift.id)
        .eq("unit_id", newUnit.id)
        .eq("party_id", newParty.id)
        .neq("id", activeBlock.id);
      if (existing && existing.length > 0) {
        setBusy(false);
        const hasOpen = existing.some((b) => !b.end_time);
        const msg = hasOpen
          ? `There's already an OPEN work block at ${newUnit.label} · ${newParty.label} in this shift. Move anyway? You'll end up with two — close one manually after.`
          : `There's already a completed work block at ${newUnit.label} · ${newParty.label} in this shift. Move anyway?`;
        if (!confirm(msg)) return;
        setBusy(true);
      }
    } catch (e) {
      console.warn("[moveActiveBlockTo] conflict check failed", e);
    }
    const { error } = await supabase
      .from("work_blocks")
      .update({ unit_id: newUnit.id, party_id: newParty.id })
      .eq("id", activeBlock.id);
    setBusy(false);
    if (error) {
      alert("Could not move work block: " + error.message);
      return;
    }

    // Reset old-bedroom assignments to Pending if the cleaner asked
    // for it. Wipes started_by/completed_by/started_at/completed_at so
    // the assignment looks untouched in reports too. status_notes is
    // preserved (might be a Blocked note the manager still wants to
    // see). Failure here is non-fatal — the move already happened.
    if (resetIds && resetIds.length > 0) {
      const { error: resetErr } = await supabase
        .from("assignment_targets")
        .update({
          status: "pending",
          started_by: null,
          started_at: null,
          completed_by: null,
          completed_at: null,
        })
        .in("id", resetIds);
      if (resetErr) console.warn("[moveActiveBlockTo] reset failed:", resetErr);
    }

    // Refresh activeBlock with the new unit/party labels so the header
    // updates immediately. Fetch the joined row so we have nested labels.
    const { data: refreshed } = await supabase
      .from("work_blocks")
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .eq("id", activeBlock.id)
      .single();
    if (refreshed) {
      setActiveBlock(refreshed);
      setTasks(refreshed.tasks || []);
      setWorkBlocks((prev) =>
        prev.map((b) => (b.id === activeBlock.id ? refreshed : b)),
      );
    }
  };

  // Multi-block move — used by the "Something's wrong" menu for both
  //   • Wrong bedroom  — caller passes all blocks at the current
  //     (unit, party) so the entire bedroom relocates as a unit
  //   • Wrong workblock — caller passes a user-selected subset of
  //     blocks within the current unit (any bedroom)
  // We do conflict checks against the destination only ONCE
  // (against any of the moved blocks). Reset of source assignment
  // targets is applied at the end if requested.
  const moveMultipleWorkBlocksTo = async (
    blockIds,
    newUnit,
    newParty,
    resetIds = [],
  ) => {
    if (!blockIds || blockIds.length === 0) return;
    if (!newUnit?.id || !newParty?.id) {
      alert("Pick a unit and bedroom.");
      return;
    }
    setBusy(true);
    try {
      // Update every block to the new (unit, party)
      const { error: e1 } = await supabase
        .from("work_blocks")
        .update({ unit_id: newUnit.id, party_id: newParty.id })
        .in("id", blockIds);
      if (e1) {
        alert("Could not move work blocks: " + e1.message);
        setBusy(false);
        return;
      }
      // Reset old-bedroom assignment_targets if asked
      if (resetIds && resetIds.length > 0) {
        const { error: e2 } = await supabase
          .from("assignment_targets")
          .update({
            status: "pending",
            started_by: null,
            started_at: null,
            completed_by: null,
            completed_at: null,
          })
          .in("id", resetIds);
        if (e2) console.warn("[moveMultipleWorkBlocksTo] reset failed:", e2);
      }
      // Refresh state — if the activeBlock was one of the moved ones,
      // re-fetch it so the BlockView header updates. Same for workBlocks
      // list (we re-fetch all from the shift).
      const { data: allBlocks } = await supabase
        .from("work_blocks")
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("shift_id", shift.id)
        .order("start_time");
      setWorkBlocks(allBlocks || []);
      if (activeBlock && blockIds.includes(activeBlock.id)) {
        const refreshed = (allBlocks || []).find(
          (b) => b.id === activeBlock.id,
        );
        if (refreshed) {
          setActiveBlock(refreshed);
          setTasks(refreshed.tasks || []);
        }
      }
    } catch (e) {
      alert("Could not move work blocks: " + (e.message || e));
    }
    setBusy(false);
  };

  // Guarantee we have a REAL, existing work_block to attach tasks to. The
  // FK "tasks_work_block_id_fkey" fails when activeBlock in state points at a
  // block that's been closed+removed or is otherwise stale (e.g. a previous
  // session). This checks the DB; if the block is gone, it opens a fresh one
  // at the same bedroom and returns its id. Returns null only if we truly
  // can't place the work (no bedroom context).
  const ensureActiveBlock = async () => {
    // If we think we have a block, verify it actually exists.
    if (activeBlock?.id) {
      try {
        const { data: exists } = await supabase
          .from("work_blocks")
          .select("id, end_time")
          .eq("id", activeBlock.id)
          .maybeSingle();
        if (exists && !exists.end_time) return activeBlock; // valid & open
      } catch {
        /* fall through to recreate */
      }
    }
    // Need to (re)create a block. Figure out where.
    const unitId =
      activeBlock?.unit_id || navigationRef.current.pendingStart?.unitId;
    const partyId =
      activeBlock?.party_id || navigationRef.current.pendingStart?.partyId;
    const assignmentId =
      activeBlock?.assignment_id ||
      navigationRef.current.pendingStart?.assignmentId ||
      null;
    if (!shift?.id || !unitId || !partyId) return activeBlock || null;
    try {
      await closeAllMyOpenBlocks(null);
      const { data, error } = await supabase
        .from("work_blocks")
        .insert({
          shift_id: shift.id,
          unit_id: unitId,
          party_id: partyId,
          assignment_id: assignmentId,
          bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
          is_preview: previewMode,
        })
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .single();
      if (error) {
        console.warn("[ensureActiveBlock] recreate failed", error);
        return activeBlock || null;
      }
      setWorkBlocks((prev) => [
        ...prev.map((b) =>
          b.end_time ? b : { ...b, end_time: new Date().toISOString() },
        ),
        data,
      ]);
      setActiveBlock(data);
      return data;
    } catch (e) {
      console.warn("[ensureActiveBlock] error", e);
      return activeBlock || null;
    }
  };

  const startTasksFromChecklistItems = async ({
    targets: pickedTargets,
    name,
    category,
  }) => {
    if (!pickedTargets || pickedTargets.length === 0) return;
    // Stop the current active task before starting a new one (matches
    // legacy onStartTask behavior — only ONE task active at a time).
    if (activeTask) await stopTask(activeTask, false);
    // 1) Advance picked targets to in_progress in a single update
    const ids = pickedTargets.map((t) => t.id);
    const toAdvance = pickedTargets.filter(
      (t) => t.status === "pending" || t.status === "paused",
    );
    if (toAdvance.length > 0) {
      const { error: tErr } = await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          started_by: employee.id,
        })
        .in(
          "id",
          toAdvance.map((t) => t.id),
        );
      if (tErr) {
        console.warn(
          "[startTasksFromChecklistItems] target advance failed:",
          tErr,
        );
      }
    }
    // 2) Create one task that represents this work session. Tag with
    //    category so reports show what was covered. We store the
    //    combined item names so PMs see the full picture.
    const ins = {
      shift_id: shift.id,
      name,
      category: category || null,
      subcategory: null,
      is_preview: previewMode,
    };
    const liveBlock = await ensureActiveBlock();
    if (liveBlock?.id) ins.work_block_id = liveBlock.id;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert(ins)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (error) {
      alert("Could not start task: " + error.message);
      return;
    }
    setTasks((prev) => [...prev, row]);
    setActiveTask(row.id);
    setNewTaskName("");
  };

  // Cleaner taps the X on an in-progress item — "I started this but
  // need to step away". Previously this dropped the item back to
  // 'pending' and wiped started_by/started_at, which silently erased
  // evidence of in-flight work (the bedroom would show 0% done in
  // audits even though photos existed).
  //
  // New behavior: route to 'paused' so the work is preserved in audit.
  // started_by/started_at are kept so we know who paused it and when;
  // any other cleaner can then resume from the Paused bucket. Pending
  // is reserved for items that have NEVER been touched.
  //
  // Items that were never started (still 'pending') are left alone —
  // there's nothing to release.
  const releaseTargetsFromWorkblock = async (targets) => {
    if (!targets || targets.length === 0) return;
    const releasable = targets.filter(
      (t) => t.status === "in_progress" || t.status === "paused",
    );
    if (releasable.length === 0) return;
    const ids = releasable.map((t) => t.id);
    const { error } = await supabase
      .from("assignment_targets")
      .update({ status: "paused" })
      .in("id", ids);
    if (error) {
      alert("Could not release: " + error.message);
    }
  };

  const confirmPendingStart = async () => {
    if (!navigationRef.current.pendingStart) return;
    setBusy(true);
    // Safety: close every open block I own across ALL my shifts before opening
    // a new one — a stale block from an earlier open shift must not stay
    // running in another bedroom.
    try {
      await closeAllMyOpenBlocks(null);
    } catch (e) {
      console.warn("[confirmPendingStart] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: navigationRef.current.pendingStart.unitId,
        party_id: navigationRef.current.pendingStart.partyId,
        assignment_id: navigationRef.current.pendingStart.assignmentId || null,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    navigationRef.current.setPendingStart(null);
    // No auto-start: starting the work block only starts the TIMER.
    // The cleaner explicitly picks items from the picker (or taps
    // Start on individual assignment cards) to flip them to
    // in_progress. Stops the "I tapped Start cleaning and everything
    // is suddenly marked in progress" surprise.
  };

  const advancePendingTargetsAtActiveBedroom = async () => {
    if (!activeBlock?.unit_id || !activeBlock?.party_id || !employee?.id)
      return;
    try {
      const { data: pending } = await supabase
        .from("assignment_targets")
        .select(
          "id, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
        )
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .eq("status", "pending");
      const ids = (pending || [])
        .filter(
          (t) =>
            t.assignment?.customer_id === shift?.customer_id &&
            t.assignment?.active &&
            !t.assignment?.deleted_at &&
            isPmApprovedAssignment(t.assignment),
        )
        .map((t) => t.id);
      if (ids.length === 0) return;
      const nowISO = new Date().toISOString();
      await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: nowISO,
          started_by: employee.id,
        })
        .in("id", ids);
    } catch (e) {
      console.warn("[advancePending] failed", e);
    }
  };

  // Stamp main_section on the active workblock based on the dominant
  // task category. Called after task creation. The workblock's section
  // is derived from the first cleaning the cleaner does — if they pick
  // Bedroom items first, that's the workblock's section. Other cleaners
  // then see "Cleaner A · Bedroom is here" with a Join button instead
  // of a section-less workblock. Only stamps when main_section is null
  // so later cross-section work in the same block doesn't keep flipping
  // the label.
  const stampMainSectionFromCategories = async (categories) => {
    if (!activeBlock || activeBlock.main_section) return;
    const valid = (categories || []).filter(
      (c) => c && ["bedroom", "vanity", "bathroom", "general"].includes(c),
    );
    if (valid.length === 0) return;
    const counts = {};
    valid.forEach((c) => {
      counts[c] = (counts[c] || 0) + 1;
    });
    const dominant = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a],
    )[0];
    if (!dominant) return;
    const { error } = await supabase
      .from("work_blocks")
      .update({ main_section: dominant })
      .eq("id", activeBlock.id);
    if (error) {
      console.warn("[stampMainSection] failed", error);
      return;
    }
    setActiveBlock((prev) =>
      prev ? { ...prev, main_section: dominant } : prev,
    );
    setWorkBlocks((prev) =>
      prev.map((b) =>
        b.id === activeBlock.id ? { ...b, main_section: dominant } : b,
      ),
    );
  };

  const startTask = async (
    overrideName = null,
    category = null,
    subcategory = null,
  ) => {
    const nameToUse = (overrideName || newTaskName || "").trim();
    if (!nameToUse) return;
    if (activeTask) await stopTask(activeTask, false);
    const insert = {
      shift_id: shift.id,
      name: nameToUse,
      is_preview: previewMode,
    };
    const liveBlockT = await ensureActiveBlock();
    if (liveBlockT?.id) insert.work_block_id = liveBlockT.id;
    if (category) insert.category = category;
    if (subcategory) insert.subcategory = subcategory;
    const { data, error } = await supabase
      .from("tasks")
      .insert(insert)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (error) {
      alert("Could not start task: " + error.message);
      return;
    }
    setTasks((prev) => [...prev, data]);
    setActiveTask(data.id);
    setNewTaskName("");
    // Bedroom-level audit sync — runs after the task insert so the
    // task ID exists before we update targets.
    advancePendingTargetsAtActiveBedroom();
    // Stamp the workblock's section so other cleaners can see what
    // section A is working on (e.g. "Cleaner A · Bedroom is here").
    stampMainSectionFromCategories([category]);
    return data;
  };

  // Cleaner picker can submit ONE task (single category) or MULTIPLE
  // (e.g. multi-selected General subcategories). When multiple are
  // submitted, the FIRST one becomes active and the rest are inserted
  // as not-yet-started tasks so the cleaner can resume them in order.
  const startTasksFromPicker = async (taskInputs) => {
    if (!taskInputs || taskInputs.length === 0) return;
    if (activeTask) await stopTask(activeTask, false);
    // Insert the first task as started (with current timestamp via default)
    const first = taskInputs[0];
    const firstInsert = {
      shift_id: shift.id,
      name: first.name,
      category: first.category || null,
      subcategory: first.subcategory || null,
      is_preview: previewMode,
    };
    const liveBlockP = await ensureActiveBlock();
    if (liveBlockP?.id) firstInsert.work_block_id = liveBlockP.id;
    const { data: firstRow, error: firstErr } = await supabase
      .from("tasks")
      .insert(firstInsert)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (firstErr) {
      alert("Could not start task: " + firstErr.message);
      return;
    }
    setTasks((prev) => [...prev, firstRow]);
    setActiveTask(firstRow.id);

    // Insert the rest as "queued" tasks with start_time AND end_time both
    // null... actually they need start_time NOT NULL per schema. Best to
    // insert them STILL with start_time but immediately stop them — so
    // they appear in the task list as paused/queued, ready to resume.
    if (taskInputs.length > 1) {
      const rest = taskInputs.slice(1);
      const now = new Date();
      const queueRows = rest.map((t, i) => ({
        shift_id: shift.id,
        work_block_id: liveBlockP?.id || null,
        name: t.name,
        category: t.category || null,
        subcategory: t.subcategory || null,
        is_preview: previewMode,
        // Start them at a stable future-ish moment so order is preserved,
        // then immediately stop. They'll appear as "Resume" cards.
        start_time: new Date(now.getTime() + (i + 1) * 1000).toISOString(),
        end_time: new Date(now.getTime() + (i + 1) * 1000 + 100).toISOString(),
      }));
      const { data: queued, error: qErr } = await supabase
        .from("tasks")
        .insert(queueRows)
        .select("*, photos(*, taken_by_employee:employees!taken_by(name))");
      if (qErr) {
        console.warn("[startTasksFromPicker] could not queue extras:", qErr);
      } else if (queued) {
        setTasks((prev) => [...prev, ...queued]);
      }
    }
    setNewTaskName("");
    // Bedroom-level audit sync — same as startTask. Fires after all
    // tasks are inserted so the cleaner's pending targets at this
    // bedroom now reflect work in progress.
    advancePendingTargetsAtActiveBedroom();
    // Stamp the workblock's section from the dominant category in
    // this batch of tasks so other cleaners can see what's claimed.
    stampMainSectionFromCategories(taskInputs.map((t) => t.category));
  };

  const stopTask = async (taskId, refetch = true) => {
    const ts = new Date().toISOString();
    await supabase.from("tasks").update({ end_time: ts }).eq("id", taskId);
    if (refetch)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, end_time: ts } : t)),
      );
    if (activeTask === taskId) setActiveTask(null);
  };

  const resumeTask = async (taskId) => {
    if (activeTask) await stopTask(activeTask, false);
    await supabase.from("tasks").update({ end_time: null }).eq("id", taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, end_time: null } : t)),
    );
    setActiveTask(taskId);
  };

  const uploadPhoto = async (taskId, kind, file) => {
    // The single-camera flow may pass a null kind — the cleaner assigns the
    // bucket afterward. Default new photos to 'after' (the most common) so
    // there's always a valid bucket; they can reassign in the modal.
    const useKind = kind || "after";
    // Read the original capture time from the file's EXIF BEFORE compressing
    // (compression strips metadata). Null when the photo has no EXIF date.
    const takenAt = await readPhotoTakenAt(file);
    const compressed = await compressImage(file);
    const path = `${shift.id}/${taskId}/${useKind}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, compressed, { contentType: "image/jpeg" });
    if (upErr) {
      alert("Upload failed: " + upErr.message);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const { data: photo, error: pErr } = await supabase
      .from("photos")
      .insert({
        task_id: taskId,
        kind: useKind,
        storage_path: path,
        public_url: publicUrl,
        is_preview: previewMode,
        taken_by: employee?.id || null,
        taken_at: takenAt,
      })
      .select()
      .single();
    if (pErr) {
      alert("Could not save photo: " + pErr.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t,
      ),
    );
    // Return the new row so callers (PhotoModal) can attach a note to it
    return photo;
  };

  // Reassign a photo to a different bucket (before / after / damage /
  // couldn't clean). Used by the single-camera flow so the cleaner can tag
  // a photo after taking it, and fix it if it lands in the wrong bucket.
  const changePhotoKind = async (photoId, taskId, newKind) => {
    if (!photoId || !newKind) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              photos: (t.photos || []).map((p) =>
                p.id === photoId ? { ...p, kind: newKind } : p,
              ),
            }
          : t,
      ),
    );
    const { error } = await supabase
      .from("photos")
      .update({ kind: newKind })
      .eq("id", photoId);
    if (error) {
      alert("Could not change the photo tag: " + error.message);
    }
  };

  // Attach a short note to a previously-uploaded photo. Used by the
  // damage photo flow so cleaners can describe what's broken. Optional —
  // an empty note is fine and we no-op out of the DB write to keep
  // request volume down.
  const savePhotoNote = async (photoId, noteText, kind = null) => {
    if (!photoId) return;
    const trimmed = (noteText || "").trim();
    // "Couldn't clean" notes are read by PMs, who read English. Cleaners
    // mostly write Spanish. Translate ONCE here at save time and store the
    // English alongside the original — the cleaner's own words are never
    // overwritten, and PM screens don't pay for a translation on every view.
    let notesEn = null;
    if (trimmed && kind === KIND_CANNOT && isTextTranslateConfigured()) {
      try {
        const [res] = await translateText([trimmed], "en");
        if (res && res.detectedSourceLanguage !== "en" && res.translatedText) {
          notesEn = res.translatedText;
        }
      } catch (e) {
        // Never block the note on a translation failure — the PM can still
        // hit the Translate button by hand.
        console.warn(
          "[photo note] auto-translate failed, saving original only",
          e,
        );
      }
    }
    const payload = { notes: trimmed || null };
    if (notesEn) payload.notes_en = notesEn;
    let { error } = await supabase
      .from("photos")
      .update(payload)
      .eq("id", photoId);
    if (error && notesEn) {
      // notes_en column not there yet (migration v59 not run) — don't lose
      // the cleaner's note over it.
      console.warn(
        "[photo note] notes_en unavailable, saving original only",
        error,
      );
      delete payload.notes_en;
      ({ error } = await supabase
        .from("photos")
        .update(payload)
        .eq("id", photoId));
    }
    if (error) throw error;
    // Mirror the update into local state so the note shows immediately
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        photos: (t.photos || []).map((p) =>
          p.id === photoId ? { ...p, ...payload } : p,
        ),
      })),
    );
  };
  return {
    shift,
    setShift,
    workBlocks,
    setWorkBlocks,
    activeBlock,
    setActiveBlock,
    tasks,
    setTasks,
    activeTask,
    setActiveTask,
    newTaskName,
    setNewTaskName,
    loaded,
    busy,
    setBusy,
    reload,
    doClockIn,
    clockOut,
    signOutWithCleanup,
    autoClockOut,
    autoStartAssignmentsAtBedroom,
    onPickBlockParty,
    undoClosedBlock,
    moveClosedBlock,
    closedMoveTarget,
    setClosedMoveTarget,
    undoBlock,
    joinBlock,
    leaveBlock,
    deletePhoto,
    finishBlock,
    endBlock,
    reopenBlock,
    moveActiveBlockTo,
    moveMultipleWorkBlocksTo,
    ensureActiveBlock,
    startTasksFromChecklistItems,
    releaseTargetsFromWorkblock,
    confirmPendingStart,
    advancePendingTargetsAtActiveBedroom,
    stampMainSectionFromCategories,
    startTask,
    startTasksFromPicker,
    stopTask,
    resumeTask,
    uploadPhoto,
    changePhotoKind,
    savePhotoNote,
    closeAllMyOpenBlocks,
    tt,
  };
}
