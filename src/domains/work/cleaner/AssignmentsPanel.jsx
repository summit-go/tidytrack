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
  fetchAllPages,
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
  localTodayStart,
  localTodayStartISO,
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
import { isVisibleAssignmentTarget, assignmentKeyFromTarget, dominantAssignmentStatus } from "../../../lib/assignments.js";
import { useAssignmentStatusCounts } from "../hooks/useAssignmentStatusCounts.js";
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
import { AssignmentTabContent } from "../cross-cutting/AssignmentTabContent.jsx";

export function AssignmentsPanel({
  propertyId,
  employee,
  refreshKey,
  onGoToBedroom,
  onOpenBedroomHistory,
  onJoinBlock,
}) {
  const [tab, setTab] = useState("pending");
  const { counts, reload: reloadCounts } = useAssignmentStatusCounts({
    propertyId,
    employeeId: employee?.id,
    refreshKey,
  });

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
        onUpdate={reloadCounts}
        onGoToBedroom={onGoToBedroom}
        onOpenBedroomHistory={onOpenBedroomHistory}
        onJoinBlock={onJoinBlock}
      />
    </div>
  );
}
