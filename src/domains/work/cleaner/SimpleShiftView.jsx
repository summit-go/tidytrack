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
import { ActiveWorkblockCard } from "./ActiveWorkblockCard.jsx";
import { CleanerMenuSheet } from "../../../apps/internal/cleaner/CleanerMenuSheet.jsx";
import { TaskCard } from "./TaskCard.jsx";
import { TaskCategoryPicker } from "./TaskCategoryPicker.jsx";

export function SimpleShiftView({
  shift,
  tasks,
  activeTask,
  employeeName,
  employee,
  onSignOut,
  onClockOut,
  onSwitchProperty,
  onAttachProperty,
  newTaskName,
  setNewTaskName,
  onStartTask,
  onStartTasksFromPicker,
  onStartChecklistItems,
  onReleaseTargets,
  onStopTask,
  onResumeTask,
  onAddPhoto,
  photoModal,
  onClosePhotoModal,
  onUploadPhoto,
  onChangePhotoKind,
  onSavePhotoNote,
  onDeletePhoto,
  onOpenMessages,
  onOpenChangePin,
  busy,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [taskInputMode, setTaskInputMode] = useState("picker"); // 'picker' | 'custom'
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();
  const activeTaskObj = tasks.find((t) => t.id === activeTask);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header
        name={employeeName}
        onSignOut={onSignOut}
        role={employee?.role}
        cleanerView
        employee={employee}
        onOpenMessages={onOpenMessages}
      />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">
              On the clock
            </div>
            <div className="text-3xl font-mono font-light tracking-tight">
              {fmtTime(elapsed)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button
              onClick={onClockOut}
              disabled={busy}
              className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <LogOut size={14} /> Clock out
            </button>
            <button
              onClick={() => setShowMenu(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <Menu size={12} /> More
            </button>
          </div>
        </div>
        {shift.customer?.name ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
            <Building2 size={11} /> {shift.customer.name}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono italic">
            No property selected
          </div>
        )}
        {shift.customer?.address && (
          <div className="mt-1 text-xs text-stone-300">
            <AddressLink
              address={shift.customer.address}
              className="text-stone-300"
            />
          </div>
        )}
        {(shift.customer?.bedrooms != null ||
          shift.customer?.bathrooms != null) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {shift.customer.bedrooms != null && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-700 text-stone-200 font-mono">
                {shift.customer.bedrooms} bed
              </span>
            )}
            {shift.customer.bathrooms != null && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-700 text-stone-200 font-mono">
                {shift.customer.bathrooms} bath
              </span>
            )}
          </div>
        )}
        <div className="mt-1 text-xs text-stone-400 font-mono">
          Started {fmtClock(shift.start_time)} · {tasks.length}{" "}
          {tasks.length === 1 ? "task" : "tasks"}
        </div>
      </div>

      {shift.customer_id && (
        <AssignmentBanner
          propertyId={shift.customer_id}
          unitId={null}
          partyId={null}
          employee={employee}
        />
      )}

      {activeTaskObj && (
        <ActiveWorkblockCard
          task={activeTaskObj}
          onStop={() => onStopTask(activeTaskObj.id)}
          onAddPhoto={(kind) => onAddPhoto(activeTaskObj.id, kind)}
        />
      )}

      <div className="mx-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            Start a new task
          </label>
          <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-full">
            <button
              onClick={() => setTaskInputMode("picker")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors ${taskInputMode === "picker" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              Quick
            </button>
            <button
              onClick={() => setTaskInputMode("custom")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors ${taskInputMode === "custom" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
            >
              Custom
            </button>
          </div>
        </div>

        {taskInputMode === "picker" ? (
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <TaskCategoryPicker
              busy={busy}
              onStartOne={(name, category, subcategory) =>
                onStartTask(name, category, subcategory)
              }
              onStartMany={onStartTasksFromPicker}
              onStartChecklistItems={onStartChecklistItems}
              onReleaseTargets={onReleaseTargets}
              customerId={shift.customer_id}
              employee={employee}
              defaultName={newTaskName}
              setDefaultName={setNewTaskName}
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="e.g. Master bathroom, Kitchen…"
              className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
              onKeyDown={(e) => e.key === "Enter" && onStartTask()}
            />
            <button
              onClick={() => onStartTask()}
              disabled={!newTaskName.trim()}
              className="px-4 rounded-xl bg-stone-900 text-stone-50 disabled:opacity-30 active:scale-95 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="mx-4 mt-6">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
          Today's tasks
        </div>
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No tasks yet.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks
              // Active task is already rendered at the top of the
              // screen with its photo buttons — skip it here so the
              // cleaner doesn't see it twice. The list below shows
              // paused / done tasks only.
              .filter((t) => t.id !== activeTask)
              .map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  isActive={false}
                  onStop={() => onStopTask(t.id)}
                  onResume={() => onResumeTask(t.id)}
                  onAddPhoto={(kind) => onAddPhoto(t.id, kind)}
                />
              ))}
          </div>
        )}
      </div>

      {photoModal && (
        <PhotoModal
          kind={photoModal.kind}
          taskName={tasks.find((t) => t.id === photoModal.taskId)?.name}
          existing={(
            tasks.find((t) => t.id === photoModal.taskId)?.photos || []
          ).filter((p) => !p.deleted_at)}
          employee={employee}
          onDeletePhoto={
            onDeletePhoto
              ? (photoId) => onDeletePhoto(photoId, photoModal.taskId)
              : null
          }
          onUpload={(file, chosenKind) =>
            onUploadPhoto(
              photoModal.taskId,
              chosenKind || photoModal.kind,
              file,
            )
          }
          onChangeKind={
            onChangePhotoKind
              ? (photoId, newKind) =>
                  onChangePhotoKind(photoId, photoModal.taskId, newKind)
              : null
          }
          onSaveNote={onSavePhotoNote}
          onClose={onClosePhotoModal}
        />
      )}
      {showMenu && (
        <CleanerMenuSheet
          employee={employee}
          shift={shift}
          onClose={() => setShowMenu(false)}
          onAttachProperty={
            !shift.customer_id && onAttachProperty
              ? () => {
                  setShowMenu(false);
                  onAttachProperty();
                }
              : null
          }
          onSwitchProperty={
            shift.customer_id && onSwitchProperty
              ? () => {
                  setShowMenu(false);
                  onSwitchProperty();
                }
              : null
          }
          onChangePin={
            onOpenChangePin
              ? () => {
                  setShowMenu(false);
                  onOpenChangePin();
                }
              : null
          }
          onOpenMessages={
            onOpenMessages
              ? () => {
                  setShowMenu(false);
                  onOpenMessages();
                }
              : null
          }
          onSignOut={() => {
            setShowMenu(false);
            onSignOut && onSignOut();
          }}
        />
      )}
    </div>
  );
}
