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
import { CleanerMenuSheet } from "./CleanerMenuSheet.jsx";
import { ViewOnlyAssignmentsPanel } from "./ViewOnlyAssignmentsPanel.jsx";

export function ViewOnlyDashboard({
  employee,
  property,
  onSignOut,
  onEndViewing,
  onOpenMessages,
  onOpenBedroomHistory,
  onSwitchProperty,
}) {
  const [showMenu, setShowMenu] = useState(false);
  if (!property) return null;
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        cleanerView
        employee={employee}
        onOpenMessages={onOpenMessages}
      />

      {/* View-only banner */}
      <div className="bg-amber-50 border-y border-amber-200 px-5 py-3 flex items-center gap-2">
        <Eye size={14} className="text-amber-700 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-amber-900">
            View-only mode
          </div>
          <div className="text-[11px] text-amber-700">
            No time is being tracked. To work, sign out and clock in.
          </div>
        </div>
        <button
          onClick={onEndViewing}
          className="px-3 py-1.5 rounded-full bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium flex-shrink-0"
        >
          End viewing
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="bg-stone-900 text-stone-50 px-5 py-5 rounded-2xl mb-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
              Viewing
            </div>
            <div className="font-serif text-2xl truncate">{property.name}</div>
            {property.address && (
              <div className="text-xs text-stone-300 mt-1">
                <AddressLink
                  address={property.address}
                  className="text-amber-400"
                />
              </div>
            )}
          </div>
          <button
            onClick={() => setShowMenu(true)}
            className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium border border-stone-500 active:scale-95 transition flex items-center gap-1.5 flex-shrink-0"
          >
            <Menu size={12} /> More
          </button>
        </div>

        {/* Read-only assignments banner — no start/done buttons */}
        <ViewOnlyAssignmentsPanel
          propertyId={property.id}
          employee={employee}
          onOpenBedroomHistory={onOpenBedroomHistory}
        />
      </div>

      {showMenu && (
        <CleanerMenuSheet
          employee={employee}
          shift={{ customer: property }}
          onClose={() => setShowMenu(false)}
          onSwitchProperty={() => {
            setShowMenu(false);
            onSwitchProperty && onSwitchProperty();
          }}
          onChangePin={null}
          onOpenMessages={null}
          onSignOut={() => {
            setShowMenu(false);
            onSignOut && onSignOut();
          }}
        />
      )}
    </div>
  );
}
