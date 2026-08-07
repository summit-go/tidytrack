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

export function PortalPhotoSection({
  label,
  photos,
  highlight,
  description,
  onResolve,
  selectMode,
  selectedIds,
  onToggleSelect,
  compact,
}) {
  const [zoom, setZoom] = useState(null);
  const isDamage = highlight === "red";
  const isCannot = highlight === "yellow";
  // Both red and yellow are "flagged" — they get the emphatic header rule,
  // the ring on each thumbnail, and the Resolve button.
  const flagged = isDamage || isCannot;
  const headRule = isDamage
    ? "pb-1.5 border-b-2 border-red-200"
    : isCannot
      ? "pb-1.5 border-b-2 border-yellow-300"
      : "";
  const headText = isDamage
    ? "text-red-800"
    : isCannot
      ? "text-yellow-800"
      : "text-stone-900";
  const emptyCls = isDamage
    ? "border-red-100 text-red-200"
    : isCannot
      ? "border-yellow-200 text-yellow-300"
      : "border-stone-200 text-stone-300";
  const ringCls = isDamage
    ? "ring-2 ring-red-400"
    : isCannot
      ? "ring-2 ring-yellow-400"
      : "";
  // `compact` is set when this section sits inside a 3-column side-by-side
  // wrapper (by-section view: Before | After | Damage). The inner grid
  // adapts to whatever width the parent gives us:
  //   - compact + phone (outer collapses to 1 col, full width): 4 cols inside
  //   - compact + desktop (outer is 3 cols, ~200px each): 2 cols inside
  //   - non-compact (standalone full-width "All photos" mode): 3/4 cols
  const innerGridClass = compact
    ? "grid grid-cols-4 sm:grid-cols-2 gap-1.5"
    : "grid grid-cols-3 sm:grid-cols-4 gap-2";
  if (photos.length === 0) {
    return (
      <div>
        <div className={`flex items-baseline justify-between mb-2 ${headRule}`}>
          <h3
            className={`font-serif text-base flex items-center gap-1.5 ${headText}`}
          >
            {flagged && "⚠"} {label}
          </h3>
          <span className="text-[10px] font-mono text-stone-400">0</span>
        </div>
        <div
          className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center ${emptyCls}`}
        >
          <Camera size={18} />
        </div>
      </div>
    );
  }
  // Determine the badge to put on each thumbnail based on the photo's kind.
  const kindBadge = (p) => {
    const k =
      p.kind ||
      (label.toLowerCase().includes("before")
        ? "before"
        : label.toLowerCase().includes("after")
          ? "after"
          : label.toLowerCase().includes("damage")
            ? "damage"
            : label.toLowerCase().includes("couldn't")
              ? KIND_CANNOT
              : null);
    if (!k) return null;
    const bg =
      k === "damage"
        ? "bg-red-600"
        : k === KIND_CANNOT
          ? "bg-yellow-600"
          : k === "before"
            ? "bg-blue-600"
            : k === "after"
              ? "bg-emerald-600"
              : "bg-stone-700";
    return (
      <span
        className={`absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-white text-[8px] font-mono uppercase tracking-wider ${bg}/90`}
      >
        {photoKindLabel(k)}
      </span>
    );
  };
  return (
    <div>
      <div className={`flex items-baseline justify-between mb-2 ${headRule}`}>
        <h3
          className={`font-serif text-base flex items-center gap-1.5 ${headText}`}
        >
          {flagged && "⚠"} {label}
        </h3>
        <span className="text-[10px] font-mono text-stone-500">
          {photos.length}
        </span>
      </div>
      {description && (
        <p className="text-xs text-stone-600 mb-2">{description}</p>
      )}
      <div className={innerGridClass}>
        {photos.map((p) => {
          const isSelected = selectMode && selectedIds && selectedIds.has(p.id);
          return (
            <div key={p.id} className="relative">
              <button
                onClick={() => (selectMode ? onToggleSelect(p.id) : setZoom(p))}
                className={`relative aspect-square w-full rounded-lg overflow-hidden ${ringCls} ${isSelected ? "ring-4 ring-stone-900" : ""}`}
              >
                <img
                  loading="lazy"
                  src={p.public_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {kindBadge(p)}
                {p.took_extra && (
                  <span className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded bg-amber-500 text-white text-[8px] font-mono uppercase tracking-wider flex items-center gap-0.5">
                    <Clock size={7} /> Extra
                  </span>
                )}
                {p.partyLabel && (
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[8px] font-mono truncate">
                    {p.partyLabel}
                  </span>
                )}
                {selectMode && (
                  <span
                    className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "bg-stone-900 border-stone-900" : "bg-white/80 border-white"}`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </span>
                )}
              </button>
              {onResolve && flagged && !selectMode && (
                <button
                  onClick={() => onResolve(p)}
                  className="mt-1 w-full px-1 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-mono active:scale-95"
                >
                  Resolve
                </button>
              )}
            </div>
          );
        })}
      </div>
      {zoom && (
        <PhotoZoomViewer
          photos={photos}
          initialUrl={zoom.public_url}
          onClose={() => setZoom(null)}
          onResolveCurrent={
            onResolve && flagged
              ? (p) => {
                  onResolve(p);
                  setZoom(null);
                }
              : null
          }
        />
      )}
    </div>
  );
}
