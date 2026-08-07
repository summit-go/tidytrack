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
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
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

export function AssignmentCard({
  target,
  busy,
  onView,
  onStart,
  onPause,
  onMoveToPending,
  onDone,
  onReopen,
  onBlocked,
  onReassign,
  onDelete,
  onGoToBedroom,
  onOpenBedroomHistory,
  onTogglePriority,
  canPrioritize = false,
  canMarkDone = true,
  canMarkDoneAlways = false,
  currentEmployeeId,
  propertyId,
  canEditDates = false,
  onSetDueDate,
  dark = false,
  workScreen = false,
  onStartCleaning = null,
  onExit = null,
  ownerView = false,
}) {
  const t = target;
  // Dark variant — used when this card is folded into the cleaner's black
  // "Working on" header. Only the neutral surfaces flip; colored status /
  // priority pills and the action buttons already read fine on dark.
  const D = {
    card: dark ? "bg-slate-900 border-slate-600" : "bg-white border-stone-200",
    cardDone: dark
      ? "bg-slate-900/70 border-slate-700 opacity-90"
      : "bg-stone-50 border-stone-200 opacity-90",
    title: dark ? "text-white" : "text-stone-900",
    sep: dark ? "text-stone-500" : "text-stone-400",
    muted: dark ? "text-stone-300" : "text-stone-500",
    chip: dark
      ? "bg-stone-200 hover:bg-stone-300 text-stone-900"
      : "bg-stone-100 hover:bg-stone-200 text-stone-700",
    outlineBtn: dark
      ? "border-slate-500 hover:bg-slate-700 text-stone-100"
      : "border-stone-300 hover:bg-stone-50 text-stone-600",
  };
  const s = ASSIGNMENT_STATUSES[t.status] || ASSIGNMENT_STATUSES.pending;
  const isDone = t.status === "done";
  const [editingDate, setEditingDate] = useState(false);
  const [localDate, setLocalDate] = useState(
    t.assignment?.scheduled_date || "",
  );
  useEffect(() => {
    setLocalDate(t.assignment?.scheduled_date || "");
  }, [t.assignment?.scheduled_date]);
  const commitDate = async (val) => {
    setLocalDate(val);
    setEditingDate(false);
    if (onSetDueDate)
      await onSetDueDate(t.assignment_id || t.assignment?.id, val || null);
  };
  // Title is always tappable as long as we have a bedroom to navigate
  // to — even Done assignments. Tapping a Done one is useful for
  // peeking at history or re-checking the bedroom.
  const canGo = onGoToBedroom && t.unit_id && t.party_id;
  const [activeCleaners, setActiveCleaners] = useState([]);

  // Pull who's currently working at this target's unit+party (active work blocks today)
  useEffect(() => {
    if (!t.unit_id || !t.party_id || isDone) {
      setActiveCleaners([]);
      return;
    }
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("work_blocks")
        .select(
          "id, end_time, shift:shifts!inner(employee:employees(id, name), customer_id)",
        )
        .eq("unit_id", t.unit_id)
        .eq("party_id", t.party_id)
        .eq("is_preview", false)
        .gte("start_time", todayStart.toISOString())
        .is("end_time", null);
      const cleaners = (data || [])
        .filter((b) => b.shift?.customer_id === propertyId)
        .map((b) => b.shift?.employee?.name)
        .filter(Boolean);
      // dedupe
      setActiveCleaners([...new Set(cleaners)]);
    })();
  }, [t.unit_id, t.party_id, isDone, propertyId, t.status]);

  return (
    <div
      className={`${dark ? "p-2.5 sm:p-3 rounded-xl border" : "p-4 rounded-2xl border shadow-sm"} ${isDone ? D.cardDone : D.card}`}
    >
      {/* === HEADER ROW =================================================
         On mobile the title takes a full-width row of its own and the
         chip group (priority / status / view doc / history) drops to
         the line below — that's the only way to guarantee long
         apartment labels never get cut off on a phone. From `sm:`
         and up there's enough horizontal room to put the title on
         the left and chips on the right. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-2">
        <div className="flex-shrink min-w-0 mr-1">
          {t.unit?.label || t.party?.label ? (
            canGo ? (
              // Bedroom title is the primary navigation target on the
              // card — tapping the bold "B4-115 · Bedroom 2" header
              // jumps the cleaner straight into that bedroom (same
              // path as the Start / Go to this bedroom buttons).
              // Underline-on-hover hint so it reads as tappable.
              <button
                onClick={onGoToBedroom}
                disabled={busy}
                className={`block text-left w-full font-serif text-lg ${D.title} leading-tight break-words hover:underline disabled:opacity-50`}
              >
                <span className="font-bold">{t.unit?.label || "No unit"}</span>
                {partyDisplay(t.party?.label) && (
                  <>
                    <span className={`${D.sep} mx-1.5`}>·</span>
                    <span className="italic">
                      {partyDisplay(t.party?.label)}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <div
                className={`font-serif text-lg ${D.title} leading-tight break-words`}
              >
                <span className="font-bold">{t.unit?.label || "No unit"}</span>
                {partyDisplay(t.party?.label) && (
                  <>
                    <span className={`${D.sep} mx-1.5`}>·</span>
                    <span className="italic">
                      {partyDisplay(t.party?.label)}
                    </span>
                  </>
                )}
              </div>
            )
          ) : (
            <div className={`font-serif text-lg ${D.title} font-bold`}>
              Whole property
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {/* Mini-row 1: Priority + Status — right-aligned. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Priority toggle (gray ↔ red) when parent passes it; else
               read-only chip. */}
            {!isDone && onTogglePriority && canPrioritize ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePriority(t);
                }}
                disabled={busy}
                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                  t.priority
                    ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                    : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                }`}
              >
                <AlertCircle size={10} />{" "}
                {t.priority ? "Priority" : "Mark priority"}
              </button>
            ) : (
              <PriorityChip on={t.priority && !isDone} />
            )}
            {/* Status pill — read-only, just a visual cue. */}
            <span
              className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${s.color}`}
            >
              {s.label}
            </span>
            {/* Due-date signal — tappable to reschedule when permitted. */}
            {!isDone &&
              (() => {
                const kind = assignmentDueKind(localDate);
                const cls =
                  kind === "overdue"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : kind === "today"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-stone-100 text-stone-600 border-stone-200";
                const label = !localDate
                  ? "Set date"
                  : kind === "overdue"
                    ? `Overdue · ${fmtDueDate(localDate)}`
                    : kind === "today"
                      ? "Today"
                      : fmtDueDate(localDate);
                if (editingDate && canEditDates) {
                  return (
                    <DueDateEditor
                      compact
                      value={localDate}
                      onSave={(d) => {
                        commitDate(d);
                        setEditingDate(false);
                      }}
                      onCancel={() => setEditingDate(false)}
                    />
                  );
                }
                if (canEditDates) {
                  return (
                    <button
                      onClick={() => setEditingDate(true)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${localDate ? cls : "bg-white text-stone-500 border-dashed border-stone-300"}`}
                    >
                      <Calendar size={9} /> {label}
                    </button>
                  );
                }
                if (!localDate) return null;
                return (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${cls}`}
                  >
                    <Calendar size={9} /> {label}
                  </span>
                );
              })()}
          </div>
          {/* Mini-row 2: View doc + History — right-aligned. Stays a
             separate mini-row so the chip pairs never split awkwardly:
             priority sits next to status, view doc next to history. */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={onView}
              className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${D.chip} flex items-center gap-1`}
            >
              <Eye size={10} /> Quick glance
            </button>
            {onOpenBedroomHistory && t.unit_id && t.party_id && (
              <button
                onClick={() =>
                  onOpenBedroomHistory({
                    unitId: t.unit_id,
                    unitLabel: t.unit?.label,
                    partyId: t.party_id,
                    partyLabel: t.party?.label,
                  })
                }
                disabled={busy}
                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${D.chip} flex items-center gap-1 disabled:opacity-50`}
              >
                <Clock size={10} /> History
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === TITLE + TYPE ===============================================
         Assignment title (move-out check / standard / etc), cleaning
         type chip, assignee. Tappable when canGo so cleaner can jump
         from the title alone. */}
      <div className="mb-2">
        {canGo ? (
          <button
            onClick={onGoToBedroom}
            disabled={busy}
            className={`text-left w-full font-serif text-sm ${dark ? "text-stone-200" : "text-stone-700"} hover:underline disabled:opacity-50`}
          >
            {t.assignment?.title}
          </button>
        ) : (
          <div
            className={`font-serif text-sm ${dark ? "text-stone-200" : "text-stone-700"}`}
          >
            {t.assignment?.title}
          </div>
        )}
        {(t.assignment?.assignment_type || (t.assignedTo?.name && !isDone)) && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <AssignmentTypeChip type={t.assignment?.assignment_type} />
            {t.assignedTo?.name && !isDone && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
                <User size={10} /> {t.assignedTo.name}
              </span>
            )}
          </div>
        )}
        {t.assignment?.notes && (
          <div className="text-xs text-stone-600 mt-1 line-clamp-2">
            {t.assignment.notes}
          </div>
        )}
        {t.status === "in_progress" && t.starter?.name && (
          <div className="text-xs text-amber-700 font-mono mt-1">
            Started by {t.starter.name}
            {t.started_at && ` · ${fmtClock(t.started_at)}`}
          </div>
        )}
        {t.status === "paused" && t.starter?.name && (
          <div className="text-xs text-blue-700 font-mono mt-1 flex items-center gap-1">
            <Pause size={10} />
            Paused by {t.starter.name}
          </div>
        )}
        {activeCleaners.length > 0 && (
          <div className="text-xs text-emerald-700 font-mono mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {activeCleaners.length === 1
              ? `${activeCleaners[0]} is here`
              : `${activeCleaners.length} cleaners here: ${activeCleaners.join(", ")}`}
          </div>
        )}
        {isDone && t.completed_at && (
          <div className="text-xs text-emerald-700 font-mono mt-1">
            {t.completer?.name ? `Done by ${t.completer.name} · ` : "Done "}
            {fmtDateWithDay(t.completed_at)} {fmtClock(t.completed_at)}
          </div>
        )}
        {t.status_notes && (
          <div className="text-xs text-red-700 italic mt-1">
            "{t.status_notes}"
          </div>
        )}
      </div>

      {/* === ACTION BUTTON ROW =========================================
         All buttons share h-9 / px-3 / text-xs / inline-flex so they
         line up symmetrically regardless of which subset is showing.
         Order: Start → Pause → Move to pending → Done → Reopen →
         Blocked → Reassign. Reassign no longer has ml-auto so the
         row stays uniform. */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Start cleaning — small, sits with the other card actions (prep
           screen only; passed as onStartCleaning). */}
        {onStartCleaning && !isDone && (
          <button
            onClick={onStartCleaning}
            disabled={busy}
            className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
          >
            <Play size={13} /> Start cleaning
          </button>
        )}
        {/* "Go to bedroom" replaces the old "Start" — Start just flipped a
           status without taking you anywhere, which was confusing. This opens
           the bedroom (where the real "Start cleaning" lives). Only shows off
           the working screen (canGo is false once you're in the bedroom). */}
        {canGo && (
          <button
            onClick={onGoToBedroom}
            disabled={busy}
            className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
          >
            Go to bedroom <ChevronRight size={13} />
          </button>
        )}
        {onPause && t.status === "in_progress" && (
          <button
            onClick={onPause}
            disabled={busy}
            className="h-9 px-3 rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <Pause size={12} /> Pause
          </button>
        )}
        {onMoveToPending && t.status === "paused" && (
          <button
            onClick={onMoveToPending}
            disabled={busy}
            className={`h-9 px-3 rounded-lg border ${D.outlineBtn} text-xs font-medium flex items-center gap-1 disabled:opacity-50`}
          >
            <ArrowLeft size={12} /> Move to pending
          </button>
        )}
        {/* "Mark complete" full button removed — the corner ✓ (permission-
           gated, with a confirm) is the single mark-complete action now. */}
        {(isDone || t.status === "blocked") && (
          <button
            onClick={onReopen}
            disabled={busy}
            className={`h-9 px-3 rounded-lg border ${D.outlineBtn} text-xs font-medium flex items-center gap-1 disabled:opacity-50`}
          >
            <Play size={12} /> Reopen
          </button>
        )}
        {ownerView &&
          (t.status === "pending" ||
            t.status === "in_progress" ||
            t.status === "paused") &&
          (() => {
            // Block is owner-only now. Owners can block without starting, so
            // it's never disabled for them here.
            return (
              <OwnerOnly employee={{ role: "owner" }}>
                <button
                  onClick={onBlocked}
                  disabled={busy}
                  title="Owners only"
                  className="h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1 border border-red-200 hover:bg-red-50 text-red-700 disabled:opacity-50"
                >
                  <AlertCircle size={12} /> Block
                </button>
              </OwnerOnly>
            );
          })()}
        {onReassign && (t.unit_id || t.party_id) && (
          <button
            onClick={onReassign}
            disabled={busy}
            className={`h-9 px-3 rounded-lg border ${D.outlineBtn} text-xs font-medium flex items-center gap-1 disabled:opacity-50`}
          >
            <Edit2 size={12} /> Reassign
          </button>
        )}
        {/* Delete an assignment uploaded by mistake (owner/uploader only) —
           pushed to the right end to mirror the checklist card. */}
        {/* Owner/manager corner actions on the working screen:
           ✓ = mark this assignment complete → Done. ✕ = delete a mistaken upload. */}
        {((canMarkDoneAlways && !isDone) || onDelete) && (
          <div className="ml-auto flex items-center gap-1.5">
            {canMarkDoneAlways && !isDone && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Mark this whole assignment complete? It closes out this assignment and moves it to Done.",
                    )
                  ) {
                    onDone();
                    if (onExit) onExit();
                  }
                }}
                disabled={busy}
                title="Mark this assignment complete → Done"
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <Check size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (onDelete) {
                    onDelete();
                    if (onExit) onExit();
                  }
                }}
                disabled={busy}
                title="Delete this assignment (uploaded by mistake)"
                className={`w-9 h-9 rounded-lg flex items-center justify-center border disabled:opacity-50 ${dark ? "bg-slate-800 hover:bg-red-950 border-slate-600 text-red-300" : "bg-white hover:bg-red-50 border-stone-300 text-red-600"}`}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* The big full-width "Go to this bedroom" button was removed — it's now
         a compact "Go to bedroom" button in the action row above, per the
         card-consolidation. */}
    </div>
  );
}
