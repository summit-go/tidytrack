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
  updateAssignmentScheduledDate,
  fetchAllPages,
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
import { isPmApprovedAssignment, assignmentKeyFromTarget, dominantAssignmentStatus } from "../../../lib/assignments.js";
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
import { AssignmentViewer } from "./AssignmentViewer.jsx";
import { BlockedNoteModal } from "./BlockedNoteModal.jsx";
import { ChecklistAssignmentView } from "./ChecklistAssignmentView.jsx";
import { ReassignModal } from "./ReassignModal.jsx";

export function AssignmentTabContent({
  propertyId,
  employee,
  statusFilter,
  onUpdate,
  onGoToBedroom,
  onOpenBedroomHistory,
  onJoinBlock,
}) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filterBuildings, setFilterBuildings] = useState(new Set()); // multi-select building keys; empty = all
  const [collapsedBuildings, setCollapsedBuildings] = useState({}); // { B3: true } = collapsed
  // Floor collapse keyed by `${building}::${floor}`. Default expanded.
  const [collapsedFloors, setCollapsedFloors] = useState({});

  // Filters — apply on top of the loaded targets
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Filters use Sets so the user can pick multiple values at once
  // (e.g. "show both Matias and Eli"). Empty Set means "no filter".
  const [filterTypes, setFilterTypes] = useState(new Set()); // assignment_type values
  const [filterCleaners, setFilterCleaners] = useState(new Set()); // employee ids
  // Completed-date RANGE filter (Done view). Empty string = no bound on
  // that side. Replaces the old day-of / last-3 / older quick tabs.
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD inclusive start
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD inclusive end
  const [aptSearch, setAptSearch] = useState(""); // apartment-number search (Done tab)
  // Done view defaults to the last 2 days — that's what you're almost
  // always looking for, and scrolling through weeks of finished work to
  // find today's was the complaint. 'all' widens it.
  const [doneWindow, setDoneWindow] = useState("recent"); // 'recent' | 'all'
  const recentCutoff = (() => {
    // "Last 2 days" = today and yesterday. -1 gives a 2-calendar-day span.
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [filterCategories, setFilterCategories] = useState(new Set()); // task categories like 'bedroom'
  const [editDueId, setEditDueId] = useState(null);
  const canEditDatesT = can(employee, "edit_due_dates");
  const todayKeyT = localTodayKey();
  // Owners/managers with this permission get the submitted/accepted/done/due
  // timeline dropdown on the date pill — same as the other screens.
  const canViewTimelineT = can(employee, "view_submission_timeline");
  const [timelineOpenT, setTimelineOpenT] = useState(null);
  const [dueDraftT, setDueDraftT] = useState(""); // draft for the date picker — save is explicit now
  const fmtStampT = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };
  const saveDueT = async (id, date) => {
    setEditDueId(null);
    if (id) {
      await updateAssignmentScheduledDate(id, date);
      load();
    }
  };

  // Track which unit-bundles are expanded on the Pending view
  const [bundleOpen, setBundleOpen] = useState({}); // { unitId: boolean }

  const [loadError, setLoadError] = useState(null);

  // Open workblocks across this property — keyed by party_id so the
  // bedroom card can show a "[Name] · section is here" chip with a
  // Join button. Without this, a cleaner browsing Pending / In progress
  // had no Join affordance from the bedroom card itself; they had to
  // dive into the section picker (or use the Suggested tab). The
  // realtime sync (useAssignmentSync) reloads this when work_blocks
  // changes — so when another cleaner opens or closes a workblock,
  // every viewer's bedroom cards reflect it within a second or two.
  const [whosHereByParty, setWhosHereByParty] = useState(new Map());
  const loadWhosHere = async () => {
    // Scoped server-side to THIS property and paginated. This used to
    // pull EVERY open work block app-wide and filter in JS, so once open
    // blocks passed PostgREST's 1000-row cap an arbitrary subset came
    // back — which is why the "X is here" chip appeared on some bedroom
    // cards and not others.
    let rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("work_blocks")
        .select(
          "id, party_id, assignment_id, main_section, shift:shifts!inner(customer_id, employee:employees(id, name))",
        )
        .is("end_time", null)
        .eq("shift.customer_id", propertyId)
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      rows = rows.concat(data);
      if (data.length < PAGE) break;
      if (from > 100000) break;
    }
    // Key by assignment_id when the block has one (so "who's here" belongs to
    // the specific job — trash-out vs move-out — not the whole bedroom), and
    // ALSO by party_id as a fallback for legacy blocks with no assignment_id.
    // Cards look themselves up by assignment first, then party.
    const m = new Map();
    const push = (key, entry) => {
      if (!key) return;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(entry);
    };
    rows.forEach((b) => {
      if (b.shift?.customer_id !== propertyId) return;
      // Exclude the viewing cleaner's own workblock — they don't need
      // to "join" themselves; the active workblock pill at the top of
      // the cleaner shell already surfaces it.
      if (b.shift?.employee?.id === employee?.id) return;
      const entry = {
        name: b.shift?.employee?.name || "?",
        workBlockId: b.id,
        mainSection: b.main_section,
      };
      if (b.assignment_id) push(`a:${b.assignment_id}`, entry);
      push(`p:${b.party_id}`, entry); // legacy fallback key
    });
    setWhosHereByParty(m);
  };
  useEffect(() => {
    loadWhosHere(); /* eslint-disable-next-line */
  }, [propertyId]);
  useAssignmentSync(loadWhosHere, "asgn-tab-whoshere");

  const load = async () => {
    setLoadError(null);
    // "Mine" and "recheck_passed" are derived from status='done' with
    // extra clientside filtering. We treat them as Done-tab variants
    // for the dominant-status logic below.
    const isMineOrRecheck =
      statusFilter === "mine" || statusFilter === "recheck_passed";
    const isDoneTab = statusFilter === "done" || isMineOrRecheck;
    // Load EVERY relevant target at this property in one query — not
    // just items whose status matches the current tab. We need the
    // full per-bedroom status mix to compute the dominant status and
    // place each bedroom card in exactly ONE tab. This is the fix for
    // "card shows up in both Pending and In progress" — that bug was
    // a direct symptom of the previous per-item-status query.
    // Page through ALL matching targets in 1000-row chunks. Supabase
    // enforces a hard server-side max-rows ceiling (~1000) that
    // .limit() can't exceed, so a single query silently truncates once
    // a property has 1000+ target rows (a move-out check alone is 6-10
    // rows; a busy property blows past 1000 fast). That truncation was
    // the "184 jobs but only 48 visible / 998 rows" bug. We loop with
    // .range() until a page comes back short, guaranteeing we collect
    // every row. The !inner join + customer_id eq narrows server-side
    // where supported; we still re-filter client-side as a safety net.
    const { data, error } = await fetchAllPages((from, to) =>
      supabase
        .from("assignment_targets")
        .select(
          "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, approved_at, deleted_at, extracted_text, spanish_translation, translation_status, assignment_type, scheduled_date, sheet_type, template_set_id, bathroom_variant, general_variant, created_at), unit:units(id, label), party:parties(id, label), starter:employees!started_by(id, name), completer:employees!completed_by(id, name), assignedTo:employees!assigned_to(id, name)",
        )
        .eq("assignment.customer_id", propertyId)
        .eq("assignment.active", true)
        .is("assignment.deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (error) {
      console.error("[Assignments] load error:", error);
      setLoadError(error.message);
      setTargets([]);
      setLoaded(true);
      return;
    }
    // Customer / active / PM-approval filter — same as before. Items
    // not visible to cleaners get dropped here.
    let allRelevant = (data || []).filter(
      (t) =>
        t.assignment?.customer_id === propertyId &&
        t.assignment?.active !== false &&
        !t.assignment?.deleted_at &&
        isPmApprovedAssignment(t.assignment),
    );

    // Compute dominant status per ASSIGNMENT (not per bedroom). Each
    // assignment is an independent job with its own lifecycle — a
    // cleaning-check done last week and a move-out check pending this
    // week at the SAME bedroom are two separate assignments and one
    // must never override the other. Keying by assignment_id (instead
    // of unit_id::party_id) keeps them distinct. Priority order:
    // in_progress > paused > blocked > pending > done determines which
    // tab the assignment lands in.
    const statusesByAsgn = new Map();
    allRelevant.forEach((t) => {
      const k = assignmentKeyFromTarget(t);
      if (!statusesByAsgn.has(k)) statusesByAsgn.set(k, new Set());
      statusesByAsgn.get(k).add(t.status);
    });
    const dominantByAsgn = new Map();
    statusesByAsgn.forEach((statusSet, k) => {
      const winner = dominantAssignmentStatus(statusSet);
      dominantByAsgn.set(k, winner);
    });

    // Filter to assignments whose dominant status matches the current
    // tab. For "mine" / "recheck_passed" / Done we still keep everything
    // status=done since those are derived views — extra clientside
    // narrowing happens below.
    let filtered;
    if (isDoneTab) {
      filtered = allRelevant.filter(
        (t) => t.status === "done" || t.status === "blocked",
      );
    } else {
      filtered = allRelevant.filter(
        (t) => dominantByAsgn.get(assignmentKeyFromTarget(t)) === statusFilter,
      );
    }
    // "Mine" view: only items I personally completed today
    if (statusFilter === "mine") {
      const todayStart = localTodayStart();
      filtered = filtered.filter(
        (t) =>
          t.completed_by &&
          employee?.id &&
          t.completed_by === employee.id &&
          t.completed_at &&
          new Date(t.completed_at) >= todayStart,
      );
    }
    if (statusFilter === "recheck_passed") {
      filtered = filtered.filter((t) => t.recheck_passed_at);
    }
    if (statusFilter === "done") {
      // Sort Done by building → unit → bedroom (natural compare on the
      // unit label so "B1-101" comes before "B1-102" before "B2-101").
      // Owner uses Done to verify specific apartments, so spatial order
      // beats temporal order for findability. Time-bucketing (Day of /
      // Last 3d / Older) still groups by date — within each bucket the
      // items are now ordered by apartment.
      filtered.sort(
        (a, b) =>
          naturalCompare(a.unit?.label || "", b.unit?.label || "") ||
          naturalCompare(a.party?.label || "", b.party?.label || ""),
      );
    } else if (statusFilter === "paused") {
      // Paused tab: assignments paused BY the current user sort to the
      // top (most useful — they can resume their own work first), then
      // everyone else's paused work alphabetically by unit/party.
      // "Paused by" is inferred from started_by since the cleaner who
      // started is the one who paused. Priority still wins overall.
      const myId = employee?.id;
      filtered.sort((a, b) => {
        const ap = a.priority ? 1 : 0;
        const bp = b.priority ? 1 : 0;
        if (ap !== bp) return bp - ap;
        const aMine = myId && a.started_by === myId ? 0 : 1;
        const bMine = myId && b.started_by === myId ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        return (
          naturalCompare(a.unit?.label || "", b.unit?.label || "") ||
          naturalCompare(a.party?.label || "", b.party?.label || "")
        );
      });
    } else {
      // Overdue → today → undated → upcoming, then priority, then
      // natural unit/party order, so cleaners see today's work first.
      // Due date first, THEN building order. Anything with a date sits
      // above anything without; undated work keeps its old natural order
      // at the bottom.
      filtered.sort((a, b) => {
        const da = a.assignment?.scheduled_date || "";
        const db = b.assignment?.scheduled_date || "";
        const ra = assignmentDueRank(da || null);
        const rb = assignmentDueRank(db || null);
        if (ra !== rb) return ra - rb;
        // Real chronological order inside a bucket. scheduled_date is
        // 'YYYY-MM-DD', so a string compare is already date order.
        // Without this every future date ties and the sort collapses
        // straight to building order.
        if (da !== db) return da.localeCompare(db);
        const ap = a.priority ? 1 : 0;
        const bp = b.priority ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return (
          naturalCompare(a.unit?.label || "", b.unit?.label || "") ||
          naturalCompare(a.party?.label || "", b.party?.label || "")
        );
      });
    }
    setTargets(filtered);
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [propertyId, statusFilter]);
  useAssignmentSync(load, "asgn-tab");

  // Map of "<unit_id>:<party_id>" → Set of task categories ever worked
  // at that bedroom for this property. Used by the category filter so
  // the owner can ask "show me bedrooms where bathroom work happened."
  const [tasksByBedroom, setTasksByBedroom] = useState({});
  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      // Pull every task for this property via the work_block → shift chain
      const { data } = await supabase
        .from("tasks")
        .select(
          "category, work_block:work_blocks!inner(unit_id, party_id, shift:shifts!inner(customer_id))",
        )
        .not("category", "is", null);
      const map = {};
      (data || []).forEach((t) => {
        const wb = t.work_block;
        if (!wb || wb.shift?.customer_id !== propertyId) return;
        if (!wb.unit_id || !wb.party_id) return;
        const key = `${wb.unit_id}:${wb.party_id}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(t.category);
      });
      setTasksByBedroom(map);
    })();
  }, [propertyId, targets.length]);

  // Cutoff retired: every assignment now renders as ONE bedroom-level
  // bulk card with the section breakdown. The old per-item rendering
  // (one card per assignment_target) caused the "16 cards for one
  // bedroom" surprise when items spanned multiple sections. Bedroom
  // cards now always read as one card per (apartment, bedroom),
  // matching the cleaner's mental model of "this bedroom is one job".
  const isPostCutoff = (_t) => true;

  // Bulk wrappers that act on every target at a bedroom. Optimistic
  // update + single .in() call, then re-load. Used by the new
  // bedroom-level card so the cleaner can mark-complete / block /
  // re-prioritize a whole bedroom in one tap.
  const bulkUpdateStatus = async (rows, newStatus, statusNotes) => {
    if (!rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab) {
      setTargets((prev) => prev.filter((t) => !ids.includes(t.id)));
    } else {
      setTargets((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t)),
      );
    }
    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (newStatus === "pending") {
      patch.started_at = null;
      patch.started_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .in("id", ids);
    setBusy(false);
    if (error) {
      load();
      alert("Could not update: " + error.message);
      return;
    }
    load();
    if (onUpdate) onUpdate();
  };

  const bulkTogglePriority = async (rows) => {
    if (!rows || rows.length === 0) return;
    const anyOn = rows.some((r) => r.priority);
    const next = !anyOn;
    const ids = rows.map((r) => r.id);
    setTargets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, priority: next } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .in("id", ids);
    if (error) {
      alert("Could not update priority: " + error.message);
      load();
    }
  };

  const updateStatus = async (target, newStatus, statusNotes) => {
    // OPTIMISTIC: since this tab filters by statusFilter, an item that
    // just changed status no longer belongs in the current view —
    // remove it immediately so the cleaner sees the result of their
    // tap with zero delay. Reload below fetches the authoritative
    // state; realtime reconciles any discrepancy.
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab) {
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    } else {
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, status: newStatus } : t)),
      );
    }

    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (target.status === "done") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    // Move-to-pending wipes started_by/at so the assignment appears
    // fully unstarted in the Pending tab.
    if (
      newStatus === "pending" &&
      (target.status === "paused" ||
        target.status === "in_progress" ||
        target.status === "blocked")
    ) {
      patch.started_at = null;
      patch.started_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", target.id);
    setBusy(false);
    if (error) {
      // Roll back optimistic on failure so the user sees the truth
      load();
      alert("Could not update: " + error.message);
      return;
    }
    setStatusModal(null);
    load();
    if (onUpdate) onUpdate();
  };

  // Reopen a DONE item back to the state it was actually in — not a blanket
  // reset to "new". "We are done here" sweeps every item at a bedroom to done,
  // including ones never touched, so on reopen we use the work evidence to
  // restore each item honestly:
  //   • worked (has a real start / started_by) → in_progress (Active), so the
  //     cleaner picks it back up where they left off
  //   • never started (no started_at) → pending (New)
  // Completion stamps are cleared since it's no longer done.
  const reopenTarget = async (target) => {
    const wasWorked = !!target.started_at || !!target.started_by;
    const newStatus = wasWorked ? "in_progress" : "pending";
    const movedOffTab = newStatus !== statusFilter;
    if (movedOffTab)
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
    else
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, status: newStatus } : t)),
      );

    setBusy(true);
    const patch = { status: newStatus, completed_at: null, completed_by: null };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = target.started_by || employee?.id || null;
    } else {
      patch.started_at = null;
      patch.started_by = null;
    }
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .eq("id", target.id);
    setBusy(false);
    if (error) {
      load();
      alert("Could not reopen: " + error.message);
      return;
    }
    load();
    if (onUpdate) onUpdate();
  };

  // Flip the priority flag on a single target.
  const togglePriority = async (target) => {
    const next = !target.priority;
    setTargets((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, priority: next } : t)),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .eq("id", target.id);
    if (error) {
      alert("Could not update priority: " + error.message);
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, priority: !next } : t)),
      );
    } else if (onUpdate) {
      onUpdate();
    }
  };

  // Tapping "Start" / "Resume" / "Go to this bedroom" on an assignment
  // card no longer mutates status. It just navigates to the prep
  // screen. The cleaner confirms with the big Start cleaning button
  // there — that's the SINGLE confirmation point. confirmPendingStart
  // → autoStartAssignmentsAtBedroom is what actually flips pending/
  // paused targets to in_progress. This stops "I clicked Go and now
  // the assignment is in_progress even though I didn't start work."
  const startAndGo = async (target) => {
    if (onGoToBedroom && target.unit_id && target.party_id) {
      onGoToBedroom(target);
    }
  };

  if (!loaded)
    return (
      <div className="text-center py-8 text-stone-400 text-xs">Loading…</div>
    );
  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        <div className="flex items-start gap-2 mb-1">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">Couldn't load assignments</span>
        </div>
        <div className="text-xs font-mono mt-2">{loadError}</div>
      </div>
    );
  }
  if (targets.length === 0) {
    const empties = {
      pending: "No pending assignments.",
      paused: "No paused assignments.",
      in_progress: "No assignments are in progress.",
      done: "No completed assignments yet.",
    };
    return (
      <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
        {empties[statusFilter]}
      </div>
    );
  }

  // Apply user filters (type / cleaner / day) before grouping.
  // We build "filteredTargets" once and feed it to all downstream
  // grouping/rendering logic.
  const isDoneTab =
    statusFilter === "done" ||
    statusFilter === "mine_today" ||
    statusFilter === "recheck_passed";
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const filteredTargets = targets.filter((t) => {
    // Type filter (multi-select)
    if (filterTypes.size > 0) {
      const typ = t.assignment?.assignment_type || "";
      if (!filterTypes.has(typ)) return false;
    }
    // Cleaner filter — matches starter OR completer
    if (filterCleaners.size > 0) {
      const ids = [t.starter?.id, t.completer?.id].filter(Boolean);
      const hit = ids.some((id) => filterCleaners.has(id));
      if (!hit) return false;
    }
    // Completed-date RANGE filter (Done view). Inclusive on both ends;
    // a blank side means "no bound". Filters on the day the work was
    // actually completed. Items without a completed date drop out when
    // any bound is set (they live under Pending anyway).
    if (dateFrom || dateTo) {
      const cd = t.completed_at
        ? new Date(t.completed_at).toISOString().slice(0, 10)
        : null;
      if (!cd) return false;
      if (dateFrom && cd < dateFrom) return false;
      if (dateTo && cd > dateTo) return false;
    } else if (isDoneTab && doneWindow === "recent") {
      // Default Done view: last 2 days only. A manual range above
      // overrides this — pick dates and you see everything you asked for.
      const cd = t.completed_at
        ? new Date(t.completed_at).toISOString().slice(0, 10)
        : null;
      if (!cd || cd < recentCutoff) return false;
    }
    // Category filter — checks if any task at this bedroom matches
    if (filterCategories.size > 0) {
      if (!t.unit_id || !t.party_id) return false;
      const key = `${t.unit_id}:${t.party_id}`;
      const cats = tasksByBedroom[key];
      if (!cats) return false;
      const hit = Array.from(filterCategories).some((c) => cats.has(c));
      if (!hit) return false;
    }
    // Apartment-number search (Done tab) — matches the unit label.
    if (aptSearch.trim()) {
      const q = aptSearch.trim().toLowerCase();
      const label =
        `${t.unit?.label || ""} ${t.party?.label || ""}`.toLowerCase();
      if (!label.includes(q)) return false;
    }
    return true;
  });

  // Compute available filter values from the FULL (pre-filter) target set
  // so dropdowns don't lose options after filtering down.
  const availableTypes = [
    ...new Set(
      targets.map((t) => t.assignment?.assignment_type).filter(Boolean),
    ),
  ];
  const availableCleaners = (() => {
    const map = new Map();
    targets.forEach((t) => {
      if (t.starter?.id) map.set(t.starter.id, t.starter);
      if (t.completer?.id) map.set(t.completer.id, t.completer);
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  })();
  const availableCategories = (() => {
    const cats = new Set();
    Object.values(tasksByBedroom).forEach((s) => s.forEach((c) => cats.add(c)));
    // Only show categories that actually exist in the data
    return TASK_CATEGORIES.filter((c) => cats.has(c.id));
  })();
  const activeFilterCount =
    (filterTypes.size > 0 ? 1 : 0) +
    (filterCleaners.size > 0 ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (filterCategories.size > 0 ? 1 : 0);

  // Toggle helpers — add/remove a value from a Set state
  const toggleSetValue = (setter) => (value) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleType = toggleSetValue(setFilterTypes);
  const toggleCleaner = toggleSetValue(setFilterCleaners);
  const toggleCategory = toggleSetValue(setFilterCategories);

  // Owner approval for cleaner-requested items. The work may already be
  // done — this is an after-the-fact decision (e.g. for billing). Approve
  // marks the request settled; Reject flags it so it can be excluded.
  // Acts on the still-pending requests in the passed-in item list.
  const reviewRequest = async (items, decision) => {
    const ids = (items || [])
      .filter(
        (t) => t.requested_by && (t.request_status || "pending") === "pending",
      )
      .map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("assignment_targets")
      .update({ request_status: decision })
      .in("id", ids);
    if (error) {
      alert("Could not update request: " + error.message);
      return;
    }
    load();
    if (onUpdate) onUpdate();
  };

  // Group targets by building, derived from the unit label (e.g. "B3-205" -> "B3")
  // Targets without a unit go into a "No unit" bucket
  const buildings = {};
  filteredTargets.forEach((t) => {
    const b = buildingFromLabel(t.unit?.label) || "—";
    if (!buildings[b]) buildings[b] = [];
    buildings[b].push(t);
  });
  const buildingKeys = Object.keys(buildings).sort(naturalCompare);
  const visibleBuildings =
    filterBuildings.size === 0
      ? buildingKeys
      : buildingKeys.filter((k) => filterBuildings.has(k));
  const toggleCollapse = (b) =>
    setCollapsedBuildings((prev) => ({ ...prev, [b]: !prev[b] }));
  const toggleBuilding = (b) =>
    setFilterBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  // Done-family tabs get the completed-date range picker.
  const isDoneView =
    statusFilter === "done" ||
    statusFilter === "mine" ||
    statusFilter === "recheck_passed";

  // Count DISTINCT assignments in a target list. Each assignment is an
  // independent job — a cleaning-check and a move-out check at the same
  // bedroom are two separate assignments and count as two. This matches
  // the owner-side count (one per assignment) so "96 open" on owner ==
  // what the cleaner sees. Falls back to bedroom key for any legacy
  // target missing an assignment_id.
  const countBedrooms = (list) => {
    const s = new Set();
    (list || []).forEach((t) =>
      s.add(t.assignment_id || `${t.unit_id || ""}::${t.party_id || ""}`),
    );
    return s.size;
  };

  // GLOBAL PRIORITY BLOCK (Pending tab only): pull priority items out
  // of their per-building bucket and show them as one section at the
  // top. Without this, priority items get hidden inside each building
  // (e.g. priority in B2 stuck behind 5 normal B1 items). Building
  // filter still applies so filtering to "Building 1" only shows B1's
  // priority at the top.
  const globalPriorityItems =
    statusFilter === "pending"
      ? visibleBuildings
          .flatMap((b) => buildings[b])
          // "Do these first" should only include items still needing
          // attention — done and blocked items have no first-do-this
          // urgency and were appearing in the section because the load
          // includes ALL targets at bedrooms whose dominant status is
          // pending (which is intentional for the bulk card view, but
          // wrong here).
          .filter(
            (t) => t.priority && t.status !== "done" && t.status !== "blocked",
          )
      : [];

  // For Done tab: bucket by age using local-date math.
  //   Day of:      completed today (local timezone)
  //   Last 3 days: completed 1, 2, or 3 days ago
  //   4+ days:     completed 4+ days ago
  // Using local-date comparison (not wall-clock subtraction) so a job
  // completed late last night still shows under "Day of" today.
  const todayLocal = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  })();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const bucketByAge = (items) => {
    const buckets = { dayOf: [], last3: [], older: [] };
    items.forEach((t) => {
      const ts = t.completed_at ? new Date(t.completed_at).getTime() : 0;
      if (!ts) {
        buckets.older.push(t);
        return;
      }
      const completedLocal = (() => {
        const d = new Date(ts);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })();
      const daysAgo = Math.round((todayLocal - completedLocal) / DAY_MS);
      if (daysAgo <= 0) buckets.dayOf.push(t);
      else if (daysAgo <= 3) buckets.last3.push(t);
      else buckets.older.push(t);
    });
    return buckets;
  };

  // For Pending view, bundle by unit when there are multiple per unit
  // ("3 assignments in B1-101"). Single-assignment units stay as plain
  // cards. The bundle is a collapsible group so the list stays short.
  const toggleBundle = (unitId) =>
    setBundleOpen((prev) => ({ ...prev, [unitId]: !prev[unitId] }));

  // Render a single grouped/bundled list. Extracted into a helper so we
  // can call it twice on the Pending tab — once for priority items
  // (top), once for the rest — with a visual separator between.
  const renderGroupedItems = (items) => {
    if (items.length === 0) return null;

    // Group by unit_id (apartment). Items without a unit go in their own bucket.
    const groups = new Map(); // unitId or 'no-unit' -> { unit, items: [] }
    items.forEach((t) => {
      const key = t.unit_id || "no-unit";
      if (!groups.has(key)) {
        groups.set(key, { unit: t.unit, unitId: t.unit_id, items: [] });
      }
      groups.get(key).items.push(t);
    });

    // Sort apartments strictly by their label (natural compare). Per
    // the owner's request, multi-assignment apartments no longer
    // automatically jump to the top — order stays numerical so the
    // cleaner reads top-down 101, 102, 103, 201, 202, etc.
    const entries = Array.from(groups.entries()).sort((a, b) =>
      naturalCompare(a[1].unit?.label || "", b[1].unit?.label || ""),
    );

    return (
      <div className="space-y-2">
        {entries.map(([key, group]) => {
          // Distinct ASSIGNMENTS (jobs) in this apartment with open
          // work. The chip on the apartment pill counts jobs, not item
          // rows (which can hit the hundreds in a Fail-Entire scenario)
          // and not bedrooms (since one bedroom can carry a cleaning-
          // check AND a move-out check as two separate jobs). This
          // makes the chip number match the number of cards the cleaner
          // sees when they expand the apartment.
          const asgnIds = new Set();
          group.items.forEach((t) =>
            asgnIds.add(t.assignment_id || `${t.party_id || "no-party"}`),
          );
          const bedroomCount = asgnIds.size;

          // Single-job + single-item apartments render as a plain
          // card with no extra nesting. Saves a click.
          if (group.items.length === 1) {
            const t = group.items[0];
            return (
              <AssignmentCard
                key={t.id}
                target={t}
                busy={busy}
                propertyId={propertyId}
                onView={() => setOpened(t)}
                onStart={() => startAndGo(t)}
                onPause={() => updateStatus(t, "paused")}
                onMoveToPending={() => updateStatus(t, "pending")}
                onDone={() => updateStatus(t, "done")}
                onReopen={() => reopenTarget(t)}
                onBlocked={() => setStatusModal({ target: t })}
                onReassign={() => setReassignTarget(t)}
                onTogglePriority={togglePriority}
                canPrioritize={
                  can(employee, "mark_assignments_done") ||
                  can(employee, "upload_assignments")
                }
                canMarkDone={
                  can(employee, "mark_assignments_done") ||
                  t.started_by === employee?.id
                }
                canMarkDoneAlways={can(employee, "mark_assignments_done")}
                ownerView={isOwner(employee)}
                currentEmployeeId={employee?.id}
                onGoToBedroom={onGoToBedroom ? () => startAndGo(t) : null}
                canEditDates={can(employee, "edit_due_dates")}
                onSetDueDate={async (aid, date) => {
                  if (aid) {
                    await updateAssignmentScheduledDate(aid, date);
                    load();
                  }
                }}
                onOpenBedroomHistory={onOpenBedroomHistory}
              />
            );
          }
          // Apartment-level expandable card. When expanded, we don't
          // dump every item — we group by BEDROOM (party_id) and
          // then by main SECTION inside each bedroom. Three taps
          // total to reach the item: apartment → bedroom → section.
          const isOpen = !!bundleOpen[key];
          const unitLabel =
            group.unit?.label || (key === "no-unit" ? "No unit" : key);
          const bundleHasPriority = group.items.some((t) => t.priority);
          // Most-urgent due status across this apartment's jobs.
          // Overdue only counts UNFINISHED work. A done item with a past
          // scheduled date is not overdue — it's done. Including it made a
          // fully-cleaned bedroom show "Overdue", which is nonsense.
          const unitDueKinds = group.items
            .filter((t) => t.status !== "done")
            .map((t) => assignmentDueKind(t.assignment?.scheduled_date))
            .filter(Boolean);
          const unitDue = unitDueKinds.includes("overdue")
            ? "overdue"
            : unitDueKinds.includes("today")
              ? "today"
              : unitDueKinds.includes("upcoming")
                ? "upcoming"
                : null;
          const earliestUpcoming = group.items
            .map((t) => t.assignment?.scheduled_date)
            .filter((d) => d && assignmentDueKind(d) === "upcoming")
            .sort()[0];
          // Build the assignment → section breakdown for the expanded
          // view. We key by party_id + assignment_id (NOT just party_id)
          // so two independent assignments at the same bedroom — e.g. a
          // cleaning-check done last week and a move-out check pending
          // this week — render as TWO separate cards. Each assignment is
          // its own job with its own lifecycle; marking one done must
          // never affect the other.
          const byBedroom = new Map(); // `${partyId}::${assignmentId}` -> { party, items, sections }
          group.items.forEach((t) => {
            const pid = t.party_id || "no-party";
            const aid = t.assignment_id || "no-asgn";
            const groupKey = `${pid}::${aid}`;
            if (!byBedroom.has(groupKey)) {
              byBedroom.set(groupKey, {
                party: t.party,
                partyId: t.party_id,
                assignmentId: t.assignment_id,
                assignment: t.assignment,
                items: [],
                sectionItems: {
                  bedroom: [],
                  vanity: [],
                  bathroom: [],
                  general: [],
                },
                hasPriority: false,
              });
            }
            const b = byBedroom.get(groupKey);
            b.items.push(t);
            const sec = (t.template_section || "").toLowerCase();
            if (b.sectionItems[sec]) b.sectionItems[sec].push(t);
            if (t.priority) b.hasPriority = true;
          });
          // Sort by bedroom label, then by assignment creation so a
          // bedroom's multiple assignments appear in a stable order.
          const bedroomEntries = Array.from(byBedroom.entries()).sort(
            (a, b) =>
              naturalCompare(
                a[1].party?.label || "",
                b[1].party?.label || "",
              ) ||
              naturalCompare(
                a[1].assignment?.created_at || "",
                b[1].assignment?.created_at || "",
              ),
          );
          return (
            <div
              key={key}
              className="rounded-xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden"
            >
              <button
                onClick={() => toggleBundle(key)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2
                    size={16}
                    className="text-amber-700 flex-shrink-0"
                  />
                  <span className="font-serif text-base text-stone-900 truncate">
                    {unitLabel}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex-shrink-0">
                    {(() => {
                      // Show WHICH bedrooms have work (e.g. "1, 3") instead of a
                      // bare job count — more useful at a glance. Pull the number
                      // out of each bedroom label ("Bedroom 3" / "BR 3" → 3),
                      // dedupe, sort numerically. Falls back to the count if a
                      // label has no number.
                      const nums = bedroomEntries
                        .map(([, b]) => {
                          const m = String(b.party?.label || "").match(/(\d+)/);
                          return m ? Number(m[1]) : null;
                        })
                        .filter((n) => n != null);
                      const uniq = Array.from(new Set(nums)).sort(
                        (a, b) => a - b,
                      );
                      if (uniq.length === 0)
                        return `${bedroomCount} job${bedroomCount === 1 ? "" : "s"}`;
                      return uniq.join(", ");
                    })()}
                  </span>
                  {unitDue === "overdue" && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                      Overdue
                    </span>
                  )}
                  {unitDue === "today" && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">
                      Today
                    </span>
                  )}
                  {unitDue === "upcoming" && earliestUpcoming && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 flex-shrink-0">
                      {fmtDateWithDay(earliestUpcoming)}
                    </span>
                  )}
                  {bundleHasPriority && <PriorityChip on={true} size="xs" />}
                </div>
                <ChevronRight
                  size={14}
                  className={`text-amber-700 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-amber-100 pt-3">
                  {bedroomEntries.map(([groupKey, bed]) => {
                    // Real party_id for this entry — used for whosHere
                    // lookups (which are per-bedroom) and as a stable
                    // React key suffix. The map key is partyId::asgnId
                    // so two assignments at one bedroom stay separate.
                    const pid = bed.partyId || "no-party";
                    const bedLabel = shortenBedroom(
                      bed.party?.label ||
                        (pid === "no-party" ? "Unassigned" : pid),
                    );
                    const sectionCounts = {
                      bedroom: bed.sectionItems.bedroom.length,
                      vanity: bed.sectionItems.vanity.length,
                      bathroom: bed.sectionItems.bathroom.length,
                      general: bed.sectionItems.general.length,
                    };
                    // Items not in any of the 4 known sections (legacy
                    // targets with no template_section, or one-offs).
                    const knownSectioned =
                      sectionCounts.bedroom +
                      sectionCounts.vanity +
                      sectionCounts.bathroom +
                      sectionCounts.general;
                    const otherCount = bed.items.length - knownSectioned;
                    const sectionBits = [];
                    if (sectionCounts.bedroom)
                      sectionBits.push(`Bedroom (${sectionCounts.bedroom})`);
                    if (sectionCounts.vanity)
                      sectionBits.push(`Vanity (${sectionCounts.vanity})`);
                    if (sectionCounts.bathroom)
                      sectionBits.push(`Bathroom (${sectionCounts.bathroom})`);
                    if (sectionCounts.general)
                      sectionBits.push(`General (${sectionCounts.general})`);
                    if (otherCount > 0)
                      sectionBits.push(`Other (${otherCount})`);

                    // Split this bedroom's items by cutoff. LEGACY
                    // (pre-cutoff) items render as the original per-item
                    // AssignmentCards — that's the contract the user
                    // asked for, so the Mon-Wed assignments behave
                    // exactly the way the cleaners are already used
                    // to. NEW (post-cutoff) items collapse into ONE
                    // bedroom-level card with the section breakdown +
                    // bulk action buttons.
                    const legacyItems = bed.items.filter(
                      (t) => !isPostCutoff(t),
                    );
                    const newItems = bed.items.filter((t) => isPostCutoff(t));

                    const firstTarget = bed.items[0];
                    const canGoToBedroom = !!(
                      onGoToBedroom &&
                      firstTarget?.unit_id &&
                      firstTarget?.party_id
                    );

                    // Build the bedroom-level bulk card (only when there
                    // are NEW items at this bedroom). We compute a few
                    // derived flags from the new-items subset:
                    //  - hasPriority: any new item has priority on
                    //  - statusBucket: the dominant status to display
                    //    in the read-only pill (pending wins, then
                    //    in_progress, then paused, then blocked, then done)
                    //  - allDone: every new item is already done
                    //  - canBulkComplete: at least one item can move to
                    //    done (i.e. not already done)
                    let bulkCard = null;
                    if (newItems.length > 0) {
                      const anyPriority = newItems.some((t) => t.priority);
                      // Whether any item at this bedroom is a cleaner
                      // request waiting on owner review. Drives the
                      // amber "Requested" banner at the top of the
                      // card so the owner sees there's something new
                      // to approve here.
                      const hasRequestedItems = newItems.some(
                        (t) => t.requested_by,
                      );
                      const pendingReview = newItems.filter(
                        (t) =>
                          t.requested_by &&
                          (t.request_status || "pending") === "pending",
                      );
                      const hasPendingReview = pendingReview.length > 0;
                      const reviewedApproved = newItems.some(
                        (t) =>
                          t.requested_by && t.request_status === "approved",
                      );
                      const reviewedRejected = newItems.some(
                        (t) =>
                          t.requested_by && t.request_status === "rejected",
                      );
                      const statusOrder = [
                        "pending",
                        "in_progress",
                        "paused",
                        "blocked",
                        "done",
                      ];
                      const dominantStatus =
                        statusOrder.find((s) =>
                          newItems.some((t) => t.status === s),
                        ) || "pending";
                      const statusPill =
                        ASSIGNMENT_STATUSES[dominantStatus] ||
                        ASSIGNMENT_STATUSES.pending;
                      const allDone = newItems.every(
                        (t) => t.status === "done",
                      );
                      const canBulkComplete =
                        !allDone && can(employee, "mark_assignments_done");
                      // For View Doc and Reassign we pick the first
                      // target's assignment as the representative.
                      // Bedroom-level uploads are 1 assignment per
                      // bedroom in the new model so this is correct
                      // 99% of the time; the rare exception (multiple
                      // assignments at one bedroom) still gets a
                      // useful "open one of them" affordance.
                      bulkCard = (
                        <div
                          key={`bulk-${groupKey}`}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                        >
                          {/* Cleaner request banner — shows at the very
                             top of the card whenever a cleaner has
                             submitted a request at this bedroom that's
                             still pending. Drops a clear "needs review"
                             signal in front of the owner without
                             interrupting the rest of the card. */}
                          {/* Cleaner request banner — when there are
                             requests awaiting review, show Approve /
                             Reject. Once reviewed, it collapses to a
                             quiet status line. The requested items are
                             already on the cleaner's list regardless;
                             this is owner sign-off after the fact. */}
                          {hasPendingReview ? (
                            <div className="mb-2 px-2 py-1.5 rounded-md bg-amber-100 border border-amber-300">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold">
                                  Cleaner requested {pendingReview.length} item
                                  {pendingReview.length === 1 ? "" : "s"} —
                                  review
                                </span>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    reviewRequest(newItems, "approved")
                                  }
                                  disabled={busy}
                                  className="flex-1 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <Check size={12} /> Approve
                                </button>
                                <button
                                  onClick={() =>
                                    reviewRequest(newItems, "rejected")
                                  }
                                  disabled={busy}
                                  className="flex-1 py-1 rounded-md bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <X size={12} /> Reject
                                </button>
                              </div>
                            </div>
                          ) : hasRequestedItems &&
                            (reviewedApproved || reviewedRejected) ? (
                            <div className="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 border border-stone-200">
                              {reviewedApproved && !reviewedRejected ? (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 font-bold flex items-center gap-1">
                                  <Check size={11} /> Request approved
                                </span>
                              ) : reviewedRejected && !reviewedApproved ? (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold flex items-center gap-1">
                                  <X size={11} /> Request rejected
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold">
                                  Request reviewed
                                </span>
                              )}
                            </div>
                          ) : null}
                          {/* "Who's here" chips — only shows when ANOTHER
                             cleaner has an open workblock at this bedroom.
                             Each chip carries the cleaner's name + section
                             they're working + a Join button so the viewer
                             can hop in without going through the picker
                             flow. Self-chip is filtered out in loadWhosHere
                             since "Join yourself" makes no sense. */}
                          {(() => {
                            // Never show "someone is here" on a DONE card — the
                            // job's finished, nobody's actively in it. And look
                            // up by THIS card's assignment (falling back to the
                            // bedroom for legacy blocks) so a different job at
                            // the same bedroom doesn't bleed its chip onto this
                            // card.
                            if (allDone) return null;
                            const asgKey = firstTarget?.assignment_id
                              ? `a:${firstTarget.assignment_id}`
                              : null;
                            const here =
                              (asgKey && whosHereByParty.get(asgKey)) ||
                              whosHereByParty.get(`p:${pid}`) ||
                              [];
                            if (here.length === 0) return null;
                            const hNames = here
                              .map((w) => w.name)
                              .filter(Boolean);
                            const hSections = Array.from(
                              new Set(
                                here.map((w) => w.mainSection).filter(Boolean),
                              ),
                            );
                            const hJoin = here.find((w) => w.workBlockId);
                            const hLabel =
                              hNames.join(", ") +
                              " here" +
                              (hSections.length
                                ? ` · ${hSections.join(", ")}`
                                : "");
                            return (
                              <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold">
                                  ●
                                </span>
                                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                  {hLabel}
                                </span>
                                {onJoinBlock && hJoin && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onJoinBlock({ id: hJoin.workBlockId });
                                    }}
                                    className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold inline-flex items-center gap-1 active:scale-95"
                                  >
                                    <Plus size={9} /> Join
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          {/* === HEADER: title + chips === */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              {canGoToBedroom ? (
                                <button
                                  onClick={() => startAndGo(firstTarget)}
                                  disabled={busy}
                                  className="block text-left w-full font-serif text-base text-stone-900 leading-tight break-words hover:underline disabled:opacity-50"
                                >
                                  {unitPartyLabel(
                                    group.unit?.label || unitLabel,
                                    bedLabel,
                                  )}
                                </button>
                              ) : (
                                <div className="font-serif text-base text-stone-900 leading-tight break-words">
                                  {unitPartyLabel(
                                    group.unit?.label || unitLabel,
                                    bedLabel,
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {can(employee, "mark_assignments_done") ||
                                can(employee, "upload_assignments") ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      bulkTogglePriority(newItems);
                                    }}
                                    disabled={busy}
                                    className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                      anyPriority
                                        ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                                        : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                                    }`}
                                  >
                                    <AlertCircle size={10} />{" "}
                                    {anyPriority ? "Priority" : "Mark priority"}
                                  </button>
                                ) : anyPriority ? (
                                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-300 font-bold inline-flex items-center gap-1">
                                    <AlertCircle size={10} /> Priority
                                  </span>
                                ) : null}
                                <span
                                  className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${statusPill.color}`}
                                >
                                  {statusPill.label}
                                </span>
                                {(() => {
                                  const asg = (newItems[0] || firstTarget)
                                    ?.assignment;
                                  const sd = asg?.scheduled_date;
                                  // Done work has a completion date, not a due
                                  // date. "Overdue" on a finished job is a
                                  // contradiction — overdue means unfinished
                                  // past its due date. Show when it finished.
                                  const grpDone =
                                    newItems.every(
                                      (t) => t.status === "done",
                                    ) && newItems.length > 0;
                                  const doneAtT =
                                    newItems
                                      .map((t) => t.completed_at)
                                      .filter(Boolean)
                                      .sort()
                                      .slice(-1)[0] || null;
                                  if (canViewTimelineT) {
                                    return (
                                      <div className="relative inline-block">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTimelineOpenT(
                                              timelineOpenT === asg?.id
                                                ? null
                                                : asg?.id,
                                            );
                                          }}
                                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                            grpDone
                                              ? "bg-stone-900 text-white border-stone-900"
                                              : sd
                                                ? sd < todayKeyT
                                                  ? "bg-red-100 text-red-700 border-red-200"
                                                  : sd === todayKeyT
                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                    : "bg-stone-100 text-stone-600 border-stone-200"
                                                : "bg-white text-stone-500 border-dashed border-stone-300"
                                          }`}
                                        >
                                          {grpDone ? (
                                            <>
                                              <Check size={9} />{" "}
                                              {doneAtT
                                                ? `Done ${fmtDueDate(String(doneAtT).slice(0, 10))}`
                                                : "Done"}
                                            </>
                                          ) : (
                                            <>
                                              <Calendar size={9} />{" "}
                                              {sd
                                                ? fmtDueDate(sd)
                                                : "Set due date"}
                                            </>
                                          )}
                                          <ChevronRight
                                            size={10}
                                            className="rotate-90 opacity-60"
                                          />
                                        </button>
                                        {timelineOpenT === asg?.id && (
                                          <>
                                            <div
                                              className="fixed inset-0 z-30"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setTimelineOpenT(null);
                                              }}
                                            />
                                            <div
                                              className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden text-left"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-stone-400">
                                                Timeline
                                              </div>
                                              <div className="px-3 pb-2 space-y-1.5">
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <FileText size={11} />{" "}
                                                    Submitted
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${asg?.created_at ? "text-stone-800" : "text-stone-400"}`}
                                                  >
                                                    {asg?.created_at
                                                      ? fmtStampT(
                                                          asg.created_at,
                                                        )
                                                      : "—"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <UserPlus size={11} />{" "}
                                                    Accepted
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${asg?.approved_at || asg?.pm_status === "approved" || !asg?.pm_status ? "text-emerald-700" : "text-stone-400"}`}
                                                  >
                                                    {asg?.approved_at
                                                      ? fmtStampT(
                                                          asg.approved_at,
                                                        )
                                                      : !asg?.pm_status ||
                                                          asg?.pm_status ===
                                                            "approved"
                                                        ? asg?.created_at
                                                          ? `${fmtStampT(asg.created_at)} · auto`
                                                          : "Auto"
                                                        : asg?.pm_status ===
                                                            "pending"
                                                          ? "Awaiting you"
                                                          : asg?.pm_status ===
                                                              "rejected"
                                                            ? "Rejected"
                                                            : "Not yet"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <Check size={11} /> Done
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-mono ${doneAtT ? "text-stone-800" : "text-stone-400"}`}
                                                  >
                                                    {doneAtT
                                                      ? fmtStampT(doneAtT)
                                                      : "Not yet"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-100">
                                                  <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                                    <Calendar size={11} /> Due
                                                  </span>
                                                  <span className="text-[11px] font-mono text-stone-800">
                                                    {sd ? fmtDueDate(sd) : "—"}
                                                  </span>
                                                </div>
                                              </div>
                                              {canEditDatesT && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTimelineOpenT(null);
                                                    setDueDraftT(sd || "");
                                                    setEditDueId(asg?.id);
                                                  }}
                                                  className="w-full border-t border-stone-100 px-3 py-2 text-[11px] font-mono text-stone-600 hover:bg-stone-50 text-left flex items-center gap-1.5"
                                                >
                                                  <Edit2 size={11} /> Change due
                                                  date
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (grpDone) {
                                    const last = newItems
                                      .map((t) => t.completed_at)
                                      .filter(Boolean)
                                      .sort()
                                      .slice(-1)[0];
                                    return (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-900 text-white inline-flex items-center gap-1">
                                        <Check size={9} />{" "}
                                        {last
                                          ? `Done ${fmtDueDate(String(last).slice(0, 10))}`
                                          : "Done"}
                                      </span>
                                    );
                                  }
                                  if (editDueId === asg?.id)
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="date"
                                          autoFocus
                                          defaultValue={sd || ""}
                                          onChange={(e) =>
                                            setDueDraftT(e.target.value)
                                          }
                                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-stone-400 bg-white"
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveDueT(
                                              asg?.id,
                                              dueDraftT || null,
                                            );
                                            setEditDueId(null);
                                          }}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-900 text-white"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditDueId(null);
                                          }}
                                          className="text-[10px] px-1 text-stone-500"
                                        >
                                          Cancel
                                        </button>
                                      </span>
                                    );
                                  if (canEditDatesT)
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDueDraftT(sd || "");
                                          setEditDueId(asg?.id);
                                        }}
                                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                          sd
                                            ? sd < todayKeyT
                                              ? "bg-red-100 text-red-700 border-red-200"
                                              : sd === todayKeyT
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-stone-100 text-stone-600 border-stone-200"
                                            : "bg-white text-stone-500 border-dashed border-stone-300"
                                        }`}
                                      >
                                        <Calendar size={9} />{" "}
                                        {sd
                                          ? sd < todayKeyT
                                            ? `Overdue · ${fmtDueDate(sd)}`
                                            : sd === todayKeyT
                                              ? "Today"
                                              : fmtDueDate(sd)
                                          : "Set due date"}
                                      </button>
                                    );
                                  return sd ? (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200 inline-flex items-center gap-1">
                                      <Calendar size={9} />{" "}
                                      {sd === todayKeyT
                                        ? "Today"
                                        : fmtDueDate(sd)}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpened(firstTarget);
                                  }}
                                  className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1"
                                >
                                  <Eye size={10} /> Quick glance
                                </button>
                                {onOpenBedroomHistory &&
                                  firstTarget?.unit_id &&
                                  firstTarget?.party_id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenBedroomHistory({
                                          unitId: firstTarget.unit_id,
                                          unitLabel: group.unit?.label,
                                          partyId: firstTarget.party_id,
                                          partyLabel: bedLabel,
                                        });
                                      }}
                                      disabled={busy}
                                      className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <Clock size={10} /> History
                                    </button>
                                  )}
                              </div>
                            </div>
                          </div>
                          {/* === TYPE + TASK COUNT (new card style) === */}
                          <div className="mb-2 flex items-center gap-2 flex-wrap text-[11px] font-mono text-stone-500">
                            {firstTarget?.assignment?.assignment_type && (
                              <AssignmentTypeChip
                                type={firstTarget.assignment.assignment_type}
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpened(firstTarget);
                              }}
                              className="underline decoration-stone-400 underline-offset-2 hover:text-stone-700"
                            >
                              {newItems.length}{" "}
                              {newItems.length === 1 ? "task" : "tasks"}
                            </button>
                            {sectionBits.length > 0 && (
                              <span className="text-stone-400">
                                · {sectionBits.join(" · ")}
                              </span>
                            )}
                          </div>
                          {/* === BULK ACTION BUTTONS ===
                             Start = navigate to bedroom (no status flip).
                             Pause = flip in_progress items to paused so the
                                     cleaner can step away and return without
                                     losing the timer/credit. Visible on In
                                     progress tab only — Pending has nothing
                                     to pause, Done/Blocked are terminal.
                             Resume = flip paused items back to in_progress.
                                      Visible on Paused tab.
                             Mark complete = bulk mark all to done (with confirm).
                             Blocked = bulk mark all blocked (note via modal on first
                                       target as proxy; we apply the same note to all).
                             Reassign = opens reassign modal on the first target.
                                        It's a per-target modal so handling N targets
                                        sequentially would be ugly; keeping it on
                                        one. Most apt cases have 1 assignment per
                                        bedroom in the new model anyway. */}
                          <div className="flex gap-2 flex-wrap items-center">
                            {canGoToBedroom && (
                              <button
                                onClick={() => startAndGo(firstTarget)}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                Go to bedroom <ChevronRight size={13} />
                              </button>
                            )}
                            {allDone &&
                              can(employee, "mark_assignments_done") && (
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Reopen ${bedLabel}? It goes back to Pending so it can be worked again.`,
                                      )
                                    )
                                      bulkUpdateStatus(newItems, "pending");
                                  }}
                                  disabled={busy}
                                  className="h-9 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                  <RotateCcw size={12} /> Reopen
                                </button>
                              )}
                            {/* Pause: only visible when there's actually
                               something running at this bedroom. The bulk
                               filter picks the in_progress items and
                               flips them to paused, preserving started_by /
                               started_at so the audit trail stays honest. */}
                            {newItems.some(
                              (t) => t.status === "in_progress",
                            ) && (
                              <button
                                onClick={() => {
                                  const running = newItems.filter(
                                    (t) => t.status === "in_progress",
                                  );
                                  bulkUpdateStatus(running, "paused");
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Pause size={12} /> Pause
                              </button>
                            )}
                            {/* Resume: pulls paused items back to in_progress
                               so the cleaner picks up where they left off. */}
                            {newItems.some((t) => t.status === "paused") && (
                              <button
                                onClick={async () => {
                                  const paused = newItems.filter(
                                    (t) => t.status === "paused",
                                  );
                                  await bulkUpdateStatus(paused, "in_progress");
                                  // Resume should drop the cleaner straight back
                                  // into the bedroom to keep working — not leave
                                  // them on the card having to tap "Go to this
                                  // bedroom" as a second step.
                                  startAndGo(firstTarget);
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Play size={12} /> Resume
                              </button>
                            )}
                            {canBulkComplete && (
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Mark all ${newItems.length} items at ${bedLabel} complete?`,
                                    )
                                  )
                                    return;
                                  await bulkUpdateStatus(newItems, "done");
                                  // Also close any open workblock this cleaner
                                  // owns at this bedroom. Saying "everything
                                  // is done" with a workblock still ticking
                                  // was contradictory and forced the cleaner
                                  // to remember to close it manually.
                                  if (employee?.id) {
                                    const unitId = newItems[0]?.unit_id;
                                    const partyId = newItems[0]?.party_id;
                                    if (unitId && partyId) {
                                      try {
                                        const { data: openBlocks } =
                                          await supabase
                                            .from("work_blocks")
                                            .select(
                                              "id, shift:shifts!inner(employee_id)",
                                            )
                                            .eq("unit_id", unitId)
                                            .eq("party_id", partyId)
                                            .is("end_time", null);
                                        const myOpen = (
                                          openBlocks || []
                                        ).filter(
                                          (b) =>
                                            b.shift?.employee_id ===
                                            employee.id,
                                        );
                                        if (myOpen.length > 0) {
                                          const ts = new Date().toISOString();
                                          await supabase
                                            .from("work_blocks")
                                            .update({ end_time: ts })
                                            .in(
                                              "id",
                                              myOpen.map((b) => b.id),
                                            );
                                        }
                                      } catch (e) {
                                        console.warn(
                                          "[Finished all tasks] could not close own workblock",
                                          e,
                                        );
                                      }
                                    }
                                  }
                                }}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <Check size={12} /> Finished all tasks
                              </button>
                            )}
                            {!allDone && (
                              <OwnerOnly employee={employee}>
                                <button
                                  onClick={() =>
                                    setStatusModal({
                                      target: firstTarget,
                                      bulkRows: newItems,
                                    })
                                  }
                                  disabled={busy}
                                  title="Owners only"
                                  className="h-9 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                  <AlertCircle size={12} /> Block
                                </button>
                              </OwnerOnly>
                            )}
                            {!allDone && (
                              <button
                                onClick={() => setReassignTarget(firstTarget)}
                                disabled={busy}
                                className="h-9 px-3 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                              >
                                <User size={12} /> Reassign
                              </button>
                            )}
                            {/* Owner-only: delete an assignment uploaded by mistake. */}
                            {can(employee, "upload_assignments") &&
                              firstTarget?.assignment?.id && (
                                <button
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        "Delete this assignment? Use this only if it was uploaded by mistake — it removes it for everyone.",
                                      )
                                    )
                                      return;
                                    const { error } = await supabase
                                      .from("assignments")
                                      .update({
                                        deleted_at: new Date().toISOString(),
                                        deleted_by: employee?.id || null,
                                      })
                                      .eq("id", firstTarget.assignment.id);
                                    if (error) {
                                      alert(
                                        "Could not delete: " + error.message,
                                      );
                                      return;
                                    }
                                    load();
                                    if (onUpdate) onUpdate();
                                  }}
                                  disabled={busy}
                                  title="Delete this assignment (uploaded by mistake)"
                                  className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center border border-stone-300 bg-white hover:bg-red-50 text-red-600 disabled:opacity-50"
                                >
                                  <X size={16} />
                                </button>
                              )}
                          </div>
                          {/* Full-width "Go to this bedroom" bar removed — it's a
                             small button in the action row now. */}
                        </div>
                      );
                    }
                    return (
                      <React.Fragment key={groupKey}>
                        {/* Legacy items at this bedroom — keep the
                           original per-item rendering so Mon-Wed
                           assignments stay exactly as the cleaners
                           are used to. */}
                        {legacyItems.map((t) => (
                          <AssignmentCard
                            key={t.id}
                            target={t}
                            busy={busy}
                            propertyId={propertyId}
                            onView={() => setOpened(t)}
                            onStart={() => startAndGo(t)}
                            onPause={() => updateStatus(t, "paused")}
                            onMoveToPending={() => updateStatus(t, "pending")}
                            onDone={() => updateStatus(t, "done")}
                            onReopen={() => reopenTarget(t)}
                            onBlocked={() => setStatusModal({ target: t })}
                            onReassign={() => setReassignTarget(t)}
                            onTogglePriority={togglePriority}
                            canPrioritize={
                              can(employee, "mark_assignments_done") ||
                              can(employee, "upload_assignments")
                            }
                            canMarkDone={
                              can(employee, "mark_assignments_done") ||
                              t.started_by === employee?.id
                            }
                            canMarkDoneAlways={can(
                              employee,
                              "mark_assignments_done",
                            )}
                            ownerView={isOwner(employee)}
                            currentEmployeeId={employee?.id}
                            onGoToBedroom={
                              onGoToBedroom ? () => startAndGo(t) : null
                            }
                            canEditDates={can(employee, "edit_due_dates")}
                            onSetDueDate={async (aid, date) => {
                              if (aid) {
                                await updateAssignmentScheduledDate(aid, date);
                                load();
                              }
                            }}
                            onOpenBedroomHistory={onOpenBedroomHistory}
                          />
                        ))}
                        {/* NEW items at this bedroom: ONE bedroom-level
                           bulk card with section breakdown + all the
                           same action buttons as legacy. */}
                        {bulkCard}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAssignmentList = (items) => {
    // For non-Pending tabs we previously rendered each assignment_target
    // as a separate AssignmentCard. That meant a bedroom with 16 items
    // showed up as 16 cards on In progress / Paused / Blocked, which is
    // exactly the "ton of cards" the cleaner reported. Routing every
    // tab through renderGroupedItems collapses those rows down to ONE
    // bedroom-level card with the bulk-action chrome — same model as
    // Pending. We keep the priority-split below for the Pending tab
    // only since priority callouts are most useful when planning what
    // to do next.
    if (statusFilter !== "pending") {
      return renderGroupedItems(items);
    }

    // PENDING TAB: split priority vs the rest, render with visual divider.
    // Done / blocked excluded from priority since they've already been
    // resolved — "do these first" implies work still to do.
    const priorityItems = items.filter(
      (t) => t.priority && t.status !== "done" && t.status !== "blocked",
    );
    const normalItems = items.filter((t) => !t.priority);

    return (
      <div className="space-y-2">
        {priorityItems.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-1">
              <AlertCircle size={12} className="text-red-700 flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-red-700">
                Priority — do these first ({priorityItems.length})
              </span>
              <div className="flex-1 h-px bg-red-200" />
            </div>
            {renderGroupedItems(priorityItems)}
          </>
        )}
        {priorityItems.length > 0 && normalItems.length > 0 && (
          <div className="py-2 flex items-center gap-2 px-1">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
              Everything else
            </span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
        )}
        {normalItems.length > 0 && renderGroupedItems(normalItems)}
      </div>
    );
  };

  // Done items are already narrowed by the completed-date range (if any)
  // up in filteredTargets, so here we just render the list — no more
  // day-of / last-3 / older sub-tabs.
  const renderDoneBuckets = (items) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-8 text-stone-400 text-xs border-2 border-dashed border-stone-200 rounded-2xl">
          Nothing matches these filters.
        </div>
      );
    }
    // On the "Last 2 days" view, split Today / Yesterday so the day you
    // almost always want is visually first. All time / a manual range
    // renders as one flat list — sub-day headers there would be noise.
    if (doneWindow === "recent" && !dateFrom && !dateTo) {
      const { dayOf, last3 } = bucketByAge(items);
      const yesterday = last3; // within the 2-day window this is just yesterday
      return (
        <div className="space-y-3">
          {dayOf.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 mb-1.5 px-1">
                Today ({countBedrooms(dayOf)})
              </div>
              {renderAssignmentList(dayOf)}
            </div>
          )}
          {yesterday.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5 px-1">
                Yesterday ({countBedrooms(yesterday)})
              </div>
              {renderAssignmentList(yesterday)}
            </div>
          )}
        </div>
      );
    }
    return renderAssignmentList(items);
  };

  return (
    <div>
      {/* Apartment search — Done view only. Type an apartment/bedroom
         number to jump to it. */}
      {isDoneView && targets.length > 0 && (
        <div className="mb-3 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={aptSearch}
            onChange={(e) => setAptSearch(e.target.value)}
            placeholder="Search apartment number…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-700 focus:outline-none focus:border-stone-900"
          />
          {aptSearch && (
            <button
              onClick={() => setAptSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-stone-100 text-stone-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {/* Filters bar: toggle to expand, pills inside. Counts active filters
         on the button so the user knows when filters are narrowing things. */}
      {targets.length > 0 &&
        (availableTypes.length > 1 ||
          availableCleaners.length > 0 ||
          availableCategories.length > 0 ||
          isDoneView) && (
          <div className="mb-3">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${activeFilterCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
            >
              <div className="flex items-center gap-2">
                <Settings size={14} />
                <span className="text-xs uppercase tracking-wider font-mono">
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  Showing {countBedrooms(filteredTargets)} of{" "}
                  {countBedrooms(targets)}
                </span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
              />
            </button>
            {filtersOpen && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mt-1 space-y-3">
                {/* Type — multi-select chips. Click to add/remove from filter. */}
                {availableTypes.length > 1 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                      Cleaning type
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableTypes.map((typeVal) => {
                        const active = filterTypes.has(typeVal);
                        return (
                          <button
                            key={typeVal}
                            onClick={() => toggleType(typeVal)}
                            className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                          >
                            {active && <Check size={10} />}
                            {assignmentTypeLabel(typeVal)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Cleaner and Task-category filters removed per request —
                 the Done tab keeps only Cleaning type + a date range. */}
                {/* Completed-date RANGE — pick a start and end day. Leave a
                 side blank for an open-ended range. Only shown on the
                 Done-family tabs where completed dates exist. */}
                {isDoneView && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                      Specific range
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <label className="flex items-center gap-1 text-xs font-mono text-stone-600">
                        <span className="text-stone-400">From</span>
                        <input
                          type="date"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-stone-700"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs font-mono text-stone-600">
                        <span className="text-stone-400">To</span>
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-stone-700"
                        />
                      </label>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => {
                            setDateFrom("");
                            setDateTo("");
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-mono bg-stone-200 text-stone-600 hover:bg-stone-300"
                        >
                          Clear dates
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 mt-1">
                      Leave blank to show all. Pick the same day twice for one
                      day, or a span for a range.
                    </div>
                  </div>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setFilterTypes(new Set());
                      setFilterCleaners(new Set());
                      setDateFrom("");
                      setDateTo("");
                      setFilterCategories(new Set());
                    }}
                    className="text-[10px] uppercase tracking-wider font-mono text-amber-700 hover:text-amber-900"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      {/* Building filter pills — multi-select. Empty = all buildings. */}
      {buildingKeys.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilterBuildings(new Set())}
            className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${filterBuildings.size === 0 ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
          >
            All ({countBedrooms(filteredTargets)})
          </button>
          {buildingKeys.map((b) => {
            const on = filterBuildings.has(b);
            return (
              <button
                key={b}
                onClick={() => toggleBuilding(b)}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap flex items-center gap-1 ${on ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
              >
                {on && <Check size={10} />}
                {b === "—" ? "No unit" : b} ({countBedrooms(buildings[b])})
              </button>
            );
          })}
        </div>
      )}

      {/* Last 2 days / All time — placed here, below the building pills
         and directly above the results, where it's actually in view when
         scanning the list. (It also lives inside Filters, but only power
         users open that.) Only meaningful on the Done family of tabs. */}
      {isDoneView && !dateFrom && !dateTo && (
        <div className="flex p-0.5 bg-stone-100 rounded-lg mb-3 max-w-xs">
          <button
            onClick={() => setDoneWindow("recent")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-mono ${doneWindow === "recent" ? "bg-white shadow-sm text-stone-900 font-medium" : "text-stone-500"}`}
          >
            Last 2 days
          </button>
          <button
            onClick={() => setDoneWindow("all")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-mono ${doneWindow === "all" ? "bg-white shadow-sm text-stone-900 font-medium" : "text-stone-500"}`}
          >
            All time
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Global priority section — shows all priority items across
           buildings as a single block at the top of Pending. Pulled out
           of the per-building loop so they're never hidden behind a
           building they don't belong to.
           CRITICAL: priority items render as FLAT CARDS (no bundling,
           no collapse). The whole point of priority is "do this first" —
           if we hide priority items inside collapsed apartment bundles,
           the user has to tap to find them. Flat cards = every priority
           visible at a glance. */}
        {globalPriorityItems.length > 0 && (
          <div className="rounded-2xl border-2 border-red-300 bg-red-50/50 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <AlertCircle size={14} className="text-red-700 flex-shrink-0" />
              <span className="text-xs uppercase tracking-wider font-mono font-bold text-red-700">
                Priority — do these first ({countBedrooms(globalPriorityItems)})
              </span>
              <div className="flex-1 h-px bg-red-200" />
            </div>
            {/* Route priority items through renderGroupedItems so each
               BEDROOM collapses to one card — not one card per target.
               Move-out checks flag every one of their 8 items as
               priority, which previously rendered the same bedroom 8
               times. The count above and the cards below now both
               reflect distinct bedrooms. */}
            {renderGroupedItems(globalPriorityItems)}
          </div>
        )}

        {visibleBuildings.map((b) => {
          const items = buildings[b];
          // When global priority section is showing, exclude priority
          // items from the building loop so they don't appear twice.
          const itemsForBuilding =
            globalPriorityItems.length > 0
              ? items.filter((t) => !t.priority)
              : items;
          // If a building has ONLY priority items, skip rendering its
          // section entirely — its items are all in the top block.
          if (itemsForBuilding.length === 0) return null;
          const collapsed = !!collapsedBuildings[b];
          // Only show group header if there's more than 1 building total
          const showHeader = buildingKeys.length > 1;

          // Sub-group by FLOOR (first digit of the apartment number).
          // The owner asked for Floor 1 → Floor 2 → Floor 3 sections
          // so the cleaner reads the building top-down in the order
          // they'd physically walk it. Items without a parseable floor
          // (e.g. property-level no-unit) land in a "—" bucket.
          const byFloor = {};
          itemsForBuilding.forEach((t) => {
            const f = floorFromLabel(t.unit?.label);
            const key = f != null ? String(f) : "—";
            if (!byFloor[key]) byFloor[key] = [];
            byFloor[key].push(t);
          });
          const floorKeys = Object.keys(byFloor).sort((a, b) => {
            if (a === "—") return 1;
            if (b === "—") return -1;
            return parseInt(a, 10) - parseInt(b, 10);
          });
          // If there's only one floor's worth of items, skip the floor
          // labels — they'd be noise.
          const showFloorHeaders = floorKeys.length > 1;

          return (
            <div key={b}>
              {showHeader && (
                <button
                  onClick={() => toggleCollapse(b)}
                  className="w-full flex items-center justify-between mb-2 px-1 py-2 hover:bg-stone-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-stone-700" />
                    <span className="font-serif text-sm text-stone-900 font-bold">
                      {b === "—"
                        ? "No unit"
                        : `Building ${b.replace(/^B/i, "")}`}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      ({countBedrooms(itemsForBuilding)})
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-stone-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
                  />
                </button>
              )}
              {!collapsed &&
                (statusFilter === "done" ? (
                  renderDoneBuckets(itemsForBuilding)
                ) : showFloorHeaders ? (
                  <div className="space-y-3">
                    {floorKeys.map((fk) => {
                      const floorKey = `${b}::${fk}`;
                      const floorOpen = !collapsedFloors[floorKey];
                      return (
                        <div key={fk}>
                          <button
                            onClick={() =>
                              setCollapsedFloors((prev) => ({
                                ...prev,
                                [floorKey]: !prev[floorKey],
                              }))
                            }
                            className="w-full flex items-center gap-2 mb-1.5 px-1 hover:bg-stone-50 rounded transition-colors text-left"
                          >
                            <ChevronRight
                              size={12}
                              className={`text-stone-500 flex-shrink-0 transition-transform ${floorOpen ? "rotate-90" : ""}`}
                            />
                            <span className="text-sm font-bold text-stone-800 tracking-wide">
                              {fk === "—" ? "Other" : `Floor ${fk}`}
                            </span>
                            <span className="text-xs font-mono text-stone-500">
                              ({countBedrooms(byFloor[fk])})
                            </span>
                            <div className="flex-1 h-px bg-stone-300" />
                          </button>
                          {floorOpen && renderAssignmentList(byFloor[fk])}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  renderAssignmentList(itemsForBuilding)
                ))}
            </div>
          );
        })}
      </div>

      {opened &&
        (opened.assignment?.template_set_id ? (
          <ChecklistAssignmentView
            assignment={opened.assignment}
            onOpenSibling={(a) => setOpened((o) => ({ ...o, assignment: a }))}
            employee={employee}
            quickGlance={true}
            onClose={() => setOpened(null)}
            onOpenSheet={
              opened.assignment?.file_url
                ? () =>
                    window.open(
                      opened.assignment.file_url,
                      "_blank",
                      "noopener",
                    )
                : null
            }
          />
        ) : (
          <AssignmentViewer
            target={opened}
            employee={employee}
            onClose={() => setOpened(null)}
          />
        ))}
      {statusModal && (
        <BlockedNoteModal
          target={statusModal.target}
          onSave={(notes) => {
            // When the bedroom-level "Blocked" button opens this modal
            // it sets bulkRows = every new item at the bedroom. We
            // apply the same blocked + note to all of them in one call.
            // Per-item Blocked (legacy AssignmentCard) doesn't set
            // bulkRows, so it falls back to single-target update.
            if (statusModal.bulkRows && statusModal.bulkRows.length > 0) {
              bulkUpdateStatus(statusModal.bulkRows, "blocked", notes);
              setStatusModal(null);
            } else {
              updateStatus(statusModal.target, "blocked", notes);
            }
          }}
          onClose={() => setStatusModal(null)}
          busy={busy}
        />
      )}
      {reassignTarget && (
        <ReassignModal
          target={reassignTarget}
          propertyId={propertyId}
          onSaved={() => {
            setReassignTarget(null);
            load();
            if (onUpdate) onUpdate();
          }}
          onClose={() => setReassignTarget(null)}
        />
      )}
    </div>
  );
}
