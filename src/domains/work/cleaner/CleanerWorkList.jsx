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
import { AssignPicker } from "./AssignPicker.jsx";
import { JobPeekModal } from "./JobPeekModal.jsx";

export function CleanerWorkList({
  employee,
  currentPropertyId,
  onGoToBedroom,
  onSwitchProperty,
  onSwitchToJob,
  onStartJob,
}) {
  const [sub, setSub] = useState("mine"); // 'mine' | 'all'
  const [jobs, setJobs] = useState([]);
  const [team, setTeam] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(null); // assignment id
  const [busyId, setBusyId] = useState(null);
  const todayKey = localTodayKey();
  const canAssign = can(employee, "assign_cleaners");
  const canDone = can(employee, "mark_assignments_done");
  // Same capability the owner-side cards use, so one toggle governs both.
  const canEditDates = can(employee, "edit_due_dates");
  // Owners/managers with this can tap the date pill to see the submission
  // timeline (submitted / accepted / due).
  const canViewTimeline = can(employee, "view_submission_timeline");
  const [editDueId, setEditDueId] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(null); // job id whose timeline dropdown is open
  const fmtStamp = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };
  const [peekJob, setPeekJob] = useState(null); // read-only quick glance
  const [collapsedDates, setCollapsedDates] = useState(new Set()); // date-group keys that are collapsed
  const saveDue = async (j, date) => {
    setEditDueId(null);
    setBusyId(j.id);
    const { data, error } = await updateAssignmentScheduledDate(j.id, date)
      .select("id, scheduled_date");
    setBusyId(null);
    if (error) {
      alert("Could not change the date: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert(
        "Date did not save — the database rejected the change for this job.",
      );
      return;
    }
    load();
  };

  const load = async () => {
    // Only properties this cleaner is allowed to see (hides BETA
    // properties unless they're a beta tester / owner).
    const [{ data: propRows }, { data: emps }] = await Promise.all([
      supabase.from("customers").select("*").eq("active", true),
      supabase
        .from("employees")
        .select("id, name, role")
        .eq("active", true)
        .order("name"),
    ]);
    const allowed = new Set(
      visibleProps(propRows || [], employee).map((p) => p.id),
    );
    setTeam(
      (emps || []).filter(
        (e) =>
          e.role !== "owner" && !/\b(test|beta|demo)\b/i.test(e.name || ""),
      ),
    );
    // Paginated — this query is unscoped (every property, every open target),
    // so a plain call stops at PostgREST's 1000-row cap and silently drops
    // jobs. That made freshly-assigned work never show up under "Mine".
    const fetchOpenTargets = async () => {
      let rows = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page, error } = await supabase
          .from("assignment_targets")
          .select(
            "id, unit_id, party_id, status, priority, completed_at, unit:units(label, bedrooms, bathrooms), party:parties(label), assignment:assignments!inner(id, customer_id, active, deleted_at, assignment_type, scheduled_date, pm_status, approved_at, created_at, source, customer:customers(name, address))",
          )
          .not("status", "in", "(done,blocked)")
          .range(from, from + PAGE - 1);
        if (error || !page) break;
        rows = rows.concat(page);
        if (page.length < PAGE) break;
        if (from > 100000) break;
      }
      return rows;
    };
    const data = await fetchOpenTargets();
    const byJob = {};
    (data || []).forEach((t) => {
      const a = t.assignment;
      if (!a || a.active === false || a.deleted_at) return;
      if (!allowed.has(a.customer_id)) return;
      if (!byJob[a.id]) {
        byJob[a.id] = {
          id: a.id,
          customerId: a.customer_id,
          propName: a.customer?.name || "Property",
          propAddress: a.customer?.address || "",
          type: a.assignment_type || "",
          scheduledDate: a.scheduled_date || null,
          unitLabel: t.unit?.label || "",
          partyLabel: t.party?.label || "",
          unitId: t.unit_id,
          partyId: t.party_id,
          bedrooms: t.unit?.bedrooms,
          bathrooms: t.unit?.bathrooms,
          priority: false,
          items: 0,
          hereNow: [],
          assignees: [],
          requested: [],
          pmStatus: a.pm_status || null,
          approvedAt: a.approved_at || null,
          submittedAt: a.created_at || null,
          doneAt: null,
        };
      }
      byJob[a.id].items++;
      if (t.priority) byJob[a.id].priority = true;
      // "Done" = when the work was finished. Track the most recent completed_at
      // across this assignment's targets (open lists rarely have any).
      if (
        t.completed_at &&
        (!byJob[a.id].doneAt || t.completed_at > byJob[a.id].doneAt)
      ) {
        byJob[a.id].doneAt = t.completed_at;
      }
    });
    const ids = Object.keys(byJob);
    if (ids.length) {
      // No employees embed — see the note in the assignment schedule load().
      const nameById = Object.fromEntries(
        (emps || []).map((e) => [e.id, e.name]),
      );
      const { data: rows, error: rowsErr } = await supabase
        .from("assignment_assignees")
        .select("assignment_id, employee_id, status")
        .in("assignment_id", ids);
      if (rowsErr)
        alert("Could not load who\u2019s assigned: " + rowsErr.message);
      (rows || []).forEach((r) => {
        const j = byJob[r.assignment_id];
        if (!j) return;
        const entry = {
          id: r.employee_id,
          name: nameById[r.employee_id] || "",
        };
        if (r.status === "requested") j.requested.push(entry);
        else j.assignees.push(entry);
      });
    }
    // Who's already physically in each bedroom. Excludes the viewer —
    // a cleaner doesn't need telling they're in the room they're in.
    const here = await fetchLivePresence();
    Object.values(byJob).forEach((j) => {
      j.hereNow = (here[`${j.unitId}:${j.partyId || ""}`] || []).filter(
        (h) => h.id !== employee?.id,
      );
      // Names read cleaner alphabetically on the card, not in load order.
      j.assignees.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      j.requested.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });
    setJobs(Object.values(byJob));
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [employee?.id]);

  const isMine = (j) => j.assignees.some((a) => a.id === employee?.id);
  const iRequested = (j) => j.requested.some((a) => a.id === employee?.id);

  const requestJob = async (j) => {
    setBusyId(j.id);
    const { error } = await supabase.from("assignment_assignees").upsert(
      {
        assignment_id: j.id,
        employee_id: employee.id,
        status: "requested",
        created_by: employee.id,
      },
      { onConflict: "assignment_id,employee_id" },
    );
    setBusyId(null);
    if (error) {
      alert("Could not ask for this job: " + error.message);
      return;
    }
    createNotification({
      to: { scope: "owner" },
      kind: "cleaner_request",
      title: `${employee.name} asked for a job`,
      body: `${unitPartyLabel(j.unitLabel, j.partyLabel) || "A job"} at ${j.propName || "a property"}`,
      linkKind: "assignment",
      linkId: j.id,
      createdBy: employee.id,
    });
    // A request counts as claiming a broadcast priority job — clear it so it
    // stops showing for the other cleaners.
    clearAssignmentBroadcast(j.id);
    load();
  };
  const commitAssignees = async (j, ids) => {
    setBusyId(j.id);
    const current = [
      ...j.assignees.map((a) => a.id),
      ...j.requested.map((a) => a.id),
    ];
    const error = await saveAssignees(j.id, current, ids, employee.id);
    setBusyId(null);
    if (error) {
      alert("Could not update who\u2019s assigned: " + error.message);
      return;
    }
    if (ids.length > 0) clearAssignmentBroadcast(j.id); // now claimed
    setAssignOpen(null);
    load();
  };
  const approveRequest = async (j, empId) => {
    setBusyId(j.id);
    await supabase
      .from("assignment_assignees")
      .update({ status: "assigned" })
      .eq("assignment_id", j.id)
      .eq("employee_id", empId);
    clearAssignmentBroadcast(j.id);
    setBusyId(null);
    load();
  };
  // Owner/manager denies a cleaner's request — removes the request row so it
  // doesn't linger. The cleaner can request again if it was a mistake.
  const denyRequest = async (j, empId) => {
    setBusyId(j.id);
    await supabase
      .from("assignment_assignees")
      .delete()
      .eq("assignment_id", j.id)
      .eq("employee_id", empId)
      .eq("status", "requested");
    setBusyId(null);
    load();
  };
  // A cleaner cancels their OWN pending request.
  const cancelRequest = async (j) => {
    setBusyId(j.id);
    await supabase
      .from("assignment_assignees")
      .delete()
      .eq("assignment_id", j.id)
      .eq("employee_id", employee.id)
      .eq("status", "requested");
    setBusyId(null);
    load();
  };
  const markDone = async (j) => {
    if (!confirm(`Mark ${j.unitLabel || "this job"} completed?`)) return;
    setBusyId(j.id);
    await supabase
      .from("assignment_targets")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: employee.id,
      })
      .eq("assignment_id", j.id)
      .neq("status", "done");
    setBusyId(null);
    load();
  };

  // Owners/managers can flag a job priority right from this list — flips all
  // of the assignment's targets, which is what the priority pill + top-sort
  // read from.
  const toggleJobPriority = async (j) => {
    setBusyId(j.id);
    const turningOn = !j.priority;
    await supabase
      .from("assignment_targets")
      .update({ priority: turningOn })
      .eq("assignment_id", j.id);
    if (turningOn) {
      const body = `${unitPartyLabel(j.unitLabel, j.partyLabel) || "A job"} at ${j.propName || "a property"}`;
      if ((j.assignees || []).length > 0) {
        // Already has cleaners on it — tell just them.
        j.assignees.forEach((a) => {
          if (a.id && a.id !== employee?.id)
            createNotification({
              to: { employeeId: a.id },
              kind: "priority_assignment",
              title: "A job was marked priority",
              body,
              linkKind: "assignment",
              linkId: j.id,
              createdBy: employee?.id,
            });
        });
      } else {
        // Unassigned priority job — broadcast to ALL cleaners. This single
        // row shows for everyone and is deleted the moment someone claims it.
        createNotification({
          to: { scope: "all_cleaners" },
          kind: "priority_assignment",
          title: "Priority job available",
          body,
          linkKind: "assignment",
          linkId: j.id,
          createdBy: employee?.id,
        });
      }
    } else {
      // Priority turned off — clear any open broadcast for this job.
      clearAssignmentBroadcast(j.id);
    }
    setBusyId(null);
    load();
  };

  // Date buckets, soonest first. The old ranking put EVERY future date in a
  // single bucket, so Jul 15 and Jul 17 tied and fell through to sorting by
  // unit label — which is why A403 (Jul 17) sat above C404 (Jul 15). It also
  // ranked "no date" above future work; undated jobs now sort last.
  const dueRank = (d) => (!d ? 3 : d < todayKey ? 0 : d === todayKey ? 1 : 2);
  const tomorrowKey = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  const list = (sub === "mine" ? jobs.filter((j) => isMine(j)) : jobs)
    .slice()
    .sort(
      (a, b) =>
        dueRank(a.scheduledDate) - dueRank(b.scheduledDate) ||
        // Real chronological order within a bucket. scheduled_date is
        // 'YYYY-MM-DD', so a plain string compare is already date order.
        (a.scheduledDate || "").localeCompare(b.scheduledDate || "") ||
        (sub === "all" ? (isMine(b) ? 1 : 0) - (isMine(a) ? 1 : 0) : 0) ||
        naturalCompare(a.propName, b.propName) ||
        naturalCompare(a.unitLabel, b.unitLabel),
    );
  // Priority jobs float to a pinned section at the very top, regardless of
  // date — "do these first" supersedes the date buckets. They're pulled out
  // of the date sections below so they don't show twice.
  const renderJobCard = (j) => {
    const here = j.customerId === currentPropertyId;
    const mine = isMine(j);
    return (
      <div
        key={j.id}
        className={`p-3.5 rounded-2xl bg-white border ${j.priority ? "border-2 border-red-300" : "border border-stone-200"}`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* Only the text is the tap target — not the empty width
                     of the row. The badge + chevron sit alongside, not
                     inside, so there's no invisible dead-zone to tap. */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => openJob(j)}
                title={here ? "Open this job" : "Switch to this job"}
                className="min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-stone-50 active:scale-[0.99] transition group inline-flex items-center gap-1"
              >
                <span className="font-serif text-base text-stone-900 truncate group-hover:underline decoration-stone-300 underline-offset-2">
                  {unitPartyLabel(j.unitLabel, j.partyLabel) || "Job"}
                </span>
                <ChevronRight
                  size={15}
                  className="text-stone-300 group-hover:text-stone-500 flex-shrink-0"
                />
              </button>
              <span className="flex items-center gap-1 flex-shrink-0">
                {/* Size — a cleaner needs to know if it's a 1x1 or a 3x2
                         BEFORE they drive there, same as the owner cards show. */}
                {(j.bedrooms || j.bathrooms) && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                    {j.bedrooms || 0}BR / {j.bathrooms || 0}BA
                  </span>
                )}
                {mine && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Yours
                  </span>
                )}
                {j.priority && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1">
                    <AlertCircle size={9} /> Priority
                  </span>
                )}
              </span>
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5 flex items-center gap-1 flex-wrap">
              <Building2 size={10} />
              {j.propAddress ? (
                <AddressLink
                  address={j.propAddress}
                  icon="none"
                  label={j.propName}
                  className="text-blue-600 font-medium"
                />
              ) : (
                <span>{j.propName}</span>
              )}
              <span>{j.type ? `· ${assignmentTypeLabel(j.type)}` : ""}</span>
              {j.items > 0 && (
                <>
                  <span>·</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeekJob(j);
                    }}
                    className="underline decoration-stone-400 underline-offset-2 hover:text-stone-700"
                  >
                    {j.items} {j.items === 1 ? "task" : "tasks"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Who's on this job */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {/* Someone is physically in there right now — worth knowing
                     before you drive over or start a second block on it. */}
          {j.hereNow.map((h, hi) => (
            <span
              key={`${h.id}-${hi}`}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"
              title={`Working here since ${fmtClock(h.since)}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {h.name} is here
            </span>
          ))}
          {j.assignees.map((a) => (
            <span
              key={a.id}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${a.id === employee?.id ? "bg-indigo-100 text-indigo-700" : "bg-stone-100 text-stone-600"}`}
            >
              <User size={9} /> {a.name}
            </span>
          ))}
          {j.requested.map((a) => (
            <span
              key={a.id}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1"
            >
              <Clock size={9} /> {a.name} asked
              {canAssign && (
                <>
                  <button
                    onClick={() => approveRequest(j, a.id)}
                    disabled={busyId === j.id}
                    className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold active:scale-95 transition disabled:opacity-50"
                  >
                    approve
                  </button>
                  <button
                    onClick={() => denyRequest(j, a.id)}
                    disabled={busyId === j.id}
                    className="px-1.5 py-0.5 rounded-full bg-white border border-red-300 text-red-700 hover:bg-red-50 text-[9px] font-bold active:scale-95 transition disabled:opacity-50"
                  >
                    deny
                  </button>
                </>
              )}
              {!canAssign && a.id === employee?.id && (
                <button
                  onClick={() => cancelRequest(j)}
                  disabled={busyId === j.id}
                  className="ml-1 px-1.5 py-0.5 rounded-full bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 text-[9px] font-bold active:scale-95 transition disabled:opacity-50"
                >
                  cancel
                </button>
              )}
            </span>
          ))}
          {/* "Unassigned" label removed — the who's-on-this-job row
                     stays empty until someone is actually assigned. */}
          {canAssign && (
            <button
              onClick={() => setAssignOpen(assignOpen === j.id ? null : j.id)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 flex items-center gap-1"
            >
              <Plus size={9} /> Assign
            </button>
          )}
        </div>

        {/* Assign picker — shared component; saves only on Save */}
        {canAssign && assignOpen === j.id && (
          <AssignPicker
            key={j.id}
            team={team}
            busy={busyId === j.id}
            currentIds={[
              ...j.assignees.map((a) => a.id),
              ...j.requested.map((a) => a.id),
            ]}
            onCancel={() => setAssignOpen(null)}
            onSave={(ids) => commitAssignees(j, ids)}
          />
        )}

        <div className="flex items-center justify-between mt-2 gap-2">
          {/* Due date — a timeline dropdown for owners/managers with
                     the permission (submitted / accepted / due); otherwise a
                     tappable date (edit) or read-only date. */}
          {editDueId === j.id ? (
            <DueDateEditor
              value={j.scheduledDate || ""}
              onSave={(d) => saveDue(j, d)}
              onCancel={() => setEditDueId(null)}
            />
          ) : canViewTimeline ? (
            <div className="relative">
              <button
                onClick={() =>
                  setTimelineOpen(timelineOpen === j.id ? null : j.id)
                }
                disabled={busyId === j.id}
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 disabled:opacity-50 ${
                  j.scheduledDate
                    ? j.scheduledDate < todayKey
                      ? "bg-red-100 text-red-700 border-red-200"
                      : j.scheduledDate === todayKey
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-stone-100 text-stone-600 border-stone-200"
                    : "bg-white text-stone-500 border-dashed border-stone-300"
                }`}
              >
                <Calendar size={9} />{" "}
                {j.scheduledDate ? fmtDue(j.scheduledDate) : "Set date"}
                <ChevronRight size={11} className="rotate-90 opacity-60" />
              </button>
              {timelineOpen === j.id && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setTimelineOpen(null)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-40 w-60 rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden">
                    <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-mono text-stone-400">
                      Timeline
                    </div>
                    <div className="px-3 pb-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                          <FileText size={11} /> Submitted
                        </span>
                        <span
                          className={`text-[11px] font-mono ${j.submittedAt ? "text-stone-800" : "text-stone-400"}`}
                        >
                          {j.submittedAt ? fmtStamp(j.submittedAt) : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                          <UserPlus size={11} /> Accepted
                        </span>
                        <span
                          className={`text-[11px] font-mono ${j.approvedAt || j.pmStatus === "approved" || !j.pmStatus ? "text-emerald-700" : "text-stone-400"}`}
                        >
                          {j.approvedAt
                            ? fmtStamp(j.approvedAt)
                            : !j.pmStatus || j.pmStatus === "approved"
                              ? j.submittedAt
                                ? `${fmtStamp(j.submittedAt)} · auto`
                                : "Auto"
                              : j.pmStatus === "pending"
                                ? "Awaiting you"
                                : j.pmStatus === "rejected"
                                  ? "Rejected"
                                  : "Not yet"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                          <Check size={11} /> Done
                        </span>
                        <span
                          className={`text-[11px] font-mono ${j.doneAt ? "text-stone-800" : "text-stone-400"}`}
                        >
                          {j.doneAt ? fmtStamp(j.doneAt) : "Not yet"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-100">
                        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
                          <Calendar size={11} /> Due
                        </span>
                        <span className="text-[11px] font-mono text-stone-800">
                          {j.scheduledDate ? fmtDueDate(j.scheduledDate) : "—"}
                        </span>
                      </div>
                    </div>
                    {canEditDates && (
                      <button
                        onClick={() => {
                          setTimelineOpen(null);
                          setEditDueId(j.id);
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
          ) : canEditDates ? (
            <button
              onClick={() => setEditDueId(j.id)}
              disabled={busyId === j.id}
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 disabled:opacity-50 ${
                j.scheduledDate
                  ? j.scheduledDate < todayKey
                    ? "bg-red-100 text-red-700 border-red-200"
                    : j.scheduledDate === todayKey
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-stone-100 text-stone-600 border-stone-200"
                  : "bg-white text-stone-500 border-dashed border-stone-300"
              }`}
            >
              <Calendar size={9} />{" "}
              {j.scheduledDate ? fmtDue(j.scheduledDate) : "Set date"}
            </button>
          ) : (
            <span
              className={`text-[11px] font-mono ${j.scheduledDate && j.scheduledDate < todayKey ? "text-red-600" : j.scheduledDate === todayKey ? "text-emerald-700" : "text-stone-400"}`}
            >
              {fmtDue(j.scheduledDate)}
            </span>
          )}
          <div className="flex items-center gap-2">
            {false && !mine && !iRequested(j) && !canAssign && (
              <button
                onClick={() => requestJob(j)}
                disabled={busyId === j.id}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 disabled:opacity-50"
              >
                Request
              </button>
            )}
            {iRequested(j) && (
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-amber-700">
                  Requested
                </span>
                {!canAssign && (
                  <button
                    onClick={() => cancelRequest(j)}
                    disabled={busyId === j.id}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </span>
            )}
            {canAssign && (
              <button
                onClick={() => toggleJobPriority(j)}
                disabled={busyId === j.id}
                title={j.priority ? "Remove priority" : "Mark priority"}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 disabled:opacity-50 ${j.priority ? "bg-red-600 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
              >
                <AlertCircle size={10} />{" "}
                {j.priority ? "Priority" : "Mark priority"}
              </button>
            )}
            {canDone && (
              <button
                onClick={() => markDone(j)}
                disabled={busyId === j.id}
                title="Mark completed"
                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
              >
                <Check size={15} />
              </button>
            )}
            <button
              onClick={() => openJob(j)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 active:scale-95 transition"
            >
              {onStartJob ? "Clock in & start" : here ? "Start" : "Switch"}{" "}
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };
  const priorityJobs = list.filter((j) => j.priority);
  const datedList = list.filter((j) => !j.priority);
  // Group the sorted list into date sections so the date is impossible to miss.
  const dateSections = (() => {
    const out = [];
    let cur = null;
    datedList.forEach((j) => {
      const key = j.scheduledDate || "none";
      if (!cur || cur.key !== key) {
        cur = { key, date: j.scheduledDate || null, jobs: [] };
        out.push(cur);
      }
      cur.jobs.push(j);
    });
    return out;
  })();
  const sectionLabel = (d) => {
    if (!d) return "No date assigned";
    if (d < todayKey) return `Overdue · ${fmtDueDate(d)}`;
    if (d === todayKey) return `Today · ${fmtDueDate(d)}`;
    if (d === tomorrowKey) return `Tomorrow · ${fmtDueDate(d)}`;
    return fmtDueDate(d);
  };
  const sectionTone = (d) => {
    if (!d) return "text-stone-400";
    if (d < todayKey) return "text-red-600";
    if (d === todayKey) return "text-emerald-700";
    return "text-stone-500";
  };
  const fmtDue = (d) =>
    !d
      ? "No date"
      : d < todayKey
        ? `Overdue · ${fmtDueDate(d)}`
        : d === todayKey
          ? "Today"
          : fmtDueDate(d);
  const openJob = (j) => {
    // Not clocked in yet → tapping a job clocks into its property and opens it.
    if (onStartJob) {
      onStartJob(j);
      return;
    }
    if (j.customerId === currentPropertyId)
      onGoToBedroom &&
        onGoToBedroom({ unit_id: j.unitId, party_id: j.partyId });
    else if (onSwitchToJob)
      onSwitchToJob(j); // direct: clock into THIS job's property + open it
    else onSwitchProperty && onSwitchProperty(); // fallback: generic picker
  };

  return (
    <div className="px-4">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-4 mt-4">
        <button
          onClick={() => setSub("mine")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium ${sub === "mine" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          Assigned to me
        </button>
        <button
          onClick={() => setSub("all")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium ${sub === "all" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
        >
          All pending
        </button>
      </div>
      {!loaded ? (
        <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm">
          {sub === "mine"
            ? "Nothing assigned to you right now. 🎉"
            : "No open assignments."}
        </div>
      ) : (
        <div className="pb-4">
          {priorityJobs.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border-l-4 border-red-500 bg-red-50">
                <AlertCircle size={13} className="text-red-600" />
                <span className="text-xs uppercase tracking-wider font-mono font-bold text-red-700">
                  Priority — do these first
                </span>
                <span className="text-[10px] font-mono text-red-500 ml-auto">
                  {priorityJobs.length}
                </span>
              </div>
              <div className="space-y-2">
                {priorityJobs.map((j) => renderJobCard(j))}
              </div>
            </div>
          )}
          {dateSections.map((sec) => {
            const isCollapsed = collapsedDates.has(sec.key);
            return (
              <div key={sec.key} className="mb-5">
                {/* Date header — tap to collapse/expand its jobs. */}
                <button
                  onClick={() =>
                    setCollapsedDates((prev) => {
                      const next = new Set(prev);
                      if (next.has(sec.key)) next.delete(sec.key);
                      else next.add(sec.key);
                      return next;
                    })
                  }
                  className={`w-full flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border-l-4 active:scale-[0.99] transition ${
                    !sec.date
                      ? "border-stone-300 bg-stone-100 hover:bg-stone-200"
                      : sec.date < todayKey
                        ? "border-red-500 bg-red-50 hover:bg-red-100"
                        : sec.date === todayKey
                          ? "border-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                          : "border-stone-400 bg-stone-100 hover:bg-stone-200"
                  }`}
                >
                  <ChevronRight
                    size={13}
                    className={`flex-shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"} ${sec.date && sec.date < todayKey ? "text-red-600" : sec.date === todayKey ? "text-emerald-700" : "text-stone-500"}`}
                  />
                  <Calendar
                    size={13}
                    className={
                      sec.date && sec.date < todayKey
                        ? "text-red-600"
                        : sec.date === todayKey
                          ? "text-emerald-700"
                          : "text-stone-500"
                    }
                  />
                  <span
                    className={`text-xs uppercase tracking-wider font-mono font-bold ${sectionTone(sec.date)}`}
                  >
                    {sectionLabel(sec.date)}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 ml-auto flex-shrink-0">
                    {sec.jobs.length} {sec.jobs.length === 1 ? "job" : "jobs"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {sec.jobs.map((j) => {
                      const here = j.customerId === currentPropertyId;
                      const mine = isMine(j);
                      return renderJobCard(j);
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {peekJob && (
        <JobPeekModal
          job={peekJob}
          employee={employee}
          onClose={() => setPeekJob(null)}
        />
      )}
    </div>
  );
}
