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
} from "../../lib/supabase.js";
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
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
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
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";

export function ReviewAssignmentModal({ assignment, employee, onDone, onClose }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editedType, setEditedType] = useState(
    assignment.assignment_type || "standard",
  );
  const [editedDate, setEditedDate] = useState(assignment.scheduled_date || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const approve = async () => {
    setBusy(true);
    setError("");
    const { error: e } = await supabase
      .from("assignments")
      .update({
        pm_status: "approved",
        approved_by: employee.id,
        approved_at: new Date().toISOString(),
        pm_rejection_reason: null,
        // Apply any edits owner/manager made during review
        assignment_type: editedType,
        scheduled_date: editedDate || null,
      })
      .eq("id", assignment.id);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await clearPmAssignmentNotification(assignment.id);
    onDone();
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      setError("Please tell the PM what to change.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: e } = await supabase
      .from("assignments")
      .update({
        pm_status: "rejected",
        pm_rejection_reason: rejectReason.trim(),
      })
      .eq("id", assignment.id);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await clearPmAssignmentNotification(assignment.id);
    onDone();
  };

  // Already clean — no cleaning needed. Approve it (so it's a real
  // assignment, not stuck in PM limbo) AND mark every bedroom done in one
  // go, stamped now. It lands in the Done view like any finished job,
  // never reaching a cleaner.
  const markDone = async () => {
    if (
      !confirm(
        "Mark this as already cleaned? It will go straight to Done — no cleaner needed.",
      )
    )
      return;
    setBusy(true);
    setError("");
    const nowIso = new Date().toISOString();
    const { error: aErr } = await supabase
      .from("assignments")
      .update({
        pm_status: "approved",
        approved_by: employee.id,
        approved_at: nowIso,
        pm_rejection_reason: null,
        assignment_type: editedType,
        scheduled_date: editedDate || null,
      })
      .eq("id", assignment.id);
    if (aErr) {
      setBusy(false);
      setError(aErr.message);
      return;
    }
    const { error: tErr } = await supabase
      .from("assignment_targets")
      .update({
        status: "done",
        completed_at: nowIso,
        completed_by: employee.id,
      })
      .eq("assignment_id", assignment.id)
      .neq("status", "done");
    setBusy(false);
    if (tErr) {
      setError(tErr.message);
      return;
    }
    await clearPmAssignmentNotification(assignment.id);
    onDone();
  };

  // Not needed at all — get rid of it. Soft-delete, so it's recoverable.
  const discard = async () => {
    if (
      !confirm(
        "Discard this submission? It won\u2019t be cleaned or billed. This can be undone later.",
      )
    )
      return;
    setBusy(true);
    setError("");
    const { error: e } = await supabase
      .from("assignments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: employee.id,
      })
      .eq("id", assignment.id);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await clearPmAssignmentNotification(assignment.id);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Review submission
            </div>
            <div className="font-serif text-xl text-stone-900 truncate">
              {assignment.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!rejectMode && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
                Adjust before approving
              </div>
              <div>
                <label className="text-xs text-stone-700 font-mono mb-1 block">
                  Type
                </label>
                <select
                  value={editedType}
                  onChange={(e) => setEditedType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                >
                  {ASSIGNMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-700 font-mono mb-1 block">
                  Scheduled for
                </label>
                <input
                  type="date"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                />
                {editedDate !== (assignment.scheduled_date || "") && (
                  <div className="text-[11px] text-amber-700 mt-1">
                    PM requested:{" "}
                    {assignment.scheduled_date
                      ? fmtDateWithDay(assignment.scheduled_date)
                      : "no date"}
                  </div>
                )}
              </div>
            </div>
          )}
          {assignment.notes && (
            <div className="p-3 rounded-xl bg-stone-100 text-sm text-stone-800 whitespace-pre-wrap">
              {assignment.notes}
            </div>
          )}
          {assignment.file_url && (
            <div>
              {assignment.file_kind === "image" ? (
                <img
                  loading="lazy"
                  src={assignment.file_url}
                  alt=""
                  className="w-full max-h-[60vh] object-contain rounded-xl bg-stone-100"
                />
              ) : (
                <a
                  href={assignment.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 rounded-xl bg-white border border-stone-200 hover:border-stone-400"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-stone-600" />
                    <span className="text-sm text-stone-800 flex-1">
                      Open PDF
                    </span>
                    <Eye size={14} className="text-stone-500" />
                  </div>
                </a>
              )}
            </div>
          )}

          {rejectMode && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Tell the PM what needs to change
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="e.g. Wrong apartment — should be B3-205 instead of B3-105"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white resize-none"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 space-y-2">
          {rejectMode ? (
            <>
              <button
                onClick={reject}
                disabled={busy}
                className="w-full py-3 rounded-2xl bg-red-600 text-white font-medium disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send back to PM with note"}
              </button>
              <button
                onClick={() => {
                  setRejectMode(false);
                  setError("");
                }}
                disabled={busy}
                className="w-full py-2 rounded-2xl text-stone-600 text-sm font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={approve}
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={16} />{" "}
                {busy ? "Approving…" : "Approve & make visible to cleaners"}
              </button>
              {/* Already clean → straight to Done, skips cleaners entirely. */}
              <button
                onClick={markDone}
                disabled={busy}
                className="w-full py-3 rounded-2xl bg-stone-900 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={14} /> Already clean — mark done
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectMode(true)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium"
                >
                  Send back for changes
                </button>
                <button
                  onClick={discard}
                  disabled={busy}
                  title="Discard — not needed at all"
                  className="px-4 py-3 rounded-2xl border-2 border-stone-200 text-stone-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
