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
import { sessionStore } from "../../../lib/sessionStore.js";
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
import { ItemsDropdown } from "./ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";
import { AssignmentTabContent } from "../../cross-cutting/AssignmentTabContent.jsx";

export function AssignmentsPanel({
  propertyId,
  employee,
  refreshKey,
  onGoToBedroom,
  onOpenBedroomHistory,
  onJoinBlock,
}) {
  const [tab, setTab] = useState("pending");
  const [counts, setCounts] = useState({
    pending: 0,
    paused: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
    mine: 0,
  });

  const loadCounts = async () => {
    const PAGE = 1000;
    let data = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: pErr } = await supabase
        .from("assignment_targets")
        .select(
          "status, completed_by, completed_at, unit_id, party_id, assignment_id, recheck_passed_at, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
        )
        .eq("assignment.customer_id", propertyId)
        .eq("assignment.active", true)
        .is("assignment.deleted_at", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (pErr) break;
      data = data.concat(page || []);
      if (!page || page.length < PAGE) break;
      if (from > 200000) break;
    }
    const filtered = (data || []).filter(
      (t) =>
        !t.assignment?.deleted_at &&
        (t.assignment?.source !== "pm" ||
          t.assignment?.pm_status === "approved"),
    );
    // Count UNIQUE assignments per status. Each assignment gets bucketed
    // ONCE based on its DOMINANT status (in_progress > paused > blocked
    // > pending > done). This is the counterpart to the dominant-status
    // logic in load() — both key by assignment_id so a cleaning-check
    // and a move-out check at the same bedroom count as two separate
    // jobs. They must agree or the badge says "1 pending" while the
    // tab shows something else.
    const asgnKey = (t) =>
      t.assignment_id || `${t.unit_id || ""}::${t.party_id || ""}`;
    const statusesByAsgn = new Map();
    filtered.forEach((t) => {
      const k = asgnKey(t);
      if (!statusesByAsgn.has(k)) statusesByAsgn.set(k, new Set());
      statusesByAsgn.get(k).add(t.status);
    });
    const dominantOrder = [
      "in_progress",
      "paused",
      "blocked",
      "pending",
      "done",
    ];
    const sets = {
      pending: new Set(),
      paused: new Set(),
      in_progress: new Set(),
      done: new Set(),
      blocked: new Set(),
      mine: new Set(),
      recheck_passed: new Set(),
    };
    statusesByAsgn.forEach((statusSet, k) => {
      const dom = dominantOrder.find((s) => statusSet.has(s)) || "pending";
      if (sets[dom]) sets[dom].add(k);
    });
    // "Mine" still depends on which items the viewing cleaner finished
    // today — it's a derived view, so we walk the items separately.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    filtered.forEach((t) => {
      if (t.recheck_passed_at) sets.recheck_passed.add(asgnKey(t));
      if (
        t.completed_by &&
        employee?.id &&
        t.completed_by === employee.id &&
        t.completed_at
      ) {
        const ca = new Date(t.completed_at);
        if (ca >= todayStart) sets.mine.add(asgnKey(t));
      }
    });
    setCounts({
      pending: sets.pending.size,
      paused: sets.paused.size,
      in_progress: sets.in_progress.size,
      done: sets.done.size,
      blocked: sets.blocked.size,
      mine: sets.mine.size,
      recheck_passed: sets.recheck_passed.size,
    });
  };
  useEffect(() => {
    loadCounts();
  }, [propertyId, refreshKey]);
  // Tab badges need to refresh on every DB change too, not just on
  // propertyId / refreshKey. Without this hook the counts went stale
  // the moment a cleaner started a workblock — the card itself moved
  // to In progress (because load() re-ran on the same sync) but the
  // badges still read the old numbers until you tabbed away and back.
  useAssignmentSync(loadCounts, "asgn-panel-counts");

  return (
    <div className="px-2 sm:px-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={14} className="text-stone-500" />
        <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">
          Assignments
        </span>
      </div>
      <div className="flex gap-1 mb-3 bg-stone-100 p-1 rounded-xl overflow-x-auto">
        <button
          onClick={() => setTab("pending")}
          className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "pending" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Pending{counts.pending > 0 && ` (${counts.pending})`}
        </button>
        <button
          onClick={() => setTab("paused")}
          className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "paused" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Paused{counts.paused > 0 && ` (${counts.paused})`}
        </button>
        <button
          onClick={() => setTab("in_progress")}
          className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "in_progress" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          In progress{counts.in_progress > 0 && ` (${counts.in_progress})`}
        </button>
        <button
          onClick={() => setTab("done")}
          className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "done" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Done{counts.done > 0 && ` (${counts.done})`}
          {counts.blocked > 0 && (
            <span className="ml-1 text-[10px] font-mono text-red-700">
              · {counts.blocked}⊘
            </span>
          )}
        </button>
        {/* Mine tab — items the current cleaner personally completed today.
           Hidden if the cleaner has no completions yet so the row stays
           compact for owners/managers viewing the same panel. */}
        {counts.mine > 0 && (
          <button
            onClick={() => setTab("mine")}
            className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "mine" ? "bg-amber-50 shadow-sm text-amber-900 font-bold" : "text-stone-500"}`}
          >
            Mine ({counts.mine})
          </button>
        )}
        {/* Passed recheck — items the PM marked passed on recheck
           (tenant did it themselves). Owner audit bucket so they
           can review what was removed from the cleaning workflow.
           Hidden when zero so the row stays compact. */}
        {counts.recheck_passed > 0 && (
          <button
            onClick={() => setTab("recheck_passed")}
            className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === "recheck_passed" ? "bg-purple-50 shadow-sm text-purple-900 font-bold" : "text-stone-500"}`}
          >
            Passed recheck ({counts.recheck_passed})
          </button>
        )}
      </div>
      <AssignmentTabContent
        propertyId={propertyId}
        employee={employee}
        statusFilter={tab}
        onUpdate={loadCounts}
        onGoToBedroom={onGoToBedroom}
        onOpenBedroomHistory={onOpenBedroomHistory}
        onJoinBlock={onJoinBlock}
      />
    </div>
  );
}
