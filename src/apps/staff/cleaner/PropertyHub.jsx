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
import { AssignmentsPanel } from "./AssignmentsPanel.jsx";
import { CleanerBottomNav } from "./CleanerBottomNav.jsx";
import { CleanerMoreExtras } from "./CleanerMoreExtras.jsx";
import { CleanerPropertiesList } from "./CleanerPropertiesList.jsx";
import { CleanerWorkList } from "./CleanerWorkList.jsx";
import { ClosedBlockMenu } from "./ClosedBlockMenu.jsx";
import { FloorFocusList } from "./FloorFocusList.jsx";
import { OthersActivityToday } from "./OthersActivityToday.jsx";
import { TodayApartmentsCard } from "./TodayApartmentsCard.jsx";
import { WhosHerePopup } from "./WhosHerePopup.jsx";
import { YourJobsCard } from "./YourJobsCard.jsx";

export function PropertyHub({
  shift,
  workBlocks,
  employeeName,
  employee,
  onSignOut,
  onClockOut,
  onSwitchProperty,
  onSwitchToJob,
  onStartNew,
  onReopen,
  onEndBlock,
  onGoToBedroom,
  onOpenMessages,
  onOpenChangePin,
  onOpenBedroomHistory,
  onJoinBlock,
  onUndoBlock,
  onMoveBlock,
  cleanerTab: cleanerTabProp,
  setCleanerTab: setCleanerTabProp,
  busy,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showProps, setShowProps] = useState(false); // Properties browser in More
  // Bottom nav tab — Home / Assignments / More. Parent (AuthedShift)
  // controls this when provided so the tab persists across BlockView
  // navigation. Falls back to local state for standalone use.
  const [cleanerTabLocal, setCleanerTabLocal] = useState("home");
  const cleanerTab = cleanerTabProp ?? cleanerTabLocal;
  const setCleanerTab = setCleanerTabProp ?? setCleanerTabLocal;
  // "Today's activity" toggle on Home tab — flips between MY blocks
  // and OTHER cleaners' blocks at this property today.
  const [activityFilter, setActivityFilter] = useState("mine"); // 'mine' | 'others'
  // Block IDs the cleaner has tapped "Pause" on. Banner is hidden for
  // these. Component-local so the banner reappears on next mount or
  // refresh — that's intentional: pausing is a soft dismiss, not a
  // permanent hide. The block is still open in the DB.
  const [dismissedBannerIds, setDismissedBannerIds] = useState(() => new Set());
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();

  // If this cleaner has the upload_assignments capability and tapped the
  // upload button, render the AssignmentForm as a full-screen overlay.
  if (showAssignmentForm) {
    return (
      <AssignmentForm
        property={shift.customer}
        employee={employee}
        onCancel={() => setShowAssignmentForm(false)}
        onSaved={() => setShowAssignmentForm(false)}
      />
    );
  }

  // Persistent "open work block" pill — rendered once at the top of the
  // body and visible across every tab so the cleaner never loses sight
  // of an active workblock when they navigate between Home / Assignments
  // / More. Shows Resume / Pause (soft dismiss) / End block.
  const openBlock = workBlocks.find(
    (b) => !b.end_time && !dismissedBannerIds.has(b.id),
  );
  const persistentPill = openBlock ? (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-100 border-2 border-amber-500 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
          <Play size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-mono text-amber-700">
            Open work block
          </div>
          <div className="text-base font-serif text-amber-900 truncate">
            {openBlock.unit?.label || ""} ·{" "}
            {openBlock.party?.label || "a bedroom"}
          </div>
          <div className="text-[11px] font-mono text-amber-700">
            Started {fmtClock(openBlock.start_time)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onReopen(openBlock)}
          disabled={busy}
          className="py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <Play size={14} /> Resume
        </button>
        <button
          onClick={() =>
            setDismissedBannerIds((prev) => {
              const next = new Set(prev);
              next.add(openBlock.id);
              return next;
            })
          }
          disabled={busy}
          className="py-2.5 rounded-xl bg-white border-2 border-amber-300 text-amber-900 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <Pause size={14} /> Pause
        </button>
        <button
          onClick={() => onEndBlock(openBlock)}
          disabled={busy}
          className="py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <Check size={14} /> End
        </button>
      </div>
    </div>
  ) : null;

  // Quick-view "who's here at this property" popup. Shown from the
  // header button on the right; cleaner can peek without leaving.
  const [whosHereOpen, setWhosHereOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header
        name={employeeName}
        onSignOut={onSignOut}
        role={employee?.role}
        cleanerView
        employee={employee}
        onOpenMessages={onOpenMessages}
        onOpenWhosHere={() => setWhosHereOpen(true)}
      />
      {whosHereOpen && (
        <WhosHerePopup
          propertyId={shift.customer_id}
          propertyName={shift.customer?.name || "this property"}
          myEmployeeId={employee?.id}
          onJoinBlock={onJoinBlock}
          onClose={() => setWhosHereOpen(false)}
        />
      )}
      {/* Global progress bar — visible during the whole cleaner session.
         At PropertyHub the cleaner is on segment 1 (Property). Tapping
         "Property" switches to a different property. Later segments
         aren't yet reachable so they have no onClick handler. */}
      {/* No progress stepper here: on the property overview you haven't
         entered a bedroom's Property→Items→Working→Complete flow yet, so
         the bar showed inert future steps that looked tappable but weren't.
         The bottom nav (My Jobs / Assignments / More) is the real
         navigation. The stepper still appears inside a bedroom's flow. */}
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Building2 size={22} className="text-amber-400 shrink-0" />
              <div className="font-serif text-2xl text-stone-50 leading-tight">
                {shift.customer?.name}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <button
              onClick={onClockOut}
              disabled={busy}
              className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <LogOut size={14} /> Clock out
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-400 font-mono flex-wrap">
          <span className="inline-flex items-center gap-1 text-stone-200">
            <Clock size={11} /> {fmtTime(elapsed)}{" "}
            <span className="text-stone-400 normal-case">clocked in</span>
          </span>
          <span className="text-stone-600">·</span>
          <span>Started {fmtClock(shift.start_time)}</span>
          <span className="text-stone-600">·</span>
          <span>
            {workBlocks.length}{" "}
            {workBlocks.length === 1
              ? "apartment cleaned"
              : "apartments cleaned"}
          </span>
        </div>
      </div>

      {/* Persistent workblock pill — rendered once, visible on every
         tab. Cleaner can navigate freely between tabs without losing
         their active workblock context. */}
      {persistentPill}

      {/* === HOME TAB === */}
      {cleanerTab === "home" && (
        <>
          <ScreenId id="CL-A" />
          {/* Paused / open work blocks — so a cleaner can always get back
             into what they were doing. (An ACTIVE block takes over the
             whole screen, so these are the paused/unfinished ones.) */}
          {/* Paused blocks section hidden for now (kept in code, gated off). */}
          {false && workBlocks.filter((b) => !b.end_time).length > 0 && (
            <div className="px-4 pt-4">
              <div className="text-xs uppercase tracking-wider text-amber-800 font-mono mb-2">
                Working on now
              </div>
              <div className="space-y-2">
                {workBlocks
                  .filter((b) => !b.end_time)
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onReopen && onReopen(b)}
                      disabled={busy}
                      className="w-full text-left p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 active:scale-98 disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <div className="font-serif text-lg text-stone-900 truncate">
                          {unitPartyLabel(b.unit?.label, b.party?.label)}
                        </div>
                        <div className="text-xs text-stone-500 font-mono">
                          Started {fmtClock(b.start_time)} · paused
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1 flex-shrink-0">
                        <Play size={11} /> Resume
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <CleanerWorkList
            employee={employee}
            currentPropertyId={shift.customer_id}
            onGoToBedroom={onGoToBedroom}
            onSwitchProperty={onSwitchProperty}
            onSwitchToJob={onSwitchToJob}
          />
          {false && (
            <>
              {homeView === "today" && (
                <TodayApartmentsCard
                  full
                  propertyId={shift.customer_id}
                  onGoToBedroom={onGoToBedroom}
                />
              )}

              <YourJobsCard
                propertyId={shift.customer_id}
                employeeId={employee?.id}
                onGoToBedroom={onGoToBedroom}
              />

              {homeView === "now" && (
                <>
                  {/* Today's stats card — quick summary of what the cleaner
             has accomplished so far this shift. Always on Home. */}
                  <div className="mx-4 mt-4 p-4 rounded-2xl bg-white border border-stone-200">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      Today so far
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-3xl font-mono font-light text-stone-900">
                          {workBlocks.filter((b) => b.end_time).length}
                        </div>
                        <div className="text-xs text-stone-500">
                          apartments cleaned
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-mono font-light text-stone-900">
                          {fmtTimeShort(elapsed)}
                        </div>
                        <div className="text-xs text-stone-500">
                          on the clock
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Where to clean — current apartment first, then the rest of
             the same building + floor, advancing on its own as bedrooms
             get finished. Replaces the flat apartment list. */}
                  <FloorFocusList
                    propertyId={shift.customer_id}
                    workBlocks={workBlocks}
                    onGoToBedroom={onGoToBedroom}
                  />

                  {/* Today's activity — Mine / Others toggle */}
                  <div className="px-4 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                        Today's activity
                      </div>
                      <div className="inline-flex bg-stone-100 rounded-full p-0.5">
                        <button
                          onClick={() => setActivityFilter("mine")}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activityFilter === "mine" ? "bg-stone-900 text-stone-50" : "text-stone-600"}`}
                        >
                          Mine
                        </button>
                        <button
                          onClick={() => setActivityFilter("others")}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activityFilter === "others" ? "bg-stone-900 text-stone-50" : "text-stone-600"}`}
                        >
                          Others
                        </button>
                      </div>
                    </div>
                    {activityFilter === "mine" ? (
                      workBlocks.length === 0 ? (
                        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                          No work yet. Tap Assignments below to pick a bedroom.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {workBlocks.map((b) => {
                            const dur =
                              (b.end_time ? new Date(b.end_time) : new Date()) -
                              new Date(b.start_time);
                            const photoCount = (b.tasks || []).reduce(
                              (sum, t) => sum + (t.photos?.length || 0),
                              0,
                            );
                            const isDone = !!b.end_time;
                            return (
                              <div
                                key={b.id}
                                className={`rounded-2xl p-4 border ${isDone ? "bg-white border-stone-200" : "bg-amber-50 border-amber-200"}`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      {isDone && (
                                        <Check
                                          size={14}
                                          className="text-emerald-600 flex-shrink-0"
                                        />
                                      )}
                                      <span className="font-serif text-lg text-stone-900 truncate">
                                        {unitPartyLabel(
                                          b.unit?.label,
                                          b.party?.label,
                                        )}
                                      </span>
                                    </div>
                                    <div className="text-xs text-stone-500 font-mono">
                                      {fmtClock(b.start_time)}
                                      {b.end_time &&
                                        ` — ${fmtClock(b.end_time)}`}{" "}
                                      · {fmtTimeShort(dur)}
                                      {(b.tasks?.length > 0 ||
                                        photoCount > 0) && (
                                        <span>
                                          {" "}
                                          · {b.tasks?.length || 0} tasks
                                          {photoCount > 0 &&
                                            `, ${photoCount} photos`}
                                        </span>
                                      )}
                                    </div>
                                    {b.work_notes && (
                                      <div className="text-xs text-stone-600 mt-1 italic">
                                        "{b.work_notes}"
                                      </div>
                                    )}
                                    {onOpenBedroomHistory &&
                                      b.unit?.id &&
                                      b.party?.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenBedroomHistory({
                                              unitId: b.unit.id,
                                              unitLabel: b.unit.label,
                                              partyId: b.party.id,
                                              partyLabel: b.party.label,
                                            });
                                          }}
                                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-mono active:scale-95"
                                        >
                                          <Clock size={10} /> Bedroom history
                                        </button>
                                      )}
                                  </div>
                                  {isDone && (
                                    <div className="ml-2 flex items-center gap-1">
                                      <button
                                        onClick={() => onReopen(b)}
                                        disabled={busy}
                                        className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                      >
                                        <Play size={11} /> Resume
                                      </button>
                                      {(onUndoBlock || onMoveBlock) && (
                                        <ClosedBlockMenu
                                          block={b}
                                          onUndo={
                                            onUndoBlock
                                              ? () => onUndoBlock(b)
                                              : null
                                          }
                                          onMove={
                                            onMoveBlock
                                              ? () => onMoveBlock(b)
                                              : null
                                          }
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <OthersActivityToday
                        propertyId={shift.customer_id}
                        myEmployeeId={employee.id}
                        onOpenBedroomHistory={onOpenBedroomHistory}
                      />
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* === ASSIGNMENTS TAB === */}
      {cleanerTab === "assignments" && (
        <>
          <ScreenId id="CL-B" />
          <AssignmentsPanel
            propertyId={shift.customer_id}
            employee={employee}
            onGoToBedroom={onGoToBedroom}
            onOpenBedroomHistory={onOpenBedroomHistory}
            onJoinBlock={onJoinBlock}
          />
          {can(employee, "upload_assignments") && (
            <div className="px-4 pt-3">
              <button
                onClick={() => setShowAssignmentForm(true)}
                disabled={busy}
                className="w-full py-3 rounded-2xl bg-white border-2 border-amber-300 hover:border-amber-500 text-amber-900 text-sm font-medium flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50"
              >
                <Plus size={16} /> Upload an assignment
              </button>
            </div>
          )}
        </>
      )}

      {/* === MORE TAB === */}
      {cleanerTab === "more" && (
        <div className="px-4 pt-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
            Properties
          </div>
          <button
            onClick={() => setShowProps((s) => !s)}
            className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
          >
            <Building2 size={18} className="text-stone-700" />
            <div className="flex-1">
              <div className="text-sm font-medium text-stone-900">
                Browse properties
              </div>
              <div className="text-xs text-stone-500">
                See every property and its open work
              </div>
            </div>
            <ChevronRight
              size={16}
              className={`text-stone-400 transition-transform ${showProps ? "rotate-90" : ""}`}
            />
          </button>
          {showProps && (
            <div className="-mx-4">
              <CleanerPropertiesList
                currentPropertyId={shift.customer_id}
                employee={employee}
                onOpenCurrent={() => setCleanerTab("home")}
                onSwitch={(p) => onSwitchProperty && onSwitchProperty(p)}
              />
            </div>
          )}

          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 pt-3">
            Account &amp; settings
          </div>
          <CleanerMoreExtras
            employee={employee}
            onOpenMessages={onOpenMessages}
            onOpenWhosHere={() => setWhosHereOpen(true)}
          />
          {onSwitchProperty && (
            <button
              onClick={() => onSwitchProperty()}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
            >
              <Building2 size={18} className="text-stone-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">
                  Switch property
                </div>
                <div className="text-xs text-stone-500">
                  Move to a different property today
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </button>
          )}
          {onOpenChangePin && (
            <button
              onClick={onOpenChangePin}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
            >
              <Lock size={18} className="text-stone-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">
                  Change PIN
                </div>
                <div className="text-xs text-stone-500">
                  Update your sign-in code
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </button>
          )}
          <button
            onClick={onSignOut}
            className="w-full px-4 py-3.5 rounded-2xl bg-white border border-red-200 hover:border-red-400 text-left flex items-center gap-3 active:scale-98"
          >
            <LogOut size={18} className="text-red-700" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-700">Sign out</div>
              <div className="text-xs text-stone-500">
                Ends your session and clocks you out
              </div>
            </div>
          </button>
          <div className="pt-4 text-center text-[10px] text-stone-400 font-mono">
            Signed in as {employeeName} · {employee?.role}
          </div>
        </div>
      )}

      {/* Bottom nav — fixed at the bottom of the viewport. */}
      <CleanerBottomNav active={cleanerTab} onChange={setCleanerTab} />
    </div>
  );
}
