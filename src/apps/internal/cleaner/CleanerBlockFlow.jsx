import React from "react";
import { ConfirmModal } from "../../../components/ConfirmModal.jsx";
import { BlockView } from "../../../domains/work/cleaner/BlockView.jsx";
import { supabase } from "../../../lib/supabase.js";

export function CleanerBlockFlow({
  shift,
  activeBlock,
  tasks,
  activeTask,
  employee,
  finishConfirmOpen,
  setFinishConfirmOpen,
  busy,
  signOutWithCleanup,
  finishBlock,
  stopTask,
  setWorkBlocks,
  setActiveBlock,
  setPendingStart,
  setCleanerTab,
  undoBlock,
  reopenBlock,
  newTaskName,
  setNewTaskName,
  startTask,
  startTasksFromPicker,
  startTasksFromChecklistItems,
  releaseTargetsFromWorkblock,
  resumeTask,
  photoModal,
  setPhotoModal,
  uploadPhoto,
  changePhotoKind,
  savePhotoNote,
  setShowMessages,
  setBedroomHistory,
  moveActiveBlockTo,
  moveMultipleWorkBlocksTo,
  leaveBlock,
  joinBlock,
  deletePhoto,
  goToBedroomForTarget,
  switchProperty,
  cleanerTab,
  previewMode,
}) {
  return (
          <>
            <ConfirmModal
              open={finishConfirmOpen}
              title="Close out this assignment?"
              message="You will close out this entire assignment. Confirm?"
              confirmLabel="Confirm"
              cancelLabel="Cancel"
              busy={busy}
              onCancel={() => setFinishConfirmOpen(false)}
              onConfirm={async () => {
                await finishBlock();
                setFinishConfirmOpen(false);
              }}
            />
            <BlockView
              shift={shift}
              block={activeBlock}
              tasks={tasks}
              activeTask={activeTask}
              employeeName={employee.name}
              employee={employee}
              onSignOut={signOutWithCleanup}
              onFinish={() => setFinishConfirmOpen(true)}
              onExit={async () => {
                // ✓ mark-complete / ✕ delete from the working screen should also CLOSE
                // the timer session. Without this the block was left open (paused) and
                // the home screen nagged you to Resume/Pause/End a session you'd
                // already finished.
                if (activeBlock) {
                  const nowISO = new Date().toISOString();
                  try {
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
                    console.warn("[onExit] could not close block", e);
                  }
                }
                setActiveBlock(null);
                setPendingStart(null);
                setCleanerTab("home");
              }}
              onPause={() => setActiveBlock(null)}
              onUndo={undoBlock}
              onReopen={reopenBlock}
              newTaskName={newTaskName}
              setNewTaskName={setNewTaskName}
              onStartTask={startTask}
              onStartTasksFromPicker={startTasksFromPicker}
              onStartChecklistItems={startTasksFromChecklistItems}
              onReleaseTargets={releaseTargetsFromWorkblock}
              onStopTask={stopTask}
              onResumeTask={resumeTask}
              onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
              photoModal={photoModal}
              onClosePhotoModal={() => setPhotoModal(null)}
              onUploadPhoto={uploadPhoto}
              onChangePhotoKind={changePhotoKind}
              onSavePhotoNote={savePhotoNote}
              onOpenMessages={() => setShowMessages(true)}
              onOpenBedroomHistory={setBedroomHistory}
              onMoveBlock={moveActiveBlockTo}
              onMoveMultiple={moveMultipleWorkBlocksTo}
              onLeaveBlock={leaveBlock}
              onJoinBlock={joinBlock}
              onDeletePhoto={deletePhoto}
              onGoToBedroom={goToBedroomForTarget}
              onSwitchProperty={switchProperty}
              cleanerTab={cleanerTab}
              setCleanerTab={setCleanerTab}
              previewMode={previewMode}
              busy={busy}
            />
          </>
  );
}
