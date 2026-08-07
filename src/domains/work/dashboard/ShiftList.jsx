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

export function ShiftList({ shifts, showMoney, onOpen }) {
  return (
    <div className="px-5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
        Shifts ({shifts.length})
      </div>
      {shifts.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No shifts in this period.
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => {
            const dur = s.end_time
              ? shiftBillableMs(s)
              : new Date() - new Date(s.start_time);
            const rawDur =
              (s.end_time ? new Date(s.end_time) : new Date()) -
              new Date(s.start_time);
            const hasAdjustment =
              (s.idle_seconds || 0) > 0 ||
              (s.manual_adjustment_seconds || 0) !== 0 ||
              s.auto_clocked_out;
            const blockCount = s.work_blocks?.length || 0;
            // Per-shift billable
            let billable = 0;
            if (showMoney && s.end_time) {
              if (s.customer?.property_type === "multi_unit") {
                billable = (s.work_blocks || []).reduce((sum, b) => {
                  if (!b.end_time) return sum;
                  const h =
                    (new Date(b.end_time) - new Date(b.start_time)) /
                    1000 /
                    3600;
                  return (
                    sum +
                    h *
                      (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0)
                  );
                }, 0);
              } else if (s.bill_rate_at_work) {
                billable = shiftBillableHours(s) * s.bill_rate_at_work;
              }
            }
            return (
              <button
                key={s.id}
                onClick={() => onOpen(s)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {!s.end_time && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <span className="font-serif text-lg text-stone-900">
                      {s.employee?.name}
                    </span>
                  </div>
                  <span className="text-xs text-stone-500 font-mono">
                    {fmtDate(s.start_time)}
                  </span>
                </div>
                {s.customer && (
                  <div className="text-xs text-amber-700 font-mono mb-2 flex items-center gap-1.5">
                    <Building2 size={11} /> {s.customer.name}
                    {blockCount > 0 && (
                      <span className="text-stone-500">
                        · {blockCount} {blockCount === 1 ? "block" : "blocks"}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
                  <span>
                    {fmtClock(s.start_time)}{" "}
                    {s.end_time ? `— ${fmtClock(s.end_time)}` : "— active"} ·{" "}
                    {fmtTimeShort(dur)}
                    {hasAdjustment && s.end_time && (
                      <span
                        className="ml-1 text-amber-700"
                        title={`Raw: ${fmtTimeShort(rawDur)}, billable shown after idle/adjustments`}
                      >
                        •
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {showMoney && billable > 0 && (
                      <span className="text-emerald-700 font-medium">
                        {fmtMoney(billable)}
                      </span>
                    )}
                    <ChevronRight size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
