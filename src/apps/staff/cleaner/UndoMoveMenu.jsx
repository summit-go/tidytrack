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
  BUILD_TAG,
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

export function UndoMoveMenu({
  disabled,
  canUndo,
  canMove,
  onUndo,
  onMoveBedroom,
  onMoveWorkblock,
}) {
  const [open, setOpen] = useState(false);
  // Close popover on outside-tap. We attach a window-level mousedown
  // listener while open and remove it when closed.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Find any element with data-undo-menu="root" — if the click is
      // inside it, keep the menu open. Otherwise close.
      let el = e.target;
      while (el) {
        if (el.dataset && el.dataset.undoMenu === "root") return;
        el = el.parentElement;
      }
      setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [open]);
  return (
    <div className="inline-block relative" data-undo-menu="root">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Something's wrong — undo this workblock or move it"
        title="Started by mistake, or in the wrong bedroom? Fix it here"
        className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-900 inline-flex items-center justify-center border border-amber-300 disabled:opacity-50 active:scale-95 transition shadow-sm"
      >
        <Undo2 size={16} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute z-40 top-full right-0 mt-1 w-72 bg-stone-50 rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
          {canUndo && (
            <button
              onClick={() => {
                setOpen(false);
                onUndo();
              }}
              className="w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-100 flex items-start gap-3"
            >
              <Delete size={16} className="text-red-700 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900">
                  Started by mistake
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  Cancel this workblock and go back to assignments.
                </div>
              </div>
            </button>
          )}
          {canMove && (
            <button
              onClick={() => {
                setOpen(false);
                onMoveBedroom();
              }}
              className="w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-100 flex items-start gap-3"
            >
              <Building2
                size={16}
                className="text-amber-700 flex-shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900">
                  I'm in the wrong bedroom
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  Move what I've done to a different bedroom. Items I've checked
                  off come with me.
                </div>
              </div>
            </button>
          )}
          {canMove && (
            <button
              onClick={() => {
                setOpen(false);
                onMoveWorkblock();
              }}
              className="w-full text-left px-4 py-3 hover:bg-stone-100 flex items-start gap-3"
            >
              <Edit2
                size={16}
                className="text-stone-700 flex-shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900">
                  Wrong workblock
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  Move this workblock to a different bedroom and reset items
                  here back to pending.
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
