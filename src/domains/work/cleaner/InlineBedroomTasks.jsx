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

export function InlineBedroomTasks({ propertyId, unitId, partyId, employee }) {
  const { locale } = useLocale();
  const { overrides } = useItemLabelOverrides(propertyId, locale, employee);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);
  const [secFilter, setSecFilter] = useState("all"); // 'all' | section key

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!unitId || !partyId) {
        setLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from("assignment_targets")
        .select(
          "id, status, template_item_key, template_section, status_notes, assignment:assignments!inner(active, deleted_at)",
        )
        .eq("unit_id", unitId)
        .eq("party_id", partyId);
      if (cancelled) return;
      if (error) {
        setLoaded(true);
        return;
      }
      const live = (data || []).filter(
        (t) =>
          t.assignment?.active &&
          !t.assignment?.deleted_at &&
          t.status !== "done" &&
          t.status !== "blocked",
      );
      setItems(live);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, partyId]);

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

  if (loaded && items.length === 0) return null;

  const SECTIONS = ["bedroom", "vanity", "bathroom", "general"];
  const bySection = {};
  items.forEach((t) => {
    const s = (t.template_section || "other").toLowerCase();
    (bySection[s] = bySection[s] || []).push(t);
  });
  const order = [
    ...SECTIONS.filter((s) => bySection[s]),
    ...Object.keys(bySection).filter((s) => !SECTIONS.includes(s)),
  ];

  return (
    <div className="mb-4 rounded-2xl bg-white border border-stone-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.99] transition"
      >
        <span className="text-xs uppercase tracking-wider font-mono text-stone-500 flex items-center gap-2">
          <FileText size={13} /> What you'll clean here
          {loaded ? ` · ${items.length}` : ""}
        </span>
        <ChevronRight
          size={15}
          className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {!loaded ? (
            <div className="text-center py-4 text-stone-400 text-sm">
              Loading…
            </div>
          ) : (
            <>
              {/* Pill tabs — All shows every section (same as before);
                 tapping a section filters to just that section, like the
                 quick-glance pop-up. */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <button
                  onClick={() => setSecFilter("all")}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-full ${secFilter === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}
                >
                  All ({items.length})
                </button>
                {order.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSecFilter(sec)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-full capitalize ${secFilter === sec ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}
                  >
                    {sec} ({bySection[sec].length})
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {(secFilter === "all"
                  ? order
                  : order.filter((s) => s === secFilter)
                ).map((sec) => (
                  <div key={sec}>
                    {secFilter === "all" && (
                      <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-1.5">
                        {sec} ({bySection[sec].length})
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      {bySection[sec].map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              t.status === "in_progress"
                                ? "bg-amber-500"
                                : t.status === "paused"
                                  ? "bg-amber-400"
                                  : "bg-stone-300"
                            }`}
                          />
                          <span className="text-xs text-stone-700 min-w-0 break-words">
                            {labelFor(t)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
