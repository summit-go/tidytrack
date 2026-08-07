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
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";
import { resolveItemLabel } from "../../../lib/pickerLabels.js";

export function JobPeekModal({ job, employee, onClose }) {
  const { locale } = useLocale();
  const { overrides } = useItemLabelOverrides(job.customerId, locale, employee);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [secFilter, setSecFilter] = useState("all"); // 'all' | section key

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Scoped to this one bedroom, so no pagination needed — but keep
      // the assignment filter tight so a second job at the same bedroom
      // doesn't bleed in.
      let q = supabase
        .from("assignment_targets")
        .select(
          "id, status, template_item_key, template_section, status_notes, completed_at",
        )
        .eq("assignment_id", job.id);
      if (job.unitId) q = q.eq("unit_id", job.unitId);
      if (job.partyId) q = q.eq("party_id", job.partyId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        alert("Could not load this job: " + error.message);
        setLoaded(true);
        return;
      }
      setItems(data || []);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.unitId, job.partyId]);

  const labelFor = (t) => {
    if (
      t.status_notes &&
      (t.template_item_key?.startsWith?.("requested:") ||
        t.template_item_key?.startsWith?.("custom_"))
    )
      return t.status_notes;
    const key = t.template_item_key || "";
    const fallback = key
      .replace(/^[a-z]+:/, "")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
    return resolveItemLabel(key, locale, overrides, fallback);
  };

  const SECTIONS = ["bedroom", "vanity", "bathroom", "general"];
  const bySection = {};
  items.forEach((t) => {
    const sec = (t.template_section || "other").toLowerCase();
    (bySection[sec] = bySection[sec] || []).push(t);
  });
  const order = [
    ...SECTIONS.filter((s) => bySection[s]),
    ...Object.keys(bySection).filter((s) => !SECTIONS.includes(s)),
  ];
  const done = items.filter((t) => t.status === "done").length;
  const size =
    job.bedrooms || job.bathrooms
      ? `${job.bedrooms || 0}BR / ${job.bathrooms || 0}BA`
      : null;
  // Same chip pattern as the real working screen, so switching between
  // peek and work doesn't feel like two different apps.
  const shown =
    secFilter === "all" ? order : order.filter((s) => s === secFilter);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono">
                Quick glance — nothing is started
              </div>
              <div className="font-serif text-base text-stone-900 truncate">
                {unitPartyLabel(job.unitLabel, job.partyLabel) || "Job"}
              </div>
              <div className="text-[11px] text-stone-500 font-mono mt-0.5 truncate">
                {job.propName}
                {job.type ? ` · ${assignmentTypeLabel(job.type)}` : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0"
            >
              <X size={20} className="text-stone-600" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {size && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                {size}
              </span>
            )}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {done} of {items.length} done
            </span>
            {job.hereNow?.map((h, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                {h.name} is here
              </span>
            ))}
            {job.assignees?.map((a) => (
              <span
                key={a.id}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1"
              >
                <User size={9} /> {a.name}
              </span>
            ))}
          </div>
        </div>

        {/* Section tabs. Sticky under the header so they stay reachable
           on a 74-item job. */}
        {loaded && items.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-stone-200 bg-stone-50 flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSecFilter("all")}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full flex-shrink-0 ${secFilter === "all" ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600"}`}
            >
              All ({items.length})
            </button>
            {order.map((sec) => (
              <button
                key={sec}
                onClick={() => setSecFilter(sec)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-full flex-shrink-0 capitalize ${secFilter === sec ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600"}`}
              >
                {sec} ({bySection[sec].length})
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!loaded ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              No items on this job.
            </div>
          ) : (
            shown.map((sec) => (
              <div key={sec}>
                {/* The heading is redundant once a single tab is picked. */}
                {secFilter === "all" && (
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-1.5">
                    {sec} ({bySection[sec].length})
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  {bySection[sec].map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          t.status === "done"
                            ? "bg-emerald-500"
                            : t.status === "in_progress"
                              ? "bg-amber-500"
                              : t.status === "blocked"
                                ? "bg-red-500"
                                : "bg-stone-300"
                        }`}
                      />
                      <span
                        className={`text-xs flex-1 min-w-0 break-words ${t.status === "done" ? "text-stone-400 line-through" : "text-stone-700"}`}
                      >
                        {labelFor(t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-stone-200">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white border border-stone-300 text-stone-700 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
