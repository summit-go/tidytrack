import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useIdleDetector } from "../../../hooks/useIdleDetector.js";
import { useTick } from "../../../hooks/useTick.js";
import { useActiveWorkBlock } from "../../../domains/work/hooks/useActiveWorkBlock.js";
import { useCleanerNavigation } from "../../../domains/work/hooks/useCleanerNavigation.js";
import { Splash } from "../../../components/Splash.jsx";
import { ChangePinModal } from "../../../domains/work/cross-cutting/ChangePinModal.jsx";
import { SwitchBedroomModal } from "../../../domains/work/cross-cutting/SwitchBedroomModal.jsx";
import { IdleWarningModal } from "../../../domains/work/cross-cutting/IdleWarningModal.jsx";
import { MoveBlockModalInline } from "../../../domains/work/cleaner/MoveBlockModalInline.jsx";
import { NextUpModal } from "../../../domains/work/cross-cutting/NextUpModal.jsx";
import { BedroomHistoryView } from "../../../domains/work/daily/BedroomHistoryView.jsx";
import { SimpleShiftView } from "../../../domains/work/cleaner/SimpleShiftView.jsx";
import { StaffMessagesTab } from "../../../features/messaging/StaffMessagesTab.jsx";
import { SupplyChecklistGate } from "./SupplyChecklistGate.jsx";
import { PropertyPicker } from "./PropertyPicker.jsx";
import { UnitPicker } from "./UnitPicker.jsx";
import { PartyPicker } from "./PartyPicker.jsx";
import { ViewOnlyDashboard } from "../../../domains/work/cleaner/ViewOnlyDashboard.jsx";
import { CleanerClockedOut } from "./CleanerClockedOut.jsx";
import { CleanerPropertyFlow } from "./CleanerPropertyFlow.jsx";
import { CleanerBlockFlow } from "./CleanerBlockFlow.jsx";

export function EmployeeApp({
  employee: employeeInit,
  onSignOut,
  previewMode = false,
}) {
  const [employee, setEmployee] = useState(employeeInit);
  const [supplyOk, setSupplyOk] = useState(false);
  const [supplyChecked, setSupplyChecked] = useState(false);

  useEffect(() => {
    if (previewMode) {
      setSupplyChecked(true);
      return;
    }
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (
        localStorage.getItem(`supply_ok_${employee?.id}_${todayKey}`) === "1"
      ) {
        setSupplyOk(true);
        setSupplyChecked(true);
        return;
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).toISOString();
        let found = false;
        for (const col of ["confirmed_at", "created_at", "inserted_at"]) {
          const { data, error } = await supabase
            .from("supply_checklist_confirmations")
            .select("id")
            .eq("employee_id", employee?.id)
            .gte(col, startOfDay)
            .limit(1);
          if (error) {
            if (/column|does not exist|42703/i.test(error.message || ""))
              continue;
            break;
          }
          if (data && data.length > 0) found = true;
          break;
        }
        if (!cancelled && found) setSupplyOk(true);
      } catch (e) {
        console.warn("[supply] today-confirmation check failed", e);
      } finally {
        if (!cancelled) setSupplyChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line */
  }, [employee?.id, previewMode]);

  const navigationRef = useRef({});
  const work = useActiveWorkBlock({
    employee,
    previewMode,
    onSignOut,
    navigationRef,
  });
  const nav = useCleanerNavigation({ employee, previewMode, work });
  navigationRef.current = nav;

  const [photoModal, setPhotoModal] = useState(null);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [whosWorkingOpen, setWhosWorkingOpen] = useState(false);

  useTick(!!work.shift && !work.shift.end_time);

  const { showWarning: showIdleWarning, dismissWarning: dismissIdleWarning } =
    useIdleDetector({
      shift: work.shift,
      onAutoClockOut: work.autoClockOut,
      enabled: !previewMode && !!work.shift && !work.shift.end_time,
    });

  if (!work.loaded) return <Splash text="Loading…" />;

  if (!previewMode && !supplyOk) {
    if (!supplyChecked) return <Splash text="Loading…" />;
    return (
      <SupplyChecklistGate
        employee={employee}
        onDone={() => setSupplyOk(true)}
        onSignOut={onSignOut}
      />
    );
  }

  const withIdleModal = (children) => (
    <>
      {children}
      {showIdleWarning && (
        <IdleWarningModal onStillActive={dismissIdleWarning} />
      )}
      {work.closedMoveTarget && (
        <MoveBlockModalInline
          block={work.closedMoveTarget}
          propertyId={work.shift?.customer_id}
          shiftId={work.shift?.id}
          currentEmployeeId={employee?.id}
          mode="bedroom"
          onSave={async (newUnit, newParty, resetIds) => {
            await work.moveMultipleWorkBlocksTo(
              [work.closedMoveTarget.id],
              newUnit,
              newParty,
              resetIds,
            );
            work.setClosedMoveTarget(null);
          }}
          onSaveMulti={async (blockIds, newUnit, newParty, resetIds) => {
            await work.moveMultipleWorkBlocksTo(
              blockIds,
              newUnit,
              newParty,
              resetIds,
            );
            work.setClosedMoveTarget(null);
          }}
          onClose={() => work.setClosedMoveTarget(null)}
        />
      )}
      {showChangePin && (
        <ChangePinModal
          employee={employee}
          onClose={() => setShowChangePin(false)}
          onSaved={(newPin) => {
            setEmployee({ ...employee, pin: newPin });
            setShowChangePin(false);
          }}
        />
      )}
      {nav.switchPending && (
        <SwitchBedroomModal
          fromUnitLabel={nav.switchPending.fromUnitLabel}
          fromPartyLabel={nav.switchPending.fromPartyLabel}
          toUnitLabel={nav.switchPending.toUnitLabel}
          toPartyLabel={nav.switchPending.toPartyLabel}
          busy={work.busy}
          onStay={() => nav.setSwitchPending(null)}
          onPause={() => nav.resolveSwitchPause(nav.switchPending.target)}
          onFinish={() => nav.resolveSwitchFinish(nav.switchPending.target)}
        />
      )}
      {nav.bedroomHistory && (
        <BedroomHistoryView
          propertyId={work.shift?.customer_id || nav.viewOnlyProperty?.id}
          propertyName={
            work.shift?.customer?.name || nav.viewOnlyProperty?.name || ""
          }
          unitId={nav.bedroomHistory.unitId}
          unitLabel={nav.bedroomHistory.unitLabel}
          partyId={nav.bedroomHistory.partyId}
          partyLabel={nav.bedroomHistory.partyLabel}
          employee={employee}
          onBack={() => nav.setBedroomHistory(null)}
        />
      )}
      {nav.nextUpPrompt && (
        <NextUpModal
          from={nav.nextUpPrompt}
          employeeId={employee?.id}
          onClose={() => nav.setNextUpPrompt(null)}
          onSeeAssignments={() => {
            nav.setNextUpPrompt(null);
            nav.setCleanerTab("home");
          }}
          onPick={(c) => {
            nav.setNextUpPrompt(null);
            nav.setPendingStart({
              unitId: c.unitId,
              partyId: c.partyId,
              unitLabel: c.unitLabel,
              partyLabel: c.partyLabel,
            });
          }}
        />
      )}
    </>
  );

  if (showMessages) {
    return withIdleModal(
      <StaffMessagesTab
        employee={employee}
        onClose={() => {
          nav.logViewOnlyAction("viewed_messages");
          setShowMessages(false);
        }}
      />,
    );
  }

  if (nav.viewOnlySession) {
    return (
      <ViewOnlyDashboard
        employee={employee}
        property={nav.viewOnlyProperty}
        onSignOut={work.signOutWithCleanup}
        onEndViewing={nav.endViewOnly}
        onOpenMessages={() => {
          nav.logViewOnlyAction("opened_messages");
          setShowMessages(true);
        }}
        onOpenBedroomHistory={(params) => {
          nav.logViewOnlyAction("opened_bedroom_history");
          nav.setBedroomHistory(params);
        }}
        onSwitchProperty={async () => {
          await nav.endViewOnly();
          nav.setClockInFlow({ step: "view-only-property" });
        }}
      />
    );
  }

  if (!work.shift && nav.clockInFlow?.step === "property") {
    return withIdleModal(
      <PropertyPicker
        onPick={nav.onPickProperty}
        onCancel={() => nav.setClockInFlow(null)}
        busy={work.busy}
        employee={employee}
      />,
    );
  }
  if (!work.shift && nav.clockInFlow?.step === "view-only-property") {
    return withIdleModal(
      <PropertyPicker
        onPick={nav.onPickViewOnlyProperty}
        onCancel={() => nav.setClockInFlow(null)}
        busy={work.busy}
        title="Which property do you want to look at?"
        subtitle="View-only — no time will be tracked"
        viewOnly={true}
        employee={employee}
      />,
    );
  }
  if (work.shift && nav.clockInFlow?.step === "attach-property") {
    return withIdleModal(
      <PropertyPicker
        onPick={nav.onAttachProperty}
        onCancel={() => nav.setClockInFlow(null)}
        busy={work.busy}
        title="Attach a property to this shift"
        subtitle="You'll stay clocked in — no time lost"
        viewOnly={true}
        employee={employee}
      />,
    );
  }
  if (work.shift && nav.blockStartFlow?.step === "unit") {
    return withIdleModal(
      <UnitPicker
        property={work.shift.customer}
        onPick={nav.onPickBlockUnit}
        onBack={() => nav.setBlockStartFlow(null)}
        busy={work.busy}
        title="Which apartment?"
      />,
    );
  }
  if (work.shift && nav.blockStartFlow?.step === "party") {
    return withIdleModal(
      <PartyPicker
        property={work.shift.customer}
        unit={nav.blockStartFlow.unit}
        onPick={work.onPickBlockParty}
        onBack={() => nav.setBlockStartFlow({ step: "unit" })}
        busy={work.busy}
      />,
    );
  }

  if (!work.shift) {
    return withIdleModal(
      <CleanerClockedOut
        employee={employee}
        cleanerTab={nav.cleanerTab}
        setCleanerTab={nav.setCleanerTab}
        busy={work.busy}
        whosWorkingOpen={whosWorkingOpen}
        setWhosWorkingOpen={setWhosWorkingOpen}
        signOutWithCleanup={work.signOutWithCleanup}
        startClockIn={nav.startClockIn}
        startJob={nav.startJob}
        onPickProperty={nav.onPickProperty}
        startViewOnly={nav.startViewOnly}
        setShowMessages={setShowMessages}
        setShowChangePin={setShowChangePin}
      />,
    );
  }

  const isMulti = work.shift.customer?.property_type === "multi_unit";

  if (isMulti && !work.activeBlock && nav.pendingStart) {
    return withIdleModal(
      <CleanerPropertyFlow
        mode="preparing"
        shift={work.shift}
        workBlocks={work.workBlocks}
        employee={employee}
        pendingStart={nav.pendingStart}
        cleanerTab={nav.cleanerTab}
        setCleanerTab={nav.setCleanerTab}
        busy={work.busy}
        signOutWithCleanup={work.signOutWithCleanup}
        clockOut={work.clockOut}
        switchProperty={nav.switchProperty}
        switchToJob={nav.switchToJob}
        startNewBlock={nav.startNewBlock}
        reopenBlock={work.reopenBlock}
        endBlock={work.endBlock}
        goToBedroomForTarget={nav.goToBedroomForTarget}
        setShowMessages={setShowMessages}
        setShowChangePin={setShowChangePin}
        setBedroomHistory={nav.setBedroomHistory}
        joinBlock={work.joinBlock}
        undoClosedBlock={work.undoClosedBlock}
        moveClosedBlock={work.moveClosedBlock}
        cancelPendingStart={nav.cancelPendingStart}
        confirmPendingStart={work.confirmPendingStart}
        sendBackToPendingFromPrepare={nav.sendBackToPendingFromPrepare}
        setActiveBlock={work.setActiveBlock}
        setPendingStart={nav.setPendingStart}
      />,
    );
  }

  if (isMulti && (!work.activeBlock || nav.cleanerTab !== "home")) {
    return withIdleModal(
      <CleanerPropertyFlow
        mode="hub"
        shift={work.shift}
        workBlocks={work.workBlocks}
        employee={employee}
        pendingStart={nav.pendingStart}
        cleanerTab={nav.cleanerTab}
        setCleanerTab={nav.setCleanerTab}
        busy={work.busy}
        signOutWithCleanup={work.signOutWithCleanup}
        clockOut={work.clockOut}
        switchProperty={nav.switchProperty}
        switchToJob={nav.switchToJob}
        startNewBlock={nav.startNewBlock}
        reopenBlock={work.reopenBlock}
        endBlock={work.endBlock}
        goToBedroomForTarget={nav.goToBedroomForTarget}
        setShowMessages={setShowMessages}
        setShowChangePin={setShowChangePin}
        setBedroomHistory={nav.setBedroomHistory}
        joinBlock={work.joinBlock}
        undoClosedBlock={work.undoClosedBlock}
        moveClosedBlock={work.moveClosedBlock}
        cancelPendingStart={nav.cancelPendingStart}
        confirmPendingStart={work.confirmPendingStart}
        sendBackToPendingFromPrepare={nav.sendBackToPendingFromPrepare}
        setActiveBlock={work.setActiveBlock}
        setPendingStart={nav.setPendingStart}
      />,
    );
  }

  if (isMulti && work.activeBlock) {
    return withIdleModal(
      <CleanerBlockFlow
        shift={work.shift}
        activeBlock={work.activeBlock}
        tasks={work.tasks}
        activeTask={work.activeTask}
        employee={employee}
        finishConfirmOpen={finishConfirmOpen}
        setFinishConfirmOpen={setFinishConfirmOpen}
        busy={work.busy}
        signOutWithCleanup={work.signOutWithCleanup}
        finishBlock={work.finishBlock}
        stopTask={work.stopTask}
        setWorkBlocks={work.setWorkBlocks}
        setActiveBlock={work.setActiveBlock}
        setPendingStart={nav.setPendingStart}
        setCleanerTab={nav.setCleanerTab}
        undoBlock={work.undoBlock}
        reopenBlock={work.reopenBlock}
        newTaskName={work.newTaskName}
        setNewTaskName={work.setNewTaskName}
        startTask={work.startTask}
        startTasksFromPicker={work.startTasksFromPicker}
        startTasksFromChecklistItems={work.startTasksFromChecklistItems}
        releaseTargetsFromWorkblock={work.releaseTargetsFromWorkblock}
        resumeTask={work.resumeTask}
        photoModal={photoModal}
        setPhotoModal={setPhotoModal}
        uploadPhoto={work.uploadPhoto}
        changePhotoKind={work.changePhotoKind}
        savePhotoNote={work.savePhotoNote}
        setShowMessages={setShowMessages}
        setBedroomHistory={nav.setBedroomHistory}
        moveActiveBlockTo={work.moveActiveBlockTo}
        moveMultipleWorkBlocksTo={work.moveMultipleWorkBlocksTo}
        leaveBlock={work.leaveBlock}
        joinBlock={work.joinBlock}
        deletePhoto={work.deletePhoto}
        goToBedroomForTarget={nav.goToBedroomForTarget}
        switchProperty={nav.switchProperty}
        cleanerTab={nav.cleanerTab}
        previewMode={previewMode}
      />,
    );
  }

  return withIdleModal(
    <SimpleShiftView
      shift={work.shift}
      tasks={work.tasks}
      activeTask={work.activeTask}
      employeeName={employee.name}
      employee={employee}
      onSignOut={work.signOutWithCleanup}
      onClockOut={work.clockOut}
      onSwitchProperty={nav.switchProperty}
      onAttachProperty={nav.startAttachProperty}
      newTaskName={work.newTaskName}
      setNewTaskName={work.setNewTaskName}
      onStartTask={work.startTask}
      onStartTasksFromPicker={work.startTasksFromPicker}
      onStartChecklistItems={work.startTasksFromChecklistItems}
      onReleaseTargets={work.releaseTargetsFromWorkblock}
      onStopTask={work.stopTask}
      onResumeTask={work.resumeTask}
      onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
      photoModal={photoModal}
      onClosePhotoModal={() => setPhotoModal(null)}
      onUploadPhoto={work.uploadPhoto}
      onSavePhotoNote={work.savePhotoNote}
      onDeletePhoto={work.deletePhoto}
      onOpenMessages={() => setShowMessages(true)}
      onOpenChangePin={() => setShowChangePin(true)}
      busy={work.busy}
    />,
  );
}
