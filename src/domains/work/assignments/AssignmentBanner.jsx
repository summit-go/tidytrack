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
import { AssignmentCard } from "./AssignmentCard.jsx";
import { AssignmentList } from "./AssignmentList.jsx";
import { AssignmentViewer } from "../cross-cutting/AssignmentViewer.jsx";
import { AttachmentModal } from "../cross-cutting/AttachmentModal.jsx";
import { BlockedNoteModal } from "../cross-cutting/BlockedNoteModal.jsx";
import { ChecklistAssignmentView } from "../cross-cutting/ChecklistAssignmentView.jsx";
import { ReassignModal } from "../cross-cutting/ReassignModal.jsx";

export function AssignmentBanner({
  propertyId,
  unitId,
  partyId,
  employee,
  showDone = false,
  onUpdate,
  onOpenBedroomHistory,
  dark = false,
  undoSlot = null,
  propertyName = null,
  elapsedMs = null,
  workScreen = false,
  onStartCleaning = null,
  onExit = null,
}) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attachmentView, setAttachmentView] = useState(null); // { url, kind } | null
  const [editDueId, setEditDueId] = useState(null);
  const [liveHere, setLiveHere] = useState(false); // an open work block exists at this bedroom
  const canEditDatesB = can(employee, "edit_due_dates");
  const todayKeyG = localTodayKey();
  // Owners/managers with this permission get a timeline dropdown on the date
  // pill (submitted / accepted / done / due).
  const canViewTimeline = can(employee, "view_submission_timeline");
  const [timelineOpenG, setTimelineOpenG] = useState(null);
  const fmtStampG = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };
  const saveDueB = async (id, date) => {
    setEditDueId(null);
    if (id) {
      await updateAssignmentScheduledDate(id, date);
      load();
    }
  };

  const load = async () => {
    let q = supabase
      .from("assignment_targets")
      .select(
        "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, approved_at, deleted_at, extracted_text, spanish_translation, translation_status, template_set_id, sheet_type, bathroom_variant, general_variant, assignment_type, scheduled_date, created_at), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name), assignedTo:employees!assigned_to(id, name)",
      );

    if (!showDone) q = q.not("status", "in", "(done,blocked)");

    if (unitId && partyId) {
      q = q.or(
        `and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`,
      );
    } else if (unitId) {
      q = q.or(`unit_id.eq.${unitId},and(unit_id.is.null,party_id.is.null)`);
    } else {
      q = q.is("unit_id", null).is("party_id", null);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[AssignmentBanner] load error:", error);
    }
    // Hide non-approved PM assignments from cleaners — they should only see what's approved
    const filtered = (data || []).filter(
      (t) =>
        t.assignment?.customer_id === propertyId &&
        t.assignment?.active &&
        !t.assignment?.deleted_at &&
        isPmApprovedAssignment(t.assignment),
    );
    // Priority items first, then by status (pending/in_progress before done)
    filtered.sort((a, b) => {
      const ap = a.priority ? 1 : 0;
      const bp = b.priority ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });
    setTargets(filtered);
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [propertyId, unitId, partyId, showDone]);

  // Is anyone in an OPEN work block at this bedroom right now? Starting a
  // block runs the timer but deliberately doesn't flip item status to
  // in_progress — so a bedroom being actively cleaned still reads
  // "pending" on its items. That's confusing on the card, so we detect a
  // live block here and let the status pill reflect it.
  useEffect(() => {
    if (!unitId || !partyId) {
      setLiveHere(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("work_blocks")
        .select("id, shift:shifts!inner(customer_id)")
        .eq("unit_id", unitId)
        .eq("party_id", partyId)
        .is("end_time", null);
      if (cancelled) return;
      setLiveHere(
        (data || []).some((b) => b.shift?.customer_id === propertyId),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, unitId, partyId]);
  useAssignmentSync(load, "asgn-banner");

  const updateStatus = async (target, newStatus, statusNotes) => {
    // Snapshot of values used for both the optimistic update AND the DB
    // patch. By computing them up front we avoid a race where the user
    // double-taps and the second click captures a stale target.
    const completedNow = newStatus === "done" ? new Date().toISOString() : null;
    const startedNow =
      newStatus === "in_progress" && !target.started_at
        ? new Date().toISOString()
        : null;
    const wasDone = target.status === "done";

    // OPTIMISTIC UPDATE — flip the local UI immediately so the cleaner
    // never sees a "click did nothing" gap. The DB write below makes it
    // durable; realtime sync corrects any divergence. Done is a hard
    // commit: nothing in this code path can put it back to pending /
    // paused / in_progress without an explicit user action.
    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== target.id) return t;
        const next = { ...t, status: newStatus };
        if (newStatus === "in_progress") {
          if (!t.started_at) next.started_at = startedNow;
          next.started_by = employee?.id || null;
        }
        if (newStatus === "done") {
          next.completed_at = completedNow;
          next.completed_by = employee?.id || null;
        } else if (wasDone) {
          // Re-opening a done assignment wipes completion
          next.completed_at = null;
          next.completed_by = null;
        }
        if (
          newStatus === "pending" &&
          (t.status === "paused" ||
            t.status === "in_progress" ||
            t.status === "blocked")
        ) {
          next.started_at = null;
          next.started_by = null;
        }
        if (statusNotes !== undefined) next.status_notes = statusNotes || null;
        return next;
      }),
    );

    setBusy(true);
    // Auto-handoff: if cleaner is starting a new assignment and they have an OTHER
    // in_progress assignment on a different bedroom, mark that one done first.
    if (newStatus === "in_progress" && employee?.id) {
      try {
        const { data: otherActive } = await supabase
          .from("assignment_targets")
          .select("id, unit_id, party_id")
          .eq("status", "in_progress")
          .eq("started_by", employee.id)
          .neq("id", target.id);
        const switching = (otherActive || []).filter(
          (o) =>
            // Only auto-finish if it's on a DIFFERENT bedroom
            o.unit_id !== target.unit_id || o.party_id !== target.party_id,
        );
        if (switching.length > 0) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("assignment_targets")
            .update({
              status: "done",
              completed_at: nowIso,
              completed_by: employee.id,
            })
            .in(
              "id",
              switching.map((s) => s.id),
            );
        }
      } catch (e) {
        console.warn("[auto-handoff] failed", e);
      }
    }
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      if (!target.started_at) patch.started_at = startedNow;
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = completedNow;
      patch.completed_by = employee?.id || null;
    } else if (wasDone) {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    // Move-to-pending from any started/in-progress/paused state should
    // clear the started_by/started_at so the assignment appears fully
    // unstarted in the Pending tab — matches the "undo a mistaken start"
    // mental model. Without this the Pending card would still show
    // "Started by X" which is misleading.
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
      // Roll back optimistic on failure — keep the user truthful
      setTargets((prev) => prev.map((t) => (t.id === target.id ? target : t)));
      alert("Could not update: " + error.message);
      return;
    }
    setStatusModal(null);
    load();
    if (onUpdate) onUpdate();
  };

  // Smart reopen — restore a done item to what it actually was, rather than
  // forcing "new". Worked items (a real start) return to in_progress (Active);
  // never-started items return to pending (New). See the fuller note on the
  // other reopenTarget.
  const reopenTarget = async (target) => {
    const wasWorked = !!target.started_at || !!target.started_by;
    const newStatus = wasWorked ? "in_progress" : "pending";
    setTargets((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? { ...t, status: newStatus, completed_at: null, completed_by: null }
          : t,
      ),
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
  // can toggle right from the capsule without opening the detail.
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

  // Bulk wrappers — used by the bedroom-level summary card so
  // Mark complete / Mark priority / Blocked work across every item
  // in a single tap. Optimistic + single DB write per action.
  const bulkUpdateStatus = async (rows, newStatus, statusNotes) => {
    if (!rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    setTargets((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t)),
    );
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
    if (onUpdate) onUpdate();
    load();
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
    } else if (onUpdate) onUpdate();
  };

  if (!loaded || targets.length === 0) return null;

  // Group checklist-style targets (template_set_id is set) under their
  // parent assignment so the banner shows ONE card per inspection
  // sheet instead of one per item. Legacy targets (no template) stay
  // as individual cards because each IS the unit of work.
  // Returns: { groups: [{ assignment, items: [...], legacy: bool }] }
  const buildGroups = (list) => {
    const byAssignmentId = new Map();
    list.forEach((t) => {
      const aid = t.assignment?.id;
      const isChecklist = !!t.assignment?.template_set_id;
      const key = isChecklist ? `cl:${aid}` : `lg:${t.id}`;
      if (!byAssignmentId.has(key)) {
        byAssignmentId.set(key, {
          key,
          assignment: t.assignment,
          isChecklist,
          items: [],
          // Use the first target as the "representative" for actions
          // like View doc / start-by-section that operate at parent level.
          representative: t,
        });
      }
      byAssignmentId.get(key).items.push(t);
    });
    return Array.from(byAssignmentId.values());
  };

  return (
    <div
      className={
        dark
          ? "px-5 pt-1 pb-5 bg-slate-800 border-t border-slate-700"
          : "mx-2 sm:mx-4 mt-4 p-3 sm:p-4 rounded-2xl bg-blue-50 border-2 border-blue-200"
      }
    >
      {/* Dark-card context header: WHERE you are (property) + how long the
         block has been running. Always shown on the working screen so the
         cleaner is never unsure which property/card they're on. */}
      {dark && (
        <div className="mb-4 pt-1">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-mono">
            Working on
          </div>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div className="min-w-0">
              {propertyName && (
                <div className="font-serif text-2xl text-stone-50 leading-tight truncate">
                  {propertyName}
                </div>
              )}
            </div>
            {elapsedMs != null && (
              /* This is the block clock — time cleaning THIS bedroom, not the
                 shift clock. Labelled so it can't be mistaken for clocked-in
                 time (which lives on the Home screen as "On the clock"). */
              <div className="text-right flex-shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-stone-400 font-mono leading-none mb-0.5">
                  Cleaning time
                </div>
                <div className="font-mono text-2xl text-stone-50 tracking-tight tabular-nums leading-none">
                  {fmtTime(elapsedMs)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {dark &&
        workScreen &&
        (targets.some((t) => t.assignment?.file_url) || undoSlot) && (
          <div className="flex items-center justify-end gap-2 mb-3">
            {/* Attachment button — view the uploaded sheet/photo for this
             bedroom's assignment, next to the undo control. */}
            {(() => {
              const withFile = targets.find((t) => t.assignment?.file_url);
              if (!withFile) return null;
              return (
                <button
                  onClick={() =>
                    setAttachmentView({
                      url: withFile.assignment.file_url,
                      kind: withFile.assignment.file_kind,
                    })
                  }
                  title="View attachment"
                  className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 text-stone-100 flex items-center justify-center flex-shrink-0 active:scale-95 transition"
                >
                  <FileText size={16} />
                </button>
              );
            })()}
            {undoSlot}
          </div>
        )}
      {(() => {
        const groups = buildGroups(targets);
        // Split priority and non-priority so the visual divider matches
        // the rest of the app — priority items live at the top, then a
        // small "everything else" separator. A group is "priority" if
        // ANY of its items are priority + not done. Legacy (single
        // target) groups behave exactly as before.
        const groupIsPriority = (g) =>
          g.items.some((t) => t.priority && t.status !== "done");
        const priorityGroups = groups.filter(groupIsPriority);
        const restGroups = groups.filter((g) => !groupIsPriority(g));
        // Render a LEGACY group as its single card (existing behavior).
        // Render a CHECKLIST group as a summary card with item counts
        // and a "View items" button that opens ChecklistAssignmentView.
        const renderGroup = (g) => {
          if (!g.isChecklist) return renderCard(g.items[0]);
          return renderChecklistGroupCard(g);
        };
        const renderCard = (t) => (
          <AssignmentCard
            key={t.id}
            target={t}
            busy={busy}
            propertyId={propertyId}
            onView={() => setOpened(t)}
            onStart={() => updateStatus(t, "in_progress")}
            onPause={() => updateStatus(t, "paused")}
            onMoveToPending={() => updateStatus(t, "pending")}
            onDone={() => updateStatus(t, "done")}
            onReopen={() => reopenTarget(t)}
            onBlocked={() => setStatusModal({ target: t })}
            onReassign={() => setReassignTarget(t)}
            onDelete={
              can(employee, "upload_assignments")
                ? async () => {
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
                      .eq("id", t.assignment?.id);
                    if (error) {
                      alert("Could not delete: " + error.message);
                      return;
                    }
                    if (onUpdate) onUpdate();
                    load();
                  }
                : null
            }
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
            canEditDates={can(employee, "edit_due_dates")}
            onSetDueDate={async (aid, date) => {
              if (aid) {
                await updateAssignmentScheduledDate(aid, date);
                load();
              }
            }}
            onOpenBedroomHistory={onOpenBedroomHistory}
            dark={dark}
            workScreen={workScreen}
            onStartCleaning={onStartCleaning}
            onExit={onExit}
          />
        );
        // Checklist group card: ONE card representing a whole inspection
        // sheet. Shows progress + a View items button. Tapping View
        // items opens ChecklistAssignmentView with full per-item
        // controls. Pause / Start operate on ALL items in the group.
        const renderChecklistGroupCard = (g) => {
          const a = g.assignment;
          const items = g.items;
          const rep = g.representative;
          const counts = {
            pending: items.filter((i) => i.status === "pending").length,
            in_progress: items.filter((i) => i.status === "in_progress").length,
            done: items.filter((i) => i.status === "done").length,
            paused: items.filter((i) => i.status === "paused").length,
            blocked: items.filter((i) => i.status === "blocked").length,
          };
          const total = items.length;
          const isAllDone = counts.done === total;
          // Most recent completion across this assignment's items — the
          // "done" point for the timeline dropdown.
          const doneStampsG = items
            .map((i) => i.completed_at)
            .filter(Boolean)
            .sort();
          const doneAtG = doneStampsG.length
            ? doneStampsG[doneStampsG.length - 1]
            : null;
          // Section breakdown — "57 items · Bedroom (16) · Vanity (12) · …"
          const sectionCounts = {
            bedroom: items.filter(
              (i) => (i.template_section || "").toLowerCase() === "bedroom",
            ).length,
            vanity: items.filter(
              (i) => (i.template_section || "").toLowerCase() === "vanity",
            ).length,
            bathroom: items.filter(
              (i) => (i.template_section || "").toLowerCase() === "bathroom",
            ).length,
            general: items.filter(
              (i) => (i.template_section || "").toLowerCase() === "general",
            ).length,
          };
          const knownSectioned =
            sectionCounts.bedroom +
            sectionCounts.vanity +
            sectionCounts.bathroom +
            sectionCounts.general;
          const otherCount = total - knownSectioned;
          const sectionBits = [];
          if (sectionCounts.bedroom)
            sectionBits.push(`Bedroom (${sectionCounts.bedroom})`);
          if (sectionCounts.vanity)
            sectionBits.push(`Vanity (${sectionCounts.vanity})`);
          if (sectionCounts.bathroom)
            sectionBits.push(`Bathroom (${sectionCounts.bathroom})`);
          if (sectionCounts.general)
            sectionBits.push(`General (${sectionCounts.general})`);
          if (otherCount > 0) sectionBits.push(`Other (${otherCount})`);
          // Aggregated priority + status for the chips on the right
          const anyPriority = items.some((i) => i.priority);
          const statusOrder = [
            "pending",
            "in_progress",
            "paused",
            "blocked",
            "done",
          ];
          const dominantStatus =
            statusOrder.find((s) => items.some((i) => i.status === s)) ||
            "pending";
          // If someone has an open block here, the bedroom IS being worked
          // even if items still read pending — show that instead.
          const effectiveStatus =
            liveHere && dominantStatus === "pending"
              ? "in_progress"
              : dominantStatus;
          const statusPill =
            ASSIGNMENT_STATUSES[effectiveStatus] || ASSIGNMENT_STATUSES.pending;
          // Item-level rows the cleaner can act on in BULK
          const openItems = items.filter((i) => i.status !== "done");
          // On the ready-to-start screen the big "Start cleaning" button
          // above is the real start action. If NOTHING here is started
          // yet, Mark complete / Block don't apply — grey them out until
          // the cleaner starts (owners with mark_assignments_done keep
          // them live). Matches the single-card gating.
          const allPending =
            openItems.length > 0 &&
            openItems.every((i) => i.status === "pending");
          const bundleGated =
            allPending && !can(employee, "mark_assignments_done");
          // Dark theme (matches the single-assignment AssignmentCard) so both
          // card types look identical when folded into the black header.
          const DC = {
            card: dark
              ? "bg-slate-900 border-slate-600"
              : "bg-white border-stone-200",
            title: dark ? "text-white" : "text-stone-900",
            sep: dark ? "text-stone-500" : "text-stone-400",
            body: dark ? "text-stone-200" : "text-stone-700",
            muted: dark ? "text-stone-300" : "text-stone-500",
            chip: dark
              ? "bg-stone-200 hover:bg-stone-300 text-stone-900"
              : "bg-stone-100 hover:bg-stone-200 text-stone-700",
            outlineBtn: dark
              ? "border-slate-500 hover:bg-slate-700 text-stone-100"
              : "border-stone-300 hover:bg-stone-50 text-stone-700",
          };
          return (
            <div
              key={g.key}
              className={`p-3 sm:p-4 rounded-xl border ${DC.card}`}
            >
              {/* === HEADER: bedroom title + chips on right ===
                 Layout mirrors the AssignmentList card exactly so
                 the cleaner sees the same chrome everywhere. */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {rep?.unit?.label || rep?.party?.label ? (
                    <div
                      className={`font-serif text-lg ${DC.title} leading-tight break-words`}
                    >
                      {unitPartyLabel(rep?.unit?.label, rep?.party?.label) ||
                        "No unit"}
                    </div>
                  ) : (
                    <div className={`font-serif text-lg ${DC.title} font-bold`}>
                      Checklist assignment
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-shrink-0 sm:max-w-[60%]">
                  {/* Mini-row 1: Priority + status — Mark Priority is
                     a bulk toggle here since the card represents N items. */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {!isAllDone &&
                    (can(employee, "mark_assignments_done") ||
                      can(employee, "upload_assignments")) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          bulkTogglePriority(items);
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
                    ) : (
                      <PriorityChip on={anyPriority && !isAllDone} />
                    )}
                    <span
                      className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${statusPill.color}`}
                    >
                      {statusPill.label}
                    </span>
                    {canViewTimeline ? (
                      editDueId === a?.id ? (
                        <DueDateEditor
                          compact
                          value={a?.scheduled_date || ""}
                          onSave={(d) => saveDueB(a?.id, d)}
                          onCancel={() => setEditDueId(null)}
                        />
                      ) : (
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimelineOpenG(
                                timelineOpenG === a?.id ? null : a?.id,
                              );
                            }}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                              a?.scheduled_date
                                ? a.scheduled_date < todayKeyG
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : a.scheduled_date === todayKeyG
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : "bg-stone-100 text-stone-600 border-stone-200"
                                : "bg-white text-stone-500 border-dashed border-stone-300"
                            }`}
                          >
                            <Calendar size={9} />{" "}
                            {a?.scheduled_date
                              ? fmtDueDate(a.scheduled_date)
                              : "Set due date"}
                            <ChevronRight
                              size={10}
                              className="rotate-90 opacity-60"
                            />
                          </button>
                          {timelineOpenG === a?.id && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTimelineOpenG(null);
                                }}
                              />
                              <div
                                className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-stone-400">
                                  Timeline
                                </div>
                                <div className="px-3 pb-2 space-y-1.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                      <FileText size={11} /> Submitted
                                    </span>
                                    <span
                                      className={`text-[11px] font-mono ${a?.created_at ? "text-stone-800" : "text-stone-400"}`}
                                    >
                                      {a?.created_at
                                        ? fmtStampG(a.created_at)
                                        : "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                      <UserPlus size={11} /> Accepted
                                    </span>
                                    <span
                                      className={`text-[11px] font-mono ${a?.approved_at || a?.pm_status === "approved" || !a?.pm_status ? "text-emerald-700" : "text-stone-400"}`}
                                    >
                                      {a?.approved_at
                                        ? fmtStampG(a.approved_at)
                                        : !a?.pm_status ||
                                            a?.pm_status === "approved"
                                          ? a?.created_at
                                            ? `${fmtStampG(a.created_at)} · auto`
                                            : "Auto"
                                          : a?.pm_status === "pending"
                                            ? "Awaiting you"
                                            : a?.pm_status === "rejected"
                                              ? "Rejected"
                                              : "Not yet"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                      <Check size={11} /> Done
                                    </span>
                                    <span
                                      className={`text-[11px] font-mono ${doneAtG ? "text-stone-800" : "text-stone-400"}`}
                                    >
                                      {doneAtG ? fmtStampG(doneAtG) : "Not yet"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-100">
                                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                      <Calendar size={11} /> Due
                                    </span>
                                    <span className="text-[11px] font-mono text-stone-800">
                                      {a?.scheduled_date
                                        ? fmtDueDate(a.scheduled_date)
                                        : "—"}
                                    </span>
                                  </div>
                                </div>
                                {canEditDatesB && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTimelineOpenG(null);
                                      setEditDueId(a?.id);
                                    }}
                                    className="w-full border-t border-stone-100 px-3 py-2 text-[11px] font-mono text-stone-600 hover:bg-stone-50 text-left flex items-center gap-1.5"
                                  >
                                    <Edit2 size={11} /> Change due date
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    ) : (
                      !isAllDone &&
                      (editDueId === a?.id ? (
                        <DueDateEditor
                          compact
                          value={a?.scheduled_date || ""}
                          onSave={(d) => saveDueB(a?.id, d)}
                          onCancel={() => setEditDueId(null)}
                        />
                      ) : canEditDatesB ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDueId(a?.id);
                          }}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            a?.scheduled_date
                              ? a.scheduled_date < todayKeyG
                                ? "bg-red-100 text-red-700 border-red-200"
                                : a.scheduled_date === todayKeyG
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-stone-100 text-stone-600 border-stone-200"
                              : "bg-white text-stone-500 border-dashed border-stone-300"
                          }`}
                        >
                          <Calendar size={9} />{" "}
                          {a?.scheduled_date
                            ? a.scheduled_date < todayKeyG
                              ? `Overdue · ${fmtDueDate(a.scheduled_date)}`
                              : a.scheduled_date === todayKeyG
                                ? "Today"
                                : fmtDueDate(a.scheduled_date)
                            : "Set due date"}
                        </button>
                      ) : a?.scheduled_date ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200 inline-flex items-center gap-1">
                          <Calendar size={9} />{" "}
                          {a.scheduled_date === todayKeyG
                            ? "Today"
                            : fmtDueDate(a.scheduled_date)}
                        </span>
                      ) : null)
                    )}
                  </div>
                  {/* Mini-row 2: History (Quick glance removed — the "X task"
                     count link peeks; the eye pill was redundant). */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {!workScreen &&
                      onOpenBedroomHistory &&
                      rep?.unit_id &&
                      rep?.party_id && (
                        <button
                          onClick={() =>
                            onOpenBedroomHistory({
                              unitId: rep.unit_id,
                              unitLabel: rep.unit?.label,
                              partyId: rep.party_id,
                              partyLabel: rep.party?.label,
                            })
                          }
                          disabled={busy}
                          className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${DC.chip} flex items-center gap-1 disabled:opacity-50`}
                        >
                          <Clock size={10} /> History
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {/* === TITLE + TYPE + SECTION BREAKDOWN === */}
              <div className="mb-2">
                {a?.assignment_type && (
                  <div className="mt-1">
                    <AssignmentTypeChip type={a.assignment_type} />
                  </div>
                )}
                <div className={`text-[11px] font-mono ${DC.muted} mt-1`}>
                  <button
                    onClick={() => setOpened(rep)}
                    className="text-left underline decoration-stone-400 underline-offset-2 hover:opacity-80"
                  >
                    {total} {total === 1 ? "task" : "tasks"}
                  </button>
                  {sectionBits.length > 0 && <> · {sectionBits.join(" · ")}</>}
                </div>
              </div>

              {/* === DONE / IN PROGRESS chips ===
                 x/x done is the clear progress signal; the separate
                 "N pending" was redundant with it (done + pending = total),
                 so it's dropped. Active states (in progress / paused /
                 blocked) still show since those aren't derivable from
                 the done count. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${dark ? "bg-stone-200 text-stone-900" : "bg-stone-100 text-stone-700"}`}
                >
                  {counts.done}/{total} done
                </span>
                {counts.in_progress > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {counts.in_progress} in progress
                  </span>
                )}
                {counts.paused > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {counts.paused} paused
                  </span>
                )}
                {counts.blocked > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {counts.blocked} blocked
                  </span>
                )}
              </div>

              {/* === ACTION BUTTON ROW ===
                 Start / Mark complete / Blocked / Reassign — same set
                 the AssignmentList card shows. Bulk semantics:
                 Mark complete + Blocked apply to every open item.
                 Reassign opens the modal on the representative target
                 (template-based assignments are 1 per bedroom so this
                 is the right one to act on). */}
              <div className="flex gap-2 flex-wrap items-center">
                {/* Start cleaning — same small button as the single-assignment
                   card. Was missing here, so checklist assignments had no way
                   to start. Prep screen only (onStartCleaning). */}
                {onStartCleaning && !isAllDone && (
                  <button
                    onClick={onStartCleaning}
                    disabled={busy}
                    className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Play size={13} /> Start cleaning
                  </button>
                )}
                {/* The owner/manager "mark complete" + "delete" actions moved
                   to compact icons at the right end of this row (below). */}
                {!isAllDone && (
                  <OwnerOnly employee={employee}>
                    <button
                      onClick={() =>
                        setStatusModal({ target: rep, bulkRows: openItems })
                      }
                      disabled={busy || bundleGated}
                      title={
                        bundleGated
                          ? "Start cleaning before marking blocked"
                          : "Owners only"
                      }
                      className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1 border ${
                        bundleGated
                          ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                          : "border-red-200 hover:bg-red-50 text-red-700 disabled:opacity-50"
                      }`}
                    >
                      <AlertCircle size={12} /> Block
                    </button>
                  </OwnerOnly>
                )}
                {false && !isAllDone && (
                  <button
                    onClick={() => setReassignTarget(rep)}
                    disabled={busy}
                    className={`h-9 px-3 rounded-lg border ${DC.outlineBtn} text-xs font-medium flex items-center gap-1 disabled:opacity-50`}
                  >
                    <User size={12} /> Reassign
                  </button>
                )}
                {/* Owner/manager corner actions, pushed to the right:
                   ✓ = mark this whole assignment complete → Done section.
                   ✕ = delete an assignment that was uploaded by mistake. */}
                {(can(employee, "mark_assignments_done") ||
                  can(employee, "upload_assignments")) && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {!isAllDone && can(employee, "mark_assignments_done") && (
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              "Mark this whole assignment complete? It moves to the Done section.",
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await bulkUpdateStatus(openItems, "done");
                            if (rep?.unit_id && rep?.party_id && employee?.id) {
                              const { data: openBlocks } = await supabase
                                .from("work_blocks")
                                .select(
                                  "id, shift:shifts!inner(employee_id, customer_id)",
                                )
                                .eq("unit_id", rep.unit_id)
                                .eq("party_id", rep.party_id)
                                .is("end_time", null);
                              const mine = (openBlocks || []).filter(
                                (b) =>
                                  b.shift?.employee_id === employee.id &&
                                  b.shift?.customer_id === propertyId,
                              );
                              if (mine.length > 0)
                                await supabase
                                  .from("work_blocks")
                                  .update({
                                    end_time: new Date().toISOString(),
                                  })
                                  .in(
                                    "id",
                                    mine.map((b) => b.id),
                                  );
                            }
                            if (onUpdate) onUpdate();
                          } catch (e) {
                            console.warn("[card ✓] failed", e);
                          }
                          setBusy(false);
                          if (onExit) onExit();
                        }}
                        disabled={busy}
                        title="Mark this assignment complete → Done"
                        className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    {can(employee, "upload_assignments") && (
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              "Delete this assignment? Use this only if it was uploaded by mistake — it removes it for everyone.",
                            )
                          )
                            return;
                          setBusy(true);
                          const { error } = await supabase
                            .from("assignments")
                            .update({
                              deleted_at: new Date().toISOString(),
                              deleted_by: employee?.id || null,
                            })
                            .eq("id", a?.id);
                          setBusy(false);
                          if (error) {
                            alert("Could not delete: " + error.message);
                            return;
                          }
                          if (onUpdate) onUpdate();
                          load();
                          if (onExit) onExit();
                        }}
                        disabled={busy}
                        title="Delete this assignment (uploaded by mistake)"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border disabled:opacity-50 ${dark ? "bg-slate-800 hover:bg-red-950 border-slate-600 text-red-300" : "bg-white hover:bg-red-50 border-stone-300 text-red-600"}`}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        };
        return (
          <div className="space-y-2">
            {priorityGroups.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1">
                  <AlertCircle
                    size={12}
                    className="text-red-700 flex-shrink-0"
                  />
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-red-700">
                    Priority — do these first ({priorityGroups.length})
                  </span>
                  <div className="flex-1 h-px bg-red-200" />
                </div>
                {priorityGroups.map(renderGroup)}
              </>
            )}
            {priorityGroups.length > 0 && restGroups.length > 0 && (
              <div className="py-1 flex items-center gap-2 px-1">
                <div
                  className={`flex-1 h-px ${dark ? "bg-stone-700" : "bg-blue-200"}`}
                />
                <span
                  className={`text-[10px] uppercase tracking-wider font-mono ${dark ? "text-stone-400" : "text-blue-700"}`}
                >
                  Everything else
                </span>
                <div
                  className={`flex-1 h-px ${dark ? "bg-stone-700" : "bg-blue-200"}`}
                />
              </div>
            )}
            {restGroups.map(renderGroup)}
          </div>
        );
      })()}

      {/* "Start cleaning" lives on the card now (prep screen). Same idea as
         moving "Go to bedroom" onto the card — the primary action sits with
         the assignment, not floating above it. */}
      {/* "Start cleaning" is now a small button in the card's own action row
         (passed down to AssignmentCard), not a big bar here. */}

      {attachmentView && (
        <AttachmentModal
          url={attachmentView.url}
          kind={attachmentView.kind}
          onClose={() => setAttachmentView(null)}
        />
      )}
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
