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
import { can, canSeeMoney, isLead, isOwner, visibleProps } from "../../../lib/permissions.js";
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
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../../lib/labels.js";
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
import { ChecklistAssignmentView } from "./ChecklistAssignmentView.jsx";
import { SpanishTranslationPanel } from "./SpanishTranslationPanel.jsx";

export function AssignmentViewer({ target, onClose, employee }) {
  const a = target.assignment;
  // For "other language" translation: prefer extracted_text (the full OCR output)
  // if available, otherwise fall back to title + notes.
  const translateTexts =
    a.extracted_text && a.extracted_text.trim()
      ? [a.title, a.notes, a.extracted_text].filter(Boolean)
      : [a.title, a.notes].filter(Boolean);

  // Bedroom-scoped target panel. We re-query targets at THIS bedroom
  // (unit + party that the row was opened from) so the audit Quick
  // glance shows the same status + notes + actions the cleaner-side
  // ChecklistAssignmentView Quick glance offers. Previously this
  // viewer only showed the file — blocked items with reasons were
  // invisible unless the owner clicked all the way in.
  const [bedroomTargets, setBedroomTargets] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const loadTargets = async () => {
    // Resolve bedroom keys — different callers populate the scalar
    // FK columns vs the nested objects. The audit view's SELECT,
    // for example, only joins unit:units(id, label) without picking
    // unit_id as a scalar, so without this fallback the query
    // .eq('unit_id', undefined) returns nothing and the panel never
    // renders. This was the root cause of "the blocked indicator
    // still doesn't show in Quick glance from the audit".
    const unitId = target.unit_id || target.unit?.id || null;
    const partyId = target.party_id || target.party?.id || null;
    if (!unitId || !partyId || !a?.id) return;
    const { data } = await supabase
      .from("assignment_targets")
      .select("*")
      .eq("assignment_id", a.id)
      .eq("unit_id", unitId)
      .eq("party_id", partyId);
    setBedroomTargets(data || []);
  };
  useEffect(() => {
    loadTargets();
  }, [target.id]);

  // Permission gates — match how AssignmentCard decides who can do what.
  // Owner / manager can always act. Cleaners need explicit permission
  // (mark_assignments_done) to mark done. Anyone with an employee
  // identity can Reopen since it just sends an item back to pending.
  const isStaff = isLead(employee);
  const canMarkDone = isStaff || can(employee, "mark_assignments_done");
  const canReopen = !!employee?.id;

  const setStatus = async (t, newStatus) => {
    if (busyId) return;
    setBusyId(t.id);
    const patch = { status: newStatus };
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (t.status === "done") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (newStatus === "pending") {
      // Clear blocked notes when reopening so the next cleaner sees
      // a fresh slate; the audit trail still has the photos / block
      // history if anyone needs to know why it was blocked before.
      patch.status_notes = null;
      patch.started_at = null;
      patch.started_by = null;
    }
    setBedroomTargets((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", t.id);
    setBusyId(null);
    if (error) {
      alert("Could not update: " + error.message);
      loadTargets(); // re-fetch authoritative
    }
  };

  const labelForT = (t) => {
    if (
      t.status_notes &&
      (t.template_item_key?.startsWith?.("requested:") ||
        t.template_item_key?.startsWith?.("custom_"))
    )
      return t.status_notes;
    const k = t.template_item_key || "";
    return (
      k
        .replace(/^[a-z_]+:/, "")
        .replace(/_/g, " ")
        .replace(/^./, (c) => c.toUpperCase()) || "Item"
    );
  };

  // Visual color for the status dot
  const dotFor = (t) => {
    if (t.recheck_passed_at)
      return { color: "bg-purple-500", label: "recheck-passed" };
    if (t.status === "done") return { color: "bg-emerald-500", label: "done" };
    if (t.status === "in_progress")
      return { color: "bg-amber-500", label: "in progress" };
    if (t.status === "paused")
      return { color: "bg-amber-300", label: "paused" };
    if (t.status === "blocked")
      return { color: "bg-red-500", label: "blocked" };
    return { color: "bg-stone-300", label: "pending" };
  };

  // Modal-with-backdrop layout (was full-screen). Cleaner can tap the
  // dark area around the card to close, same as tapping the X.
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-stone-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-4 text-stone-50 bg-stone-900 sm:rounded-t-3xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg truncate">{a.title}</div>
              {/* Bedroom context — so the owner knows which bedroom's
                 items the panel below refers to. */}
              {(target.unit?.label || target.party?.label) && (
                <div className="text-xs text-stone-300 mt-0.5 font-mono">
                  {target.unit?.label}
                  {target.party?.label && ` · ${target.party.label}`}
                </div>
              )}
              {a.notes && (
                <div className="text-xs text-stone-400 mt-0.5 whitespace-pre-wrap break-words">
                  {a.notes}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-stone-800 flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <SpanishTranslationPanel assignment={a} />
          <TranslateButton texts={translateTexts} />
        </div>
        {/* Item / target panel — surfaces blocked items + reasons +
           Reopen / Mark done actions. Sits above the file so the
           owner sees the actionable info before having to scroll
           through a PDF. Only shown when we have bedroom context. */}
        {bedroomTargets.length > 0 && (
          <div className="p-3 bg-white border-b border-stone-200">
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-2">
              Items at this bedroom ({bedroomTargets.length})
            </div>
            <div className="space-y-1.5">
              {bedroomTargets.map((t) => {
                const d = dotFor(t);
                const isBlocked = t.status === "blocked";
                const isDone = t.status === "done";
                return (
                  <div
                    key={t.id}
                    className={`text-sm rounded-lg ${isBlocked ? "bg-red-50 border border-red-200 p-2" : "p-1"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${d.color} flex-shrink-0`}
                        title={d.label}
                      />
                      <span
                        className={`flex-1 min-w-0 ${isDone ? "text-stone-500 line-through" : "text-stone-900"}`}
                      >
                        {labelForT(t)}
                      </span>
                      {isBlocked && (
                        <span className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 flex-shrink-0">
                          Blocked
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">
                          Done
                        </span>
                      )}
                    </div>
                    {/* Blocked reason — the part the user specifically
                       called out as invisible from the audit. */}
                    {isBlocked && t.status_notes && (
                      <div className="text-xs text-red-700 italic mt-1 pl-4">
                        "{t.status_notes}"
                      </div>
                    )}
                    {/* Action row. Reopen shows for done/blocked/paused
                       to any signed-in user. Mark done shows for
                       anything that isn't already done, gated on
                       canMarkDone (owners + managers + cleaners with
                       explicit permission). */}
                    {(canReopen || canMarkDone) && (
                      <div className="flex items-center gap-1.5 mt-1.5 pl-4">
                        {canReopen &&
                          (isBlocked || isDone || t.status === "paused") && (
                            <button
                              onClick={() => setStatus(t, "pending")}
                              disabled={busyId === t.id}
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              <Play size={10} /> Reopen
                            </button>
                          )}
                        {canMarkDone && !isDone && (
                          <button
                            onClick={() => setStatus(t, "done")}
                            disabled={busyId === t.id}
                            className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check size={10} /> Mark done
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto bg-stone-100">
          {a.file_url ? (
            a.file_kind === "image" ? (
              <ZoomableImage src={a.file_url} alt={a.title} />
            ) : (
              <iframe
                src={a.file_url}
                className="w-full h-full min-h-[60vh]"
                title={a.title}
              />
            )
          ) : (
            <div className="p-8 text-center text-stone-400 text-sm">
              No file attached to this assignment.
            </div>
          )}
        </div>
        {a.file_url && (
          <div className="p-4 bg-stone-900">
            <a
              href={a.file_url}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-stone-50 text-stone-900 text-sm font-medium"
            >
              <Download size={14} /> Open / download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
