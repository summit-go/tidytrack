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

export function RecheckRequestModal({
  assignment,
  property,
  portalUser,
  onClose,
  onSaved,
}) {
  const [targets, setTargets] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      // Load open targets (not done, not already recheck-passed).
      // These are the ones the PM can choose to pass on recheck.
      const { data } = await supabase
        .from("assignment_targets")
        .select(
          "id, status, template_section, template_item_key, status_notes, unit:units(label), party:parties(label), recheck_passed_at",
        )
        .eq("assignment_id", assignment.id)
        .not("status", "in", "(done,blocked)")
        .is("recheck_passed_at", null);
      setTargets(data || []);
      setLoaded(true);
    })();
  }, [assignment.id]);

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

  // Group by bedroom so the PM scans by location instead of a flat list
  const grouped = (() => {
    const m = new Map();
    targets.forEach((t) => {
      const k = `${t.unit?.label || ""}::${t.party?.label || ""}`;
      if (!m.has(k))
        m.set(k, {
          unitLabel: t.unit?.label || "",
          partyLabel: t.party?.label || "",
          items: [],
        });
      m.get(k).items.push(t);
    });
    return Array.from(m.values());
  })();

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      setError("Pick at least one item the tenant passed.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // 1. Find the portal_user id from the URL/session — passed in
      //    via assignment for this build we'll read from the property
      //    metadata. Simpler: leave created_by null; the owner inbox
      //    will still show the assignment + property which is enough
      //    attribution for now.
      const { data: req, error: e1 } = await supabase
        .from("recheck_requests")
        .insert({
          assignment_id: assignment.id,
          created_by: portalUser?.id || null,
          pm_status: "pending",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;
      // 2. Insert the item rows
      const itemRows = Array.from(selected).map((tid) => ({
        recheck_request_id: req.id,
        assignment_target_id: tid,
      }));
      const { error: e2 } = await supabase
        .from("recheck_request_items")
        .insert(itemRows);
      if (e2) throw e2;
      onSaved();
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              Recheck request
            </div>
            <div className="font-serif text-xl text-stone-900 truncate">
              {assignment.title}
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
            Tick every item the tenant passed on recheck. The owner will
            approve, then those items leave the cleaning team's workflow.
          </div>
          {!loaded ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Loading items…
            </div>
          ) : targets.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No open items to pass on recheck.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((g, idx) => (
                <div key={idx}>
                  <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    {g.unitLabel}
                    {g.partyLabel && ` · ${g.partyLabel}`}{" "}
                    <span className="text-stone-400">({g.items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {g.items.map((t) => {
                      const checked = selected.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggle(t.id)}
                          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 text-left ${checked ? "border-emerald-500 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-400"}`}
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? "border-emerald-600 bg-emerald-600" : "border-stone-300"}`}
                          >
                            {checked && (
                              <Check size={11} className="text-white" />
                            )}
                          </div>
                          <span className="text-sm text-stone-900">
                            {labelForTarget(t)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-3">
                <label className="text-xs uppercase tracking-wider font-mono text-stone-500 block mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything the owner should know about this recheck…"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>
          )}
        </div>
        {targets.length > 0 && (
          <div className="p-5 border-t border-stone-200 space-y-2">
            {error && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{" "}
                {error}
              </div>
            )}
            <div className="text-xs text-stone-600 text-center">
              {selected.size} item{selected.size === 1 ? "" : "s"} selected
            </div>
            <button
              onClick={submit}
              disabled={busy || selected.size === 0}
              className="w-full py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50"
            >
              {busy
                ? "Submitting…"
                : `Submit recheck request${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
