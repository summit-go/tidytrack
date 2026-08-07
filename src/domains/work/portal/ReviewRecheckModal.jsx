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
  isLead,
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

export function ReviewRecheckModal({ recheck, employee, onDone, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const items = recheck.items || [];

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      const nowISO = new Date().toISOString();
      const targetIds = items.map((i) => i.target?.id).filter(Boolean);
      // 1. Mark every listed target as done + recheck_passed.
      //    completed_by stays null (no cleaner did this work) — the
      //    recheck_passed_at column distinguishes from a normal close.
      if (targetIds.length > 0) {
        const { error: e1 } = await supabase
          .from("assignment_targets")
          .update({
            status: "done",
            completed_at: nowISO,
            recheck_passed_at: nowISO,
            recheck_passed_by: recheck.created_by || null,
          })
          .in("id", targetIds);
        if (e1) throw e1;
      }
      // 2. Stamp the recheck request as approved
      const { error: e2 } = await supabase
        .from("recheck_requests")
        .update({
          pm_status: "approved",
          approved_by: employee.id,
          approved_at: nowISO,
        })
        .eq("id", recheck.id);
      if (e2) throw e2;
      onDone();
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  const reject = async () => {
    if (!rejectionReason.trim()) {
      setError("Please give a reason so the PM knows what to change.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nowISO = new Date().toISOString();
      const { error: e1 } = await supabase
        .from("recheck_requests")
        .update({
          pm_status: "rejected",
          rejected_by: employee.id,
          rejected_at: nowISO,
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", recheck.id);
      if (e1) throw e1;
      onDone();
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  // Group items by bedroom for display
  const grouped = (() => {
    const m = new Map();
    items.forEach((i) => {
      const t = i.target;
      if (!t) return;
      const k = `${t.unit?.label || ""}::${t.party?.label || ""}`;
      if (!m.has(k))
        m.set(k, {
          unitLabel: t.unit?.label || "",
          partyLabel: t.party?.label || "",
          list: [],
        });
      m.get(k).list.push(t);
    });
    return Array.from(m.values());
  })();

  const labelForTarget = (t) => {
    if (
      t.status_notes &&
      (t.template_item_key?.startsWith?.("requested:") ||
        t.template_item_key?.startsWith?.("custom_"))
    )
      return t.status_notes;
    const key = t.template_item_key || "";
    if (!key) return "Item";
    return key
      .replace(/^[a-z]+:/, "")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono">
                RECHECK
              </span>
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Review request
              </div>
            </div>
            <div className="font-serif text-xl text-stone-900 truncate">
              {recheck.assignment?.title}
            </div>
            <div className="text-xs text-stone-500 font-mono mt-0.5">
              {recheck.assignment?.property?.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-sm text-stone-700 mb-4">
            The PM is asking you to confirm the tenant passed the following
            items on recheck. Approving removes them from the cleaning team's
            workflow.
          </div>
          {recheck.notes && (
            <div className="p-3 rounded-xl bg-stone-100 text-sm text-stone-700 mb-4 whitespace-pre-wrap">
              <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                PM notes
              </div>
              {recheck.notes}
            </div>
          )}
          {grouped.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              No items in this request.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((g, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white border-2 border-emerald-200 p-3"
                >
                  <div className="text-xs uppercase tracking-wider font-mono text-emerald-700 mb-2">
                    {g.unitLabel}
                    {g.partyLabel && ` · ${g.partyLabel}`}{" "}
                    <span className="text-stone-400">({g.list.length})</span>
                  </div>
                  <ul className="space-y-1">
                    {g.list.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <Check
                          size={14}
                          className="text-emerald-600 flex-shrink-0 mt-0.5"
                        />
                        <span>{labelForTarget(t)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 space-y-2">
          {error && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {rejecting ? (
            <>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Reason — e.g. 'tenant didn't actually clean, the photo shows dust'"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-900"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRejecting(false)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium text-sm"
                >
                  Back
                </button>
                <button
                  onClick={reject}
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-medium text-sm disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send back to PM"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="flex-1 py-3 rounded-2xl border-2 border-red-200 text-red-700 font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <X size={14} /> Send back
              </button>
              <button
                onClick={approve}
                disabled={busy}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check size={14} />{" "}
                {busy ? "Approving…" : `Approve (${items.length})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
