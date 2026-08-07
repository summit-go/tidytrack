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
import { can, canSeeMoney, isLead, isLeadOnly, isOwner, visibleProps } from "../../lib/permissions.js";
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
import { sessionStore } from "../../domains/auth/sessionStore.js";
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
import { SignIn } from "../../domains/auth/SignIn.jsx";
import { ConfigError } from "../../domains/auth/ConfigError.jsx";
import { BetaShell } from "./BetaShell.jsx";
import { LeadShell } from "./LeadShell.jsx";
import { EmployeeApp } from "./cleaner/EmployeeApp.jsx";

export function StaffApp() {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (
      SUPABASE_URL.includes("PASTE_") ||
      SUPABASE_ANON_KEY.includes("PASTE_")
    ) {
      setConfigError(true);
      setLoaded(true);
      return;
    }
    (async () => {
      const s = await sessionStore.get();
      if (s?.employeeId) {
        const { data } = await supabase
          .from("employees")
          .select("*")
          .eq("id", s.employeeId)
          .maybeSingle();
        if (data) setSession({ employee: data });
        else await sessionStore.clear();
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <Splash text="Loading…" />;
  if (configError) return <ConfigError />;

  if (!session) {
    return (
      <SignIn
        onSignIn={async (employee) => {
          // Remember they chose staff (in case localStorage was cleared)
          try {
            localStorage.setItem("tt_role_choice", "staff");
          } catch {}
          // Apply per-employee language pref before any UI mounts so the
          // cleaner sees the right locale immediately on this device.
          if (employee?.locale) {
            try {
              localStorage.setItem("tidytrack_locale", employee.locale);
            } catch {}
          }
          await sessionStore.set({ employeeId: employee.id });
          setSession({ employee });
        }}
      />
    );
  }
  const signOut = async () => {
    // Clear any persisted "preview as cleaner/PM" flags so a deliberate
    // sign-out doesn't drop the owner back into a preview session on their
    // next login. (These are keyed per-employee, so they never leak between
    // users — this is just for the same owner signing back in.)
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tidytrack_page_lead_preview_"))
          localStorage.removeItem(k);
      }
    } catch {}
    await sessionStore.clear();
    setSession(null);
  };
  // Beta testers (is_beta_tester=true) get a sticky top toggle bar
  // letting them swap between BETA / EMPLOYEE / PM views. The flag is
  // set via SQL on a dedicated test-harness employee row — your real
  // owner account stays untouched.
  if (session.employee.is_beta_tester) {
    return <BetaShell employee={session.employee} onSignOut={signOut} />;
  }
  if (isLead(session.employee)) {
    return <LeadShell employee={session.employee} onSignOut={signOut} />;
  }
  // Cleaner path. The supply checklist gate now lives inside EmployeeApp so it
  // also covers Beta accounts and preview — see the gate there.
  return <EmployeeApp employee={session.employee} onSignOut={signOut} />;
}
