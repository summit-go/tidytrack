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

export function SwitchBedroomModal({
  fromUnitLabel,
  fromPartyLabel,
  toUnitLabel,
  toPartyLabel,
  onStay,
  onPause,
  onFinish,
  busy,
}) {
  const from = `${fromUnitLabel || ""}${fromUnitLabel && fromPartyLabel ? " · " : ""}${fromPartyLabel || ""}`;
  const to = `${toUnitLabel || ""}${toUnitLabel && toPartyLabel ? " · " : ""}${toPartyLabel || ""}`;
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="p-5 border-b border-stone-200">
          <div className="font-serif text-xl text-stone-900 mb-1">
            You're still in {from}
          </div>
          <div className="text-sm text-stone-600">
            Switching to <span className="font-bold text-stone-900">{to}</span>{" "}
            will end the work block in {from}. Pick what to do with the items
            you started there.
          </div>
        </div>
        <div className="p-5 space-y-2.5">
          {/* Finish — close the current bedroom out for good */}
          <button
            onClick={onFinish}
            disabled={busy}
            className="w-full p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1">
              <Check size={16} className="text-emerald-700" />
              <span className="font-serif text-base text-stone-900 font-bold">
                Finish in {fromPartyLabel || "this bedroom"}
              </span>
            </div>
            <div className="text-xs text-stone-600">
              Mark every item you started in {from} as complete, end the work
              block, then take me to {to}.
            </div>
          </button>
          {/* Pause — close the block but keep items resumable */}
          <button
            onClick={onPause}
            disabled={busy}
            className="w-full p-4 rounded-2xl border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1">
              <Pause size={16} className="text-blue-700" />
              <span className="font-serif text-base text-stone-900 font-bold">
                Pause and switch
              </span>
            </div>
            <div className="text-xs text-stone-600">
              Pause the items you started in {from} (you can resume them later),
              end the work block, then take me to {to}.
            </div>
          </button>
          {/* Stay — cancel the switch */}
          <button
            onClick={onStay}
            disabled={busy}
            className="w-full p-4 rounded-2xl border-2 border-stone-300 bg-white hover:bg-stone-50 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeft size={16} className="text-stone-700" />
              <span className="font-serif text-base text-stone-900 font-bold">
                Stay in {fromPartyLabel || "this bedroom"}
              </span>
            </div>
            <div className="text-xs text-stone-600">
              Keep working on {from}. Nothing changes.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
