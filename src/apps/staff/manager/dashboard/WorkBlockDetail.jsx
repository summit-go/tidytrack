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
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
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
import { TaskDetail } from "../dashboard/TaskDetail.jsx";
import { WorkBlockAssignmentLink } from "../../../cross-cutting/WorkBlockAssignmentLink.jsx";

export function WorkBlockDetail({
  block,
  rate,
  showMoney,
  canEdit,
  onEdit,
  onDelete,
  onMove,
  propertyId,
  onOpenBedroomHistory,
  employee,
}) {
  const dur =
    (block.end_time ? new Date(block.end_time) : new Date()) -
    new Date(block.start_time);
  const blockRate = block.bill_rate_at_work || rate || 0;
  const billable = block.end_time ? (dur / 1000 / 3600) * blockRate : 0;
  return (
    <div className="p-4 rounded-2xl bg-white border border-stone-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg text-stone-900">
            {block.unit?.label} ·{" "}
            <span className="italic text-amber-700">{block.party?.label}</span>
          </div>
          {block.party?.full_name && (
            <div className="text-xs text-stone-500">
              {block.party.full_name}
            </div>
          )}
          <div className="text-xs text-stone-500 font-mono mt-1">
            {fmtClock(block.start_time)}
            {block.end_time && ` — ${fmtClock(block.end_time)}`} ·{" "}
            {fmtTimeShort(dur)}
          </div>
        </div>
        {showMoney && billable > 0 && (
          <div className="text-right ml-2">
            <div className="font-mono text-sm text-emerald-700 font-medium">
              {fmtMoney(billable)}
            </div>
          </div>
        )}
      </div>
      {propertyId && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <WorkBlockAssignmentLink
            block={block}
            propertyId={propertyId}
            employee={employee}
            compact
          />
          {onOpenBedroomHistory && block.unit?.id && block.party?.id && (
            <button
              onClick={() =>
                onOpenBedroomHistory({
                  unitId: block.unit.id,
                  unitLabel: block.unit.label,
                  partyId: block.party.id,
                  partyLabel: block.party.label,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-mono active:scale-95"
            >
              <Clock size={10} /> Bedroom history
            </button>
          )}
        </div>
      )}
      {block.work_notes && (
        <div className="text-xs text-stone-600 italic mt-2">
          "{block.work_notes}"
        </div>
      )}
      {block.tasks?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
          {block.tasks.map((t) => (
            <TaskDetail key={t.id} task={t} compact employee={employee} />
          ))}
        </div>
      )}
      {canEdit && (onEdit || onDelete || onMove) && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2 flex-wrap">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <Edit2 size={12} /> Edit times
            </button>
          )}
          {onMove && (
            <button
              onClick={onMove}
              className="flex-1 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <ChevronRight size={12} /> Move bedroom
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-1 py-2 rounded-xl border border-red-200 text-red-700 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-red-50"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
