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
  isLead,
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

export function PortalMenuSheet({
  portalUser,
  property,
  hasMultipleProperties,
  portalKind,
  isPmStaff,
  onClose,
  onSwitchProperty,
  onShowWelcome,
  onChangeCode,
  onShowTeam,
  onSignOut,
}) {
  const kindLabel =
    portalKind === "property_owner"
      ? "Property Owner"
      : portalKind === "pm_staff"
        ? "PM Staff"
        : "Property Manager";

  const Item = ({ icon: Icon, label, hint, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`w-full px-4 py-4 flex items-center gap-3 active:bg-stone-100 text-left border-b border-stone-100 last:border-b-0 ${danger ? "text-red-700" : "text-stone-900"}`}
    >
      <Icon size={18} className={danger ? "text-red-600" : "text-stone-500"} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-xs text-stone-500 truncate">{hint}</div>}
      </div>
      <ChevronRight size={16} className="text-stone-400" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-900/60" onClick={onClose} />
      {/* Sheet */}
      <div className="relative bg-stone-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        {/* Header — identifies who's signed in */}
        <div className="px-5 py-4 border-b border-stone-200 bg-white">
          <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
            Signed in as
          </div>
          <div className="font-serif text-lg text-stone-900 truncate">
            {portalUser?.name || "Portal user"}
          </div>
          <div className="text-xs text-stone-500 font-mono">{kindLabel}</div>
          {property && (
            <div className="mt-2 pt-2 border-t border-stone-100 text-xs text-stone-600 flex items-center gap-1.5">
              <Building2 size={12} className="text-amber-700" />
              Viewing: <span className="font-medium">{property.name}</span>
            </div>
          )}
        </div>

        {/* Menu items */}
        <div className="bg-white">
          {hasMultipleProperties && (
            <Item
              icon={Layers}
              label="Switch property"
              hint="Pick a different property in your portfolio"
              onClick={onSwitchProperty}
            />
          )}
          {portalKind === "property_owner" && (
            <Item
              icon={Users}
              label="Property team"
              hint="See & manage PMs on this property"
              onClick={onShowTeam}
            />
          )}
          <Item
            icon={HelpCircle}
            label="How this works"
            hint="Quick overview of the portal"
            onClick={onShowWelcome}
          />
          {!isPmStaff && portalUser && !portalUser._legacy && (
            <Item
              icon={Settings}
              label="Change my code"
              hint="Update your portfolio access code"
              onClick={onChangeCode}
            />
          )}
          <Item icon={LogOut} label="Sign out" danger onClick={onSignOut} />
        </div>

        {/* Footer cancel */}
        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-mono text-stone-500 hover:bg-stone-100 border-t border-stone-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
