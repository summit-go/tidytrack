import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase.js";
import { usePagePersistence } from "../../../hooks/usePagePersistence.js";

export function useCleanerNavigation({
  employee,
  previewMode,
  work,
}) {
  const [cleanerTab, setCleanerTab] = usePagePersistence(
    `cleaner_tab_${employee.id}`,
    "home",
  );
  const [clockInFlow, setClockInFlow] = useState(null);

  const [blockStartFlow, setBlockStartFlow] = useState(null);
  // Set when an assignment "Start" or "Go to this bedroom" is tapped from
  // somewhere outside the bedroom — we navigate the cleaner to that
  // bedroom but DON'T create a work_block until they confirm. This
  // separates the "I'm intending to clean here" moment from the "the
  // billable clock starts now" moment, which matches how cleaners
  // actually work (they often walk to the bedroom, get supplies, etc.
  // before they're really ready to start). `null` when no pending start.
  // Shape: { unitId, partyId, unitLabel, partyLabel }
  const [pendingStart, setPendingStart] = useState(null);

  const [switchPending, setSwitchPending] = useState(null);
  // After the cleaner finishes a bedroom we show a "Next up" suggestion
  // modal listing other bedrooms in the same apartment → floor → building
  // → next building (3rd floor down). Shape: { fromUnit, fromParty }.
  const [nextUpPrompt, setNextUpPrompt] = useState(null);
  const [viewOnlySession, setViewOnlySession] = useState(null); // { id, started_at } if viewing without clocking in
  const [viewOnlyProperty, setViewOnlyProperty] = useState(null); // the property they picked to view
  const [bedroomHistory, setBedroomHistory] = useState(null); // params for BedroomHistoryView
  const [pendingBedroomAfterSwitch, setPendingBedroomAfterSwitch] =
    useState(null);

  useEffect(() => {
    if (work.activeBlock) setCleanerTab("home");
  }, [work.activeBlock?.id]);
  // Not clocked in → always land on Home. Otherwise a cleaner who was last
  // on More or Assignments clocks out and comes back to that tab instead of
  // their work list.
  useEffect(() => {
    if (!work.shift) setCleanerTab("home");
  }, [!work.shift]);

  const startClockIn = () => setClockInFlow({ step: "property" });

  // When a cleaner taps a job from the signed-in home, we clock them into
  // that job's property and then jump straight to its bedroom.
  const [pendingJob, setPendingJob] = useState(null);
  const startJob = async (job) => {
    setPendingJob(job);
    const { data: prop } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customerId)
      .single();
    if (!prop) {
      setPendingJob(null);
      return;
    }
    await onPickProperty(prop);
  };

  useEffect(() => {
    if (!pendingJob || !work.shift) return;
    if (work.shift.customer_id !== pendingJob.customerId) return;
    const j = pendingJob;
    setPendingJob(null);
    goToBedroomForTarget({ unit_id: j.unitId, party_id: j.partyId });
    /* eslint-disable-next-line */
  }, [work.shift, pendingJob]);

  const onPickProperty = async (property) => {
    if (property === null) {
      await work.doClockIn({ customerId: null });
      return;
    }
    if (property.property_type === "multi_unit") {
      await work.doClockIn({ customerId: property.id, propertyType: "multi_unit" });
    } else {
      await work.doClockIn({
        customerId: property.id,
        billRate:
          property.bill_mode === "hourly"
            ? property.bill_rate_hourly
            : property.flat_rate_amount,
        propertyType: "simple",
      });
    }
  };

  // View-only: cleaner browses messages, properties, assignments
  // without clocking in. Audited via view_only_sessions table.
  const startViewOnly = () => setClockInFlow({ step: "view-only-property" });

  const onPickViewOnlyProperty = async (property) => {
    work.setBusy(true);
    // First, auto-close any of this employee's view-only sessions that don't have an end_time.
    // This handles the case where they closed the browser without ending properly.
    try {
      const { data: open } = await supabase
        .from("view_only_sessions")
        .select("id, start_time")
        .eq("employee_id", employee.id)
        .is("end_time", null);
      if (open && open.length > 0) {
        await supabase
          .from("view_only_sessions")
          .update({ end_time: new Date().toISOString() })
          .eq("employee_id", employee.id)
          .is("end_time", null);
      }
    } catch (e) {
      console.warn("[view-only cleanup] failed", e);
    }
    const { data, error } = await supabase
      .from("view_only_sessions")
      .insert({
        employee_id: employee.id,
        customer_id: property?.id || null,
      })
      .select()
      .single();
    work.setBusy(false);
    if (error) {
      alert("Could not start view-only session: " + error.message);
      return;
    }
    setViewOnlySession(data);
    setViewOnlyProperty(property);
    setClockInFlow(null);
  };

  const logViewOnlyAction = async (action) => {
    if (!viewOnlySession) return;
    try {
      // Append to views_logged jsonb array
      const { data: current } = await supabase
        .from("view_only_sessions")
        .select("views_logged")
        .eq("id", viewOnlySession.id)
        .maybeSingle();
      const prior = Array.isArray(current?.views_logged)
        ? current.views_logged
        : [];
      const next = [...prior, { action, at: new Date().toISOString() }].slice(
        -200,
      ); // cap at 200 events per session
      await supabase
        .from("view_only_sessions")
        .update({ views_logged: next })
        .eq("id", viewOnlySession.id);
    } catch (e) {
      console.warn("[view-only audit] failed", e);
    }
  };

  const endViewOnly = async () => {
    if (!viewOnlySession) {
      setViewOnlySession(null);
      setViewOnlyProperty(null);
      return;
    }
    try {
      await supabase
        .from("view_only_sessions")
        .update({ end_time: new Date().toISOString() })
        .eq("id", viewOnlySession.id);
    } catch (e) {
      console.warn("[view-only end] failed", e);
    }
    setViewOnlySession(null);
    setViewOnlyProperty(null);
  };

  const switchToJob = async (job) => {
    if (!job?.customerId) {
      switchProperty();
      return;
    }
    work.setBusy(true);
    if (work.activeTask) await work.stopTask(work.activeTask, false);
    if (work.activeBlock && !work.activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", work.activeBlock.id);
    }
    if (work.shift?.id)
      await supabase
        .from("shifts")
        .update({ end_time: new Date().toISOString() })
        .eq("id", work.shift.id);
    work.setWorkBlocks([]);
    work.setActiveBlock(null);
    work.setTasks([]);
    work.setActiveTask(null);
    // Clock into the job's property.
    const { data: prop } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customerId)
      .single();
    const { data: newShift, error } = await supabase
      .from("shifts")
      .insert({
        employee_id: employee.id,
        customer_id: job.customerId,
        bill_rate_at_work:
          prop?.property_type === "simple"
            ? prop?.bill_mode === "hourly"
              ? prop?.bill_rate_hourly
              : prop?.flat_rate_amount
            : null,
        is_preview: previewMode,
      })
      .select("*, customer:customers(*)")
      .single();
    work.setBusy(false);
    if (error) {
      alert("Could not switch: " + error.message);
      return;
    }
    work.setShift(newShift);
    setClockInFlow(null);
    // Queue the bedroom so we land on its ready-to-start screen.
    if (job.unitId && job.partyId) {
      setPendingBedroomAfterSwitch({
        unit_id: job.unitId,
        party_id: job.partyId,
      });
    }
  };
  // Once the new work.shift is live, open the queued bedroom's ready-to-start.
  useEffect(() => {
    if (pendingBedroomAfterSwitch && work.shift?.id) {
      const target = pendingBedroomAfterSwitch;
      setPendingBedroomAfterSwitch(null);
      goToBedroomForTarget(target);
    }
    // eslint-disable-next-line
  }, [work.shift?.id, pendingBedroomAfterSwitch]);

  const switchProperty = async (targetProperty = null) => {
    // Direct switch: a property was tapped (e.g. from the More-tab browser),
    // so clock out here and clock straight into that one — no second picker.
    // Without a target, fall back to the old behavior (clock out → picker).
    const direct = targetProperty && targetProperty.id;
    const msg = direct
      ? `Clock out of ${work.shift.customer?.name || "here"} and clock in at ${targetProperty.name}?`
      : "Clock out here and pick a new property?";
    if (!confirm(msg)) return;
    work.setBusy(true);
    if (work.activeTask) await work.stopTask(work.activeTask, false);
    if (work.activeBlock && !work.activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", work.activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({ end_time: new Date().toISOString() })
      .eq("id", work.shift.id);
    work.setShift(null);
    work.setWorkBlocks([]);
    work.setActiveBlock(null);
    work.setTasks([]);
    work.setActiveTask(null);
    if (direct) {
      // Reuse the exact same clock-in path the picker uses, so there's one
      // code path for "start a work.shift at a property" and no risk of a second
      // open work.shift. work.doClockIn inserts the new work.shift and clears the flow.
      if (targetProperty.property_type === "multi_unit") {
        await work.doClockIn({
          customerId: targetProperty.id,
          propertyType: "multi_unit",
        });
      } else {
        await work.doClockIn({
          customerId: targetProperty.id,
          billRate:
            targetProperty.bill_mode === "hourly"
              ? targetProperty.bill_rate_hourly
              : targetProperty.flat_rate_amount,
          propertyType: "simple",
        });
      }
      setCleanerTab && setCleanerTab("home");
    } else {
      setClockInFlow({ step: "property" }); // no target → jump to the picker
    }
    work.setBusy(false);
  };

  // Attach a property to an existing no-property work.shift WITHOUT clocking
  // out. Routes the user to the property picker; on pick, just updates
  // the existing work.shift row's customer_id (and bill_rate_at_work for
  // simple properties). Keeps their clocked-in time running.
  const startAttachProperty = () => setClockInFlow({ step: "attach-property" });

  const onAttachProperty = async (property) => {
    if (!property?.id || !work.shift?.id) {
      // Nothing to do
      setClockInFlow(null);
      return;
    }
    work.setBusy(true);
    const update = { customer_id: property.id };
    // For simple properties, also update the bill_rate snapshot so
    // billing reflects the now-attached property. Skip for multi-unit
    // since they're billed per work block.
    if (property.property_type === "simple" && property.bill_rate_hourly) {
      update.bill_rate_at_work = property.bill_rate_hourly;
    }
    const { data, error } = await supabase
      .from("shifts")
      .update(update)
      .eq("id", work.shift.id)
      .select("*, customer:customers(*)")
      .single();
    work.setBusy(false);
    if (error) {
      alert("Could not attach property: " + error.message);
      return;
    }
    work.setShift(data);
    setClockInFlow(null);
  };

  const startNewBlock = () => setBlockStartFlow({ step: "unit" });
  const onPickBlockUnit = (unit) => setBlockStartFlow({ step: "party", unit });

  const goToBedroomForTarget = async (target) => {
    if (!target.unit_id || !target.party_id) {
      alert("This assignment isn't tied to a specific bedroom.");
      return;
    }

    // Already on this bedroom? Just open it.
    if (
      work.activeBlock &&
      work.activeBlock.unit_id === target.unit_id &&
      work.activeBlock.party_id === target.party_id &&
      !work.activeBlock.end_time
    ) {
      return; // already there
    }

    // Active block but on a different bedroom — open the
    // SwitchBedroomModal with 3 options instead of a native confirm.
    // The modal will call back into resolveSwitchTo* helpers below
    // depending on which button the cleaner taps.
    if (work.activeBlock && !work.activeBlock.end_time) {
      setSwitchPending({
        target,
        fromUnitLabel: work.activeBlock.unit?.label || "",
        fromPartyLabel: work.activeBlock.party?.label || "",
        toUnitLabel: target.unit?.label || "",
        toPartyLabel: target.party?.label || "",
      });
      return;
    }

    // If THIS cleaner has their own open block at this bedroom, close it
    // first (stop the running timer) and route through the pending-start
    // screen. We don't want "go to this bedroom" to land them in a
    // timer-running view — the user has been explicit about this. The
    // earlier work time stays preserved in the closed block; a fresh
    // block gets created when they tap Start cleaning.
    const myOpen = work.workBlocks.find(
      (b) =>
        !b.end_time &&
        b.unit_id === target.unit_id &&
        b.party_id === target.party_id,
    );
    if (myOpen) {
      work.setBusy(true);
      if (work.activeTask) await work.stopTask(work.activeTask, false);
      const ts = new Date().toISOString();
      await supabase
        .from("work_blocks")
        .update({ end_time: ts })
        .eq("id", myOpen.id);
      work.setWorkBlocks((prev) =>
        prev.map((b) => (b.id === myOpen.id ? { ...b, end_time: ts } : b)),
      );
      if (work.activeBlock?.id === myOpen.id) {
        work.setActiveBlock(null);
        work.setTasks([]);
        work.setActiveTask(null);
      }
      work.setBusy(false);
    }

    // Show the pending start screen — cleaner confirms by tapping Start.
    // Carry the assignment_id through so the work block created on confirm
    // is tagged with the exact job the cleaner came from (the card they
    // tapped), keeping two jobs at one bedroom — e.g. trash-out vs move-out
    // — from merging into one session.
    setPendingStart({
      unitId: target.unit_id,
      partyId: target.party_id,
      unitLabel: target.unit?.label || "",
      partyLabel: target.party?.label || "",
      assignmentId: target.assignment_id || target.assignment?.id || null,
    });
  };

  // ----- SwitchBedroomModal callbacks -----
  // The modal hands the cleaner three explicit actions for "I want
  // to switch to a different bedroom while one is open":
  //   - Stay        (close the modal, do nothing)
  //   - Pause + go  (pause in_progress items, end the block, route to new)
  //   - Finish + go (mark in_progress items DONE, end the block, route to new)
  // Both Pause and Finish then call goToBedroomForTarget for the new
  // target — which by then has no active block so it falls through to
  // the pendingStart branch and routes the cleaner to the bedroom
  // landing page.
  const closeCurrentBlockAndSwitch = async ({ markStatus, target }) => {
    setSwitchPending(null);
    if (!work.activeBlock || work.activeBlock.end_time) {
      // Block already gone — just route.
      await goToBedroomForTarget(target);
      return;
    }
    work.setBusy(true);
    if (work.activeTask) await work.stopTask(work.activeTask, false);
    // Update the cleaner's open items at the current bedroom to the
    // chosen status (paused for resume, done for finish).
    if (employee?.id && work.activeBlock.unit_id && work.activeBlock.party_id) {
      try {
        const patch = { status: markStatus };
        if (markStatus === "done") {
          patch.completed_at = new Date().toISOString();
          patch.completed_by = employee.id;
        }
        await supabase
          .from("assignment_targets")
          .update(patch)
          .eq("unit_id", work.activeBlock.unit_id)
          .eq("party_id", work.activeBlock.party_id)
          .eq("started_by", employee.id)
          .eq("status", "in_progress");
      } catch (e) {
        console.warn(
          `[switch bedroom] could not ${markStatus} in-progress items`,
          e,
        );
      }
    }
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", work.activeBlock.id);
    const updated = { ...work.activeBlock, end_time: ts, tasks: work.tasks };
    work.setWorkBlocks((prev) =>
      prev.map((b) => (b.id === work.activeBlock.id ? updated : b)),
    );
    work.setActiveBlock(null);
    work.setTasks([]);
    work.setActiveTask(null);
    work.setBusy(false);
    // Now route into the requested bedroom (fall-through to pendingStart).
    await goToBedroomForTarget(target);
  };
  const resolveSwitchPause = async (target) =>
    closeCurrentBlockAndSwitch({ markStatus: "paused", target });
  const resolveSwitchFinish = async (target) =>
    closeCurrentBlockAndSwitch({ markStatus: "done", target });

  // Cancel the pending start (cleaner decides not to start after all)
  const cancelPendingStart = () => setPendingStart(null);

  // Send-back-to-pending: cleaner navigated here but realized it's
  // the wrong bedroom (or changed their mind). Previously reset any
  // of THEIR OWN in_progress/paused targets at this bedroom to
  // 'pending' + wiped started_by/started_at — which silently erased
  // evidence of work in flight (the same bug class as the release-X
  // path we fixed earlier). Now those items move to 'paused' with
  // started_by/started_at preserved so the audit stays honest and
  // any other cleaner can resume.
  //
  // The function name still reads "send back to pending" because
  // the user-visible flow is the same (cleaner backs out, queue
  // looks fresh); only the internal status routing changed.
  const sendBackToPendingFromPrepare = async () => {
    if (!pendingStart || !employee?.id) {
      setPendingStart(null);
      return;
    }
    try {
      const { data: mine } = await supabase
        .from("assignment_targets")
        .select("id, status, assignment:assignments!inner(customer_id, active)")
        .eq("unit_id", pendingStart.unitId)
        .eq("party_id", pendingStart.partyId)
        .in("status", ["in_progress", "paused"])
        .eq("started_by", employee.id);
      const eligible = (mine || []).filter(
        (t) =>
          t.assignment?.customer_id === work.shift?.customer_id &&
          t.assignment?.active,
      );
      // Route in_progress → paused. Items already paused stay paused
      // (no-op). started_by/started_at are PRESERVED so the audit
      // trail still says who and when.
      const toPause = eligible.filter((t) => t.status === "in_progress");
      if (toPause.length > 0) {
        await supabase
          .from("assignment_targets")
          .update({
            status: "paused",
          })
          .in(
            "id",
            toPause.map((t) => t.id),
          );
      }
    } catch (e) {
      console.warn("[sendBackToPending] failed", e);
    }
    setPendingStart(null);
  };
  return {
    cleanerTab,
    setCleanerTab,
    clockInFlow,
    setClockInFlow,
    blockStartFlow,
    setBlockStartFlow,
    pendingStart,
    setPendingStart,
    pendingJob,
    setPendingJob,
    switchPending,
    setSwitchPending,
    nextUpPrompt,
    setNextUpPrompt,
    viewOnlySession,
    setViewOnlySession,
    viewOnlyProperty,
    setViewOnlyProperty,
    bedroomHistory,
    setBedroomHistory,
    pendingBedroomAfterSwitch,
    setPendingBedroomAfterSwitch,
    startClockIn,
    startJob,
    onPickProperty,
    startViewOnly,
    onPickViewOnlyProperty,
    logViewOnlyAction,
    endViewOnly,
    switchToJob,
    switchProperty,
    startAttachProperty,
    onAttachProperty,
    startNewBlock,
    onPickBlockUnit,
    goToBedroomForTarget,
    closeCurrentBlockAndSwitch,
    resolveSwitchPause,
    resolveSwitchFinish,
    cancelPendingStart,
    sendBackToPendingFromPrepare,
  };
}
