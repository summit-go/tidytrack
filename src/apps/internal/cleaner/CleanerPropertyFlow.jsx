import React from "react";
import { PreparingBlockView } from "../../../domains/work/cleaner/PreparingBlockView.jsx";
import { PropertyHub } from "./PropertyHub.jsx";

export function CleanerPropertyFlow({
  mode,
  shift,
  workBlocks,
  employee,
  pendingStart,
  cleanerTab,
  setCleanerTab,
  busy,
  signOutWithCleanup,
  clockOut,
  switchProperty,
  switchToJob,
  startNewBlock,
  reopenBlock,
  endBlock,
  goToBedroomForTarget,
  setShowMessages,
  setShowChangePin,
  setBedroomHistory,
  joinBlock,
  undoClosedBlock,
  moveClosedBlock,
  cancelPendingStart,
  confirmPendingStart,
  sendBackToPendingFromPrepare,
  setActiveBlock,
  setPendingStart,
}) {
  if (mode === "preparing") {
    return (
            <PreparingBlockView
              shift={shift}
              pendingStart={pendingStart}
              employeeName={employee.name}
              employee={employee}
              onSignOut={signOutWithCleanup}
              onCancel={cancelPendingStart}
              onStart={confirmPendingStart}
              onSendBackToPending={sendBackToPendingFromPrepare}
              onReopen={reopenBlock}
              onOpenMessages={() => setShowMessages(true)}
              onOpenBedroomHistory={setBedroomHistory}
              onJoinBlock={joinBlock}
              onExit={() => {
                setActiveBlock(null);
                setPendingStart(null);
                setCleanerTab("home");
              }}
              busy={busy}
            />
    );
  }
  return (
          <PropertyHub
            shift={shift}
            workBlocks={workBlocks}
            employeeName={employee.name}
            employee={employee}
            onSignOut={signOutWithCleanup}
            onClockOut={clockOut}
            onSwitchProperty={switchProperty}
            onSwitchToJob={switchToJob}
            onStartNew={startNewBlock}
            onReopen={reopenBlock}
            onEndBlock={endBlock}
            onGoToBedroom={goToBedroomForTarget}
            onOpenMessages={() => setShowMessages(true)}
            onOpenChangePin={() => setShowChangePin(true)}
            onOpenBedroomHistory={setBedroomHistory}
            onJoinBlock={joinBlock}
            onUndoBlock={undoClosedBlock}
            onMoveBlock={moveClosedBlock}
            cleanerTab={cleanerTab}
            setCleanerTab={setCleanerTab}
            busy={busy}
          />
  );
}
