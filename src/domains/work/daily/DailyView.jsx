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
import { AssignedVsCleanedView } from "./AssignedVsCleanedView.jsx";
import { BedroomHistoryView } from "./BedroomHistoryView.jsx";
import { DailyCalendar } from "./DailyCalendar.jsx";
import { DailyDayDetail } from "./DailyDayDetail.jsx";
import { DailyUnitDayDetail } from "./DailyUnitDayDetail.jsx";
import { InboxView } from "../../../features/messaging/InboxView.jsx";

export function DailyView({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [view, setView] = useState({ kind: "calendar" });
  const showMoney = canSeeMoney(employee);
  // Persistent state for the Assigned vs Cleaned audit so its filters
  // / property / date range survive a side trip into BedroomHistoryView.
  // Lifted from AssignedVsCleanedView itself because that component
  // unmounts when the user navigates to a bedroom's history and back —
  // local useState would reset every time. Held at this level (the
  // common parent of both views) so neither leg of the journey loses it.
  const todayISO = new Date().toISOString().split("T")[0];
  const [auditState, setAuditState] = useState({
    selectedPropertyId: "",
    start: todayISO,
    end: todayISO,
    filterBuildings: [],
    filterStatuses: [],
    collapsedBuildings: [],
    scrollY: 0,
  });

  const openBedroomHistory = (params) =>
    setView({ kind: "bedroom-history", ...params, from: view });

  if (view.kind === "day") {
    return (
      <DailyDayDetail
        date={view.date}
        employee={employee}
        showMoney={showMoney}
        onBack={() => setView({ kind: "calendar" })}
        onOpenUnit={(propertyId, unitId, unitLabel, propertyName) =>
          setView({
            kind: "unit-day",
            date: view.date,
            propertyId,
            unitId,
            unitLabel,
            propertyName,
          })
        }
      />
    );
  }
  if (view.kind === "unit-day") {
    return (
      <DailyUnitDayDetail
        date={view.date}
        propertyId={view.propertyId}
        unitId={view.unitId}
        unitLabel={view.unitLabel}
        propertyName={view.propertyName}
        employee={employee}
        showMoney={showMoney}
        onBack={() => setView({ kind: "day", date: view.date })}
        onOpenBedroomHistory={openBedroomHistory}
      />
    );
  }
  if (view.kind === "bedroom-history") {
    return (
      <BedroomHistoryView
        propertyId={view.propertyId}
        propertyName={view.propertyName}
        unitId={view.unitId}
        unitLabel={view.unitLabel}
        partyId={view.partyId}
        partyLabel={view.partyLabel}
        employee={employee}
        onBack={() => setView(view.from || { kind: "calendar" })}
      />
    );
  }
  if (view.kind === "inbox") {
    return (
      <InboxView
        employee={employee}
        onBack={() => setView({ kind: "calendar" })}
      />
    );
  }
  if (view.kind === "assigned-vs-cleaned") {
    return (
      <AssignedVsCleanedView
        employee={employee}
        onBack={() => setView({ kind: "calendar" })}
        onOpenBedroomHistory={openBedroomHistory}
        persistedState={auditState}
        onStateChange={setAuditState}
      />
    );
  }

  return (
    <DailyCalendar
      employee={employee}
      onSignOut={onSignOut}
      onPickDay={(date) => setView({ kind: "day", date })}
      onOpenInbox={() => setView({ kind: "inbox" })}
      onOpenAssignedVsCleaned={() => setView({ kind: "assigned-vs-cleaned" })}
      onOpenMessages={onOpenMessages}
      onLogoClick={onLogoClick}
    />
  );
}
