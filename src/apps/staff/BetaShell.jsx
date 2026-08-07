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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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
import { ManagerShell } from "./ManagerShell.jsx";
import { EmployeeApp } from "./cleaner/EmployeeApp.jsx";
import { PortalApp } from "../portal/PortalApp.jsx";

export const BETA_VIEW_LS_KEY = "tidytrack_beta_view";
export function readBetaView() {
  try {
    const v = localStorage.getItem(BETA_VIEW_LS_KEY);
    if (v === "beta" || v === "employee" || v === "pm") return v;
  } catch {}
  return "beta";
}
export function writeBetaView(v) {
  try {
    localStorage.setItem(BETA_VIEW_LS_KEY, v);
  } catch {}
  if (typeof window !== "undefined") window.__tidytrack_beta_view = v;
}
// Gate helper used by features that want to render only inside the
// BETA view of a beta-tester account. Closed for everyone else even
// if they somehow set the window global manually.
export function isBetaFeaturesEnabled(employee) {
  if (!employee?.is_beta_tester) return false;
  const v =
    (typeof window !== "undefined" && window.__tidytrack_beta_view) || "beta";
  return v === "beta";
}

export function BetaShell({ employee, onSignOut }) {
  const [view, setView] = useState(readBetaView());
  // Mirror to window global so deep components can read without prop drilling
  useEffect(() => {
    writeBetaView(view);
  }, [view]);
  // On mount, set the global once (in case something reads it before
  // the effect runs in StrictMode dev double-render).
  useEffect(() => {
    if (typeof window !== "undefined") window.__tidytrack_beta_view = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const VIEWS = [
    { id: "beta", label: "BETA", desc: "Admin + new features" },
    { id: "employee", label: "EMPLOYEE", desc: "What cleaners see" },
    { id: "pm", label: "PM", desc: "What property managers see" },
  ];
  const banner = (
    <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-stone-50 px-2 py-1.5 flex items-center gap-1 shadow-lg">
      <span className="text-[9px] uppercase tracking-widest font-mono text-amber-400 px-1.5 flex-shrink-0">
        Beta
      </span>
      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              view === v.id
                ? "bg-amber-500 text-stone-900 font-bold"
                : "bg-stone-800 text-stone-400 hover:text-stone-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <button
        onClick={onSignOut}
        className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full text-stone-400 hover:text-stone-100 flex-shrink-0"
      >
        Sign out
      </button>
    </div>
  );
  // Each branch keeps its own state (mount/unmount on switch).
  // That's intentional — a fresh EMPLOYEE view from BETA shows a clean
  // cleaner experience, not a half-finished one.
  let inner;
  if (view === "beta") {
    inner = <ManagerShell employee={employee} onSignOut={onSignOut} />;
  } else if (view === "employee") {
    inner = <EmployeeApp employee={employee} onSignOut={onSignOut} />;
  } else {
    // PM view — implemented in the next turn. Synthetic portalUser
    // injection requires PortalShell refactor we haven't done yet.
    inner = (
      <div className="min-h-screen bg-stone-50 pt-12 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 text-center">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-3">
            Coming soon
          </div>
          <div className="font-serif text-2xl text-stone-900 mb-2">PM view</div>
          <div className="text-sm text-stone-600">
            PM impersonation needs PortalShell adapter work. Shipping in a
            follow-up turn. For now, use BETA or EMPLOYEE.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      {banner}
      {/* Push the inner shell down so the banner doesn't overlap.
         The banner is ~32px tall; pt-9 (36px) gives a tiny buffer. */}
      <div className="pt-9">{inner}</div>
    </div>
  );
}
