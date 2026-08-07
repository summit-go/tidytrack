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

export function TaskCard({ task, isActive, onStop, onResume, onAddPhoto }) {
  useTick(isActive);
  const elapsed = task.end_time
    ? new Date(task.end_time).getTime() - new Date(task.start_time).getTime()
    : Date.now() - new Date(task.start_time).getTime();
  const photos = task.photos || [];
  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");
  const damage = photos.filter((p) => p.kind === "damage");
  const cannot = photos.filter((p) => p.kind === KIND_CANNOT);
  const isDone = !!task.end_time;
  return (
    <div
      className={`rounded-2xl p-4 border-2 transition-all ${isActive ? "border-amber-300 bg-amber-50/50" : "border-stone-200 bg-white"}`}
      style={{ touchAction: "manipulation" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1 flex-wrap">
            {isDone && (
              <Check
                size={14}
                className="text-emerald-600 flex-shrink-0 mt-1.5"
              />
            )}
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse flex-shrink-0 mt-2.5" />
            )}
            {(() => {
              // Multi-item task → compact headline; the full list lives in a
              // scrollable dropdown below (see ItemsDropdown) so it doesn't
              // fill the card. Single-item tasks render the plain name.
              const parts = splitTaskName(task.name);
              if (parts.length > 1) {
                const head = task.category
                  ? taskCategoryShortLabel(task.category, task.subcategory)
                  : `${parts.length} items`;
                return (
                  <span className="font-serif text-lg text-stone-900 truncate">
                    {head}
                  </span>
                );
              }
              return (
                <span className="font-serif text-lg text-stone-900 truncate">
                  {task.name}
                </span>
              );
            })()}
            {damage.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                ⚠ {damage.length}
              </span>
            )}
            {cannot.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 flex-shrink-0">
                ⚠ {cannot.length} blocked
              </span>
            )}
          </div>
          {task.category && (
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
              {taskCategoryShortLabel(task.category, task.subcategory)}
            </div>
          )}
          <div className="text-xs text-stone-500 font-mono">
            {fmtClock(task.start_time)}
            {task.end_time && ` — ${fmtClock(task.end_time)}`} ·{" "}
            {fmtTimeShort(elapsed)}
          </div>
          {/* Multi-item list as a compact scrollable dropdown (active + done). */}
          {(() => {
            const parts = splitTaskName(task.name);
            return parts.length > 1 ? <ItemsDropdown items={parts} /> : null;
          })()}
        </div>
        {isDone ? (
          <button
            onClick={onResume}
            style={{ touchAction: "manipulation" }}
            aria-label="Reopen this task"
            className="ml-2 h-9 px-4 rounded-full bg-stone-100 text-stone-700 text-sm font-medium active:scale-95 transition-transform"
          >
            Reopen task
          </button>
        ) : (
          <button
            onClick={onStop}
            style={{ touchAction: "manipulation" }}
            className="ml-2 px-4 py-2.5 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Pause size={14} /> Done
          </button>
        )}
      </div>
      {/* Spacer so the Done button is well-separated from the photo grid below — prevents ghost taps on iOS */}
      <div className="mt-2">
        <button
          onClick={() => onAddPhoto(null)}
          style={{ touchAction: "manipulation" }}
          className="w-full px-3 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Camera size={15} /> Add photo
          {before.length + after.length + damage.length + cannot.length > 0 && (
            <span className="text-stone-300 font-mono">
              ({before.length + after.length + damage.length + cannot.length})
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
