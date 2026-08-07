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
import { fetchOpenAssignmentTargets } from "../../../lib/assignments.js";
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
import { AssignPicker } from "../cleaner/AssignPicker.jsx";
import { AssignmentDetail } from "./AssignmentDetail.jsx";
import { AssignmentForm } from "./AssignmentForm.jsx";
import { AssignmentList } from "./AssignmentList.jsx";
import { ChecklistAssignmentWizard } from "../cross-cutting/ChecklistAssignmentWizard.jsx";
import { CompletedAssignmentsView } from "./CompletedAssignmentsView.jsx";
import { QuickAssignmentForm } from "./QuickAssignmentForm.jsx";

export function AssignmentsTab({ employee, onSignOut, onOpenMessages, onLogoClick }) {
  const [properties, setProperties] = useState([]);
  const [assignmentCounts, setAssignmentCounts] = useState({}); // { customer_id: open_count }
  const [jobs, setJobs] = useState([]); // one entry per open assignment
  const [scheduleMode, setScheduleMode] = useState("schedule"); // 'schedule' | 'property'
  const [adding, setAdding] = useState(false); // property picker for adding
  const [expanded, setExpanded] = useState(() => new Set()); // expanded card keys
  const [actioning, setActioning] = useState(null); // job id being marked done / deleted
  const [team, setTeam] = useState([]);
  const [editDueJob, setEditDueJob] = useState(null);
  const [assignJob, setAssignJob] = useState(null);
  const [sizeJob, setSizeJob] = useState(null);
  const [sizeBr, setSizeBr] = useState("");
  const [sizeBa, setSizeBa] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState(null); // selected property
  const [view, setView] = useState("open"); // 'open' | 'upload' | 'detail'
  const [detail, setDetail] = useState(null); // selected assignment when view === 'detail'
  const [propSearch, setPropSearch] = useState("");

  const load = async () => {
    const [propsRes, targetsRes] = await Promise.all([
      supabase.from("customers").select("*").eq("active", true).order("name"),
      fetchOpenAssignmentTargets(),
    ]);
    const counts = {};
    const seenBedrooms = new Set();
    const jobsByAsg = {};
    (targetsRes.data || []).forEach((t) => {
      const a = t.assignment;
      if (!a || a.active === false || a.deleted_at) return;
      const cid = a.customer_id;
      if (!cid) return;
      const key = `${cid}::${t.unit_id || ""}::${t.party_id || ""}`;
      if (!seenBedrooms.has(key)) {
        seenBedrooms.add(key);
        counts[cid] = (counts[cid] || 0) + 1;
      }
      if (!jobsByAsg[a.id]) {
        jobsByAsg[a.id] = {
          id: a.id,
          customerId: cid,
          title: a.title || "",
          scheduledDate: a.scheduled_date || null,
          type: a.assignment_type || "",
          unitLabel: t.unit?.label || "",
          partyLabel: t.party?.label || "",
          unitId: t.unit_id,
          partyId: t.party_id,
          bedrooms: t.unit?.bedrooms,
          bathrooms: t.unit?.bathrooms,
          tookLonger: !!a.took_longer,
          priority: false,
          targetIds: [],
          assignees: [],
          hereNow: [],
          count: 0,
          sections: {
            bedroom: 0,
            vanity: 0,
            bathroom: 0,
            general: 0,
            other: 0,
          },
        };
      }
      if (t.priority) jobsByAsg[a.id].priority = true;
      jobsByAsg[a.id].targetIds.push(t.id);
      jobsByAsg[a.id].count++;
      const sec = (t.template_section || "").toLowerCase();
      if (
        sec === "bedroom" ||
        sec === "vanity" ||
        sec === "bathroom" ||
        sec === "general"
      )
        jobsByAsg[a.id].sections[sec]++;
      else jobsByAsg[a.id].sections.other++;
    });
    // Load the roster FIRST so we can resolve assignee names ourselves.
    // Note: no `employee:employees(...)` embed on assignment_assignees below.
    // That embed needs a foreign key PostgREST can see; without one the whole
    // read fails and (because the error used to be discarded) assignees just
    // silently vanished. Joining by hand here can't fail that way.
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .order("name");
    const nameById = Object.fromEntries(
      (emps || []).map((e) => [e.id, e.name]),
    );
    const jobIds = Object.keys(jobsByAsg);
    if (jobIds.length) {
      const { data: asgn, error: asgnErr } = await supabase
        .from("assignment_assignees")
        .select("assignment_id, employee_id, status")
        .in("assignment_id", jobIds);
      if (asgnErr)
        alert("Could not load who\u2019s assigned: " + asgnErr.message);
      (asgn || []).forEach((r) => {
        const j = jobsByAsg[r.assignment_id];
        if (!j) return;
        j.assignees.push({
          id: r.employee_id,
          name: nameById[r.employee_id] || "",
          requested: r.status === "requested",
        });
      });
    }
    setTeam(
      (emps || []).filter(
        (e) =>
          e.role !== "owner" && !/\b(test|beta|demo)\b/i.test(e.name || ""),
      ),
    );
    // Who's physically in each bedroom right now. Matched on unit:party
    // because that's all a work block records.
    const here = await fetchLivePresence();
    Object.values(jobsByAsg).forEach((j) => {
      j.hereNow = here[`${j.unitId}:${j.partyId || ""}`] || [];
    });
    setProperties(visibleProps(propsRes.data || [], employee));
    setAssignmentCounts(counts);
    setJobs(Object.values(jobsByAsg));
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);

  // Detail view: show a single assignment's status / targets
  if (picked && view === "detail" && detail) {
    return (
      <AssignmentDetail
        property={picked}
        assignment={detail}
        employee={employee}
        onBack={() => {
          setDetail(null);
          setView("open");
          load();
        }}
      />
    );
  }

  // Picked property + Upload sub-view → render form
  if (picked && view === "upload") {
    return (
      <AssignmentForm
        property={picked}
        employee={employee}
        onCancel={() => setView("open")}
        onSaved={() => {
          setView("open");
          load();
        }}
      />
    );
  }

  // Picked property + Upload-checklist sub-view → render new wizard
  if (picked && view === "upload-checklist") {
    return (
      <ChecklistAssignmentWizard
        property={picked}
        employee={employee}
        onCancel={() => setView("open")}
        onSaved={() => {
          setView("open");
          load();
        }}
      />
    );
  }

  // Picked property + Quick sub-view → render the lightweight form
  if (picked && view === "quick") {
    return (
      <QuickAssignmentForm
        property={picked}
        employee={employee}
        onCancel={() => setView("open")}
        onSaved={() => {
          setView("open");
          load();
        }}
      />
    );
  }

  // Picked property + Open sub-view → render list
  if (picked && view === "open") {
    return (
      <AssignmentList
        property={picked}
        employee={employee}
        onBack={() => {
          setPicked(null);
          load();
        }}
        onNew={() => setView("upload")}
        onNewChecklist={() => setView("upload-checklist")}
        onNewQuick={() => setView("quick")}
        onOpen={(a) => {
          setDetail(a);
          setView("detail");
        }}
      />
    );
  }

  // No picked property → new landing: Add button + Schedule/By-property
  // with expandable property cards showing their scheduled jobs.
  const pq = propSearch.trim().toLowerCase();
  const matchesPropSearch = (p) =>
    !pq ||
    (p.name || "").toLowerCase().includes(pq) ||
    (p.address || "").toLowerCase().includes(pq);
  const withAssignments = properties
    .filter((p) => (assignmentCounts[p.id] || 0) > 0 && matchesPropSearch(p))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const others = properties
    .filter((p) => (assignmentCounts[p.id] || 0) === 0 && matchesPropSearch(p))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));
  const toggleExpand = (k) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Quick actions straight from a schedule card.
  const markJobDone = async (job) => {
    if (
      !confirm(
        `Mark ${job.unitLabel || "this job"} completed? This marks all its items done.`,
      )
    )
      return;
    setActioning(job.id);
    await supabase
      .from("assignment_targets")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: employee.id,
      })
      .eq("assignment_id", job.id)
      .neq("status", "done");
    setActioning(null);
    load();
  };
  const deleteJob = async (job) => {
    if (
      !confirm(
        `Delete this assignment (${job.unitLabel || ""})? It can be restored later.`,
      )
    )
      return;
    setActioning(job.id);
    await supabase
      .from("assignments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: employee.id })
      .eq("id", job.id);
    setActioning(null);
    load();
  };
  const canAssignJobs = can(employee, "assign_cleaners");
  const canEditJobDates = can(employee, "edit_due_dates");
  const todayK = localTodayKey();
  const saveJobDue = async (job, date) => {
    setEditDueJob(null);
    setActioning(job.id);
    await updateAssignmentScheduledDate(job.id, date);
    setActioning(null);
    load();
  };
  const commitJobAssignees = async (job, ids) => {
    setActioning(job.id);
    const error = await saveAssignees(
      job.id,
      job.assignees.map((a) => a.id),
      ids,
      employee.id,
    );
    setActioning(null);
    if (error) {
      alert("Could not update who\u2019s assigned: " + error.message);
      return;
    }
    setAssignJob(null);
    load();
  };
  const saveJobSize = async (job, br, ba) => {
    if (!job.unitId) {
      setSizeJob(null);
      return;
    }
    setActioning(job.id);
    const { data: updated, error } = await supabase
      .from("units")
      .update({
        // parseFloat on baths: 2.5 is a real size and parseInt would silently
        // save it as 2.
        bedrooms: br === "" ? null : parseInt(br, 10),
        bathrooms: ba === "" ? null : parseFloat(ba),
      })
      .eq("id", job.unitId)
      .select("id, bedrooms, bathrooms");
    setActioning(null);
    if (error) {
      alert("Could not save size: " + error.message);
      return;
    }
    if (!updated || updated.length === 0) {
      alert(
        "Size did not save — the database rejected the update for this apartment.",
      );
      return;
    }
    setSizeJob(null);
    load();
  };
  const toggleTookLonger = async (job) => {
    setActioning(job.id);
    await supabase
      .from("assignments")
      .update({ took_longer: !job.tookLonger })
      .eq("id", job.id);
    setActioning(null);
    load();
  };

  // Priority lives on each assignment_target (a bedroom can be prioritized
  // independently), so toggling a job's priority flips all of its targets.
  const toggleJobPriority = async (job) => {
    const ids = job.targetIds || [];
    if (ids.length === 0) return;
    setActioning(job.id);
    const turningOn = !job.priority;
    await supabase
      .from("assignment_targets")
      .update({ priority: turningOn })
      .in("id", ids);
    if (turningOn) {
      // Announce the priority job to all cleaners; the row clears when someone
      // claims it. (assignees aren't tracked in this owner view, so we always
      // broadcast — if it's already assigned, the assigned cleaner still sees
      // the alert, which is fine.)
      createNotification({
        to: { scope: "all_cleaners" },
        kind: "priority_assignment",
        title: "Priority job available",
        body: `${job.unitLabel || "A job"}${job.partyLabel ? " · " + job.partyLabel : ""} at ${propById[job.customerId]?.name || "a property"}`,
        linkKind: "assignment",
        linkId: job.id,
        createdBy: employee?.id,
      });
    } else {
      clearAssignmentBroadcast(job.id);
    }
    setActioning(null);
    load();
  };

  const canDelete = can(employee, "manage_assignments_admin");
  const canDone = can(employee, "mark_assignments_done");
  const fmtSched = (key) => {
    const today = localTodayKey();
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tmr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    if (key === today) return "Today";
    if (key === tmr) return "Tomorrow";
    return new Date(key + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Row used in the "Add assignment" property picker (tap to pick).
  const PropertyRow = ({ p }) => (
    <button
      onClick={() => {
        setAdding(false);
        setPicked(p);
        setView("open");
      }}
      className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-serif text-lg text-stone-900">{p.name}</span>
            {(assignmentCounts[p.id] || 0) > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex items-center gap-1">
                <FileText size={10} /> {assignmentCounts[p.id]} open
              </span>
            )}
          </div>
          {p.address && (
            <div className="text-xs text-stone-500 font-mono">
              <AddressLink address={p.address} />
            </div>
          )}
        </div>
        <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
      </div>
    </button>
  );

  // Expandable property card — drops down to show its jobs.
  const PropertyCard = ({ property, cardJobs, keyId }) => {
    const isOpen = expanded.has(keyId);
    return (
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
        <button
          onClick={() => toggleExpand(keyId)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 gap-3"
        >
          <div className="min-w-0 text-left">
            <div className="font-serif text-lg text-stone-900 truncate">
              {property?.name || "Property"}
            </div>
            <div className="text-xs text-stone-500 font-mono">
              {cardJobs.length} job{cardJobs.length === 1 ? "" : "s"}
            </div>
          </div>
          <ChevronRight
            size={16}
            className={`text-stone-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="px-3 pb-3 border-t border-stone-100 pt-2 space-y-1.5">
            {cardJobs.map((j) => {
              const sec = j.sections || {};
              const secBits = [
                ["Bedroom", sec.bedroom],
                ["Vanity", sec.vanity],
                ["Bathroom", sec.bathroom],
                ["General", sec.general],
              ].filter(([, n]) => n > 0);
              return (
                <div
                  key={j.id}
                  className="px-3 py-2.5 rounded-lg bg-stone-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                >
                  <button
                    onClick={() => {
                      setPicked(property);
                      setView("open");
                    }}
                    className="min-w-0 sm:flex-1 text-left"
                  >
                    <div className="text-sm text-stone-800 font-medium">
                      {unitPartyLabel(j.unitLabel, j.partyLabel) || "Job"}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {j.type ? assignmentTypeLabel(j.type) : "Clean"}
                      {j.scheduledDate
                        ? ` · ${fmtSched(j.scheduledDate)}`
                        : " · no date"}{" "}
                      · {j.count} item{j.count === 1 ? "" : "s"}
                    </div>
                    {secBits.length > 0 ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 max-w-[220px]">
                        {secBits.map(([label, n]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between text-[10px] font-mono"
                          >
                            <span className="text-stone-500">{label}</span>
                            <span className="text-stone-700 font-bold">
                              {n}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </button>

                  {/* Inline controls — due date, size, who's on it, took longer */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {/* Due date */}
                    {editDueJob === j.id ? (
                      <DueDateEditor
                        compact
                        value={j.scheduledDate || ""}
                        onSave={(d) => saveJobDue(j, d)}
                        onCancel={() => setEditDueJob(null)}
                      />
                    ) : canEditJobDates ? (
                      <button
                        onClick={() => setEditDueJob(j.id)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                          j.scheduledDate
                            ? j.scheduledDate < todayK
                              ? "bg-red-100 text-red-700 border-red-200"
                              : j.scheduledDate === todayK
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-stone-100 text-stone-600 border-stone-200"
                            : "bg-white text-stone-500 border-dashed border-stone-300"
                        }`}
                      >
                        <Calendar size={9} />{" "}
                        {j.scheduledDate
                          ? fmtSched(j.scheduledDate)
                          : "Set due date"}
                      </button>
                    ) : null}

                    {/* Size (BR/BA) — editable, e.g. after a 1x1 turns out to be 2x2 */}
                    {sizeJob === j.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          autoFocus
                          value={sizeBr}
                          onChange={(e) => setSizeBr(e.target.value)}
                          className="w-10 px-1 py-0.5 rounded border border-stone-300 text-[10px] font-mono"
                          placeholder="BR"
                        />
                        <span className="text-[9px] text-stone-400">BR</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={sizeBa}
                          onChange={(e) => setSizeBa(e.target.value)}
                          className="w-12 px-1 py-0.5 rounded border border-stone-300 text-[10px] font-mono"
                          placeholder="BA"
                        />
                        <span className="text-[9px] text-stone-400">BA</span>
                        <button
                          onClick={() => saveJobSize(j, sizeBr, sizeBa)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-900 text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setSizeJob(null)}
                          className="text-[10px] px-1 text-stone-500"
                        >
                          ×
                        </button>
                      </span>
                    ) : j.unitId ? (
                      <button
                        onClick={() => {
                          setSizeJob(j.id);
                          setSizeBr(j.bedrooms ?? "");
                          setSizeBa(j.bathrooms ?? "");
                        }}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 inline-flex items-center gap-1"
                      >
                        {j.bedrooms || j.bathrooms
                          ? `${j.bedrooms || 0}BR / ${j.bathrooms || 0}BA`
                          : "Set size"}
                      </button>
                    ) : null}

                    {/* Who's physically in there RIGHT NOW — distinct from the
                     indigo "assigned to" pills, which are only a plan. */}
                    {j.hereNow.map((h, hi) => (
                      <span
                        key={`${h.id}-${hi}`}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"
                        title={`Working here since ${fmtClock(h.since)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {h.name} is here
                      </span>
                    ))}

                    {/* Who's on it */}
                    {j.assignees.map((a) => (
                      <span
                        key={a.id}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${a.requested ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-700"}`}
                      >
                        <User size={9} /> {a.name}
                        {a.requested ? " asked" : ""}
                      </span>
                    ))}
                    {canAssignJobs && (
                      <button
                        onClick={() =>
                          setAssignJob(assignJob === j.id ? null : j.id)
                        }
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 inline-flex items-center gap-1"
                      >
                        <Plus size={9} /> Assign
                      </button>
                    )}

                    {/* Took longer → charge extra on the invoice */}
                    <button
                      onClick={() => toggleTookLonger(j)}
                      disabled={actioning === j.id}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 disabled:opacity-50 ${j.tookLonger ? "bg-amber-500 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
                    >
                      <Clock size={9} /> {j.tookLonger ? "Extra" : "Mark extra"}
                    </button>

                    {/* Priority — owners can flag any pending job; it sorts to
                     the top and shows a red pill/border on the cleaner side. */}
                    <button
                      onClick={() => toggleJobPriority(j)}
                      disabled={actioning === j.id}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 disabled:opacity-50 ${j.priority ? "bg-red-600 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
                    >
                      <AlertCircle size={9} />{" "}
                      {j.priority ? "Priority" : "Mark priority"}
                    </button>
                  </div>

                  {canAssignJobs && assignJob === j.id && (
                    <AssignPicker
                      key={j.id}
                      team={team}
                      busy={actioning === j.id}
                      currentIds={j.assignees.map((a) => a.id)}
                      onCancel={() => setAssignJob(null)}
                      onSave={(ids) => commitJobAssignees(j, ids)}
                    />
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canDone && (
                      <button
                        onClick={() => markJobDone(j)}
                        disabled={actioning === j.id}
                        title="Mark completed"
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteJob(j)}
                        disabled={actioning === j.id}
                        title="Delete assignment"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => {
                setPicked(property);
                setView("open");
              }}
              className="w-full text-center py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg"
            >
              Manage all →
            </button>
          </div>
        )}
      </div>
    );
  };

  // Group jobs by property (for By-property) and by date→property (Schedule).
  const jobsByProp = {};
  jobs.forEach((j) => {
    (jobsByProp[j.customerId] = jobsByProp[j.customerId] || []).push(j);
  });
  // Within each property, order by building/unit label (B4-216, B5-218…) so
  // they're easy to find, with priority jobs pulled to the top. Natural sort
  // so B10 comes after B9, not after B1.
  const sortJobsInProp = (arr) =>
    arr
      .slice()
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          naturalCompare(a.unitLabel || "", b.unitLabel || "") ||
          naturalCompare(a.partyLabel || "", b.partyLabel || ""),
      );
  Object.keys(jobsByProp).forEach((cid) => {
    jobsByProp[cid] = sortJobsInProp(jobsByProp[cid]);
  });
  const propKeysSorted = Object.keys(jobsByProp).sort((a, b) =>
    (propById[a]?.name || "").localeCompare(propById[b]?.name || ""),
  );

  const byDate = {};
  jobs.forEach((j) => {
    const d = j.scheduledDate || "__none__";
    (byDate[d] = byDate[d] || []).push(j);
  });
  const dateKeysSorted = Object.keys(byDate)
    .filter((k) => k !== "__none__")
    .sort();

  return (
    <div className="pb-24">
      <ScreenId id="OW-ASGN" />
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          Manage
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-4">
          <span className="font-serif italic text-amber-700">Assignments</span>
        </h1>

        {adding ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-600">
                Pick a property to add an assignment.
              </p>
              <button
                onClick={() => setAdding(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancel
              </button>
            </div>
            {properties.length > 3 && (
              <input
                type="text"
                value={propSearch}
                onChange={(e) => setPropSearch(e.target.value)}
                placeholder={`Search ${properties.length} properties…`}
                className="w-full px-4 py-3 mb-4 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
              />
            )}
            {!loaded ? (
              <Splash text="Loading…" />
            ) : (
              <div className="space-y-4">
                {withAssignments.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-amber-700 font-mono mb-2">
                      Has open assignments
                    </div>
                    <div className="space-y-2">
                      {withAssignments.map((p) => (
                        <PropertyRow key={p.id} p={p} />
                      ))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
                      All properties
                    </div>
                    <div className="space-y-2">
                      {others.map((p) => (
                        <PropertyRow key={p.id} p={p} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setPropSearch("");
                setAdding(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-stone-50 rounded-xl py-3.5 font-medium mb-5 active:scale-98"
            >
              <Plus size={18} /> Add assignment
            </button>

            <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5">
              <button
                onClick={() => setScheduleMode("schedule")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${scheduleMode === "schedule" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                Schedule
              </button>
              <button
                onClick={() => setScheduleMode("property")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${scheduleMode === "property" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                By property
              </button>
              <button
                onClick={() => setScheduleMode("completed")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${scheduleMode === "completed" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
              >
                Completed
              </button>
            </div>

            {scheduleMode === "completed" ? (
              <CompletedAssignmentsView
                employee={employee}
                propById={propById}
              />
            ) : !loaded ? (
              <Splash text="Loading…" />
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                No open assignments. Tap “Add assignment” to create one.
              </div>
            ) : scheduleMode === "schedule" ? (
              <div className="space-y-6">
                {dateKeysSorted.map((dk) => {
                  const dJobsByProp = {};
                  byDate[dk].forEach((j) => {
                    (dJobsByProp[j.customerId] =
                      dJobsByProp[j.customerId] || []).push(j);
                  });
                  Object.keys(dJobsByProp).forEach((cid) => {
                    dJobsByProp[cid] = sortJobsInProp(dJobsByProp[cid]);
                  });
                  const props = Object.keys(dJobsByProp).sort((a, b) =>
                    (propById[a]?.name || "").localeCompare(
                      propById[b]?.name || "",
                    ),
                  );
                  return (
                    <div key={dk}>
                      <div className="text-xs uppercase tracking-wider text-amber-700 font-mono mb-2 flex items-center gap-1.5">
                        <Calendar size={11} /> {fmtSched(dk)}
                      </div>
                      <div className="space-y-2">
                        {props.map((cid) => (
                          <PropertyCard
                            key={cid}
                            property={propById[cid]}
                            cardJobs={dJobsByProp[cid]}
                            keyId={`${dk}::${cid}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {byDate["__none__"] && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 flex items-center gap-1.5">
                      <FileText size={11} /> No date set
                    </div>
                    <div className="space-y-2">
                      {Object.entries(
                        (() => {
                          const m = {};
                          byDate["__none__"].forEach((j) => {
                            (m[j.customerId] = m[j.customerId] || []).push(j);
                          });
                          return m;
                        })(),
                      )
                        .sort((a, b) =>
                          (propById[a[0]]?.name || "").localeCompare(
                            propById[b[0]]?.name || "",
                          ),
                        )
                        .map(([cid, cj]) => (
                          <PropertyCard
                            key={cid}
                            property={propById[cid]}
                            cardJobs={cj}
                            keyId={`none::${cid}`}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {propKeysSorted.map((cid) => (
                  <PropertyCard
                    key={cid}
                    property={propById[cid]}
                    cardJobs={jobsByProp[cid]}
                    keyId={`prop::${cid}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
