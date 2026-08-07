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

export function SpanishTranslationPanel({ assignment, viewerRole }) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  if (!assignment) return null;
  // Master kill switch: if translation feature is off, render nothing
  // regardless of whether existing assignments have stored Spanish text.
  if (!TRANSLATION_ENABLED) return null;

  const status = assignment.translation_status;
  const spanish = assignment.spanish_translation;
  const hasSpanish = !!(spanish && spanish.trim());
  // Only owners and managers see translation pipeline errors / skipped notes.
  // PMs and cleaners just see "in progress" or the final ES pill.
  const isStaff = viewerRole === "owner" || viewerRole === "manager";

  const retry = async () => {
    if (!assignment.file_url) return;
    setRetrying(true);
    try {
      await supabase
        .from("assignments")
        .update({
          translation_status: "pending",
          translation_error: null,
        })
        .eq("id", assignment.id);
      // Kick off auto-translate; fire-and-forget
      autoTranslateAssignment(
        assignment.id,
        assignment.file_url,
        assignment.file_kind,
      );
    } finally {
      setRetrying(false);
    }
  };

  // Show different states based on translation status
  if (status === "processing" || status === "pending") {
    // Only show the "in progress" spinner to owners/managers — PMs and cleaners
    // don't know about the auto-translation pipeline, no point exposing it.
    if (!isStaff) return null;
    return (
      <div className="mt-2 px-3 py-1.5 rounded-full bg-stone-100 inline-flex items-center gap-1.5 text-xs font-mono text-stone-500">
        <div className="w-2 h-2 rounded-full border border-stone-400 border-t-transparent animate-spin" />
        Spanish translation in progress…
      </div>
    );
  }
  if (status === "skipped") {
    // Nothing readable in attachment — quietly hide for cleaners, show small note to staff
    if (!isStaff) return null;
    return (
      <div className="mt-2 px-3 py-1.5 rounded-full bg-stone-100 inline-flex items-center gap-1.5 text-xs font-mono text-stone-500">
        No readable text in attachment — translation skipped.
      </div>
    );
  }
  if (status === "failed" && !hasSpanish) {
    // Failed — only show to staff so they can fix it; hide from cleaners
    if (!isStaff) return null;
    return (
      <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider font-mono text-red-700 mb-1 flex items-center gap-1.5">
              <AlertCircle size={11} /> Auto-translation failed
            </div>
            {assignment.translation_error && (
              <div className="text-xs text-red-800 font-mono break-words">
                {assignment.translation_error}
              </div>
            )}
            <div className="text-[10px] text-red-700 mt-1">
              Cleaners can't see this — only you. Common fixes: enable Cloud
              Vision API in Google Cloud Console, or add it to your API key's
              allowed API list.
            </div>
          </div>
          <button
            onClick={retry}
            disabled={retrying}
            className="px-3 py-1 rounded-full bg-red-700 text-white text-[11px] font-mono active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    );
  }
  if (!hasSpanish) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono active:scale-95 transition-all ${expanded ? "bg-amber-200 text-amber-900" : "bg-amber-100 hover:bg-amber-200 text-amber-900"}`}
      >
        <span className="font-bold tracking-wider">ES</span>
        <span>
          {expanded ? "Hide Spanish version" : "Spanish version available"}
        </span>
        <ChevronRight
          size={11}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-amber-800 mb-2">
            <Languages size={11} /> Traducción al español
          </div>
          <div className="text-sm text-stone-800 whitespace-pre-wrap break-words">
            {spanish}
          </div>
        </div>
      )}
    </div>
  );
}
