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
import { isPmApprovedAssignment } from "../../../lib/assignments.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
  readPhotoTakenAt,
} from "../../../lib/photos.js";
import { sessionStore } from "../../../domains/auth/sessionStore.js";
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
import { LeaveWorkblockModal } from "../../../domains/work/cleaner/LeaveWorkblockModal.jsx";
import { BlockView } from "../../../domains/work/cleaner/BlockView.jsx";
import { ChangePinModal } from "../../../domains/work/cross-cutting/ChangePinModal.jsx";
import { SwitchBedroomModal } from "../../../domains/work/cross-cutting/SwitchBedroomModal.jsx";
import { CleanerBottomNav } from "./CleanerBottomNav.jsx";
import { CleanerMoreExtras } from "./CleanerMoreExtras.jsx";
import { CleanerPropertiesList } from "./CleanerPropertiesList.jsx";
import { CleanerWorkList } from "../../../domains/work/cleaner/CleanerWorkList.jsx";
import { IdleWarningModal } from "../../../domains/work/cross-cutting/IdleWarningModal.jsx";
import { MoveBlockModal } from "../../../domains/work/cleaner/MoveBlockModal.jsx";
import { MoveBlockModalInline } from "../../../domains/work/cleaner/MoveBlockModalInline.jsx";
import { NextUpModal } from "../../../domains/work/cross-cutting/NextUpModal.jsx";
import { PartyPicker } from "./PartyPicker.jsx";
import { PreparingBlockView } from "../../../domains/work/cleaner/PreparingBlockView.jsx";
import { PropertyHub } from "./PropertyHub.jsx";
import { PropertyPicker } from "./PropertyPicker.jsx";
import { SimpleShiftView } from "../../../domains/work/cleaner/SimpleShiftView.jsx";
import { StaffMessagesTab } from "../../../features/messaging/StaffMessagesTab.jsx";
import { SupplyChecklistGate } from "./SupplyChecklistGate.jsx";
import { UnitPicker } from "./UnitPicker.jsx";
import { ViewOnlyDashboard } from "../../../domains/work/cleaner/ViewOnlyDashboard.jsx";
import { WhosWorkingNowModal } from "../../../domains/work/cleaner/WhosWorkingNowModal.jsx";

export function EmployeeApp({
  employee: employeeInit,
  onSignOut,
  previewMode = false,
}) {
  // Track the employee locally so PIN changes update the live session
  const [employee, setEmployee] = useState(employeeInit);
  // Supply-checklist gate. Lives here (not in App) so it also fires for Beta
  // accounts and any path that renders the cleaner shell. Skipped only in
  // owner-preview mode.
  //
  // The checklist is meant once per day, not once per page load. supplyOk is
  // React state that resets to false on every mount, so a refresh (or the app
  // being reopened) used to force the cleaner back through the whole list even
  // though they'd already confirmed that morning. supplyChecked gates the work
  // UI while we look for today's confirmation: null = still checking (show a
  // splash, not the gate), false = no confirmation today (show the gate), true
  // = already confirmed today (skip straight through).
  const [supplyOk, setSupplyOk] = useState(false);
  const [supplyChecked, setSupplyChecked] = useState(false);

  useEffect(() => {
    if (previewMode) {
      setSupplyChecked(true);
      return;
    }
    // Fast local path: if this employee already confirmed today on this device,
    // skip the gate instantly (and skip the DB round-trip). This is what stops
    // a browser refresh from re-prompting even if the DB write is flaky.
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (
        localStorage.getItem(`supply_ok_${employee?.id}_${todayKey}`) === "1"
      ) {
        setSupplyOk(true);
        setSupplyChecked(true);
        return;
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        // Local midnight → the cleaner's "today". A confirmation from
        // yesterday shouldn't carry over, and one from 6am should still
        // count at 9am.
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).toISOString();
        // We don't hard-code the timestamp column name (it's a DB default),
        // so try the common ones in order and fall back to "no confirmation"
        // rather than ever wrongly skipping the checklist.
        let found = false;
        for (const col of ["confirmed_at", "created_at", "inserted_at"]) {
          const { data, error } = await supabase
            .from("supply_checklist_confirmations")
            .select("id")
            .eq("employee_id", employee?.id)
            .gte(col, startOfDay)
            .limit(1);
          if (error) {
            // Unknown column → try the next candidate. Any other error →
            // stop and leave the gate up (safe default).
            if (/column|does not exist|42703/i.test(error.message || ""))
              continue;
            break;
          }
          if (data && data.length > 0) found = true;
          break; // column exists; trust its answer
        }
        if (!cancelled && found) setSupplyOk(true);
      } catch (e) {
        console.warn("[supply] today-confirmation check failed", e);
      } finally {
        if (!cancelled) setSupplyChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line */
  }, [employee?.id, previewMode]);
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [clockInFlow, setClockInFlow] = useState(null);
  // Bottom-nav tab — Home / Assignments / More. Lifted to AuthedShift
  // so it persists across PropertyHub ↔ BlockView navigation. When a
  // workblock starts we auto-snap back to Home so the cleaner sees the
  // workblock card (and doesn't get stuck on the Assignments list with
  // the workblock running silently in the background).
  // Persisted per-employee so an OS tab reload (phone backgrounded the app
  // to save memory, screen locked, switched to the camera) drops the cleaner
  // back on the tab they were on rather than always Home. Their shift, work
  // block and active task are already restored from the database in reload();
  // this just keeps the tab consistent too. The effect below still forces
  // Home whenever they're not clocked in.
  const [cleanerTab, setCleanerTab] = usePagePersistence(
    `cleaner_tab_${employee.id}`,
    "home",
  );
  const [blockStartFlow, setBlockStartFlow] = useState(null);
  // Set when an assignment "Start" or "Go to this bedroom" is tapped from
  // somewhere outside the bedroom — we navigate the cleaner to that
  // bedroom but DON'T create a work_block until they confirm. This
  // separates the "I'm intending to clean here" moment from the "the
  // billable clock starts now" moment, which matches how cleaners
  // actually work (they often walk to the bedroom, get supplies, etc.
  // before they're really ready to start). `null` when no pending start.
  // Shape: { unitId, partyId, unitLabel, partyLabel }
  const [pendingStart, setPendingStart] = useState(null);
  // Custom finish-confirmation modal (replaces the browser confirm on
  // "We are done here"). null = closed.
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [whosWorkingOpen, setWhosWorkingOpen] = useState(false); // read-only "where is everyone"
  const [bedroomHistory, setBedroomHistory] = useState(null); // params for BedroomHistoryView
  // Whenever an activeBlock transitions from null → set (cleaner just
  // started a workblock), snap the bottom-nav tab back to Home so they
  // see the workblock UI right away. Without this, if they started the
  // block from the Assignments tab, they'd see the assignments list
  // with the workblock running silently in the background — confusing.
  useEffect(() => {
    if (activeBlock) setCleanerTab("home");
  }, [activeBlock?.id]);
  // Not clocked in → always land on Home. Otherwise a cleaner who was last
  // on More or Assignments clocks out and comes back to that tab instead of
  // their work list.
  useEffect(() => {
    if (!shift) setCleanerTab("home");
  }, [!shift]);
  // When the cleaner taps a different bedroom while one is open, we
  // surface a 3-button modal (Stay / Pause + switch / Finish + switch)
  // instead of a native confirm. Shape: { target, fromLabel, toLabel }.
  const [switchPending, setSwitchPending] = useState(null);
  // After the cleaner finishes a bedroom we show a "Next up" suggestion
  // modal listing other bedrooms in the same apartment → floor → building
  // → next building (3rd floor down). Shape: { fromUnit, fromParty }.
  const [nextUpPrompt, setNextUpPrompt] = useState(null);
  const [viewOnlySession, setViewOnlySession] = useState(null); // { id, started_at } if viewing without clocking in
  const [viewOnlyProperty, setViewOnlyProperty] = useState(null); // the property they picked to view

  useTick(!!shift && !shift.end_time);
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, []);

  const reload = async () => {
    // Only re-attach to shifts matching the current mode. Without this,
    // an owner who left a preview shift open and then opened the app
    // normally would resume the preview shift as a real one (or vice
    // versa). Strict mode-match prevents that.
    const { data: activeShift } = await supabase
      .from("shifts")
      .select("*, customer:customers(*)")
      .eq("employee_id", employee.id)
      .eq("is_preview", previewMode)
      .is("end_time", null)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShift) {
      setShift(activeShift);
      if (activeShift.customer?.property_type === "multi_unit") {
        const { data: blocks } = await supabase
          .from("work_blocks")
          .select(
            "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
          )
          .eq("shift_id", activeShift.id)
          .order("start_time", { ascending: true });
        let allBlocks = blocks || [];
        // The query above only sees blocks from THIS shift. If the cleaner
        // clocked out and back in (or the phone reloaded the app into a new
        // shift), their earlier blocks — and the photos in them — live under
        // the previous shift and would vanish for them, even though other
        // cleaners still see them. Pull this cleaner's OWN closed blocks from
        // today at this property and merge any that aren't already loaded, so
        // their photos always come back with them.
        try {
          // Same rolling window as the Done tab (see doneBlocks) — a block
          // the cleaner started on a previous day and is continuing today
          // should come back with its photos, not just today's blocks.
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - 6);
          const { data: mine } = await supabase
            .from("work_blocks")
            .select(
              "*, unit:units(*), party:parties(*), shift:shifts!inner(id, employee_id, customer_id), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
            )
            .eq("shift.employee_id", employee.id)
            .eq("shift.customer_id", activeShift.customer_id)
            .gte("start_time", dayStart.toISOString())
            .order("start_time", { ascending: true });
          if (mine && mine.length) {
            const have = new Set(allBlocks.map((b) => b.id));
            const extra = mine.filter((b) => !have.has(b.id));
            if (extra.length) {
              allBlocks = [...allBlocks, ...extra].sort(
                (a, b) => new Date(a.start_time) - new Date(b.start_time),
              );
            }
          }
        } catch (e) {
          console.warn("[reload] could not merge own earlier blocks", e);
        }
        setWorkBlocks(allBlocks);
        const live = allBlocks.find((b) => !b.end_time);
        if (live) {
          setActiveBlock(live);
          // A cleaner can end up with more than one open block at the SAME
          // bedroom (e.g. a stale earlier shift never closed). Each block's
          // tasks — and the before/after photos on them — would otherwise be
          // split, and the ones on the non-active block would look "missing".
          // So gather tasks from EVERY open block at this same unit+party, not
          // just the one we picked as active. Dedupe by task id.
          const sameSpotOpen = allBlocks.filter(
            (b) =>
              !b.end_time &&
              b.unit_id === live.unit_id &&
              b.party_id === live.party_id,
          );
          const seen = new Set();
          const mergedTasks = [];
          sameSpotOpen.forEach((b) =>
            (b.tasks || []).forEach((t) => {
              if (!seen.has(t.id)) {
                seen.add(t.id);
                mergedTasks.push(t);
              }
            }),
          );
          setTasks(mergedTasks.length ? mergedTasks : live.tasks || []);
          const liveTask =
            mergedTasks.find((t) => !t.end_time) ||
            (live.tasks || []).find((t) => !t.end_time);
          if (liveTask) setActiveTask(liveTask.id);
        }
      } else {
        const { data: ts } = await supabase
          .from("tasks")
          .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
          .eq("shift_id", activeShift.id)
          .is("work_block_id", null)
          .order("start_time");
        setTasks(ts || []);
        const live = (ts || []).find((t) => !t.end_time);
        if (live) setActiveTask(live.id);
      }
    }
    setLoaded(true);
  };

  // Clock-in
  const startClockIn = () => setClockInFlow({ step: "property" });

  // When a cleaner taps a job from the signed-in home, we clock them into
  // that job's property and then jump straight to its bedroom.
  const [pendingJob, setPendingJob] = useState(null);
  const startJob = async (job) => {
    setPendingJob(job);
    const { data: prop } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customerId)
      .single();
    if (!prop) {
      setPendingJob(null);
      return;
    }
    await onPickProperty(prop);
  };

  useEffect(() => {
    if (!pendingJob || !shift) return;
    if (shift.customer_id !== pendingJob.customerId) return;
    const j = pendingJob;
    setPendingJob(null);
    goToBedroomForTarget({ unit_id: j.unitId, party_id: j.partyId });
    /* eslint-disable-next-line */
  }, [shift, pendingJob]);

  const onPickProperty = async (property) => {
    if (property === null) {
      await doClockIn({ customerId: null });
      return;
    }
    if (property.property_type === "multi_unit") {
      await doClockIn({ customerId: property.id, propertyType: "multi_unit" });
    } else {
      await doClockIn({
        customerId: property.id,
        billRate:
          property.bill_mode === "hourly"
            ? property.bill_rate_hourly
            : property.flat_rate_amount,
        propertyType: "simple",
      });
    }
  };

  const doClockIn = async ({ customerId, billRate, propertyType }) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        employee_id: employee.id,
        customer_id: customerId || null,
        bill_rate_at_work: propertyType === "simple" ? billRate : null,
        // Tag preview-mode shifts so reports/payroll exclude them
        is_preview: previewMode,
      })
      .select("*, customer:customers(*)")
      .single();
    setBusy(false);
    if (error) {
      alert("Could not clock in: " + error.message);
      return;
    }
    setShift(data);
    setWorkBlocks([]);
    setTasks([]);
    setClockInFlow(null);
  };

  // View-only: cleaner browses messages, properties, assignments
  // without clocking in. Audited via view_only_sessions table.
  const startViewOnly = () => setClockInFlow({ step: "view-only-property" });

  const onPickViewOnlyProperty = async (property) => {
    setBusy(true);
    // First, auto-close any of this employee's view-only sessions that don't have an end_time.
    // This handles the case where they closed the browser without ending properly.
    try {
      const { data: open } = await supabase
        .from("view_only_sessions")
        .select("id, start_time")
        .eq("employee_id", employee.id)
        .is("end_time", null);
      if (open && open.length > 0) {
        await supabase
          .from("view_only_sessions")
          .update({ end_time: new Date().toISOString() })
          .eq("employee_id", employee.id)
          .is("end_time", null);
      }
    } catch (e) {
      console.warn("[view-only cleanup] failed", e);
    }
    const { data, error } = await supabase
      .from("view_only_sessions")
      .insert({
        employee_id: employee.id,
        customer_id: property?.id || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start view-only session: " + error.message);
      return;
    }
    setViewOnlySession(data);
    setViewOnlyProperty(property);
    setClockInFlow(null);
  };

  const logViewOnlyAction = async (action) => {
    if (!viewOnlySession) return;
    try {
      // Append to views_logged jsonb array
      const { data: current } = await supabase
        .from("view_only_sessions")
        .select("views_logged")
        .eq("id", viewOnlySession.id)
        .maybeSingle();
      const prior = Array.isArray(current?.views_logged)
        ? current.views_logged
        : [];
      const next = [...prior, { action, at: new Date().toISOString() }].slice(
        -200,
      ); // cap at 200 events per session
      await supabase
        .from("view_only_sessions")
        .update({ views_logged: next })
        .eq("id", viewOnlySession.id);
    } catch (e) {
      console.warn("[view-only audit] failed", e);
    }
  };

  const endViewOnly = async () => {
    if (!viewOnlySession) {
      setViewOnlySession(null);
      setViewOnlyProperty(null);
      return;
    }
    try {
      await supabase
        .from("view_only_sessions")
        .update({ end_time: new Date().toISOString() })
        .eq("id", viewOnlySession.id);
    } catch (e) {
      console.warn("[view-only end] failed", e);
    }
    setViewOnlySession(null);
    setViewOnlyProperty(null);
  };

  const clockOut = async () => {
    const hasOpen = activeBlock && !activeBlock.end_time;
    const msg = hasOpen
      ? "You have an active work block. End shift anyway?"
      : "End your shift?";
    if (!confirm(msg)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({ end_time: new Date().toISOString() })
      .eq("id", shift.id);
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setBusy(false);
  };

  // Sign-out wrapper that force-clocks-out any active shift before
  // exiting. This prevents ghost shifts from cleaners who tap "Sign out"
  // while still on the clock. Note we do NOT pop a confirm dialog here
  // because the user already confirmed (by tapping Sign out); we just
  // close out their work cleanly in the background.
  const signOutWithCleanup = async () => {
    try {
      if (activeTask) {
        try {
          await stopTask(activeTask, false);
        } catch (e) {
          console.warn("[signOut] stopTask failed", e);
        }
      }
      // Before closing the block, park any in-progress items at this
      // shift as 'paused' rather than leaving them 'in_progress' with no
      // open block behind them. An orphaned in_progress item claims
      // someone is actively cleaning when nobody is, and it doesn't
      // surface in the Paused bucket where a cleaner would look to
      // resume. This is the same routing the manual back-out uses.
      if (shift?.id) {
        try {
          await supabase
            .from("assignment_targets")
            .update({ status: "paused" })
            .eq("started_by", employee.id)
            .eq("status", "in_progress");
        } catch (e) {
          console.warn("[signOut] pause-in-progress failed", e);
        }
      }
      if (activeBlock && !activeBlock.end_time) {
        await supabase
          .from("work_blocks")
          .update({ end_time: new Date().toISOString() })
          .eq("id", activeBlock.id);
      }
      if (shift && !shift.end_time) {
        await supabase
          .from("shifts")
          .update({ end_time: new Date().toISOString() })
          .eq("id", shift.id);
      }
      // Also close any open view-only session so the audit trail is clean
      if (viewOnlySession && !viewOnlySession.end_time) {
        try {
          await supabase
            .from("view_only_sessions")
            .update({ end_time: new Date().toISOString() })
            .eq("id", viewOnlySession.id);
        } catch (e) {
          console.warn("[signOut] view-only close failed", e);
        }
      }
    } catch (e) {
      console.warn(
        "[signOutWithCleanup] cleanup error (proceeding with sign out)",
        e,
      );
    }
    // Clear local state, then let the parent finish the sign-out
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setViewOnlySession(null);
    setViewOnlyProperty(null);
    onSignOut();
  };

  // Auto clock-out triggered by idle detector. endTs = the last activity time;
  // we use that as the shift's end_time so billable time excludes the idle gap.
  const autoClockOut = async (endTs) => {
    if (!shift) return;
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date(endTs).toISOString() })
        .eq("id", activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({
        end_time: new Date(endTs).toISOString(),
        auto_clocked_out: true,
      })
      .eq("id", shift.id);
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    alert(
      "You were clocked out automatically after 1 hour of inactivity. Your time was adjusted to your last activity. Talk to your manager if this is a mistake.",
    );
  };

  // Idle detector — only active while there's an open shift
  const { showWarning: showIdleWarning, dismissWarning: dismissIdleWarning } =
    useIdleDetector({
      shift,
      onAutoClockOut: autoClockOut,
      // Not in preview: an owner poking around the cleaner UI isn't really on
      // the clock, and a retroactive idle clock-out would close their open
      // block the next time the page regains focus or reloads.
      enabled: !previewMode && !!shift && !shift.end_time,
    });

  // Switch straight to a specific pending job at ANOTHER property. The
  // cleaner already told us which job by tapping it — so instead of the
  // generic "clock out → confirm → pick a property → land generically"
  // dance, we clock out here, clock into THAT job's property, and open
  // its bedroom. One tap, no picker.
  const [pendingBedroomAfterSwitch, setPendingBedroomAfterSwitch] =
    useState(null);
  const switchToJob = async (job) => {
    if (!job?.customerId) {
      switchProperty();
      return;
    }
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", activeBlock.id);
    }
    if (shift?.id)
      await supabase
        .from("shifts")
        .update({ end_time: new Date().toISOString() })
        .eq("id", shift.id);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    // Clock into the job's property.
    const { data: prop } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customerId)
      .single();
    const { data: newShift, error } = await supabase
      .from("shifts")
      .insert({
        employee_id: employee.id,
        customer_id: job.customerId,
        bill_rate_at_work:
          prop?.property_type === "simple"
            ? prop?.bill_mode === "hourly"
              ? prop?.bill_rate_hourly
              : prop?.flat_rate_amount
            : null,
        is_preview: previewMode,
      })
      .select("*, customer:customers(*)")
      .single();
    setBusy(false);
    if (error) {
      alert("Could not switch: " + error.message);
      return;
    }
    setShift(newShift);
    setClockInFlow(null);
    // Queue the bedroom so we land on its ready-to-start screen.
    if (job.unitId && job.partyId) {
      setPendingBedroomAfterSwitch({
        unit_id: job.unitId,
        party_id: job.partyId,
      });
    }
  };
  // Once the new shift is live, open the queued bedroom's ready-to-start.
  useEffect(() => {
    if (pendingBedroomAfterSwitch && shift?.id) {
      const target = pendingBedroomAfterSwitch;
      setPendingBedroomAfterSwitch(null);
      goToBedroomForTarget(target);
    }
    // eslint-disable-next-line
  }, [shift?.id, pendingBedroomAfterSwitch]);

  // Switch property = clock out current shift, then drop straight on the property picker.
  // Cleaner break than clock-out → home → clock-in.
  const switchProperty = async (targetProperty = null) => {
    // Direct switch: a property was tapped (e.g. from the More-tab browser),
    // so clock out here and clock straight into that one — no second picker.
    // Without a target, fall back to the old behavior (clock out → picker).
    const direct = targetProperty && targetProperty.id;
    const msg = direct
      ? `Clock out of ${shift.customer?.name || "here"} and clock in at ${targetProperty.name}?`
      : "Clock out here and pick a new property?";
    if (!confirm(msg)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase
        .from("work_blocks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", activeBlock.id);
    }
    await supabase
      .from("shifts")
      .update({ end_time: new Date().toISOString() })
      .eq("id", shift.id);
    setShift(null);
    setWorkBlocks([]);
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    if (direct) {
      // Reuse the exact same clock-in path the picker uses, so there's one
      // code path for "start a shift at a property" and no risk of a second
      // open shift. doClockIn inserts the new shift and clears the flow.
      if (targetProperty.property_type === "multi_unit") {
        await doClockIn({
          customerId: targetProperty.id,
          propertyType: "multi_unit",
        });
      } else {
        await doClockIn({
          customerId: targetProperty.id,
          billRate:
            targetProperty.bill_mode === "hourly"
              ? targetProperty.bill_rate_hourly
              : targetProperty.flat_rate_amount,
          propertyType: "simple",
        });
      }
      setCleanerTab && setCleanerTab("home");
    } else {
      setClockInFlow({ step: "property" }); // no target → jump to the picker
    }
    setBusy(false);
  };

  // Attach a property to an existing no-property shift WITHOUT clocking
  // out. Routes the user to the property picker; on pick, just updates
  // the existing shift row's customer_id (and bill_rate_at_work for
  // simple properties). Keeps their clocked-in time running.
  const startAttachProperty = () => setClockInFlow({ step: "attach-property" });

  const onAttachProperty = async (property) => {
    if (!property?.id || !shift?.id) {
      // Nothing to do
      setClockInFlow(null);
      return;
    }
    setBusy(true);
    const update = { customer_id: property.id };
    // For simple properties, also update the bill_rate snapshot so
    // billing reflects the now-attached property. Skip for multi-unit
    // since they're billed per work block.
    if (property.property_type === "simple" && property.bill_rate_hourly) {
      update.bill_rate_at_work = property.bill_rate_hourly;
    }
    const { data, error } = await supabase
      .from("shifts")
      .update(update)
      .eq("id", shift.id)
      .select("*, customer:customers(*)")
      .single();
    setBusy(false);
    if (error) {
      alert("Could not attach property: " + error.message);
      return;
    }
    setShift(data);
    setClockInFlow(null);
  };

  // Work blocks
  const startNewBlock = () => setBlockStartFlow({ step: "unit" });
  const onPickBlockUnit = (unit) => setBlockStartFlow({ step: "party", unit });

  // When a cleaner confirms Start in PreparingBlockView, flip any
  // pending OR paused assignments at this bedroom to in_progress.
  // This is the SINGLE confirmation point — tapping Start/Resume on a
  // card just navigates to the prep screen; status only flips here so
  // the cleaner has one chance to back out before the assignment
  // moves out of Pending.
  const autoStartAssignmentsAtBedroom = async (unitId, partyId) => {
    if (!shift?.customer_id) return;
    try {
      // Find pending OR paused targets at this exact bedroom OR property-wide for this customer
      const { data: targets } = await supabase
        .from("assignment_targets")
        .select(
          "id, status, assignment:assignments!inner(id, customer_id, active, source, pm_status, deleted_at)",
        )
        .in("status", ["pending", "paused"])
        .or(
          `and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`,
        );
      const eligible = (targets || []).filter(
        (t) =>
          t.assignment?.customer_id === shift.customer_id &&
          t.assignment?.active &&
          !t.assignment?.deleted_at &&
          isPmApprovedAssignment(t.assignment),
      );
      if (eligible.length === 0) return;
      const ids = eligible.map((t) => t.id);
      await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          started_by: employee.id,
        })
        .in("id", ids);
    } catch (e) {
      console.warn("[auto-start assignments] failed", e);
    }
  };

  const onPickBlockParty = async (party, workNotes) => {
    setBusy(true);
    const { unit } = blockStartFlow;
    // Defensive safety: only one open work block per shift. If another open
    // block exists (could happen across devices / stale state), close it
    // first so the new one's start time is correct and we never end up
    // double-clocked.
    try {
      const { data: openBlocks } = await supabase
        .from("work_blocks")
        .select("id")
        .eq("shift_id", shift.id)
        .is("end_time", null);
      if (openBlocks && openBlocks.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in(
            "id",
            openBlocks.map((b) => b.id),
          );
      }
    } catch (e) {
      console.warn("[onPickBlockParty] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: unit.id,
        party_id: party.id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        work_notes: workNotes || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    setBlockStartFlow(null);
  };

  const _DEPRECATED_onPickBlockParty_LEGACY_UNUSED = async (
    party,
    workNotes,
  ) => {
    setBusy(true);
    const { unit } = blockStartFlow;
    // Defensive safety: only one open work block per shift. If another open
    // block exists (could happen across devices / stale state), close it
    // first so the new one's start time is correct and we never end up
    // double-clocked.
    try {
      const { data: openBlocks } = await supabase
        .from("work_blocks")
        .select("id")
        .eq("shift_id", shift.id)
        .is("end_time", null);
      if (openBlocks && openBlocks.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in(
            "id",
            openBlocks.map((b) => b.id),
          );
      }
    } catch (e) {
      console.warn("[onPickBlockParty] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: unit.id,
        party_id: party.id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        work_notes: workNotes || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      // Reflect any pre-closed blocks in local state too
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    setBlockStartFlow(null);
    // No auto-start: tapping "Start cleaning" only starts the WORK BLOCK
    // timer. Targets stay pending until the cleaner explicitly picks
    // them in the task picker. This stops the surprise where every
    // assignment at the bedroom flipped to in_progress on entry.
  };

  // Undo a work block started by mistake. Cleaner taps "Started by
  // mistake?" → confirm → we delete every task in the block, revert
  // any assignment_targets the cleaner advanced to in_progress back
  // to pending, then delete the work_block row itself. Cleaner lands
  // back at PropertyHub with no record this ever happened. Owners can
  // undo anyone's block; non-owners can only undo their own.
  // undoClosedBlock — owner/cleaner deletes a CLOSED workblock from
  // the "Today's work blocks" list. Unlike the active-block undo
  // (which only handles status='in_progress'), this also reverts items
  // the cleaner COMPLETED during the block since the work is being
  // wiped from history. Cleaner can only undo their own; owners/
  // managers can undo anyone's.
  const undoClosedBlock = async (block) => {
    if (!block?.id) return;
    const canUndoAnyone =
      employee?.role === "owner" || employee?.role === "manager";
    const isMine = block.shift_id === shift?.id;
    if (!canUndoAnyone && !isMine) {
      alert(tt("You can only undo work blocks you started yourself."));
      return;
    }
    const taskCount = (block.tasks || []).length;
    const photoCount = (block.tasks || []).reduce(
      (sum, t) =>
        sum + ((t.photos || []).filter((p) => !p.deleted_at).length || 0),
      0,
    );
    const detail = [
      taskCount > 0 && `${taskCount} task${taskCount === 1 ? "" : "s"}`,
      photoCount > 0 && `${photoCount} photo${photoCount === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const msg = tt(
      `Undo this finished workblock at ${block.unit?.label} · ${block.party?.label}? ${detail ? `${detail} will be deleted. ` : ""}Items marked done during this block will go back to pending. This cannot be reversed.`,
    );
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      // Revert in_progress + done items that this cleaner advanced
      // during the block's time window. We can't precisely tell
      // which items were touched in THIS block vs others, so we use
      // a conservative scope: items at this bedroom where the
      // started_by OR completed_by matches the block's shift's
      // employee. Owners/managers undoing someone else's block
      // revert based on the shift owner's id.
      const targetCleanerId = block.shift?.employee?.id;
      if (targetCleanerId && block.unit_id && block.party_id) {
        // Reset items started by this cleaner that are still in flight
        await supabase
          .from("assignment_targets")
          .update({
            status: "pending",
            started_at: null,
            started_by: null,
            completed_at: null,
            completed_by: null,
          })
          .eq("unit_id", block.unit_id)
          .eq("party_id", block.party_id)
          .or(
            `started_by.eq.${targetCleanerId},completed_by.eq.${targetCleanerId}`,
          )
          .gte("started_at", block.start_time)
          .lte("started_at", block.end_time || new Date().toISOString());
      }
      // Delete tasks belonging to this block (FK cascades photos +
      // participants will cascade from work_block FK).
      await supabase.from("tasks").delete().eq("work_block_id", block.id);
      // Delete the block itself.
      await supabase.from("work_blocks").delete().eq("id", block.id);
      // Drop from local state.
      setWorkBlocks((prev) => prev.filter((b) => b.id !== block.id));
    } catch (e) {
      alert("Could not undo: " + (e.message || e));
    }
    setBusy(false);
  };

  // moveClosedBlock — opens the existing move modal but targeting a
  // specific (non-active) block from the list. Reuses the
  // moveMultipleWorkBlocksTo handler under the hood since it accepts
  // any block ids.
  const [closedMoveTarget, setClosedMoveTarget] = useState(null);
  const moveClosedBlock = (block) => {
    if (!block?.id) return;
    const canMoveAnyone =
      employee?.role === "owner" || employee?.role === "manager";
    const isMine = block.shift_id === shift?.id;
    if (!canMoveAnyone && !isMine) {
      alert(tt("You can only move work blocks you started yourself."));
      return;
    }
    setClosedMoveTarget(block);
  };

  const undoBlock = async () => {
    if (!activeBlock) return;
    const canUndoAnyone =
      employee?.role === "owner" || employee?.role === "manager";
    const isMine = activeBlock.shift_id === shift?.id;
    if (!canUndoAnyone && !isMine) {
      alert(tt("You can only undo a work block you started yourself."));
      return;
    }
    const taskCount = (tasks || []).length;
    // Count non-deleted photos so the cleaner sees what'll be wiped.
    // FK cascade on tasks.delete drops photos too, so this is real loss.
    const photoCount = (tasks || []).reduce(
      (sum, t) => sum + (t.photos || []).filter((p) => !p.deleted_at).length,
      0,
    );
    const parts = [];
    if (taskCount > 0)
      parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);
    if (photoCount > 0)
      parts.push(`${photoCount} photo${photoCount === 1 ? "" : "s"}`);
    const detail =
      parts.length > 0 ? `${parts.join(" · ")} will be deleted. ` : "";
    const heavy = photoCount > 0;
    const msg = tt(
      `${heavy ? "\u26A0 " : ""}Undo this work block? ${detail}Any items you marked in-progress will go back to pending. This cannot be reversed.`,
    );
    if (!confirm(msg)) return;
    // Photos are often the whole point of a job (before/after proof). Deleting
    // them is permanent, so when any exist require a SECOND explicit yes — a
    // single mis-tap should never wipe evidence photos.
    if (photoCount > 0) {
      if (
        !confirm(
          tt(
            `This will permanently delete ${photoCount} photo${photoCount === 1 ? "" : "s"} that can't be recovered. Are you absolutely sure?`,
          ),
        )
      )
        return;
    }
    setBusy(true);
    try {
      // 1. Revert assignment_targets the cleaner advanced during this
      //    block. Scope to (unit_id, party_id, started_by=employee.id,
      //    status='in_progress'). Reset status to pending and clear
      //    the started_at / started_by stamps.
      if (employee?.id && activeBlock.unit_id && activeBlock.party_id) {
        await supabase
          .from("assignment_targets")
          .update({ status: "pending", started_at: null, started_by: null })
          .eq("unit_id", activeBlock.unit_id)
          .eq("party_id", activeBlock.party_id)
          .eq("started_by", employee.id)
          .eq("status", "in_progress");
      }
      // 2. Delete tasks belonging to this block (cascades photos via FK).
      await supabase.from("tasks").delete().eq("work_block_id", activeBlock.id);
      // 3. Delete the work_block itself.
      await supabase.from("work_blocks").delete().eq("id", activeBlock.id);
      // 4. Reset local state — drop from list, clear active.
      setWorkBlocks((prev) => prev.filter((b) => b.id !== activeBlock.id));
      setActiveBlock(null);
      setTasks([]);
      setActiveTask(null);
    } catch (e) {
      alert("Could not undo: " + (e.message || e));
    }
    setBusy(false);
  };

  // ===== Multi-cleaner workblock helpers =====
  // joinBlock — cleaner taps "Join" on another cleaner's active
  // workblock (from Suggested tab or Who's-here popup). Creates a
  // work_block_participants row for THIS cleaner under their shift,
  // then opens the BlockView with that block as activeBlock. The
  // helper cleaner now shares the block: same items, same task list,
  // photos attributed to whoever takes them.
  //
  // Cap: 4 participants per block. Includes the original starter.
  const PARTICIPANT_CAP = 4;
  // Close EVERY open work block this cleaner owns, across ALL their shifts —
  // not just the current one. A cleaner should only ever have one block open
  // at a time; scoping the pre-close to the current shift let a stale block
  // from an earlier still-open shift stay running, which is how someone ended
  // up "active" in two different bedrooms (101 and 312) at once. Returns the
  // ids it closed so callers can update local state.
  const closeAllMyOpenBlocks = async (exceptId = null) => {
    if (!employee?.id) return [];
    try {
      // Find this cleaner's open blocks via their shifts (any shift, open or
      // not) — the block is "mine" if its shift belongs to me.
      const { data: myShifts } = await supabase
        .from("shifts")
        .select("id")
        .eq("employee_id", employee.id);
      const shiftIds = (myShifts || []).map((s) => s.id);
      if (shiftIds.length === 0) return [];
      let q = supabase
        .from("work_blocks")
        .select("id")
        .in("shift_id", shiftIds)
        .is("end_time", null);
      if (exceptId) q = q.neq("id", exceptId);
      const { data: openBlocks } = await q;
      const ids = (openBlocks || []).map((b) => b.id);
      if (ids.length > 0) {
        const ts = new Date().toISOString();
        await supabase
          .from("work_blocks")
          .update({ end_time: ts })
          .in("id", ids);
        setWorkBlocks((prev) =>
          prev.map((b) => (ids.includes(b.id) ? { ...b, end_time: ts } : b)),
        );
      }
      return ids;
    } catch (e) {
      console.warn("[closeAllMyOpenBlocks] failed", e);
      return [];
    }
  };

  const joinBlock = async (targetBlock) => {
    if (!targetBlock?.id) return;
    if (!shift?.id) {
      alert("Clock in first to join a workblock.");
      return;
    }
    if (activeBlock?.id === targetBlock.id) {
      // Already in this block — just snap the tab back to Home
      setCleanerTab("home");
      return;
    }
    setBusy(true);
    // Close THIS cleaner's other open workblocks under this shift first
    // so we don't end up with B owning a stale open block while also
    // being a participant in A's. Mirrors the pre-close pattern in
    // onPickBlockParty. The block's items stay in whatever status they
    // were in (paused / in_progress) — nothing is lost.
    try {
      if (activeTask) await stopTask(activeTask, false);
      // Close every open block I own (across all my shifts), except the one
      // I'm joining — prevents being active in two bedrooms via a stale shift.
      await closeAllMyOpenBlocks(targetBlock.id);
    } catch (e) {
      console.warn("[joinBlock] could not pre-close own open blocks", e);
    }
    try {
      // Count current participants (joined and not yet left)
      const { data: current } = await supabase
        .from("work_block_participants")
        .select("id, employee_id")
        .eq("work_block_id", targetBlock.id)
        .is("left_at", null);
      const alreadyHere = (current || []).some(
        (p) => p.employee_id === employee.id,
      );
      if (!alreadyHere && (current || []).length >= PARTICIPANT_CAP) {
        setBusy(false);
        alert(`This workblock is full (${PARTICIPANT_CAP} cleaners max).`);
        return;
      }
      // Create participant row (or no-op if cleaner already has one)
      if (!alreadyHere) {
        const { error: e1 } = await supabase
          .from("work_block_participants")
          .insert({
            work_block_id: targetBlock.id,
            employee_id: employee.id,
            shift_id: shift.id,
            joined_at: new Date().toISOString(),
          });
        if (e1 && !e1.message?.includes("duplicate key")) {
          setBusy(false);
          alert("Could not join: " + e1.message);
          return;
        }
      }
      // Pull full block details + tasks (shared task list with the
      // original starter — anyone in the block can add tasks)
      const { data: refreshed } = await supabase
        .from("work_blocks")
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("id", targetBlock.id)
        .single();
      if (refreshed) {
        setActiveBlock(refreshed);
        setTasks(refreshed.tasks || []);
        setCleanerTab("home");
      }
    } catch (e) {
      alert("Could not join: " + (e.message || e));
    }
    setBusy(false);
  };

  // leaveBlock — current cleaner steps out of the active block but
  // doesn't end it for others. Sets their participant row's left_at.
  // If they're the last remaining participant, we prompt and auto-
  // finish the block (per spec: last to leave finishes).
  const leaveBlock = async () => {
    if (!activeBlock || !employee?.id) return;
    // Are there OTHER cleaners still active here (besides me)? That decides
    // whether I'm just leaving (they stay) or closing the whole bedroom.
    const { data: others } = await supabase
      .from("work_block_participants")
      .select("id")
      .eq("work_block_id", activeBlock.id)
      .is("left_at", null)
      .neq("employee_id", employee.id);
    const othersCount = (others || []).length;
    const nowISO = new Date().toISOString();

    if (othersCount > 0) {
      // Not the last one — leaving ends MY session; the block stays open.
      if (
        !confirm(
          tt(
            "Finished your part in this bedroom? Your session here closes and you'll go back to your assignments — the other cleaner(s) stay until they finish.",
          ),
        )
      )
        return;
      setBusy(true);
      try {
        await supabase
          .from("work_block_participants")
          .update({ left_at: nowISO })
          .eq("work_block_id", activeBlock.id)
          .eq("employee_id", employee.id)
          .is("left_at", null);
      } catch (e) {
        setBusy(false);
        alert("Could not leave: " + (e.message || e));
        return;
      }
    } else {
      // Last one here — this closes out the WHOLE bedroom.
      const { data: openTargets } = await supabase
        .from("assignment_targets")
        .select("id")
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .in("status", ["pending", "in_progress", "paused"]);
      const stillOpen = (openTargets || []).length;
      const msg =
        stillOpen > 0
          ? tt(
              `You're closing out this whole bedroom. ${stillOpen} item${stillOpen === 1 ? " is" : "s are"} still not done — finish anyway and go back to your assignments?`,
            )
          : tt("Close out this whole bedroom and go back to your assignments?");
      if (!confirm(msg)) return;
      setBusy(true);
      try {
        await supabase
          .from("work_block_participants")
          .update({ left_at: nowISO })
          .eq("work_block_id", activeBlock.id)
          .eq("employee_id", employee.id)
          .is("left_at", null);
        if (activeTask) await stopTask(activeTask, false);
        await supabase
          .from("work_blocks")
          .update({ end_time: nowISO })
          .eq("id", activeBlock.id);
        setWorkBlocks((prev) =>
          prev.map((b) =>
            b.id === activeBlock.id ? { ...b, end_time: nowISO } : b,
          ),
        );
      } catch (e) {
        setBusy(false);
        alert("Could not finish: " + (e.message || e));
        return;
      }
    }
    // Either way: drop out locally and land on the assignments list.
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setCleanerTab("home");
    setBusy(false);
  };

  // deletePhoto — soft-delete (cleaner can remove a bad / accidental
  // photo). Only the cleaner who took it OR an owner/manager can
  // delete; enforced both client + server side. We use deleted_at /
  // deleted_by columns instead of hard-deleting so we keep evidence
  // if needed later.
  const deletePhoto = async (photoId, taskId) => {
    if (!photoId) return;
    const photo = (tasks || [])
      .flatMap((t) => t.photos || [])
      .find((p) => p.id === photoId);
    if (!photo) return;
    const canDeleteAny =
      employee?.role === "owner" || employee?.role === "manager";
    const isMine = photo.taken_by === employee?.id;
    if (!canDeleteAny && !isMine) {
      alert(tt("You can only delete photos you took."));
      return;
    }
    if (!confirm(tt("Delete this photo? This cannot be reversed."))) return;
    const { error } = await supabase
      .from("photos")
      .update({ deleted_at: new Date().toISOString(), deleted_by: employee.id })
      .eq("id", photoId);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    // Drop from local state so the photo disappears immediately
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, photos: (t.photos || []).filter((p) => p.id !== photoId) }
          : t,
      ),
    );
  };

  // Translation helper used by handler prompts above. Resolves to a
  // Spanish string when the cleaner's locale === 'es' and a known
  // mapping exists; otherwise returns the original English. The full
  // translation system + dictionary is built in the next phase (E2);
  // this lightweight helper keeps the multi-cleaner prompts ready
  // for that wiring without blocking shipping E1.
  function tt(s) {
    try {
      const loc =
        (typeof window !== "undefined" && window.__tidytrack_locale) || "en";
      if (loc !== "es") return s;
      const dict =
        (typeof window !== "undefined" && window.__tidytrack_es) || {};
      return dict[s] || s;
    } catch {
      return s;
    }
  }

  const finishBlock = async () => {
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", activeBlock.id);
    // Auto-complete on close-out: EVERY still-open target at this (unit,
    // party) — pending, in_progress OR paused — gets flipped to done. The
    // earlier version only caught in_progress, so an assignment the cleaner
    // never tapped "Start" on stayed pending and lingered in All Pending
    // after they hit "I'm done here". "Done here" means done here.
    //
    // Limited to active assignments at this customer. PM-sourced
    // assignments must be approved before they count.
    try {
      const { data: inProg } = await supabase
        .from("assignment_targets")
        .select(
          "id, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
        )
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .in("status", ["pending", "in_progress", "paused"]);
      const ids = (inProg || [])
        .filter(
          (t) =>
            t.assignment?.customer_id === shift?.customer_id &&
            t.assignment?.active &&
            !t.assignment?.deleted_at &&
            isPmApprovedAssignment(t.assignment),
        )
        .map((t) => t.id);
      if (ids.length > 0) {
        await supabase
          .from("assignment_targets")
          .update({
            status: "done",
            completed_at: ts,
            completed_by: employee?.id || null,
          })
          .in("id", ids);
      }
    } catch (e) {
      console.warn("[finishBlock auto-complete] failed", e);
    }
    const updated = { ...activeBlock, end_time: ts, tasks };
    setWorkBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? updated : b)),
    );
    // Capture the bedroom we just finished so the NextUpPrompt knows
    // which apartment / floor / building to suggest from.
    const finishedFrom = {
      unitId: activeBlock.unit_id,
      unitLabel: activeBlock.unit?.label,
      partyId: activeBlock.party_id,
      partyLabel: activeBlock.party?.label,
      propertyId: shift.customer_id,
    };
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setBusy(false);
    // Back to the assignments list, with the "what's next?" prompt on top.
    setCleanerTab("home");
    setNextUpPrompt(finishedFrom);
  };

  // Generic end-block — closes ANY block by id, including the one
  // surfaced in the PropertyHub resume banner. Differs from
  // finishBlock above which only operates on the currently-active
  // block (held in state).
  const endBlock = async (block) => {
    if (!block) return;
    if (
      !confirm(
        `End work block at ${block.unit?.label} · ${block.party?.label}?`,
      )
    )
      return;
    setBusy(true);
    // If they're ending the block that happens to be active right now,
    // stop any running task too so we don't leave orphaned timing.
    if (activeBlock?.id === block.id && activeTask) {
      await stopTask(activeTask, false);
    }
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", block.id);
    setWorkBlocks((prev) =>
      prev.map((b) => (b.id === block.id ? { ...b, end_time: ts } : b)),
    );
    if (activeBlock?.id === block.id) {
      setActiveBlock(null);
      setTasks([]);
      setActiveTask(null);
    }
    setBusy(false);
  };

  const reopenBlock = async (block) => {
    setBusy(true);
    // Pre-close any of MY currently-open blocks so we don't end up with
    // two open at once. We scope this to the current shift since those
    // are the only blocks "I" own right now. A block closed by mistake
    // can belong to an earlier shift or another cleaner — we still
    // reopen it below regardless of whose shift it's under, so anyone
    // can recover a block that was closed by accident.
    try {
      // Close every open block I own across all my shifts (not just the
      // current one), except the one being reopened.
      await closeAllMyOpenBlocks(block.id);
    } catch (e) {
      console.warn("[reopenBlock] could not pre-close open blocks", e);
    }
    // Reopen the target. Surface any error instead of silently failing
    // (the old version assumed success and updated local state even if
    // the DB write was rejected, which looked like "reopen does
    // nothing").
    const { error: reErr } = await supabase
      .from("work_blocks")
      .update({ end_time: null })
      .eq("id", block.id);
    if (reErr) {
      console.error("[reopenBlock] reopen failed", reErr);
      alert("Could not reopen this work block: " + reErr.message);
      setBusy(false);
      return;
    }
    const { data: blockTasks } = await supabase
      .from("tasks")
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .eq("work_block_id", block.id)
      .order("start_time");
    const updated = { ...block, end_time: null, tasks: blockTasks || [] };
    setWorkBlocks((prev) => {
      const exists = prev.some((b) => b.id === block.id);
      const next = prev.map((b) => {
        if (b.id === block.id) return updated;
        // Reflect the pre-closure in local state for any other currently-open blocks
        if (!b.end_time) return { ...b, end_time: new Date().toISOString() };
        return b;
      });
      // If the reopened block wasn't already in local state (e.g. it
      // belonged to another shift / the Others list), add it so the
      // active-block view has it.
      return exists ? next : [updated, ...next];
    });
    setActiveBlock(updated);
    setTasks(blockTasks || []);
    // Resume always sends the cleaner back to the Home tab (BlockView).
    // Without this, if they tapped Resume from the Assignments tab,
    // they'd stay on Assignments with the block now in state — the
    // active workblock useEffect only fires on activeBlock.id change,
    // so a same-block reopen wouldn't trigger it.
    setCleanerTab("home");
    setBusy(false);
  };

  // Move the active work block to a different bedroom in this property.
  // Used when the cleaner (or owner in preview) opened the wrong bedroom
  // and put their tasks/photos/notes there — instead of redoing all
  // that data entry, we just relabel the block by updating its unit_id
  // + party_id. Tasks/photos follow via foreign keys. The old bedroom
  // is left clean (no leftover row).
  const moveActiveBlockTo = async (newUnit, newParty, resetIds = []) => {
    if (!activeBlock) return;
    if (!newUnit?.id || !newParty?.id) {
      alert("Pick a unit and bedroom.");
      return;
    }
    if (
      newUnit.id === activeBlock.unit_id &&
      newParty.id === activeBlock.party_id
    ) {
      alert("That's already where this block is.");
      return;
    }
    setBusy(true);
    // Conflict check — if a separate block already exists at the target
    // bedroom in this shift, ask before creating a duplicate.
    try {
      const { data: existing } = await supabase
        .from("work_blocks")
        .select("id, end_time")
        .eq("shift_id", shift.id)
        .eq("unit_id", newUnit.id)
        .eq("party_id", newParty.id)
        .neq("id", activeBlock.id);
      if (existing && existing.length > 0) {
        setBusy(false);
        const hasOpen = existing.some((b) => !b.end_time);
        const msg = hasOpen
          ? `There's already an OPEN work block at ${newUnit.label} · ${newParty.label} in this shift. Move anyway? You'll end up with two — close one manually after.`
          : `There's already a completed work block at ${newUnit.label} · ${newParty.label} in this shift. Move anyway?`;
        if (!confirm(msg)) return;
        setBusy(true);
      }
    } catch (e) {
      console.warn("[moveActiveBlockTo] conflict check failed", e);
    }
    const { error } = await supabase
      .from("work_blocks")
      .update({ unit_id: newUnit.id, party_id: newParty.id })
      .eq("id", activeBlock.id);
    setBusy(false);
    if (error) {
      alert("Could not move work block: " + error.message);
      return;
    }

    // Reset old-bedroom assignments to Pending if the cleaner asked
    // for it. Wipes started_by/completed_by/started_at/completed_at so
    // the assignment looks untouched in reports too. status_notes is
    // preserved (might be a Blocked note the manager still wants to
    // see). Failure here is non-fatal — the move already happened.
    if (resetIds && resetIds.length > 0) {
      const { error: resetErr } = await supabase
        .from("assignment_targets")
        .update({
          status: "pending",
          started_by: null,
          started_at: null,
          completed_by: null,
          completed_at: null,
        })
        .in("id", resetIds);
      if (resetErr) console.warn("[moveActiveBlockTo] reset failed:", resetErr);
    }

    // Refresh activeBlock with the new unit/party labels so the header
    // updates immediately. Fetch the joined row so we have nested labels.
    const { data: refreshed } = await supabase
      .from("work_blocks")
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .eq("id", activeBlock.id)
      .single();
    if (refreshed) {
      setActiveBlock(refreshed);
      setTasks(refreshed.tasks || []);
      setWorkBlocks((prev) =>
        prev.map((b) => (b.id === activeBlock.id ? refreshed : b)),
      );
    }
  };

  // Multi-block move — used by the "Something's wrong" menu for both
  //   • Wrong bedroom  — caller passes all blocks at the current
  //     (unit, party) so the entire bedroom relocates as a unit
  //   • Wrong workblock — caller passes a user-selected subset of
  //     blocks within the current unit (any bedroom)
  // We do conflict checks against the destination only ONCE
  // (against any of the moved blocks). Reset of source assignment
  // targets is applied at the end if requested.
  const moveMultipleWorkBlocksTo = async (
    blockIds,
    newUnit,
    newParty,
    resetIds = [],
  ) => {
    if (!blockIds || blockIds.length === 0) return;
    if (!newUnit?.id || !newParty?.id) {
      alert("Pick a unit and bedroom.");
      return;
    }
    setBusy(true);
    try {
      // Update every block to the new (unit, party)
      const { error: e1 } = await supabase
        .from("work_blocks")
        .update({ unit_id: newUnit.id, party_id: newParty.id })
        .in("id", blockIds);
      if (e1) {
        alert("Could not move work blocks: " + e1.message);
        setBusy(false);
        return;
      }
      // Reset old-bedroom assignment_targets if asked
      if (resetIds && resetIds.length > 0) {
        const { error: e2 } = await supabase
          .from("assignment_targets")
          .update({
            status: "pending",
            started_by: null,
            started_at: null,
            completed_by: null,
            completed_at: null,
          })
          .in("id", resetIds);
        if (e2) console.warn("[moveMultipleWorkBlocksTo] reset failed:", e2);
      }
      // Refresh state — if the activeBlock was one of the moved ones,
      // re-fetch it so the BlockView header updates. Same for workBlocks
      // list (we re-fetch all from the shift).
      const { data: allBlocks } = await supabase
        .from("work_blocks")
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .eq("shift_id", shift.id)
        .order("start_time");
      setWorkBlocks(allBlocks || []);
      if (activeBlock && blockIds.includes(activeBlock.id)) {
        const refreshed = (allBlocks || []).find(
          (b) => b.id === activeBlock.id,
        );
        if (refreshed) {
          setActiveBlock(refreshed);
          setTasks(refreshed.tasks || []);
        }
      }
    } catch (e) {
      alert("Could not move work blocks: " + (e.message || e));
    }
    setBusy(false);
  };

  // Cleaner picked one or more checklist items in the TaskCategoryPicker
  // and tapped Start. We do TWO things in one shot:
  //  1) Flip every picked assignment_target from pending/paused to
  //     in_progress so the AssignmentBanner and ChecklistAssignmentView
  //     immediately reflect that work is happening.
  //  2) Create ONE combined task tied to the current shift+block so
  //     time tracking + reports stay aligned with the legacy flow.
  // This is the bridge between the new checklist data model and the
  // existing tasks/work_blocks pipeline.
  // Guarantee we have a REAL, existing work_block to attach tasks to. The
  // FK "tasks_work_block_id_fkey" fails when activeBlock in state points at a
  // block that's been closed+removed or is otherwise stale (e.g. a previous
  // session). This checks the DB; if the block is gone, it opens a fresh one
  // at the same bedroom and returns its id. Returns null only if we truly
  // can't place the work (no bedroom context).
  const ensureActiveBlock = async () => {
    // If we think we have a block, verify it actually exists.
    if (activeBlock?.id) {
      try {
        const { data: exists } = await supabase
          .from("work_blocks")
          .select("id, end_time")
          .eq("id", activeBlock.id)
          .maybeSingle();
        if (exists && !exists.end_time) return activeBlock; // valid & open
      } catch {
        /* fall through to recreate */
      }
    }
    // Need to (re)create a block. Figure out where.
    const unitId = activeBlock?.unit_id || pendingStart?.unitId;
    const partyId = activeBlock?.party_id || pendingStart?.partyId;
    const assignmentId =
      activeBlock?.assignment_id || pendingStart?.assignmentId || null;
    if (!shift?.id || !unitId || !partyId) return activeBlock || null;
    try {
      await closeAllMyOpenBlocks(null);
      const { data, error } = await supabase
        .from("work_blocks")
        .insert({
          shift_id: shift.id,
          unit_id: unitId,
          party_id: partyId,
          assignment_id: assignmentId,
          bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
          is_preview: previewMode,
        })
        .select(
          "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
        )
        .single();
      if (error) {
        console.warn("[ensureActiveBlock] recreate failed", error);
        return activeBlock || null;
      }
      setWorkBlocks((prev) => [
        ...prev.map((b) =>
          b.end_time ? b : { ...b, end_time: new Date().toISOString() },
        ),
        data,
      ]);
      setActiveBlock(data);
      return data;
    } catch (e) {
      console.warn("[ensureActiveBlock] error", e);
      return activeBlock || null;
    }
  };

  const startTasksFromChecklistItems = async ({
    targets: pickedTargets,
    name,
    category,
  }) => {
    if (!pickedTargets || pickedTargets.length === 0) return;
    // Stop the current active task before starting a new one (matches
    // legacy onStartTask behavior — only ONE task active at a time).
    if (activeTask) await stopTask(activeTask, false);
    // 1) Advance picked targets to in_progress in a single update
    const ids = pickedTargets.map((t) => t.id);
    const toAdvance = pickedTargets.filter(
      (t) => t.status === "pending" || t.status === "paused",
    );
    if (toAdvance.length > 0) {
      const { error: tErr } = await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          started_by: employee.id,
        })
        .in(
          "id",
          toAdvance.map((t) => t.id),
        );
      if (tErr) {
        console.warn(
          "[startTasksFromChecklistItems] target advance failed:",
          tErr,
        );
      }
    }
    // 2) Create one task that represents this work session. Tag with
    //    category so reports show what was covered. We store the
    //    combined item names so PMs see the full picture.
    const ins = {
      shift_id: shift.id,
      name,
      category: category || null,
      subcategory: null,
      is_preview: previewMode,
    };
    const liveBlock = await ensureActiveBlock();
    if (liveBlock?.id) ins.work_block_id = liveBlock.id;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert(ins)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (error) {
      alert("Could not start task: " + error.message);
      return;
    }
    setTasks((prev) => [...prev, row]);
    setActiveTask(row.id);
    setNewTaskName("");
  };

  // Cleaner taps the X on an in-progress item — "I started this but
  // need to step away". Previously this dropped the item back to
  // 'pending' and wiped started_by/started_at, which silently erased
  // evidence of in-flight work (the bedroom would show 0% done in
  // audits even though photos existed).
  //
  // New behavior: route to 'paused' so the work is preserved in audit.
  // started_by/started_at are kept so we know who paused it and when;
  // any other cleaner can then resume from the Paused bucket. Pending
  // is reserved for items that have NEVER been touched.
  //
  // Items that were never started (still 'pending') are left alone —
  // there's nothing to release.
  const releaseTargetsFromWorkblock = async (targets) => {
    if (!targets || targets.length === 0) return;
    const releasable = targets.filter(
      (t) => t.status === "in_progress" || t.status === "paused",
    );
    if (releasable.length === 0) return;
    const ids = releasable.map((t) => t.id);
    const { error } = await supabase
      .from("assignment_targets")
      .update({ status: "paused" })
      .in("id", ids);
    if (error) {
      alert("Could not release: " + error.message);
    }
  };

  // Tapping an assignment from outside a bedroom: take the cleaner to
  // PropertyHub with a "pending start" banner for the target bedroom.
  // We DO NOT create the work_block here — that happens when the cleaner
  // taps the big Start cleaning button on the banner. This separates
  // "I'm heading to this bedroom" from "the timer starts now."
  //
  // - Same bedroom is already active → just stay there (no-op)
  // - A different bedroom is active → confirm switch, then close current
  //   block, then show pending start banner
  // - A coworker has an open block at this bedroom → join (open the existing one)
  // - Else → set pendingStart banner; cleaner taps Start to create block
  const goToBedroomForTarget = async (target) => {
    if (!target.unit_id || !target.party_id) {
      alert("This assignment isn't tied to a specific bedroom.");
      return;
    }

    // Already on this bedroom? Just open it.
    if (
      activeBlock &&
      activeBlock.unit_id === target.unit_id &&
      activeBlock.party_id === target.party_id &&
      !activeBlock.end_time
    ) {
      return; // already there
    }

    // Active block but on a different bedroom — open the
    // SwitchBedroomModal with 3 options instead of a native confirm.
    // The modal will call back into resolveSwitchTo* helpers below
    // depending on which button the cleaner taps.
    if (activeBlock && !activeBlock.end_time) {
      setSwitchPending({
        target,
        fromUnitLabel: activeBlock.unit?.label || "",
        fromPartyLabel: activeBlock.party?.label || "",
        toUnitLabel: target.unit?.label || "",
        toPartyLabel: target.party?.label || "",
      });
      return;
    }

    // If THIS cleaner has their own open block at this bedroom, close it
    // first (stop the running timer) and route through the pending-start
    // screen. We don't want "go to this bedroom" to land them in a
    // timer-running view — the user has been explicit about this. The
    // earlier work time stays preserved in the closed block; a fresh
    // block gets created when they tap Start cleaning.
    const myOpen = workBlocks.find(
      (b) =>
        !b.end_time &&
        b.unit_id === target.unit_id &&
        b.party_id === target.party_id,
    );
    if (myOpen) {
      setBusy(true);
      if (activeTask) await stopTask(activeTask, false);
      const ts = new Date().toISOString();
      await supabase
        .from("work_blocks")
        .update({ end_time: ts })
        .eq("id", myOpen.id);
      setWorkBlocks((prev) =>
        prev.map((b) => (b.id === myOpen.id ? { ...b, end_time: ts } : b)),
      );
      if (activeBlock?.id === myOpen.id) {
        setActiveBlock(null);
        setTasks([]);
        setActiveTask(null);
      }
      setBusy(false);
    }

    // Show the pending start screen — cleaner confirms by tapping Start.
    // Carry the assignment_id through so the work block created on confirm
    // is tagged with the exact job the cleaner came from (the card they
    // tapped), keeping two jobs at one bedroom — e.g. trash-out vs move-out
    // — from merging into one session.
    setPendingStart({
      unitId: target.unit_id,
      partyId: target.party_id,
      unitLabel: target.unit?.label || "",
      partyLabel: target.party?.label || "",
      assignmentId: target.assignment_id || target.assignment?.id || null,
    });
  };

  // ----- SwitchBedroomModal callbacks -----
  // The modal hands the cleaner three explicit actions for "I want
  // to switch to a different bedroom while one is open":
  //   - Stay        (close the modal, do nothing)
  //   - Pause + go  (pause in_progress items, end the block, route to new)
  //   - Finish + go (mark in_progress items DONE, end the block, route to new)
  // Both Pause and Finish then call goToBedroomForTarget for the new
  // target — which by then has no active block so it falls through to
  // the pendingStart branch and routes the cleaner to the bedroom
  // landing page.
  const closeCurrentBlockAndSwitch = async ({ markStatus, target }) => {
    setSwitchPending(null);
    if (!activeBlock || activeBlock.end_time) {
      // Block already gone — just route.
      await goToBedroomForTarget(target);
      return;
    }
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    // Update the cleaner's open items at the current bedroom to the
    // chosen status (paused for resume, done for finish).
    if (employee?.id && activeBlock.unit_id && activeBlock.party_id) {
      try {
        const patch = { status: markStatus };
        if (markStatus === "done") {
          patch.completed_at = new Date().toISOString();
          patch.completed_by = employee.id;
        }
        await supabase
          .from("assignment_targets")
          .update(patch)
          .eq("unit_id", activeBlock.unit_id)
          .eq("party_id", activeBlock.party_id)
          .eq("started_by", employee.id)
          .eq("status", "in_progress");
      } catch (e) {
        console.warn(
          `[switch bedroom] could not ${markStatus} in-progress items`,
          e,
        );
      }
    }
    const ts = new Date().toISOString();
    await supabase
      .from("work_blocks")
      .update({ end_time: ts })
      .eq("id", activeBlock.id);
    const updated = { ...activeBlock, end_time: ts, tasks };
    setWorkBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? updated : b)),
    );
    setActiveBlock(null);
    setTasks([]);
    setActiveTask(null);
    setBusy(false);
    // Now route into the requested bedroom (fall-through to pendingStart).
    await goToBedroomForTarget(target);
  };
  const resolveSwitchPause = async (target) =>
    closeCurrentBlockAndSwitch({ markStatus: "paused", target });
  const resolveSwitchFinish = async (target) =>
    closeCurrentBlockAndSwitch({ markStatus: "done", target });

  // Confirm the pending start: actually create the work_block now and
  // open it as active. Called by the Start button on the PropertyHub
  // pending banner.
  const confirmPendingStart = async () => {
    if (!pendingStart) return;
    setBusy(true);
    // Safety: close every open block I own across ALL my shifts before opening
    // a new one — a stale block from an earlier open shift must not stay
    // running in another bedroom.
    try {
      await closeAllMyOpenBlocks(null);
    } catch (e) {
      console.warn("[confirmPendingStart] could not pre-close open blocks", e);
    }
    const { data, error } = await supabase
      .from("work_blocks")
      .insert({
        shift_id: shift.id,
        unit_id: pendingStart.unitId,
        party_id: pendingStart.partyId,
        assignment_id: pendingStart.assignmentId || null,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        is_preview: previewMode,
      })
      .select(
        "*, unit:units(*), party:parties(*), tasks(*, photos(*, taken_by_employee:employees!taken_by(name)))",
      )
      .single();
    setBusy(false);
    if (error) {
      alert("Could not start work block: " + error.message);
      return;
    }
    setWorkBlocks((prev) => {
      const ts = new Date().toISOString();
      const closed = prev.map((b) => (b.end_time ? b : { ...b, end_time: ts }));
      return [...closed, data];
    });
    setActiveBlock(data);
    setTasks(data.tasks || []);
    setPendingStart(null);
    // No auto-start: starting the work block only starts the TIMER.
    // The cleaner explicitly picks items from the picker (or taps
    // Start on individual assignment cards) to flip them to
    // in_progress. Stops the "I tapped Start cleaning and everything
    // is suddenly marked in progress" surprise.
  };

  // Cancel the pending start (cleaner decides not to start after all)
  const cancelPendingStart = () => setPendingStart(null);

  // Send-back-to-pending: cleaner navigated here but realized it's
  // the wrong bedroom (or changed their mind). Previously reset any
  // of THEIR OWN in_progress/paused targets at this bedroom to
  // 'pending' + wiped started_by/started_at — which silently erased
  // evidence of work in flight (the same bug class as the release-X
  // path we fixed earlier). Now those items move to 'paused' with
  // started_by/started_at preserved so the audit stays honest and
  // any other cleaner can resume.
  //
  // The function name still reads "send back to pending" because
  // the user-visible flow is the same (cleaner backs out, queue
  // looks fresh); only the internal status routing changed.
  const sendBackToPendingFromPrepare = async () => {
    if (!pendingStart || !employee?.id) {
      setPendingStart(null);
      return;
    }
    try {
      const { data: mine } = await supabase
        .from("assignment_targets")
        .select("id, status, assignment:assignments!inner(customer_id, active)")
        .eq("unit_id", pendingStart.unitId)
        .eq("party_id", pendingStart.partyId)
        .in("status", ["in_progress", "paused"])
        .eq("started_by", employee.id);
      const eligible = (mine || []).filter(
        (t) =>
          t.assignment?.customer_id === shift?.customer_id &&
          t.assignment?.active,
      );
      // Route in_progress → paused. Items already paused stay paused
      // (no-op). started_by/started_at are PRESERVED so the audit
      // trail still says who and when.
      const toPause = eligible.filter((t) => t.status === "in_progress");
      if (toPause.length > 0) {
        await supabase
          .from("assignment_targets")
          .update({
            status: "paused",
          })
          .in(
            "id",
            toPause.map((t) => t.id),
          );
      }
    } catch (e) {
      console.warn("[sendBackToPending] failed", e);
    }
    setPendingStart(null);
  };

  // Tasks
  // When a cleaner starts working at a bedroom (via the picker, the
  // freeform task entry, or anything that creates a task in the active
  // work block), we want pending assignment_targets at THIS bedroom to
  // flip to in_progress. Otherwise the audit shows them stuck at
  // pending even after photos and work are logged, which is the
  // exact source of cleaner confusion ("I took pictures and marked
  // complete but it still says pending"). Limited to active
  // assignments belonging to this property so we don't accidentally
  // touch out-of-scope rows.
  const advancePendingTargetsAtActiveBedroom = async () => {
    if (!activeBlock?.unit_id || !activeBlock?.party_id || !employee?.id)
      return;
    try {
      const { data: pending } = await supabase
        .from("assignment_targets")
        .select(
          "id, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
        )
        .eq("unit_id", activeBlock.unit_id)
        .eq("party_id", activeBlock.party_id)
        .eq("status", "pending");
      const ids = (pending || [])
        .filter(
          (t) =>
            t.assignment?.customer_id === shift?.customer_id &&
            t.assignment?.active &&
            !t.assignment?.deleted_at &&
            isPmApprovedAssignment(t.assignment),
        )
        .map((t) => t.id);
      if (ids.length === 0) return;
      const nowISO = new Date().toISOString();
      await supabase
        .from("assignment_targets")
        .update({
          status: "in_progress",
          started_at: nowISO,
          started_by: employee.id,
        })
        .in("id", ids);
    } catch (e) {
      console.warn("[advancePending] failed", e);
    }
  };

  // Stamp main_section on the active workblock based on the dominant
  // task category. Called after task creation. The workblock's section
  // is derived from the first cleaning the cleaner does — if they pick
  // Bedroom items first, that's the workblock's section. Other cleaners
  // then see "Cleaner A · Bedroom is here" with a Join button instead
  // of a section-less workblock. Only stamps when main_section is null
  // so later cross-section work in the same block doesn't keep flipping
  // the label.
  const stampMainSectionFromCategories = async (categories) => {
    if (!activeBlock || activeBlock.main_section) return;
    const valid = (categories || []).filter(
      (c) => c && ["bedroom", "vanity", "bathroom", "general"].includes(c),
    );
    if (valid.length === 0) return;
    const counts = {};
    valid.forEach((c) => {
      counts[c] = (counts[c] || 0) + 1;
    });
    const dominant = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a],
    )[0];
    if (!dominant) return;
    const { error } = await supabase
      .from("work_blocks")
      .update({ main_section: dominant })
      .eq("id", activeBlock.id);
    if (error) {
      console.warn("[stampMainSection] failed", error);
      return;
    }
    setActiveBlock((prev) =>
      prev ? { ...prev, main_section: dominant } : prev,
    );
    setWorkBlocks((prev) =>
      prev.map((b) =>
        b.id === activeBlock.id ? { ...b, main_section: dominant } : b,
      ),
    );
  };

  const startTask = async (
    overrideName = null,
    category = null,
    subcategory = null,
  ) => {
    const nameToUse = (overrideName || newTaskName || "").trim();
    if (!nameToUse) return;
    if (activeTask) await stopTask(activeTask, false);
    const insert = {
      shift_id: shift.id,
      name: nameToUse,
      is_preview: previewMode,
    };
    const liveBlockT = await ensureActiveBlock();
    if (liveBlockT?.id) insert.work_block_id = liveBlockT.id;
    if (category) insert.category = category;
    if (subcategory) insert.subcategory = subcategory;
    const { data, error } = await supabase
      .from("tasks")
      .insert(insert)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (error) {
      alert("Could not start task: " + error.message);
      return;
    }
    setTasks((prev) => [...prev, data]);
    setActiveTask(data.id);
    setNewTaskName("");
    // Bedroom-level audit sync — runs after the task insert so the
    // task ID exists before we update targets.
    advancePendingTargetsAtActiveBedroom();
    // Stamp the workblock's section so other cleaners can see what
    // section A is working on (e.g. "Cleaner A · Bedroom is here").
    stampMainSectionFromCategories([category]);
    return data;
  };

  // Cleaner picker can submit ONE task (single category) or MULTIPLE
  // (e.g. multi-selected General subcategories). When multiple are
  // submitted, the FIRST one becomes active and the rest are inserted
  // as not-yet-started tasks so the cleaner can resume them in order.
  const startTasksFromPicker = async (taskInputs) => {
    if (!taskInputs || taskInputs.length === 0) return;
    if (activeTask) await stopTask(activeTask, false);
    // Insert the first task as started (with current timestamp via default)
    const first = taskInputs[0];
    const firstInsert = {
      shift_id: shift.id,
      name: first.name,
      category: first.category || null,
      subcategory: first.subcategory || null,
      is_preview: previewMode,
    };
    const liveBlockP = await ensureActiveBlock();
    if (liveBlockP?.id) firstInsert.work_block_id = liveBlockP.id;
    const { data: firstRow, error: firstErr } = await supabase
      .from("tasks")
      .insert(firstInsert)
      .select("*, photos(*, taken_by_employee:employees!taken_by(name))")
      .single();
    if (firstErr) {
      alert("Could not start task: " + firstErr.message);
      return;
    }
    setTasks((prev) => [...prev, firstRow]);
    setActiveTask(firstRow.id);

    // Insert the rest as "queued" tasks with start_time AND end_time both
    // null... actually they need start_time NOT NULL per schema. Best to
    // insert them STILL with start_time but immediately stop them — so
    // they appear in the task list as paused/queued, ready to resume.
    if (taskInputs.length > 1) {
      const rest = taskInputs.slice(1);
      const now = new Date();
      const queueRows = rest.map((t, i) => ({
        shift_id: shift.id,
        work_block_id: liveBlockP?.id || null,
        name: t.name,
        category: t.category || null,
        subcategory: t.subcategory || null,
        is_preview: previewMode,
        // Start them at a stable future-ish moment so order is preserved,
        // then immediately stop. They'll appear as "Resume" cards.
        start_time: new Date(now.getTime() + (i + 1) * 1000).toISOString(),
        end_time: new Date(now.getTime() + (i + 1) * 1000 + 100).toISOString(),
      }));
      const { data: queued, error: qErr } = await supabase
        .from("tasks")
        .insert(queueRows)
        .select("*, photos(*, taken_by_employee:employees!taken_by(name))");
      if (qErr) {
        console.warn("[startTasksFromPicker] could not queue extras:", qErr);
      } else if (queued) {
        setTasks((prev) => [...prev, ...queued]);
      }
    }
    setNewTaskName("");
    // Bedroom-level audit sync — same as startTask. Fires after all
    // tasks are inserted so the cleaner's pending targets at this
    // bedroom now reflect work in progress.
    advancePendingTargetsAtActiveBedroom();
    // Stamp the workblock's section from the dominant category in
    // this batch of tasks so other cleaners can see what's claimed.
    stampMainSectionFromCategories(taskInputs.map((t) => t.category));
  };

  const stopTask = async (taskId, refetch = true) => {
    const ts = new Date().toISOString();
    await supabase.from("tasks").update({ end_time: ts }).eq("id", taskId);
    if (refetch)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, end_time: ts } : t)),
      );
    if (activeTask === taskId) setActiveTask(null);
  };

  const resumeTask = async (taskId) => {
    if (activeTask) await stopTask(activeTask, false);
    await supabase.from("tasks").update({ end_time: null }).eq("id", taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, end_time: null } : t)),
    );
    setActiveTask(taskId);
  };

  const uploadPhoto = async (taskId, kind, file) => {
    // The single-camera flow may pass a null kind — the cleaner assigns the
    // bucket afterward. Default new photos to 'after' (the most common) so
    // there's always a valid bucket; they can reassign in the modal.
    const useKind = kind || "after";
    // Read the original capture time from the file's EXIF BEFORE compressing
    // (compression strips metadata). Null when the photo has no EXIF date.
    const takenAt = await readPhotoTakenAt(file);
    const compressed = await compressImage(file);
    const path = `${shift.id}/${taskId}/${useKind}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, compressed, { contentType: "image/jpeg" });
    if (upErr) {
      alert("Upload failed: " + upErr.message);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const { data: photo, error: pErr } = await supabase
      .from("photos")
      .insert({
        task_id: taskId,
        kind: useKind,
        storage_path: path,
        public_url: publicUrl,
        is_preview: previewMode,
        taken_by: employee?.id || null,
        taken_at: takenAt,
      })
      .select()
      .single();
    if (pErr) {
      alert("Could not save photo: " + pErr.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t,
      ),
    );
    // Return the new row so callers (PhotoModal) can attach a note to it
    return photo;
  };

  // Reassign a photo to a different bucket (before / after / damage /
  // couldn't clean). Used by the single-camera flow so the cleaner can tag
  // a photo after taking it, and fix it if it lands in the wrong bucket.
  const changePhotoKind = async (photoId, taskId, newKind) => {
    if (!photoId || !newKind) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              photos: (t.photos || []).map((p) =>
                p.id === photoId ? { ...p, kind: newKind } : p,
              ),
            }
          : t,
      ),
    );
    const { error } = await supabase
      .from("photos")
      .update({ kind: newKind })
      .eq("id", photoId);
    if (error) {
      alert("Could not change the photo tag: " + error.message);
    }
  };

  // Attach a short note to a previously-uploaded photo. Used by the
  // damage photo flow so cleaners can describe what's broken. Optional —
  // an empty note is fine and we no-op out of the DB write to keep
  // request volume down.
  const savePhotoNote = async (photoId, noteText, kind = null) => {
    if (!photoId) return;
    const trimmed = (noteText || "").trim();
    // "Couldn't clean" notes are read by PMs, who read English. Cleaners
    // mostly write Spanish. Translate ONCE here at save time and store the
    // English alongside the original — the cleaner's own words are never
    // overwritten, and PM screens don't pay for a translation on every view.
    let notesEn = null;
    if (trimmed && kind === KIND_CANNOT && isTextTranslateConfigured()) {
      try {
        const [res] = await translateText([trimmed], "en");
        if (res && res.detectedSourceLanguage !== "en" && res.translatedText) {
          notesEn = res.translatedText;
        }
      } catch (e) {
        // Never block the note on a translation failure — the PM can still
        // hit the Translate button by hand.
        console.warn(
          "[photo note] auto-translate failed, saving original only",
          e,
        );
      }
    }
    const payload = { notes: trimmed || null };
    if (notesEn) payload.notes_en = notesEn;
    let { error } = await supabase
      .from("photos")
      .update(payload)
      .eq("id", photoId);
    if (error && notesEn) {
      // notes_en column not there yet (migration v59 not run) — don't lose
      // the cleaner's note over it.
      console.warn(
        "[photo note] notes_en unavailable, saving original only",
        error,
      );
      delete payload.notes_en;
      ({ error } = await supabase
        .from("photos")
        .update(payload)
        .eq("id", photoId));
    }
    if (error) throw error;
    // Mirror the update into local state so the note shows immediately
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        photos: (t.photos || []).map((p) =>
          p.id === photoId ? { ...p, ...payload } : p,
        ),
      })),
    );
  };

  if (!loaded) return <Splash text="Loading…" />;

  // Supply checklist — cleaners confirm supplies before reaching any work UI.
  // Skipped in owner-preview. Fires for Beta accounts too (they render this
  // shell). Skips itself if the list is empty / on error, so never traps.
  if (!previewMode && !supplyOk) {
    // Wait for the same-day confirmation lookup before deciding — otherwise a
    // cleaner who already confirmed this morning sees the gate flash up for a
    // moment on every refresh.
    if (!supplyChecked) return <Splash text="Loading…" />;
    return (
      <SupplyChecklistGate
        employee={employee}
        onDone={() => setSupplyOk(true)}
        onSignOut={onSignOut}
      />
    );
  }

  // Reusable wrapper: overlays the idle warning + change-PIN modal regardless of view
  const withIdleModal = (children) => (
    <>
      {children}
      {showIdleWarning && (
        <IdleWarningModal onStillActive={dismissIdleWarning} />
      )}
      {/* Move a closed work block to a different bedroom from the
         PropertyHub list. Mounted at AuthedShift level so the modal
         survives view switches. */}
      {closedMoveTarget && (
        <MoveBlockModalInline
          block={closedMoveTarget}
          propertyId={shift?.customer_id}
          shiftId={shift?.id}
          currentEmployeeId={employee?.id}
          mode="bedroom"
          onSave={async (newUnit, newParty, resetIds) => {
            await moveMultipleWorkBlocksTo(
              [closedMoveTarget.id],
              newUnit,
              newParty,
              resetIds,
            );
            setClosedMoveTarget(null);
          }}
          onSaveMulti={async (blockIds, newUnit, newParty, resetIds) => {
            await moveMultipleWorkBlocksTo(
              blockIds,
              newUnit,
              newParty,
              resetIds,
            );
            setClosedMoveTarget(null);
          }}
          onClose={() => setClosedMoveTarget(null)}
        />
      )}
      {showChangePin && (
        <ChangePinModal
          employee={employee}
          onClose={() => setShowChangePin(false)}
          onSaved={(newPin) => {
            setEmployee({ ...employee, pin: newPin });
            setShowChangePin(false);
          }}
        />
      )}
      {/* Switch-bedroom modal — shown when a cleaner taps a different
         bedroom while one is open. Three explicit options: Stay /
         Pause + switch / Finish + switch. */}
      {switchPending && (
        <SwitchBedroomModal
          fromUnitLabel={switchPending.fromUnitLabel}
          fromPartyLabel={switchPending.fromPartyLabel}
          toUnitLabel={switchPending.toUnitLabel}
          toPartyLabel={switchPending.toPartyLabel}
          busy={busy}
          onStay={() => setSwitchPending(null)}
          onPause={() => resolveSwitchPause(switchPending.target)}
          onFinish={() => resolveSwitchFinish(switchPending.target)}
        />
      )}
      {/* Bedroom history overlay — rendered as a fixed-position layer
         on top of whatever the cleaner was looking at, NOT a route
         replacement. Tapping Back closes it and the underlying screen
         comes right back with its tab/filter/scroll state intact. */}
      {bedroomHistory && (
        <BedroomHistoryView
          propertyId={shift?.customer_id || viewOnlyProperty?.id}
          propertyName={shift?.customer?.name || viewOnlyProperty?.name || ""}
          unitId={bedroomHistory.unitId}
          unitLabel={bedroomHistory.unitLabel}
          partyId={bedroomHistory.partyId}
          partyLabel={bedroomHistory.partyLabel}
          employee={employee}
          onBack={() => setBedroomHistory(null)}
        />
      )}
      {/* Next-up prompt — shown after the cleaner finishes a bedroom.
         Suggests where to go next (same apt → same floor → same
         building → other building starting on the 3rd floor). Picking
         a suggestion routes through the pending-start flow so the
         cleaner still has to tap Start cleaning on the next landing. */}
      {nextUpPrompt && (
        <NextUpModal
          from={nextUpPrompt}
          employeeId={employee?.id}
          onClose={() => setNextUpPrompt(null)}
          onSeeAssignments={() => {
            setNextUpPrompt(null);
            setCleanerTab("home");
          }}
          onPick={(c) => {
            setNextUpPrompt(null);
            // Reuse the existing pending-start route — no work block
            // gets created until the cleaner taps Start cleaning.
            setPendingStart({
              unitId: c.unitId,
              partyId: c.partyId,
              unitLabel: c.unitLabel,
              partyLabel: c.partyLabel,
            });
          }}
        />
      )}
    </>
  );

  // Messages overlay — takes over the screen, regardless of where cleaner was
  if (showMessages) {
    return withIdleModal(
      <StaffMessagesTab
        employee={employee}
        onClose={() => {
          logViewOnlyAction("viewed_messages");
          setShowMessages(false);
        }}
      />,
    );
  }

  // View-only mode: cleaner is browsing without a real shift
  if (viewOnlySession) {
    return (
      <ViewOnlyDashboard
        employee={employee}
        property={viewOnlyProperty}
        onSignOut={signOutWithCleanup}
        onEndViewing={endViewOnly}
        onOpenMessages={() => {
          logViewOnlyAction("opened_messages");
          setShowMessages(true);
        }}
        onOpenBedroomHistory={(params) => {
          logViewOnlyAction("opened_bedroom_history");
          setBedroomHistory(params);
        }}
        onSwitchProperty={async () => {
          await endViewOnly();
          setClockInFlow({ step: "view-only-property" });
        }}
      />
    );
  }

  if (!shift && clockInFlow?.step === "property") {
    return withIdleModal(
      <PropertyPicker
        onPick={onPickProperty}
        onCancel={() => setClockInFlow(null)}
        busy={busy}
        employee={employee}
      />,
    );
  }
  if (!shift && clockInFlow?.step === "view-only-property") {
    return withIdleModal(
      <PropertyPicker
        onPick={onPickViewOnlyProperty}
        onCancel={() => setClockInFlow(null)}
        busy={busy}
        title="Which property do you want to look at?"
        subtitle="View-only — no time will be tracked"
        viewOnly={true}
        employee={employee}
      />,
    );
  }
  if (shift && clockInFlow?.step === "attach-property") {
    return withIdleModal(
      <PropertyPicker
        onPick={onAttachProperty}
        onCancel={() => setClockInFlow(null)}
        busy={busy}
        title="Attach a property to this shift"
        subtitle="You'll stay clocked in — no time lost"
        viewOnly={true}
        employee={employee}
      />,
    );
  }
  if (shift && blockStartFlow?.step === "unit") {
    return withIdleModal(
      <UnitPicker
        property={shift.customer}
        onPick={onPickBlockUnit}
        onBack={() => setBlockStartFlow(null)}
        busy={busy}
        title="Which apartment?"
      />,
    );
  }
  if (shift && blockStartFlow?.step === "party") {
    return withIdleModal(
      <PartyPicker
        property={shift.customer}
        unit={blockStartFlow.unit}
        onPick={onPickBlockParty}
        onBack={() => setBlockStartFlow({ step: "unit" })}
        busy={busy}
      />,
    );
  }

  if (!shift) {
    return withIdleModal(
      <div className="min-h-screen bg-stone-50 flex flex-col pb-24">
        <Header
          name={employee.name}
          onSignOut={signOutWithCleanup}
          role={employee.role}
          cleanerView
          employee={employee}
          onOpenMessages={() => setShowMessages(true)}
          onOpenWhosHere={() => setWhosWorkingOpen(true)}
        />
        {whosWorkingOpen && (
          <WhosWorkingNowModal
            employee={employee}
            onClose={() => setWhosWorkingOpen(false)}
          />
        )}

        {/* NOT CLOCKED IN. This is its own screen — it is NOT PropertyHub's
           Home tab, it just shares the same CleanerWorkList, which is why
           the two look alike. The Assignments / More tabs in PropertyHub are
           scoped to the property of the current shift, and there's no shift
           yet, so those tabs get property-independent content here. */}
        {cleanerTab === "home" && (
          <>
            <div className="px-1 pt-2">
              <div className="px-4">
                <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-1">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <h2 className="text-3xl font-light text-stone-900 tracking-tight mb-1">
                  Your{" "}
                  <span className="font-serif italic text-amber-700">work</span>
                </h2>
              </div>
              <CleanerWorkList
                employee={employee}
                currentPropertyId={null}
                onStartJob={startJob}
                onGoToBedroom={null}
                onSwitchProperty={null}
              />
            </div>

            <div className="flex-1 flex flex-col justify-center items-center px-6 pb-6">
              <button
                onClick={startClockIn}
                disabled={busy}
                className="w-full max-w-sm py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50"
              >
                <Clock size={18} />
                <span>Clock in without a job</span>
              </button>
            </div>
          </>
        )}

        {/* Assignments, before a property is picked = where is the work.
           Tapping a property starts the clock-in flow there. */}
        {cleanerTab === "assignments" && (
          <div className="pt-4">
            <div className="px-4 mb-1">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
                Where the work is
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Open jobs by property. Tap one to clock in there.
              </p>
            </div>
            {/* Tapping a property clocks straight in there. It used to call
               startClockIn, which reopened the generic picker and made you
               choose the same property a second time. */}
            <CleanerPropertiesList
              currentPropertyId={null}
              employee={employee}
              onOpenCurrent={startClockIn}
              onSwitch={(p) => onPickProperty(p)}
            />
          </div>
        )}

        {cleanerTab === "more" && (
          <div className="px-4 pt-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
              Account &amp; settings
            </div>
            <CleanerMoreExtras employee={employee} />
            <button
              onClick={() => setShowMessages(true)}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
            >
              <MessageSquare size={18} className="text-stone-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">
                  Messages
                </div>
                <div className="text-xs text-stone-500">
                  Read and reply to the team
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowChangePin(true)}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98"
            >
              <User size={18} className="text-stone-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">
                  Change PIN
                </div>
                <div className="text-xs text-stone-500">
                  Update your sign-in code
                </div>
              </div>
            </button>
            <button
              onClick={startViewOnly}
              disabled={busy}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 text-left flex items-center gap-3 active:scale-98 disabled:opacity-50"
            >
              <Eye size={18} className="text-stone-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">
                  Just look around
                </div>
                <div className="text-xs text-stone-500">
                  Browse without tracking time
                </div>
              </div>
            </button>
            <button
              onClick={signOutWithCleanup}
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-stone-200 hover:border-red-300 text-left flex items-center gap-3 active:scale-98"
            >
              <LogOut size={18} className="text-red-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-600">Sign out</div>
              </div>
            </button>
          </div>
        )}

        <CleanerBottomNav active={cleanerTab} onChange={setCleanerTab} />
      </div>,
    );
  }

  const isMulti = shift.customer?.property_type === "multi_unit";

  // Pending-start route: cleaner tapped Start (or Go to this bedroom)
  // on an assignment but hasn't confirmed yet. Show the bedroom view
  // with no timer running and a big Start cleaning button.
  if (isMulti && !activeBlock && pendingStart) {
    return withIdleModal(
      <PreparingBlockView
        shift={shift}
        pendingStart={pendingStart}
        employeeName={employee.name}
        employee={employee}
        onSignOut={signOutWithCleanup}
        onCancel={cancelPendingStart}
        onStart={confirmPendingStart}
        onSendBackToPending={sendBackToPendingFromPrepare}
        onReopen={reopenBlock}
        onOpenMessages={() => setShowMessages(true)}
        onOpenBedroomHistory={setBedroomHistory}
        onJoinBlock={joinBlock}
        onExit={() => {
          setActiveBlock(null);
          setPendingStart(null);
          setCleanerTab("home");
        }}
        busy={busy}
      />,
    );
  }
  if (isMulti && (!activeBlock || cleanerTab !== "home")) {
    return withIdleModal(
      <PropertyHub
        shift={shift}
        workBlocks={workBlocks}
        employeeName={employee.name}
        employee={employee}
        onSignOut={signOutWithCleanup}
        onClockOut={clockOut}
        onSwitchProperty={switchProperty}
        onSwitchToJob={switchToJob}
        onStartNew={startNewBlock}
        onReopen={reopenBlock}
        onEndBlock={endBlock}
        onGoToBedroom={goToBedroomForTarget}
        onOpenMessages={() => setShowMessages(true)}
        onOpenChangePin={() => setShowChangePin(true)}
        onOpenBedroomHistory={setBedroomHistory}
        onJoinBlock={joinBlock}
        onUndoBlock={undoClosedBlock}
        onMoveBlock={moveClosedBlock}
        cleanerTab={cleanerTab}
        setCleanerTab={setCleanerTab}
        busy={busy}
      />,
    );
  }
  if (isMulti && activeBlock) {
    return withIdleModal(
      <>
        <ConfirmModal
          open={finishConfirmOpen}
          title="Close out this assignment?"
          message="You will close out this entire assignment. Confirm?"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          busy={busy}
          onCancel={() => setFinishConfirmOpen(false)}
          onConfirm={async () => {
            await finishBlock();
            setFinishConfirmOpen(false);
          }}
        />
        <BlockView
          shift={shift}
          block={activeBlock}
          tasks={tasks}
          activeTask={activeTask}
          employeeName={employee.name}
          employee={employee}
          onSignOut={signOutWithCleanup}
          onFinish={() => setFinishConfirmOpen(true)}
          onExit={async () => {
            // ✓ mark-complete / ✕ delete from the working screen should also CLOSE
            // the timer session. Without this the block was left open (paused) and
            // the home screen nagged you to Resume/Pause/End a session you'd
            // already finished.
            if (activeBlock) {
              const nowISO = new Date().toISOString();
              try {
                if (activeTask) await stopTask(activeTask, false);
                await supabase
                  .from("work_blocks")
                  .update({ end_time: nowISO })
                  .eq("id", activeBlock.id);
                setWorkBlocks((prev) =>
                  prev.map((b) =>
                    b.id === activeBlock.id ? { ...b, end_time: nowISO } : b,
                  ),
                );
              } catch (e) {
                console.warn("[onExit] could not close block", e);
              }
            }
            setActiveBlock(null);
            setPendingStart(null);
            setCleanerTab("home");
          }}
          onPause={() => setActiveBlock(null)}
          onUndo={undoBlock}
          onReopen={reopenBlock}
          newTaskName={newTaskName}
          setNewTaskName={setNewTaskName}
          onStartTask={startTask}
          onStartTasksFromPicker={startTasksFromPicker}
          onStartChecklistItems={startTasksFromChecklistItems}
          onReleaseTargets={releaseTargetsFromWorkblock}
          onStopTask={stopTask}
          onResumeTask={resumeTask}
          onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
          photoModal={photoModal}
          onClosePhotoModal={() => setPhotoModal(null)}
          onUploadPhoto={uploadPhoto}
          onChangePhotoKind={changePhotoKind}
          onSavePhotoNote={savePhotoNote}
          onOpenMessages={() => setShowMessages(true)}
          onOpenBedroomHistory={setBedroomHistory}
          onMoveBlock={moveActiveBlockTo}
          onMoveMultiple={moveMultipleWorkBlocksTo}
          onLeaveBlock={leaveBlock}
          onJoinBlock={joinBlock}
          onDeletePhoto={deletePhoto}
          onGoToBedroom={goToBedroomForTarget}
          onSwitchProperty={switchProperty}
          cleanerTab={cleanerTab}
          setCleanerTab={setCleanerTab}
          previewMode={previewMode}
          busy={busy}
        />
      </>,
    );
  }
  return withIdleModal(
    <SimpleShiftView
      shift={shift}
      tasks={tasks}
      activeTask={activeTask}
      employeeName={employee.name}
      employee={employee}
      onSignOut={signOutWithCleanup}
      onClockOut={clockOut}
      onSwitchProperty={switchProperty}
      onAttachProperty={startAttachProperty}
      newTaskName={newTaskName}
      setNewTaskName={setNewTaskName}
      onStartTask={startTask}
      onStartTasksFromPicker={startTasksFromPicker}
      onStartChecklistItems={startTasksFromChecklistItems}
      onReleaseTargets={releaseTargetsFromWorkblock}
      onStopTask={stopTask}
      onResumeTask={resumeTask}
      onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
      photoModal={photoModal}
      onClosePhotoModal={() => setPhotoModal(null)}
      onUploadPhoto={uploadPhoto}
      onSavePhotoNote={savePhotoNote}
      onDeletePhoto={deletePhoto}
      onOpenMessages={() => setShowMessages(true)}
      onOpenChangePin={() => setShowChangePin(true)}
      busy={busy}
    />,
  );
}
