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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../lib/labels.js";
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
import { QuickAddPortalUserModal } from "./QuickAddPortalUserModal.jsx";

export function PortalUserAssignmentSection({
  portalUsers,
  assignedIds,
  loaded,
  search,
  setSearch,
  onToggle,
  onUserCreated,
}) {
  const [kindFilter, setKindFilter] = useState("pm"); // 'pm' | 'property_owner' | 'pm_staff'
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const KIND_TABS = [
    { id: "pm", label: "Managers" },
    { id: "property_owner", label: "Owners" },
    { id: "pm_staff", label: "PM Staff" },
  ];

  // Filter by kind first, then by search
  const byKind = (portalUsers || []).filter(
    (u) => u.kind === kindFilter && u.active !== false,
  );
  const filtered = search.trim()
    ? byKind.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
          u.code?.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : byKind;

  // Count assigned per kind for the badge
  const assignedByKind = { pm: 0, property_owner: 0, pm_staff: 0 };
  (portalUsers || []).forEach((u) => {
    if (assignedIds.has(u.id) && assignedByKind[u.kind] !== undefined) {
      assignedByKind[u.kind]++;
    }
  });

  return (
    <div className="p-4 rounded-2xl bg-white border border-stone-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-stone-500" />
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Who's over this property?
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="px-2.5 py-1.5 rounded-full bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-mono flex items-center gap-1 active:scale-95"
        >
          <Plus size={11} /> Add new
        </button>
      </div>
      <p className="text-[11px] text-stone-500 -mt-1 mb-3">
        Check any owners, managers, or PM staff that need access to this
        property's portal.
      </p>

      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-3">
        {KIND_TABS.map((tab) => {
          const isActive = kindFilter === tab.id;
          const count = assignedByKind[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setKindFilter(tab.id)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${isActive ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-amber-100 text-amber-900" : "bg-stone-200 text-stone-600"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {byKind.length >= 6 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${byKind.length} ${KIND_TABS.find((t) => t.id === kindFilter)?.label.toLowerCase() || ""}…`}
          className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:border-stone-400"
        />
      )}

      {!loaded ? (
        <div className="text-center py-6 text-stone-400 text-xs font-mono">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-stone-400 text-xs border-2 border-dashed border-stone-200 rounded-xl">
          {search
            ? `No ${KIND_TABS.find((t) => t.id === kindFilter)?.label.toLowerCase() || "users"} match "${search}".`
            : `No ${KIND_TABS.find((t) => t.id === kindFilter)?.label.toLowerCase() || "users"} yet. Tap "Add new" to create one.`}
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {filtered.map((u) => {
            const checked = assignedIds.has(u.id);
            return (
              <label
                key={u.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-amber-50" : "hover:bg-stone-50"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(u.id)}
                  className="w-4 h-4 flex-shrink-0 accent-amber-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {u.name}
                  </div>
                  {u.code && (
                    <div className="text-[10px] font-mono text-stone-500">
                      Code: {u.code}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {showQuickAdd && (
        <QuickAddPortalUserModal
          defaultKind={kindFilter}
          onClose={() => setShowQuickAdd(false)}
          onCreated={(user) => {
            setShowQuickAdd(false);
            // Switch to the kind tab the new user lives in so they're visible
            if (user.kind && user.kind !== kindFilter) setKindFilter(user.kind);
            onUserCreated(user);
          }}
        />
      )}
    </div>
  );
}
