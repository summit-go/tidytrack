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

export function DayPhotoTabs({ photos, isStaff }) {
  const [activeTab, setActiveTab] = useState("all");

  // Bucket photos by kind
  const byKind = {
    before: [],
    after: [],
    damage: [],
    [KIND_CANNOT]: [],
    other: [],
  };
  photos.forEach((p) => {
    const k = byKind[p.kind] ? p.kind : "other";
    byKind[k].push(p);
  });
  // Sort each bucket oldest-first
  Object.keys(byKind).forEach((k) =>
    byKind[k].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    ),
  );

  const TABS = [
    { id: "all", label: "All", count: photos.length },
    { id: "before", label: "Before", count: byKind.before.length },
    { id: "after", label: "After", count: byKind.after.length },
    { id: "damage", label: "Damage", count: byKind.damage.length },
    {
      id: KIND_CANNOT,
      label: "Couldn't clean",
      count: byKind[KIND_CANNOT].length,
    },
  ].filter((t) => t.id === "all" || t.count > 0); // hide kinds with no photos

  // Build the visible list based on active tab
  let visible;
  if (activeTab === "all") {
    visible = [
      ...byKind.before.map((p) => ({ ...p, _kindLabel: "Before" })),
      ...byKind.after.map((p) => ({ ...p, _kindLabel: "After" })),
      ...byKind.damage.map((p) => ({ ...p, _kindLabel: "Damage" })),
      ...byKind[KIND_CANNOT].map((p) => ({
        ...p,
        _kindLabel: "Couldn't clean",
      })),
      ...byKind.other.map((p) => ({
        ...p,
        _kindLabel: photoKindLabel(p.kind),
      })),
    ];
  } else {
    visible = byKind[activeTab] || [];
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const colorClass =
            tab.id === "damage"
              ? isActive
                ? "bg-red-100 text-red-900 ring-1 ring-red-300"
                : "text-red-700 hover:bg-red-50"
              : tab.id === KIND_CANNOT
                ? isActive
                  ? "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-400"
                  : "text-yellow-800 hover:bg-yellow-50"
                : tab.id === "before"
                  ? isActive
                    ? "bg-blue-100 text-blue-900 ring-1 ring-blue-300"
                    : "text-blue-700 hover:bg-blue-50"
                  : tab.id === "after"
                    ? isActive
                      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                      : "text-emerald-700 hover:bg-emerald-50"
                    : isActive
                      ? "bg-stone-900 text-stone-50"
                      : "text-stone-600 hover:bg-stone-100";
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-mono whitespace-nowrap transition-colors ${colorClass}`}
            >
              {tab.label} <span className="opacity-70">({tab.count})</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {visible.map((p, i) => {
          // Section header within "All": insert a kind separator before the first photo of each group
          const prev = i > 0 ? visible[i - 1] : null;
          const showSeparator =
            activeTab === "all" && (!prev || prev._kindLabel !== p._kindLabel);
          return (
            <React.Fragment key={p.id}>
              {showSeparator && (
                <div className="col-span-4 text-[9px] uppercase tracking-wider font-mono text-stone-500 mt-1 pt-1 border-t border-stone-100 first:border-t-0 first:mt-0 first:pt-0">
                  {p._kindLabel}
                </div>
              )}
              <a
                href={p.public_url}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square rounded-lg overflow-hidden bg-stone-200 active:opacity-80"
              >
                <img
                  src={p.public_url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {p.kind && activeTab === "all" && (
                  <div
                    className={`absolute top-1 left-1 px-1 py-0.5 rounded text-white text-[8px] uppercase tracking-wider ${
                      p.kind === "damage"
                        ? "bg-red-700/85"
                        : p.kind === KIND_CANNOT
                          ? "bg-yellow-600/90"
                          : p.kind === "before"
                            ? "bg-blue-700/85"
                            : p.kind === "after"
                              ? "bg-emerald-700/85"
                              : "bg-black/70"
                    }`}
                  >
                    {photoKindLabel(p.kind)}
                  </div>
                )}
                {isStaff && p.cleanerName && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <div className="text-[8px] text-white font-mono leading-tight truncate">
                      {p.cleanerName}
                    </div>
                  </div>
                )}
              </a>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
