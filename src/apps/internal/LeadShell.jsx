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
  migrateLeadPersistenceKeys,
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
  isoToLocalInput,
  localInputToISO,
  shiftBillableAmount,
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
  readPhotoTakenAt,
  sharePhotos,
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
import { resolveItemLabel } from "../../lib/pickerLabels.js";
import { generatePortalUserCode } from "../../lib/portal.js";
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
import { DailyView } from "../../domains/work/daily/DailyView.jsx";
import { LeadDashboard } from "../../domains/work/dashboard/LeadDashboard.jsx";
import { EmployeeAdmin } from "./lead/team/EmployeeAdmin.jsx";
import { PropertyAdmin } from "../../domains/properties/admin/PropertyAdmin.jsx";
import { AssignmentsTab } from "../../domains/work/assignments/AssignmentsTab.jsx";
import { MoneyView } from "../../domains/billing/lead/MoneyView.jsx";
import { EmployeeApp } from "./cleaner/EmployeeApp.jsx";
import { StaffMessagesTab } from "../../features/messaging/StaffMessagesTab.jsx";
import { PortalApp } from "../client/PortalApp.jsx";

export function LeadShell({ employee, onSignOut }) {
  useEffect(() => {
    migrateLeadPersistenceKeys(employee?.id);
  }, [employee?.id]);
  // Persist the active tab in localStorage so an accidental refresh
  // brings the user back to where they were (Assignments, Properties,
  // etc) instead of always dumping them on Daily.
  const [tab, setTab] = usePagePersistence(
    `lead_tab_${employee.id}`,
    "daily",
  );
  const [showMessages, setShowMessages] = useState(false);
  // "Preview as cleaner" mode — owner can browse the cleaner UI as
  // themselves (replaces the need for a dummy "Beta" account). All
  // their actions in this mode go to the database under their own
  // employee record, just like a normal cleaner shift. They can
  // exit any time via the banner.
  // Persisted to localStorage (keyed per employee) so a browser refresh
  // while the owner is previewing the cleaner/PM side keeps them there,
  // rather than snapping back to the manager view every reload.
  const [previewMode, setPreviewMode] = usePagePersistence(
    `lead_preview_cleaner_${employee.id}`,
    false,
  );
  const showMoneyTabs = canSeeMoney(employee); // owner or view_pay_info
  const isOwner = employee?.role === "owner";
  // Owner "hats": Operations (cleaning side) vs Business (management).
  // Reshapes the bottom nav so each mode only shows its own tabs.
  // Managers keep the flat nav.
  const [mode, setMode] = usePagePersistence(
    `lead_mode_${employee.id}`,
    "ops",
  ); // 'ops' | 'business'
  const [pmPreview, setPmPreview] = usePagePersistence(
    `lead_preview_pm_${employee.id}`,
    false,
  );
  // Cleaner-preview and PM-preview are mutually exclusive. If a stale
  // localStorage from an interrupted session ever had both set, let
  // cleaner-preview win (it renders first below) and clear the other.
  useEffect(() => {
    if (previewMode && pmPreview) setPmPreview(false);
    /* eslint-disable-next-line */
  }, []);
  const switchMode = (m) => {
    setMode(m);
    if (m === "ops" && !["daily", "dashboard", "assignments"].includes(tab))
      setTab("daily");
    if (m === "business" && !["props", "money", "team"].includes(tab))
      setTab("props");
  };
  // Keep the active tab valid for the current mode (handles stale
  // persisted tabs after a refresh).
  useEffect(() => {
    if (!isOwner) return;
    if (mode === "ops" && !["daily", "dashboard", "assignments"].includes(tab))
      setTab("daily");
    if (mode === "business" && !["props", "money", "team"].includes(tab))
      setTab("props");
    /* eslint-disable-next-line */
  }, [mode, isOwner]);

  // If a manager somehow lands on the money tab (e.g. via stale state), bounce them home
  useEffect(() => {
    if (!showMoneyTabs && tab === "money") setTab("daily");
  }, [showMoneyTabs, tab]);

  // Tab count: managers get 5 (no Money), owners get 6.
  const colCount = showMoneyTabs ? 6 : 5;
  const openMessages = () => setShowMessages(true);
  const goHome = () => setTab("daily");

  // Exiting preview mode: gracefully close any open preview-mode shift
  // / work_block so we don't leave dangling rows. They're flagged
  // is_preview so reports already ignore them, but cleaning them up
  // keeps the DB tidy and avoids the next preview session "resuming"
  // the stale one.
  const exitPreviewMode = async () => {
    try {
      const ts = new Date().toISOString();
      const { data: openShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("is_preview", true)
        .is("end_time", null);
      if (openShifts && openShifts.length > 0) {
        const ids = openShifts.map((s) => s.id);
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in("shift_id", ids)
          .is("end_time", null);
        await supabase.from("shifts").update({ end_time: ts }).in("id", ids);
      }
    } catch (e) {
      console.warn("[exitPreviewMode] cleanup failed", e);
    }
    setPreviewMode(false);
  };

  // Preview mode: render the cleaner-side EmployeeApp with a sticky
  // banner that lets the owner return to the manager view. In preview
  // mode every write (shift, work_block, task, photo) carries
  // is_preview=true so reports, payroll, and the live-cleaners sheet
  // filter the noise out.
  if (previewMode) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="bg-amber-600 text-white px-3 py-1 text-[10px] font-mono flex items-center justify-between gap-2 sticky top-0 z-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <Eye size={11} className="flex-shrink-0" />
            <span className="font-bold">Preview · cleaner</span>
            <span className="text-white/70 truncate hidden sm:inline">
              — doesn't affect reports
            </span>
          </div>
          <button
            onClick={exitPreviewMode}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 flex-shrink-0"
          >
            Exit
          </button>
        </div>
        <EmployeeApp
          employee={employee}
          previewMode={true}
          onSignOut={exitPreviewMode}
        />
      </div>
    );
  }

  // Owner "Preview as PM" — renders the portal as a synthetic PM.
  if (pmPreview) {
    return (
      <PortalApp
        previewMode
        previewEmployee={employee}
        onExitPreview={() => setPmPreview(false)}
      />
    );
  }

  // Messages takes over the whole screen as an overlay
  if (showMessages) {
    return (
      <StaffMessagesTab
        employee={employee}
        onClose={() => setShowMessages(false)}
      />
    );
  }

  return (
    <PreviewContext.Provider
      value={{
        onPreview: () => setPreviewMode(true),
        isOwner: employee?.role === "owner",
      }}
    >
      <div className="min-h-screen bg-stone-50">
        {tab === "daily" && (
          <DailyView
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "dashboard" && (
          <LeadDashboard
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "team" && (
          <EmployeeAdmin
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "props" && (
          <PropertyAdmin
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {tab === "assignments" && (
          <AssignmentsTab
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}
        {showMoneyTabs && tab === "money" && (
          <MoneyView
            employee={employee}
            onSignOut={onSignOut}
            onOpenMessages={openMessages}
            onLogoClick={goHome}
          />
        )}

        {/* Spacer so the two-row owner nav doesn't cover the last content. */}
        {isOwner && <div aria-hidden className="h-20 print:hidden" />}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-1 py-2 z-30 print:hidden">
          {isOwner ? (
            <div className="max-w-md mx-auto">
              {/* Operations / Business hat toggle — color-coded so the two
               modes read as distinct contexts, matching their nav tabs. */}
              <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-2">
                <button
                  onClick={() => switchMode("ops")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium ${mode === "ops" ? "bg-stone-900 text-white shadow-sm" : "text-stone-500"}`}
                >
                  Operations
                </button>
                <button
                  onClick={() => switchMode("business")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium ${mode === "business" ? "bg-amber-700 text-white shadow-sm" : "text-stone-500"}`}
                >
                  Business
                </button>
              </div>
              {mode === "ops" ? (
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                >
                  <TabButton
                    tone="ops"
                    active={tab === "daily"}
                    onClick={() => setTab("daily")}
                    icon={<Calendar size={18} />}
                    label="Daily"
                  />
                  <TabButton
                    tone="ops"
                    active={tab === "assignments"}
                    onClick={() => setTab("assignments")}
                    icon={<FileText size={18} />}
                    label="Assignments"
                  />
                  <TabButton
                    tone="ops"
                    active={tab === "dashboard"}
                    onClick={() => setTab("dashboard")}
                    icon={<LayoutDashboard size={18} />}
                    label="Shifts"
                  />
                  <TabButton
                    tone="ops"
                    active={false}
                    onClick={() => setPreviewMode(true)}
                    icon={<Eye size={18} />}
                    label="Cleaner view"
                  />
                </div>
              ) : (
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${showMoneyTabs ? 4 : 3}, minmax(0, 1fr))`,
                  }}
                >
                  <TabButton
                    tone="business"
                    active={tab === "props"}
                    onClick={() => setTab("props")}
                    icon={<Building2 size={18} />}
                    label="Properties"
                  />
                  {showMoneyTabs && (
                    <TabButton
                      tone="business"
                      active={tab === "money"}
                      onClick={() => setTab("money")}
                      icon={<DollarSign size={18} />}
                      label="Money"
                    />
                  )}
                  <TabButton
                    tone="business"
                    active={tab === "team"}
                    onClick={() => setTab("team")}
                    icon={<TeamClockIcon size={18} />}
                    label="Team"
                  />
                  <TabButton
                    tone="business"
                    active={false}
                    onClick={() => setPmPreview(true)}
                    icon={<Eye size={18} />}
                    label="PM view"
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              className="max-w-md mx-auto grid gap-0.5"
              style={{
                gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              }}
            >
              <TabButton
                active={tab === "daily"}
                onClick={() => setTab("daily")}
                icon={<Calendar size={18} />}
                label="Daily"
              />
              <TabButton
                active={tab === "dashboard"}
                onClick={() => setTab("dashboard")}
                icon={<LayoutDashboard size={18} />}
                label="Shifts"
              />
              <TabButton
                active={tab === "team"}
                onClick={() => setTab("team")}
                icon={<TeamClockIcon size={18} />}
                label="Team"
              />
              <TabButton
                active={tab === "props"}
                onClick={() => setTab("props")}
                icon={<Building2 size={18} />}
                label="Properties"
              />
              <TabButton
                active={tab === "assignments"}
                onClick={() => setTab("assignments")}
                icon={<FileText size={18} />}
                label="Assignments"
              />
            </div>
          )}
        </div>
      </div>
    </PreviewContext.Provider>
  );
}
