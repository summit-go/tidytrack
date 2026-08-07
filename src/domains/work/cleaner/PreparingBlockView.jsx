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
import { AssignmentWorkHistory } from "./AssignmentWorkHistory.jsx";
import { BlockView } from "./BlockView.jsx";
import { InlineBedroomTasks } from "./InlineBedroomTasks.jsx";
import { OtherWorkblocksHere } from "./OtherWorkblocksHere.jsx";

export function PreparingBlockView({
  shift,
  pendingStart,
  employeeName,
  employee,
  onSignOut,
  onCancel,
  onStart,
  onSendBackToPending,
  onReopen,
  onOpenMessages,
  onOpenBedroomHistory,
  onJoinBlock,
  onExit,
  busy,
}) {
  const handleLogoClick = () => onCancel();

  // Load priority + cleaning types for this bedroom's open assignments
  // so the chips show in the prep-screen header — same visual language
  // as BlockView.
  const [bedroomContext, setBedroomContext] = useState({
    priority: false,
    types: [],
  });
  useEffect(() => {
    if (!pendingStart?.unitId || !pendingStart?.partyId) {
      setBedroomContext({ priority: false, types: [] });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("assignment_targets")
        .select(
          "priority, assignment:assignments!inner(assignment_type, active)",
        )
        .eq("unit_id", pendingStart.unitId)
        .eq("party_id", pendingStart.partyId)
        .not("status", "in", "(done,blocked)");
      const open = (data || []).filter((t) => t.assignment?.active);
      const hasPriority = open.some((t) => t.priority);
      const types = [
        ...new Set(
          open.map((t) => t.assignment?.assignment_type).filter(Boolean),
        ),
      ];
      setBedroomContext({ priority: hasPriority, types });
    })();
  }, [pendingStart?.unitId, pendingStart?.partyId]);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <ScreenId id="CL-D" />
      <Header
        name={employeeName}
        onSignOut={onSignOut}
        role={employee?.role}
        cleanerView
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={handleLogoClick}
      />
      {/* Cleaner has navigated to a specific bedroom. They've chosen the
         property + assignment. They're about to claim items / start
         working. Tapping Property or Assignment goes back. */}
      <CleanerProgressBar
        segments={[
          { label: "Assignment", filled: true, onClick: onCancel },
          { label: "Items", filled: false, isCurrent: true },
          { label: "Working", filled: false },
          { label: "Complete", filled: false },
        ]}
        inActiveWork={false}
      />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <button
            onClick={onCancel}
            title="Back"
            className="p-2 rounded-full bg-white text-stone-900 active:scale-95 transition"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
        <div className="text-xs uppercase tracking-widest text-amber-400 font-mono">
          Ready to start
        </div>
        {/* Property name, prominent — so a cleaner who just switched here
           knows exactly which property they're at. */}
        {shift?.customer?.name && (
          <div className="flex items-center gap-1.5 text-sm text-amber-300 font-mono mt-0.5 mb-1">
            <Building2 size={13} /> {shift.customer.name}
          </div>
        )}
        <div className="font-serif text-2xl text-stone-50 leading-tight">
          {pendingStart.unitLabel}
          {partyDisplay(pendingStart.partyLabel) && (
            <>
              {" "}
              ·{" "}
              <span className="italic text-amber-400">
                {partyDisplay(pendingStart.partyLabel)}
              </span>
            </>
          )}
        </div>
        {(bedroomContext.priority || bedroomContext.types.length > 0) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <PriorityChip on={bedroomContext.priority} />
            {bedroomContext.types.map((typ) => (
              <AssignmentTypeChip key={typ} type={typ} />
            ))}
          </div>
        )}
        {/* No timer yet — make it explicit so they know the clock isn't running */}
        <div className="mt-2 text-xs font-mono text-stone-400">
          Clock not started yet
        </div>
      </div>

      <div className="px-5 pt-6">
        {/* OtherWorkblocksHere removed from this view per user request —
           the Join card should only show inside the cleaner's active
           workblock (BlockView), not on the "ready to start" screen.
           The Items step in the progress bar is for picking what
           you'll clean, not for jumping into someone else's session. */}

        {/* Readiness reminders — NOT a checklist to tick, just a calm
           pre-flight so the cleaner is safe, stocked, at the RIGHT
           bedroom, and announces themselves on entry. The clock isn't
           running yet, so there's no pressure. */}
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 mb-4">
          <div className="text-sm font-medium text-stone-900 mb-2">
            Before you start
            {unitPartyLabel(pendingStart.unitLabel, pendingStart.partyLabel) ? (
              <>
                {" "}
                — heading to{" "}
                <span className="text-amber-800">
                  {unitPartyLabel(
                    pendingStart.unitLabel,
                    pendingStart.partyLabel,
                  )}
                </span>
              </>
            ) : (
              ""
            )}
          </div>
          <ul className="space-y-2 text-xs text-stone-700">
            <li className="flex items-start gap-2">
              <Check
                size={13}
                className="text-amber-700 flex-shrink-0 mt-0.5"
              />
              <span>
                Grab your supplies and anything special this job needs.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check
                size={13}
                className="text-amber-700 flex-shrink-0 mt-0.5"
              />
              <span>
                Double-check you're at the right bedroom
                {pendingStart.unitLabel ? (
                  <>
                    {" "}
                    — <strong>{pendingStart.unitLabel}</strong>
                  </>
                ) : (
                  ""
                )}
                {partyDisplay(pendingStart.partyLabel) ? (
                  <>
                    , <strong>{partyDisplay(pendingStart.partyLabel)}</strong>
                  </>
                ) : (
                  ""
                )}
                .
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check
                size={13}
                className="text-amber-700 flex-shrink-0 mt-0.5"
              />
              <span>
                Knock and announce yourself — say your name and that you're here
                to clean.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check
                size={13}
                className="text-amber-700 flex-shrink-0 mt-0.5"
              />
              <span>Watch your footing and handle any hazards safely.</span>
            </li>
          </ul>
        </div>

        {/* Assignment card for this bedroom, with "Start cleaning" attached
           to it (passed as onStartCleaning) so the primary action sits with
           the job it starts. */}
        <AssignmentBanner
          propertyId={shift.customer_id}
          unitId={pendingStart.unitId}
          partyId={pendingStart.partyId}
          employee={employee}
          workScreen
          onStartCleaning={onStart}
        />

        {/* 3: the task list shown INLINE so the cleaner sees exactly what
           they'll clean without opening a separate quick-glance screen. */}
        <InlineBedroomTasks
          propertyId={shift.customer_id}
          unitId={pendingStart.unitId}
          partyId={pendingStart.partyId}
          employee={employee}
        />

        {/* What's already happened here — including anyone working it
           right now, with their photos. You should never have to start a
           clock just to find out whether a bedroom is half done. */}
        <AssignmentWorkHistory
          propertyId={shift.customer_id}
          unitId={pendingStart.unitId}
          partyId={pendingStart.partyId}
          employee={employee}
          onReopen={onReopen}
        />
      </div>
    </div>
  );
}
