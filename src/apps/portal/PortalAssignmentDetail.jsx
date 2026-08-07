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
import { RecheckRequestModal } from "./RecheckRequestModal.jsx";
import { SpanishTranslationPanel } from "../cross-cutting/SpanishTranslationPanel.jsx";

export function PortalAssignmentDetail({
  property,
  assignment,
  portalUser,
  onBack,
  onEdit,
}) {
  const [busy, setBusy] = useState(false);
  const canEdit =
    assignment.pm_status === "draft" || assignment.pm_status === "rejected";
  const canDelete = canEdit;
  // Recheck modal — only relevant when the assignment is APPROVED
  // (visible to cleaners) and has at least one item not yet passed.
  // PM uses this to tell us "the tenant did this part themselves, you
  // don't need to clean it anymore."
  const [recheckOpen, setRecheckOpen] = useState(false);
  const [pendingRecheck, setPendingRecheck] = useState(null); // existing pending request, if any

  // Pull existing pending recheck request for this assignment so we
  // can show "you already submitted a recheck — waiting for owner".
  useEffect(() => {
    if (assignment.pm_status !== "approved") return;
    (async () => {
      const { data } = await supabase
        .from("recheck_requests")
        .select("id, created_at, pm_status, items:recheck_request_items(id)")
        .eq("assignment_id", assignment.id)
        .eq("pm_status", "pending")
        .limit(1)
        .maybeSingle();
      setPendingRecheck(data || null);
    })();
  }, [assignment.id, assignment.pm_status]);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("assignments")
      .update({ pm_status: "pending", pm_rejection_reason: null })
      .eq("id", assignment.id);
    setBusy(false);
    if (error) {
      alert("Could not submit: " + error.message);
      return;
    }
    createNotification({
      to: { scope: "owner" },
      kind: "pm_assignment",
      title: "Assignment resubmitted for approval",
      body: `${property.name} · ${assignment.title || assignmentTypeLabel(assignment.assignment_type)}`,
      linkKind: "assignment",
      linkId: assignment.id,
    });
    onBack();
  };

  const remove = async () => {
    if (!confirm("Delete this assignment? This cannot be undone.")) return;
    setBusy(true);
    if (assignment.file_path) await deletePmFile(assignment.file_path);
    await supabase.from("assignments").delete().eq("id", assignment.id);
    setBusy(false);
    onBack();
  };

  const statusLabels = {
    draft: { text: "Draft", color: "bg-stone-200 text-stone-700" },
    pending: { text: "Pending approval", color: "bg-amber-100 text-amber-800" },
    approved: {
      text: "Approved — visible to team",
      color: "bg-emerald-100 text-emerald-800",
    },
    rejected: { text: "Needs changes", color: "bg-red-100 text-red-700" },
  };
  const s = statusLabels[assignment.pm_status] || statusLabels.draft;

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <ScreenId id="PM-ASGN-DET" />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">
            {property.name}
          </div>
          <div className="font-serif text-xl text-stone-900 truncate">
            {assignment.title}
          </div>
        </div>
      </div>
      {(assignment.assignment_type || assignment.scheduled_date) && (
        <div className="flex gap-2 flex-wrap px-5 pt-3">
          <AssignmentTypeChip type={assignment.assignment_type} />
          {assignment.scheduled_date && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-200 text-stone-800 text-xs font-mono">
              <Calendar size={11} /> {fmtDateWithDay(assignment.scheduled_date)}
            </span>
          )}
        </div>
      )}
      <div className="px-5 pt-4 space-y-2">
        <SpanishTranslationPanel assignment={assignment} viewerRole="pm" />
        <TranslateButton
          texts={
            assignment.extracted_text && assignment.extracted_text.trim()
              ? [
                  assignment.title,
                  assignment.notes,
                  assignment.extracted_text,
                ].filter(Boolean)
              : [assignment.title, assignment.notes].filter(Boolean)
          }
        />
      </div>
      <div className="px-5 pt-4 space-y-5">
        <div
          className={`p-3 rounded-xl text-sm flex items-center gap-2 ${s.color}`}
        >
          <Check size={14} /> {s.text}
        </div>

        {assignment.pm_rejection_reason && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="text-xs uppercase tracking-wider font-mono text-red-700 mb-1">
              Owner's note
            </div>
            <div className="text-sm text-red-900 whitespace-pre-wrap">
              {assignment.pm_rejection_reason}
            </div>
          </div>
        )}

        {assignment.file_url && (
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="flex items-center gap-3 mb-3">
              {assignment.file_kind === "pdf" ? (
                <FileText size={20} className="text-stone-600" />
              ) : (
                <ImageIcon size={20} className="text-stone-600" />
              )}
              <div className="flex-1">
                <div className="font-serif text-base text-stone-900">
                  Attached file
                </div>
                <div className="text-xs text-stone-500 font-mono">
                  {assignment.file_kind?.toUpperCase()}
                </div>
              </div>
            </div>
            {assignment.file_kind === "image" && (
              <img
                loading="lazy"
                src={assignment.file_url}
                alt=""
                className="w-full max-h-[60vh] object-contain rounded-xl mb-3 bg-stone-100"
              />
            )}
            <a
              href={assignment.file_url}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium"
            >
              <Eye size={14} /> Open
            </a>
          </div>
        )}

        {assignment.notes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">
              Notes
            </div>
            <div className="text-sm text-stone-800 whitespace-pre-wrap">
              {assignment.notes}
            </div>
          </div>
        )}

        {canEdit ? (
          <div className="space-y-2 pt-2">
            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
            >
              {busy ? "Working…" : "Submit for approval"}
            </button>
            <button
              onClick={onEdit}
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Edit2 size={14} /> Edit
            </button>
            {canDelete && (
              <button
                onClick={remove}
                disabled={busy}
                className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        ) : assignment.pm_status === "pending" ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-stone-700">
            This assignment is locked while waiting for the owner to review.
            You'll be able to edit again if changes are requested.
          </div>
        ) : (
          // Approved (active) — PM can now submit a recheck if the
          // tenant fixed some items themselves between the original
          // submission and the cleaner arriving.
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-stone-700">
              This assignment is active and visible to the cleaning team. It
              can't be edited from here.
            </div>
            {pendingRecheck ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-xs uppercase tracking-wider font-mono text-amber-800 mb-1">
                  Recheck pending review
                </div>
                <div className="text-sm text-stone-700">
                  You submitted a recheck request with{" "}
                  {pendingRecheck.items?.length || 0} item
                  {(pendingRecheck.items?.length || 0) === 1 ? "" : "s"}. The
                  owner will approve or reject it.
                </div>
              </div>
            ) : (
              <button
                onClick={() => setRecheckOpen(true)}
                disabled={busy}
                className="w-full py-3 rounded-2xl bg-stone-100 border border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-stone-200"
              >
                <Check size={14} /> Request recheck — tenant passed some items
              </button>
            )}
          </div>
        )}
      </div>

      {recheckOpen && (
        <RecheckRequestModal
          assignment={assignment}
          property={property}
          portalUser={portalUser}
          onClose={() => setRecheckOpen(false)}
          onSaved={() => {
            setRecheckOpen(false);
            // Reload the pending banner state
            (async () => {
              const { data } = await supabase
                .from("recheck_requests")
                .select(
                  "id, created_at, pm_status, items:recheck_request_items(id)",
                )
                .eq("assignment_id", assignment.id)
                .eq("pm_status", "pending")
                .limit(1)
                .maybeSingle();
              setPendingRecheck(data || null);
            })();
          }}
        />
      )}
    </div>
  );
}
