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
} from "../../../../lib/supabase.js";
import {
  ASSIGNMENT_TYPES,
  assignmentTypeLabel,
  assignmentTypeMeta,
  BUILD_TAG,
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";
import { DeleteConfirmModal } from "../dashboard/DeleteConfirmModal.jsx";
import { TaskDetail } from "../dashboard/TaskDetail.jsx";
import { TimeEditModal } from "../dashboard/TimeEditModal.jsx";
import { WorkBlockAssignmentLink } from "../../../cross-cutting/WorkBlockAssignmentLink.jsx";

export function DailyUnitDayDetail({
  date,
  propertyId,
  unitId,
  unitLabel,
  propertyName,
  employee,
  showMoney,
  onBack,
  onOpenBedroomHistory,
}) {
  const canEdit = employee?.role === "owner" || employee?.role === "manager";
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [deletingBlock, setDeletingBlock] = useState(null);
  const [deletingShift, setDeletingShift] = useState(null); // shift obj
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoaded(false);
    const [dyY, dyM, dyD] = String(date).split("-").map(Number);
    const dayStart = new Date(dyY, dyM - 1, dyD, 0, 0, 0, 0).toISOString();
    const dayEnd = new Date(dyY, dyM - 1, dyD, 23, 59, 59, 999).toISOString();
    const { data } = await supabase
      .from("work_blocks")
      .select(
        "*, party:parties(label, full_name), shift:shifts!inner(id, customer_id, start_time, end_time, employee:employees(id,name), bill_rate_at_work, customer:customers(bill_rate_hourly, name)), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .eq("unit_id", unitId)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time");
    const filtered = (data || []).filter(
      (b) => b.shift?.customer_id === propertyId,
    );
    setBlocks(filtered);
    setLoaded(true);
  };

  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [date, unitId, propertyId]);

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

  const deleteShift = async (shift) => {
    setBusy(true);
    const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
    setBusy(false);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setDeletingShift(null);
    reload();
  };

  if (!loaded) return <Splash text="Loading…" />;

  // Aggregate stats
  const employeeTimes = {}; // name -> totalMs
  let totalMs = 0;
  let totalBillable = 0;
  const allTasks = [];
  blocks.forEach((b) => {
    const dur =
      (b.end_time ? new Date(b.end_time) : new Date()) - new Date(b.start_time);
    totalMs += dur;
    const empName = b.shift?.employee?.name || "?";
    employeeTimes[empName] = (employeeTimes[empName] || 0) + dur;
    if (showMoney && b.end_time) {
      const rate =
        b.bill_rate_at_work || b.shift?.customer?.bill_rate_hourly || 0;
      totalBillable += (dur / 1000 / 3600) * rate;
    }
    (b.tasks || []).forEach((t) =>
      allTasks.push({ ...t, employee: empName, party: b.party }),
    );
  });

  // Group tasks by party for display
  const partyGroups = {};
  blocks.forEach((b) => {
    const partyKey = b.party?.id || "no-party";
    if (!partyGroups[partyKey]) {
      partyGroups[partyKey] = { party: b.party, blocks: [] };
    }
    partyGroups[partyKey].blocks.push(b);
  });

  const dateObj = new Date(date + "T12:00:00");

  return (
    <div className="pb-24">
      <ScreenId id="OW-UNIT-DAY" />
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print bg-stone-900 text-stone-50 px-5 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 text-sm hover:text-stone-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-stone-50 text-stone-900 text-sm font-medium flex items-center gap-2"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h1 className="font-serif text-3xl text-stone-900 mb-1">{unitLabel}</h1>
        <div className="text-sm text-stone-600 flex items-center gap-1.5">
          <Building2 size={13} /> {propertyName}
        </div>

        {/* Stats summary */}
        <div
          className={`grid ${showMoney ? "grid-cols-3" : "grid-cols-2"} gap-3 mt-6 mb-6`}
        >
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
              Total time
            </div>
            <div className="text-2xl font-serif">{fmtTimeShort(totalMs)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
              Cleaners
            </div>
            <div className="text-2xl font-serif">
              {Object.keys(employeeTimes).length}
            </div>
          </div>
          {showMoney && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">
                Billable
              </div>
              <div className="text-2xl font-serif text-amber-900">
                {fmtMoney(totalBillable)}
              </div>
            </div>
          )}
        </div>

        {/* Per-employee summary */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Time by cleaner
          </div>
          <div className="space-y-2">
            {Object.entries(employeeTimes)
              .sort((a, b) => b[1] - a[1])
              .map(([name, ms]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-stone-400" />
                    <span className="text-stone-900">{name}</span>
                  </div>
                  <span className="font-mono text-sm text-stone-700">
                    {fmtTimeShort(ms)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Per-party detail */}
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
          Cleaning details
        </div>
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No work blocks recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(partyGroups).map((pg, i) => {
              // Use the first block in this party group to anchor the date-aware assignment query
              const sampleBlock = pg.blocks[0];
              return (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white border border-stone-200"
                >
                  {pg.party && (
                    <div className="mb-3">
                      <div className="font-serif text-lg text-stone-900 flex items-center gap-2 flex-wrap">
                        {pg.party.label}
                        {pg.party.full_name && (
                          <span className="text-sm text-stone-500">
                            {pg.party.full_name}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <WorkBlockAssignmentLink
                          block={sampleBlock}
                          propertyId={propertyId}
                          employee={employee}
                          compact
                        />
                        <button
                          onClick={() =>
                            onOpenBedroomHistory &&
                            onOpenBedroomHistory({
                              propertyId,
                              propertyName,
                              unitId,
                              unitLabel,
                              partyId: pg.party.id,
                              partyLabel: pg.party.label,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-mono active:scale-95"
                        >
                          <Clock size={10} /> View bedroom history
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {pg.blocks.map((b) => {
                      const dur =
                        (b.end_time ? new Date(b.end_time) : new Date()) -
                        new Date(b.start_time);
                      const billable =
                        showMoney && b.end_time
                          ? (dur / 1000 / 3600) *
                            (b.bill_rate_at_work ||
                              b.shift?.customer?.bill_rate_hourly ||
                              0)
                          : 0;
                      return (
                        <div
                          key={b.id}
                          className="pb-3 border-b border-stone-100 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-stone-400" />
                              <span className="font-medium text-stone-900 text-sm">
                                {b.shift?.employee?.name}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-stone-500">
                              {fmtClock(b.start_time)}
                              {b.end_time &&
                                ` — ${fmtClock(b.end_time)}`} ·{" "}
                              {fmtTimeShort(dur)}
                              {showMoney && billable > 0 && (
                                <span className="text-emerald-700 ml-2">
                                  {fmtMoney(billable)}
                                </span>
                              )}
                            </div>
                          </div>
                          {b.work_notes && (
                            <div className="text-xs text-stone-600 italic mb-2 pl-5">
                              "
                              <TranslatableText
                                text={b.work_notes}
                                targetLang="en"
                              />
                              "
                            </div>
                          )}
                          {b.tasks?.length > 0 && (
                            <div className="pl-5 space-y-2">
                              {b.tasks.map((t) => (
                                <TaskDetail
                                  key={t.id}
                                  task={t}
                                  compact
                                  employee={employee}
                                />
                              ))}
                            </div>
                          )}
                          {/* Per-block edit/delete actions */}
                          {canEdit && (
                            <div className="mt-3 pl-5 flex gap-2 no-print">
                              <button
                                onClick={() => setEditingBlock(b)}
                                className="px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium flex items-center gap-1.5"
                              >
                                <Edit2 size={11} /> Edit times
                              </button>
                              <button
                                onClick={() => setDeletingBlock(b)}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50"
                              >
                                <Trash2 size={11} /> Delete block
                              </button>
                              <button
                                onClick={() => setDeletingShift(b.shift)}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50 ml-auto"
                              >
                                <Trash2 size={11} /> Delete this shift
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals (reused from ShiftDetail) */}
      {editingBlock && (
        <TimeEditModal
          title="Edit work block times"
          subtitle={`${unitLabel} · ${editingBlock.party?.label || ""}`}
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
          itemSummary={`${unitLabel} · ${deletingBlock.party?.label || ""} · ${deletingBlock.shift?.employee?.name || ""}`}
          busy={busy}
          onConfirm={() => deleteBlock(deletingBlock)}
          onClose={() => setDeletingBlock(null)}
        />
      )}
      {deletingShift && (
        <DeleteConfirmModal
          title="Delete this entire shift?"
          description="This permanently deletes the whole shift for this cleaner, including ALL work blocks (other apartments too, not just this one), tasks, and photos. This cannot be undone."
          itemSummary={`${deletingShift.employee?.name} · ${fmtDate(deletingShift.start_time)} · ${deletingShift.customer?.name || ""}`}
          busy={busy}
          onConfirm={() => deleteShift(deletingShift)}
          onClose={() => setDeletingShift(null)}
        />
      )}
    </div>
  );
}
