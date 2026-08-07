import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  Search,
  Clock,
  Camera,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Pause,
  Play,
  Check,
  ArrowLeft,
  Users,
  Image as ImageIcon,
  Download,
  X,
  MapPin,
  Briefcase,
  Delete,
  AlertCircle,
  UserPlus,
  Building2,
  Trash2,
  Eye,
  EyeOff,
  LayoutDashboard,
  FileText,
  DollarSign,
  Home,
  Layers,
  User,
  Edit2,
  Copy,
  Printer,
  Calendar,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  Settings,
  Languages,
  Menu,
  Square,
  Share2,
  ClipboardList,
  Lock,
  Circle,
  MoreVertical,
  RotateCcw,
  Undo2,
  Bell,
} from "lucide-react";
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  secureEmployeeSignIn,
  securePortalSignIn,
  secureSetCredential,
  PHOTO_BUCKET,
  ASSIGNMENT_BUCKET,
  PM_UPLOAD_BUCKET,
  MESSAGE_BUCKET,
  saveAssignees,
  fetchLivePresence,
  createNotification,
  clearAssignmentBroadcast,
  clearPmAssignmentNotification,
  uploadAssignmentFile,
  uploadPmFile,
  deletePmFile,
  uploadMessagePhoto,
  deleteMessagePhoto,
} from "../../../lib/supabase.js";
import {
  ASSIGNMENT_TYPES,
  assignmentTypeLabel,
  assignmentTypeMeta,
  KIND_CANNOT,
  PHOTO_KIND_LABELS,
  photoKindLabel,
  FLAG_KINDS,
  ASSIGNMENT_MAX_SIZE_MB,
  CAPABILITIES,
  TASK_CATEGORIES,
  GENERAL_GROUP_ORDER,
  taskCategoryLabel,
  taskCategoryShortLabel,
  ASSIGNMENT_STATUSES,
  INVOICE_DESCR,
  SUMMIT_LOGO_URL,
  SUMMIT_COMPANY,
  INVOICE_TYPE_LABEL,
  INVOICE_STATUS_STYLE,
  STALE_IDLE_MIN,
  STALE_FORCE_MIN,
  MAX_BLOCK_HOURS,
} from "../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../lib/permissions.js";
import {
  fmtTime,
  fmtTimeShort,
  fmtMoney,
  fmtDate,
  fmtDateLong,
  fmtDateWithDay,
  fmtDueDate,
  localTodayKey,
  assignmentDueKind,
  assignmentDueRank,
  fmtClock,
  greetingForTime,
  shiftBillableMs,
  shiftBillableHours,
  localDayKey,
  fmtInvoiceDate,
  toDateKey,
} from "../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../lib/photos.js";
import { sessionStore } from "../../auth/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../lib/labels.js";
import { splitTaskName } from "../../../lib/tasks.js";
import { useAssignmentSync } from "../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../hooks/useTick.js";
import { useUnreadCount } from "../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../components/Splash.jsx";
import { ScreenId } from "../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../components/NotificationBell.jsx";
import { Header } from "../../../components/Header.jsx";
import { TeamClockIcon } from "../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { AdjustmentModal } from "./AdjustmentModal.jsx";
import { BedroomHistoryView } from "../daily/BedroomHistoryView.jsx";
import { DeleteConfirmModal } from "./DeleteConfirmModal.jsx";
import { MoveBlockModal } from "../cleaner/MoveBlockModal.jsx";
import { TaskDetail } from "./TaskDetail.jsx";
import { TimeEditModal } from "./TimeEditModal.jsx";
import { WorkBlockDetail } from "./WorkBlockDetail.jsx";

export function ShiftDetail({ shiftId, viewerRole, viewerEmployee, onBack }) {
  const showMoney = canSeeMoney(viewerEmployee);
  const canEdit = can(viewerEmployee, "edit_shift_times");
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingShift, setEditingShift] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null); // block obj
  const [deletingBlock, setDeletingBlock] = useState(null); // block obj
  const [movingBlock, setMovingBlock] = useState(null); // block obj for MoveBlockModal
  const [editingAdjustment, setEditingAdjustment] = useState(false);
  const [bedroomHistory, setBedroomHistory] = useState(null); // params for history view
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data: s } = await supabase
      .from("shifts")
      .select(
        "*, employee:employees(name), customer:customers(name,address,property_type,bill_rate_hourly)",
      )
      .eq("id", shiftId)
      .single();
    setShift(s);
    if (s?.customer?.property_type === "multi_unit") {
      const { data: wbs } = await supabase
        .from("work_blocks")
        .select(
          "*, unit:units(label), party:parties(label,full_name), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("shift_id", shiftId)
        .order("start_time");
      setWorkBlocks(wbs || []);
    } else {
      const { data: ts } = await supabase
        .from("tasks")
        .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
        .eq("shift_id", shiftId)
        .is("work_block_id", null)
        .order("start_time");
      setTasks(ts || []);
    }
  };
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [shiftId]);

  const saveShiftTimes = async (startISO, endISO) => {
    setBusy(true);
    const { error } = await supabase
      .from("shifts")
      .update({ start_time: startISO, end_time: endISO || null })
      .eq("id", shiftId);
    setBusy(false);
    if (error) {
      alert("Could not save: " + error.message);
      return;
    }
    setEditingShift(false);
    reload();
  };

  const saveAdjustment = async (seconds, notes) => {
    setBusy(true);
    const { error } = await supabase
      .from("shifts")
      .update({
        manual_adjustment_seconds: seconds,
        adjustment_notes: notes || null,
      })
      .eq("id", shiftId);
    setBusy(false);
    if (error) {
      alert("Could not save: " + error.message);
      return;
    }
    reload();
  };

  const deleteShift = async () => {
    setBusy(true);
    // Cascade should handle work_blocks/tasks/photos via the original schema
    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
    setBusy(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setDeletingShift(false);
    onBack();
  };

  const saveBlockTimes = async (block, startISO, endISO) => {
    setBusy(true);
    const { error } = await supabase
      .from("work_blocks")
      .update({ start_time: startISO, end_time: endISO || null })
      .eq("id", block.id);
    setBusy(false);
    if (error) {
      alert("Could not save: " + error.message);
      return;
    }
    setEditingBlock(null);
    reload();
  };

  const deleteBlock = async (block) => {
    setBusy(true);
    const { error } = await supabase
      .from("work_blocks")
      .delete()
      .eq("id", block.id);
    setBusy(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setDeletingBlock(null);
    reload();
  };

  if (!shift) return <Splash text="Loading…" />;
  if (bedroomHistory) {
    return (
      <BedroomHistoryView
        propertyId={shift.customer_id}
        propertyName={shift.customer?.name || ""}
        unitId={bedroomHistory.unitId}
        unitLabel={bedroomHistory.unitLabel}
        partyId={bedroomHistory.partyId}
        partyLabel={bedroomHistory.partyLabel}
        employee={{ role: viewerRole }}
        onBack={() => setBedroomHistory(null)}
      />
    );
  }
  const dur =
    (shift.end_time ? new Date(shift.end_time) : new Date()) -
    new Date(shift.start_time);
  const isMulti = shift.customer?.property_type === "multi_unit";

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 text-sm mb-4 hover:text-stone-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          Shift detail · {fmtDate(shift.start_time)}
        </div>
        <h1 className="text-3xl font-light tracking-tight mb-2">
          <span className="font-serif italic text-amber-500">
            {shift.employee?.name}
          </span>
        </h1>
        {shift.customer && (
          <div className="text-sm text-stone-300 mb-2 flex items-center gap-1.5">
            <Building2 size={14} /> {shift.customer.name}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm mt-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 font-mono mb-1">
              Clocked in
            </div>
            <div className="font-mono text-lg">{fmtTimeShort(dur)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 font-mono mb-1">
              {isMulti ? "Blocks" : "Tasks"}
            </div>
            <div className="font-mono text-lg">
              {isMulti ? workBlocks.length : tasks.length}
            </div>
          </div>
        </div>

        {/* Idle + adjustment breakdown */}
        {(shift.idle_seconds > 0 ||
          shift.manual_adjustment_seconds !== 0 ||
          shift.auto_clocked_out) &&
          (() => {
            const idleSec = shift.idle_seconds || 0;
            const adjSec = shift.manual_adjustment_seconds || 0;
            const totalMs =
              (shift.end_time ? new Date(shift.end_time) : new Date()) -
              new Date(shift.start_time);
            const billableMs = Math.max(
              0,
              totalMs - idleSec * 1000 + adjSec * 1000,
            );
            const intervals = shift.idle_intervals || [];
            return (
              <div className="mt-4 p-4 rounded-2xl bg-stone-800 border border-stone-700">
                <div className="text-xs uppercase tracking-wider text-amber-400 font-mono mb-3">
                  Time breakdown
                </div>
                <div className="space-y-1.5 text-sm font-mono">
                  <div className="flex justify-between text-stone-300">
                    <span>Clocked in</span>
                    <span>{fmtTimeShort(totalMs)}</span>
                  </div>
                  {idleSec > 0 && (
                    <div className="flex justify-between text-stone-400">
                      <span>− Idle detected</span>
                      <span>{fmtTimeShort(idleSec * 1000)}</span>
                    </div>
                  )}
                  {adjSec !== 0 && (
                    <div className="flex justify-between text-stone-400">
                      <span>{adjSec >= 0 ? "+" : "−"} Manual adjustment</span>
                      <span>{fmtTimeShort(Math.abs(adjSec) * 1000)}</span>
                    </div>
                  )}
                  <div className="border-t border-stone-700 pt-1.5 flex justify-between text-stone-50 font-semibold">
                    <span>= Billable</span>
                    <span>{fmtTimeShort(billableMs)}</span>
                  </div>
                </div>

                {shift.auto_clocked_out && (
                  <div className="mt-3 text-[10px] text-amber-400 font-mono">
                    ⚠ Auto-clocked out due to 30+ min inactivity
                  </div>
                )}

                {intervals.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-700">
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">
                      Idle gaps detected
                    </div>
                    {intervals.map((iv, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-stone-400 font-mono"
                      >
                        {fmtClock(iv.start)} – {fmtClock(iv.end)} (
                        {fmtTimeShort(iv.seconds * 1000)})
                      </div>
                    ))}
                  </div>
                )}

                {shift.adjustment_notes && (
                  <div className="mt-3 pt-3 border-t border-stone-700">
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">
                      Adjustment notes
                    </div>
                    <div className="text-xs text-stone-300 italic">
                      "{shift.adjustment_notes}"
                    </div>
                  </div>
                )}

                {canEdit && (
                  <button
                    onClick={() => setEditingAdjustment(true)}
                    className="mt-3 w-full py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-mono flex items-center justify-center gap-2"
                  >
                    <Edit2 size={12} /> Adjust billable time
                  </button>
                )}
              </div>
            );
          })()}
      </div>
      <div className="px-5 pt-6">
        {isMulti ? (
          <>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
              Work blocks
            </div>
            {workBlocks.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No work blocks.
              </div>
            ) : (
              <div className="space-y-3">
                {workBlocks.map((b) => (
                  <WorkBlockDetail
                    key={b.id}
                    block={b}
                    rate={shift.customer?.bill_rate_hourly}
                    showMoney={showMoney}
                    canEdit={canEdit}
                    propertyId={shift.customer_id}
                    employee={viewerEmployee}
                    onEdit={() => setEditingBlock(b)}
                    onDelete={() => setDeletingBlock(b)}
                    onMove={() => setMovingBlock(b)}
                    onOpenBedroomHistory={setBedroomHistory}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
              Task log
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No tasks logged.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => (
                  <TaskDetail key={t.id} task={t} employee={viewerEmployee} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Owner/manager-only edit & delete actions for the whole shift */}
        {canEdit && (
          <div className="mt-8 pt-6 border-t border-stone-200 space-y-2">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
              Shift actions
            </div>
            <button
              onClick={() => setEditingShift(true)}
              className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}
            >
              <Edit2 size={14} /> Edit clock-in / clock-out times
            </button>
            <button
              onClick={() => setEditingAdjustment(true)}
              className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}
            >
              <Clock size={14} /> Adjust billable time
            </button>
            <button
              onClick={() => setDeletingShift(true)}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}
            >
              <Trash2 size={14} /> Delete shift
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingShift && shift && (
        <TimeEditModal
          title="Edit shift times"
          subtitle={`${shift.employee?.name} · ${shift.customer?.name || "No property"}`}
          startTime={shift.start_time}
          endTime={shift.end_time}
          busy={busy}
          onSave={saveShiftTimes}
          onClose={() => setEditingShift(false)}
        />
      )}
      {deletingShift && shift && (
        <DeleteConfirmModal
          title="Delete this shift?"
          description="This will permanently delete the entire shift, including all work blocks, tasks, and photos. This cannot be undone."
          itemSummary={`${shift.employee?.name} · ${fmtDate(shift.start_time)} · ${shift.customer?.name || "No property"}`}
          busy={busy}
          onConfirm={deleteShift}
          onClose={() => setDeletingShift(false)}
        />
      )}
      {editingBlock && (
        <TimeEditModal
          title="Edit work block times"
          subtitle={`${editingBlock.unit?.label || ""} · ${editingBlock.party?.label || ""}`}
          startTime={editingBlock.start_time}
          endTime={editingBlock.end_time}
          busy={busy}
          onSave={(s, e) => saveBlockTimes(editingBlock, s, e)}
          onClose={() => setEditingBlock(null)}
        />
      )}
      {deletingBlock && (
        <DeleteConfirmModal
          title="Delete this work block?"
          description="This removes the work block and all its tasks and photos, but keeps the rest of the shift intact."
          itemSummary={`${deletingBlock.unit?.label || ""} · ${deletingBlock.party?.label || ""}`}
          busy={busy}
          onConfirm={() => deleteBlock(deletingBlock)}
          onClose={() => setDeletingBlock(null)}
        />
      )}
      {movingBlock && (
        <MoveBlockModal
          block={movingBlock}
          propertyId={shift?.customer_id}
          onSaved={() => {
            setMovingBlock(null);
            reload();
          }}
          onClose={() => setMovingBlock(null)}
        />
      )}
      {editingAdjustment && shift && (
        <AdjustmentModal
          shift={shift}
          busy={busy}
          onSave={saveAdjustment}
          onClose={() => setEditingAdjustment(false)}
        />
      )}
    </div>
  );
}
