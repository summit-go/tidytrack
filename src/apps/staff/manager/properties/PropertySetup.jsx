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
} from "../../../../lib/supabase.js";
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";

export function PropertySetup({
  property,
  onDone,
  onAssignPortalUsers,
  onAddUnits,
  onEditProperty,
}) {
  const isMulti = property.property_type === "multi_unit";
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="px-5 py-4 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-2 text-xs text-emerald-700 font-mono uppercase tracking-wider mb-1">
          <Check size={12} /> Property created
        </div>
        <h1 className="font-serif text-2xl text-stone-900 truncate">
          {property.name}
        </h1>
        {property.address && (
          <div className="text-sm text-stone-500 mt-0.5">
            <AddressLink address={property.address} />
          </div>
        )}
      </div>

      <div className="px-5 pt-6 space-y-4 max-w-xl mx-auto">
        <div className="text-sm text-stone-600 mb-2">
          Now let's set this property up. You can skip any step and come back to
          it later.
        </div>

        {/* Card 1: Assign portal users */}
        <button
          onClick={onAssignPortalUsers}
          className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-amber-500 active:scale-[0.99] transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <UserPlus size={18} className="text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg text-stone-900">
                Assign portal users
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                Who owns or manages this property? Give them access to the PM
                portal so they can communicate, upload assignments, and see
                work.
              </div>
              <div className="text-[11px] uppercase tracking-wider font-mono text-amber-700 mt-2">
                Optional · recommended
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-stone-400 flex-shrink-0 mt-1"
            />
          </div>
        </button>

        {/* Card 2: Add units */}
        <button
          onClick={onAddUnits}
          className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-amber-500 active:scale-[0.99] transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-stone-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg text-stone-900">
                {isMulti ? "Build out units" : "Add details"}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                {isMulti
                  ? "Bulk-create apartments in a grid, import a townhome list from CSV, or add individual units."
                  : "Simple property — you can skip this. If it has multiple structures or specific units to track, add them here."}
              </div>
              <div className="text-[11px] uppercase tracking-wider font-mono text-stone-600 mt-2">
                {isMulti
                  ? "Strongly recommended for multi-unit"
                  : "Optional for simple properties"}
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-stone-400 flex-shrink-0 mt-1"
            />
          </div>
        </button>

        {/* Card 3: Edit basics */}
        <button
          onClick={onEditProperty}
          className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 active:scale-[0.99] transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
              <Edit2 size={16} className="text-stone-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg text-stone-900">
                Edit property details
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                Update name, address, bill rate, notes, or other property info.
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-stone-400 flex-shrink-0 mt-1"
            />
          </div>
        </button>

        <div className="pt-2">
          <button
            onClick={onDone}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-stone-300 text-stone-600 text-sm hover:border-stone-500 active:scale-[0.99] transition-all"
          >
            I'll set this up later — back to properties
          </button>
        </div>
      </div>
    </div>
  );
}
