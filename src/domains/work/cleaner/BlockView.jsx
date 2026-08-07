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
  localTodayStart,
  localTodayStartISO,
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
import { CleanerBottomNav } from "../../../apps/internal/cleaner/CleanerBottomNav.jsx";
import { MoveBlockModal } from "./MoveBlockModal.jsx";
import { MoveBlockModalInline } from "./MoveBlockModalInline.jsx";
import { OtherWorkblocksHere } from "./OtherWorkblocksHere.jsx";
import { TaskCard } from "./TaskCard.jsx";
import { TaskCategoryPicker } from "./TaskCategoryPicker.jsx";
import { UndoMoveMenu } from "./UndoMoveMenu.jsx";
import { WhosHerePopup } from "./WhosHerePopup.jsx";

export function BlockView({
  shift,
  block,
  tasks,
  activeTask,
  employeeName,
  employee,
  onSignOut,
  onFinish,
  onExit,
  onPause,
  onUndo,
  onReopen,
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
  onOpenMessages,
  onOpenBedroomHistory,
  onMoveBlock,
  onMoveMultiple,
  onLeaveBlock,
  onJoinBlock,
  onDeletePhoto,
  onGoToBedroom,
  onSwitchProperty,
  cleanerTab,
  setCleanerTab,
  previewMode,
  busy,
}) {
  useTick(true);
  const blockElapsed = Date.now() - new Date(block.start_time).getTime();
  const activeTaskObj = tasks.find((t) => t.id === activeTask);
  // Multi-cleaner participants in this block. Loaded on mount and
  // refreshed every 30s so the header chips track joins/leaves.
  // Excludes the current cleaner (they know they're here).
  const [participants, setParticipants] = useState([]);
  useEffect(() => {
    if (!block?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("work_block_participants")
        .select(
          "id, employee_id, joined_at, left_at, employee:employees(id, name)",
        )
        .eq("work_block_id", block.id)
        .is("left_at", null);
      if (!cancelled) setParticipants(data || []);
    };
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [block?.id]);
  // Other cleaners currently in this block (not me)
  const others = participants.filter((p) => p.employee_id !== employee?.id);
  // Total active participants (me + others) — drives the conditional
  // "Leave block" vs "I finished in this bedroom" label.
  const totalActive = participants.length;
  // Task input mode toggle: structured picker (default) vs freeform typing
  const [taskInputMode, setTaskInputMode] = useState("picker"); // 'picker' | 'custom'
  // "Your other jobs" — the Assigned to me / All pending list, shown at the
  // bottom of the block so the cleaner can see what's next without pausing.
  // Collapsed by default: the open block is still the point of this screen.
  const [showWorkList, setShowWorkList] = useState(false);
  // "Move bedroom" modal — shown to owners/managers and in preview
  // mode. Cleaners typically don't see this so they don't accidentally
  // re-attach their work to the wrong bedroom; managers can fix
  // mistakes after the fact.
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  // 'bedroom' = move keeping items in their current status (cleaner is
  // in wrong bedroom physically but the items they advanced still apply
  // to the destination). 'workblock' = also reset items at the source
  // back to pending — they shouldn't follow because the cleaner shouldn't
  // have touched them. Default 'bedroom'.
  const [moveMode, setMoveMode] = useState("bedroom");
  // Move bedroom is available to anyone with an onMoveBlock handler.
  // Cleaners need to be able to fix their own mistakes (wrong bedroom
  // opened, photos/tasks added to the wrong work block) without
  // bothering a manager. The move flow asks at confirmation time
  // whether to also reset the old bedroom's assignment to Pending.
  const canMoveBlock = !!onMoveBlock;

  // Surface the open assignments' priority + cleaning types for this
  // bedroom in the header. AssignmentBanner shows the same info but
  // it's below the fold; the header is the first thing the cleaner
  // sees so the chips need to live there too.
  const [bedroomContext, setBedroomContext] = useState({
    priority: false,
    types: [],
  });
  useEffect(() => {
    if (!block.unit_id || !block.party_id) {
      setBedroomContext({ priority: false, types: [] });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("assignment_targets")
        .select(
          "priority, assignment:assignments!inner(assignment_type, active)",
        )
        .eq("unit_id", block.unit_id)
        .eq("party_id", block.party_id)
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
  }, [block.unit_id, block.party_id]);

  // Logo tap: confirm before pausing the block + bouncing to PropertyHub
  const handleLogoClick = () => {
    if (confirm("Pause this work block and go back to property home?"))
      onPause();
  };

  // Quick-view popup for cleaners — peek at who else is at this property
  const [whosHereOpen, setWhosHereOpen] = useState(false);

  // === Three-tab layout: New / Active / Done ===
  // 'new'    = the task picker (start something)
  // 'active' = the current open workblock (running task + your tasks here)
  // 'done'   = finished workblocks at this bedroom today (yours + others)
  // Opens on Active when a task is already running, else New.
  const [blockTab, setBlockTab] = useState(() =>
    activeTask ? "active" : "new",
  );
  // Auto-jump to Active the moment a task starts, and back to New the moment
  // the running task is marked Done (activeTask clears). Landing on New drops
  // the cleaner straight onto the checklist to pick their next item, instead
  // of an empty Active tab. Tracks the previous value so switching between
  // tabs by hand while idle doesn't yank them around.
  const prevActiveTaskRef = useRef(activeTask);
  useEffect(() => {
    const had = prevActiveTaskRef.current;
    if (activeTask) setBlockTab("active");
    else if (had) setBlockTab("new"); // a task just finished
    prevActiveTaskRef.current = activeTask;
  }, [activeTask]);

  // When the active block itself changes — a join, a reopen, or moving to a
  // different bedroom — land on Active with that block open. The cleaner
  // asked to be IN this workblock; drop them there, not on the pick-a-task
  // (New) screen. (A fresh start still snaps to Active via the running-task
  // effect above.) Guarded so it only fires on an actual block change.
  const prevBlockIdRef = useRef(block?.id);
  useEffect(() => {
    if (block?.id && block.id !== prevBlockIdRef.current) {
      setBlockTab("active");
      prevBlockIdRef.current = block.id;
    }
  }, [block?.id]);

  // Finished workblocks at THIS bedroom today — closed blocks only, mine +
  // others, grouped by workblock. Powers the Done tab and replaces the old
  // standalone "Tasks others did today" panel.
  const [doneBlocks, setDoneBlocks] = useState({ list: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!block?.unit_id || !block?.party_id) {
        if (!cancelled) setDoneBlocks({ list: [], loading: false });
        return;
      }
      // Not "today only" — a bedroom can be started one day and finished the
      // next (a cleaner runs out of time, someone else picks it up tomorrow).
      // If we only showed today's closed blocks, yesterday's block — the one
      // that owns the "STARTED" checklist items — would be invisible, so the
      // items looked started with nowhere to reopen them. Look back a few
      // days so continued work is always reachable in Done.
      const start = localTodayStart();
      start.setDate(start.getDate() - 6);
      let q = supabase
        .from("work_blocks")
        .select(
          "*, unit:units(*), party:parties(*), shift:shifts!inner(id, employee:employees!inner(id, name)), tasks(id, name, category, subcategory, start_time, end_time, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("unit_id", block.unit_id)
        .eq("party_id", block.party_id)
        .gte("start_time", start.toISOString())
        .not("end_time", "is", null)
        .neq("id", block.id)
        .order("start_time", { ascending: false });
      // Scope to the SAME assignment when the current block is tagged with
      // one. This is the core of the fix: two separate jobs at the same
      // bedroom (e.g. trash-out and move-out) each show only THEIR OWN closed
      // workblocks and photos, instead of merging. Legacy blocks that predate
      // assignment tagging (assignment_id null) fall back to bedroom-only so
      // nothing old disappears.
      if (block.assignment_id) q = q.eq("assignment_id", block.assignment_id);
      const { data } = await q;
      if (cancelled) return;
      const list = (data || [])
        .map((b) => ({
          ...b,
          ownerName: b.shift?.employee?.name || "A cleaner",
          ownerId: b.shift?.employee?.id,
          mine: b.shift?.employee?.id === employee?.id,
        }))
        .filter((b) => (b.tasks || []).length > 0);
      setDoneBlocks({ list, loading: false });
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [
    block?.id,
    block?.unit_id,
    block?.party_id,
    block?.assignment_id,
    employee?.id,
    blockTab,
  ]);

  // Reopen a finished workblock → it becomes the active block. Confirm first
  // when it belongs to someone else (you're picking up their session).
  const handleReopenDone = (b) => {
    if (!onReopen) return;
    if (
      !b.mine &&
      !confirm(
        `Reopen ${b.ownerName}'s workblock and continue it?\n\nIt becomes your active workblock at this bedroom, and moves to the Active tab.`,
      )
    )
      return;
    // Reopen always lands on Active with the block open — the cleaner asked
    // to work THIS block, so put them in it. From there they tap New to add
    // the next task, exactly like a fresh block.
    setBlockTab("active");
    onReopen(b);
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <ScreenId id="CL-C" />
      <Header
        name={employeeName}
        onSignOut={onSignOut}
        role={employee?.role}
        cleanerView
        employee={employee}
        onOpenMessages={onOpenMessages}
        onOpenWhosHere={() => setWhosHereOpen(true)}
        onLogoClick={handleLogoClick}
      />
      {whosHereOpen && (
        <WhosHerePopup
          propertyId={shift.customer_id}
          propertyName={shift.customer?.name || "this property"}
          myEmployeeId={employee?.id}
          onClose={() => setWhosHereOpen(false)}
        />
      )}
      {/* Cleaner is INSIDE an active work block. Tapping any other
         segment triggers the leave-warning modal. The decision they
         choose (Done / Stay / Pause) is forwarded back here so we
         can finish or pause the block before navigating. */}
      <CleanerProgressBar
        segments={[
          { label: "Assignment", filled: true },
          { label: "Items", filled: true },
          { label: "Working", filled: true, isCurrent: true },
          { label: "Complete", filled: false },
        ]}
        inActiveWork={true}
        onLeaveDecision={(decision) => {
          if (decision === "done") return onFinish();
          if (decision === "pause") return onPause();
        }}
      />
      {(others.length > 0 || block.work_notes) && (
        <div className="bg-slate-800 text-stone-50 px-5 py-3 sticky top-0 z-10 shadow-md">
          {block.work_notes && (
            <div className="px-3 py-2 rounded-lg bg-slate-700 text-stone-200 text-xs italic">
              "{block.work_notes}"
            </div>
          )}
          {/* Active participants — chips with the OTHER cleaners helping in
           this block. The current cleaner is implicit. When solo, nothing
           renders. */}
          {others.length > 0 && (
            <div
              className={`flex items-center gap-1.5 flex-wrap ${block.work_notes ? "mt-2" : ""}`}
            >
              <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
                With you:
              </span>
              {others.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-100 border border-stone-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {p.employee?.name || "?"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignment card, folded into the dark header as one block (dark
         variant). Sits flush under the sticky header so the bedroom info and
         the assignment read as a single dark section. */}
      <AssignmentBanner
        propertyId={shift.customer_id}
        unitId={block.unit_id}
        partyId={block.party_id}
        employee={employee}
        onOpenBedroomHistory={onOpenBedroomHistory}
        dark
        workScreen
        onExit={onExit}
        propertyName={shift.customer?.name}
        elapsedMs={blockElapsed}
        undoSlot={
          onUndo || canMoveBlock ? (
            <UndoMoveMenu
              disabled={busy}
              canUndo={!!onUndo}
              canMove={!!canMoveBlock}
              onUndo={onUndo}
              onMoveBedroom={() => {
                setMoveMode("bedroom");
                setMoveModalOpen(true);
              }}
              onMoveWorkblock={() => {
                setMoveMode("workblock");
                setMoveModalOpen(true);
              }}
            />
          ) : null
        }
      />

      {onOpenBedroomHistory && block.unit?.id && block.party?.id && (
        <div className="px-4 mt-3">
          <button
            onClick={() =>
              onOpenBedroomHistory({
                unitId: block.unit.id,
                unitLabel: block.unit.label,
                partyId: block.party.id,
                partyLabel: block.party.label,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-mono active:scale-95"
          >
            <Clock size={12} /> Bedroom history
          </button>
        </div>
      )}

      {/* Other cleaners' open workblocks at this bedroom now live inside the
         Active tab (below), not above the tabs — a "someone else is here,
         Join them" card only makes sense alongside your own active work, and
         it was confusingly showing on the New tab. */}

      {/* New / Active / Done toggle — splits the old single-scroll view so
         the cleaner sees one thing at a time. Badges flag where the work is
         even when looking at another tab. */}
      <div className="mx-4 mt-4">
        <div className="grid grid-cols-3 gap-1 p-1 bg-stone-200 rounded-2xl">
          {[
            { key: "new", label: "New", count: null },
            { key: "active", label: "Active", count: activeTaskObj ? 1 : 0 },
            {
              key: "done",
              label: "Done",
              count:
                (tasks || []).filter((t) => t.id !== activeTask).length +
                doneBlocks.list.length,
            },
          ].map((t) => {
            const on = blockTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setBlockTab(t.key)}
                className={`py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${on ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                {t.key === "active" && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${activeTaskObj ? "bg-amber-600 animate-pulse" : "bg-stone-300"}`}
                  />
                )}
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] ${on ? "bg-stone-200 text-stone-700" : "bg-stone-300 text-stone-600"}`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {blockTab === "active" && (
        <>
          {activeTaskObj ? (
            <ActiveWorkblockCard
              task={activeTaskObj}
              onStop={() => onStopTask(activeTaskObj.id)}
              onAddPhoto={(kind) => onAddPhoto(activeTaskObj.id, kind)}
            />
          ) : (
            <div className="mx-4 mt-6 text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              Nothing running right now.
              <br />
              Tap <span className="font-mono text-stone-500">New</span> to start
              a task, or check{" "}
              <span className="font-mono text-stone-500">Done</span> to resume
              one.
            </div>
          )}
          <div className="mx-4 mt-4 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
              In this workblock:
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> You
            </span>
            {others.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                {p.employee?.name || "?"}
              </span>
            ))}
          </div>
          {/* Other cleaners working a different section at THIS bedroom, with
             a Join button. Lives here in Active so it sits alongside your own
             running work, not on the New/pick-a-task screen. */}
          {block.unit?.id && block.party?.id && (
            <div className="mx-4 mt-4">
              <OtherWorkblocksHere
                unitId={block.unit.id}
                partyId={block.party.id}
                currentBlockId={block.id}
                currentEmployeeId={employee?.id}
                onJoin={onJoinBlock}
              />
            </div>
          )}
        </>
      )}

      {blockTab === "new" && (
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
                unitId={block.unit_id}
                partyId={block.party_id}
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

          {/* The ONE finish action for this bedroom. Solo → close everything
           out (finishBlock warns + routes to assignments). Multiple cleaners
           → this cleaner leaves, others stay (leaveBlock warns + routes); the
           LAST one to leave closes the whole bedroom. No second confirm here —
           each handler owns its own warning. */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                if (totalActive > 1 && onLeaveBlock) return onLeaveBlock();
                return onFinish();
              }}
              disabled={busy}
              className="mx-auto px-6 py-2.5 rounded-full bg-amber-700 hover:bg-amber-800 text-stone-50 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Check size={15} />
              We are done here
            </button>
            {totalActive > 1 && onLeaveBlock && (
              <div className="text-[11px] text-stone-500 text-center mt-1.5 font-mono">
                {totalActive} cleaners here · the block stays open until
                everyone finishes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finished tasks in the current block now live in the Done tab
         ("this session"), so hitting Done on a task moves it out of Active.
         Active shows only what's running. */}

      {/* DONE — everything finished at this bedroom today: your finished
         tasks in the current (open) block, plus closed workblocks (yours
         from earlier + other cleaners'). Tasks resume; blocks reopen. */}
      {blockTab === "done" &&
        (() => {
          const finishedHere = (tasks || []).filter((t) => t.id !== activeTask);
          const nothing =
            finishedHere.length === 0 && doneBlocks.list.length === 0;
          return (
            <div className="mx-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                  Finished here recently
                </div>
                {(block?.unit?.label || block?.party?.label) && (
                  <div className="text-[11px] text-stone-400 font-mono">
                    {block?.unit?.label}
                    {block?.unit?.label && block?.party?.label ? " · " : ""}
                    {block?.party?.label}
                  </div>
                )}
              </div>
              {doneBlocks.loading && nothing ? (
                <div className="text-center py-10 text-stone-400 text-sm font-mono">
                  Loading…
                </div>
              ) : nothing ? (
                <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  Nothing finished here yet today.
                </div>
              ) : (
                <div className="space-y-4">
                  {finishedHere.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono mb-2">
                        This session · tap Reopen task to pick it back up
                      </div>
                      <div className="space-y-3">
                        {finishedHere.map((t) => (
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
                    </div>
                  )}
                  {doneBlocks.list.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono mb-2">
                        Closed workblocks
                      </div>
                      <div className="space-y-3">
                        {doneBlocks.list.map((b) => {
                          const bTasks = b.tasks || [];
                          const dur = b.end_time
                            ? new Date(b.end_time) - new Date(b.start_time)
                            : null;
                          return (
                            <div
                              key={b.id}
                              className="p-4 rounded-2xl bg-white border border-stone-200"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full ${b.mine ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
                                >
                                  <User size={11} />{" "}
                                  {b.mine ? "You" : b.ownerName}
                                </span>
                                <button
                                  onClick={() => handleReopenDone(b)}
                                  disabled={busy}
                                  aria-label="Start this workblock again"
                                  className="h-9 px-4 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
                                >
                                  <Play size={14} /> Start
                                </button>
                              </div>
                              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                                {bTasks.map((t) => (
                                  <span
                                    key={t.id}
                                    className="font-serif text-[15px] text-stone-900"
                                  >
                                    {splitTaskName(t.name)[0] || t.name}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 text-[10px] text-stone-500 font-mono">
                                {(() => {
                                  // Prefix the day when this block isn't from today,
                                  // so a bedroom started yesterday reads clearly as
                                  // earlier work being continued.
                                  const bStart = new Date(b.start_time);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const isToday = bStart >= today;
                                  const dayLabel = isToday
                                    ? ""
                                    : bStart.toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      }) + " · ";
                                  return `${dayLabel}${fmtClock(b.start_time)} – ${fmtClock(b.end_time)}`;
                                })()}
                                {dur ? ` · ${fmtTimeShort(dur)}` : ""} ·{" "}
                                {bTasks.length} task
                                {bTasks.length === 1 ? "" : "s"}
                              </div>
                              {(() => {
                                // Photos live under the block's tasks — from ANY
                                // cleaner who worked this block, so a reopener sees
                                // the whole picture. Grouped by kind with counts
                                // (Before / After / Damage / Couldn't clean) and
                                // tappable to view full-size.
                                const blockPhotos = bTasks.flatMap((t) =>
                                  (t.photos || []).filter((p) => !p.deleted_at),
                                );
                                if (blockPhotos.length === 0) return null;
                                const KIND_META = {
                                  before: {
                                    label: "Before",
                                    color: "text-blue-700",
                                  },
                                  after: {
                                    label: "After",
                                    color: "text-emerald-700",
                                  },
                                  damage: {
                                    label: "Damage",
                                    color: "text-red-700",
                                  },
                                  cannot_clean: {
                                    label: "Couldn't clean",
                                    color: "text-yellow-700",
                                  },
                                };
                                const counts = {};
                                blockPhotos.forEach((p) => {
                                  counts[p.kind] = (counts[p.kind] || 0) + 1;
                                });
                                return (
                                  <div className="mt-2.5">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                      {[
                                        "before",
                                        "after",
                                        "damage",
                                        "cannot_clean",
                                      ]
                                        .filter((k) => counts[k])
                                        .map((k) => (
                                          <span
                                            key={k}
                                            className={`text-[10px] uppercase tracking-wider font-mono ${KIND_META[k].color}`}
                                          >
                                            {counts[k]} {KIND_META[k].label}
                                          </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {blockPhotos.slice(0, 8).map((p) => (
                                        <a
                                          key={p.id}
                                          href={p.public_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          title={
                                            KIND_META[p.kind]?.label || p.kind
                                          }
                                          className="block w-14 h-14 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 flex-shrink-0"
                                        >
                                          <img
                                            src={p.public_url}
                                            alt=""
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                          />
                                        </a>
                                      ))}
                                      {blockPhotos.length > 8 && (
                                        <span className="w-14 h-14 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-[11px] font-mono text-stone-500 flex-shrink-0">
                                          +{blockPhotos.length - 8}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="mt-2 text-[10px] text-stone-500 font-mono flex items-center gap-1.5">
                                <Play size={11} />{" "}
                                {b.mine
                                  ? "Tap Start to reopen and keep working"
                                  : `Tap Start to reopen ${b.ownerName}'s block`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

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
      {moveModalOpen && (
        <MoveBlockModalInline
          block={block}
          propertyId={shift.customer_id}
          shiftId={shift.id}
          currentEmployeeId={employee?.id}
          mode={moveMode}
          onSave={async (newUnit, newParty, resetIds) => {
            await onMoveBlock(newUnit, newParty, resetIds);
            setMoveModalOpen(false);
          }}
          onSaveMulti={
            onMoveMultiple
              ? async (blockIds, newUnit, newParty, resetIds) => {
                  await onMoveMultiple(blockIds, newUnit, newParty, resetIds);
                  setMoveModalOpen(false);
                }
              : null
          }
          onClose={() => setMoveModalOpen(false)}
        />
      )}
      {/* The "Close out entire bedroom" button now lives inside the New tab
         (with the task picker) instead of always-on-screen, so it can't be
         hit by accident while a cleaner is mid-task. */}

      {/* "Tasks others did today" panel removed — its contents now live in
         the Done tab above, grouped by workblock and labeled by cleaner. */}

      {/* The rest of the day, without leaving this block. The active
         block still owns the top of the screen; this just means the
         cleaner no longer has to finish or pause to see what's next.
         Collapsed by default so it can't crowd out the work in hand.
         Tapping another bedroom routes through onGoToBedroom, which
         raises the switch-bedroom prompt rather than silently
         abandoning the open block. */}
      {/* "Your other jobs" was removed from this screen — the cleaner
         focuses on the work in hand; other jobs are on the Today tab. */}

      {/* Persistent bottom nav — lets the cleaner peek at Assignments
         or More without finishing/pausing the workblock. The block
         stays open in the DB; flipping tabs just hides this view.
         Returns when they tap Home (or the persistent pill on
         non-Home tabs). Hidden while a photo modal is open so a tap
         doesn't bypass the modal. */}
      {setCleanerTab && !photoModal && (
        <CleanerBottomNav
          active={cleanerTab || "home"}
          onChange={setCleanerTab}
        />
      )}
    </div>
  );
}
