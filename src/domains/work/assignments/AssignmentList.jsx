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
import { AssignPicker } from "../cleaner/AssignPicker.jsx";

export function AssignmentList({
  property,
  employee,
  onBack,
  onNew,
  onNewChecklist,
  onNewQuick,
  onOpen,
  embedded = false,
}) {
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("open"); // open | all
  const [search, setSearch] = useState("");
  // Which building groups are collapsed (default expanded)
  const [collapsedBuildings, setCollapsedBuildings] = useState({});
  // Which floor groups inside a building are collapsed (default expanded).
  // Keyed by `${buildingKey}::${floorKey}` so two buildings can both
  // have a Floor 1 without colliding.
  const [collapsedFloors, setCollapsedFloors] = useState({});
  // Bulk-delete selection set — only available to users with the
  // archive_assignments permission. Tracks assignment IDs the user
  // has ticked for deletion. The mode flag turns the checkboxes
  // on/off so the layout doesn't grow checkboxes for everyone.
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Which apartment dropdowns are open inside a building
  const [openApartments, setOpenApartments] = useState({}); // { 'B1-101': true }
  // Filters — priority and cleaning type. Expandable panel keeps the
  // controls compact when not in use.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [filterTypes, setFilterTypes] = useState(new Set()); // assignment_type values
  // Track which row is currently saving a priority toggle so we can
  // disable the button + show a busy state.
  const [togglingId, setTogglingId] = useState(null);
  // Inline due-date editing (owners / granted users).
  const [editDateId, setEditDateId] = useState(null);
  const canEditDates = can(employee, "edit_due_dates");
  const saveDue = async (id, date) => {
    setEditDateId(null);
    await updateAssignmentScheduledDate(id, date);
    load();
  };
  // Assigning cleaners straight from this list.
  const canAssignHere = can(employee, "assign_cleaners");
  const [teamList, setTeamList] = useState([]);
  const [assignFor, setAssignFor] = useState(null);
  const [assigneeMap, setAssigneeMap] = useState({}); // assignment_id -> [{id,name,requested}]
  // Owner resolves a cleaner's request right from the board.
  const [reqBusy, setReqBusy] = useState(null);
  const approveAsgRequest = async (asgId, empId) => {
    setReqBusy(`${asgId}:${empId}`);
    await supabase
      .from("assignment_assignees")
      .update({ status: "assigned" })
      .eq("assignment_id", asgId)
      .eq("employee_id", empId);
    setReqBusy(null);
    loadAssignees(Object.keys(assigneeMap));
  };
  const denyAsgRequest = async (asgId, empId) => {
    setReqBusy(`${asgId}:${empId}`);
    await supabase
      .from("assignment_assignees")
      .delete()
      .eq("assignment_id", asgId)
      .eq("employee_id", empId)
      .eq("status", "requested");
    setReqBusy(null);
    loadAssignees(Object.keys(assigneeMap));
  };
  const loadAssignees = async (asgIds) => {
    if (!asgIds.length) {
      setAssigneeMap({});
      return;
    }
    // No employees embed — see the note in the assignment schedule load().
    const { data, error } = await supabase
      .from("assignment_assignees")
      .select("assignment_id, employee_id, status")
      .in("assignment_id", asgIds);
    if (error) {
      alert("Could not load who\u2019s assigned: " + error.message);
      return;
    }
    const m = {};
    (data || []).forEach((r) => {
      (m[r.assignment_id] = m[r.assignment_id] || []).push({
        id: r.employee_id,
        name: rosterById[r.employee_id] || "",
        requested: r.status === "requested",
      });
    });
    setAssigneeMap(m);
  };
  const [rosterById, setRosterById] = useState({}); // every active employee, owners included
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("active", true)
        .order("name");
      setTeamList((data || []).filter((e) => e.role !== "owner"));
      setRosterById(
        Object.fromEntries((data || []).map((e) => [e.id, e.name])),
      );
    })();
  }, []);
  const [assignBusy, setAssignBusy] = useState(null);
  const commitAssign = async (asgId, ids) => {
    setAssignBusy(asgId);
    const current = (assigneeMap[asgId] || []).map((a) => a.id);
    const error = await saveAssignees(asgId, current, ids, employee.id);
    setAssignBusy(null);
    if (error) {
      alert("Could not update who\u2019s assigned: " + error.message);
      return;
    }
    setAssignFor(null);
    load();
  };

  const load = async () => {
    // Pull targets so we can group by unit and surface priority/type
    const { data } = await supabase
      .from("assignments")
      .select(
        "*, targets:assignment_targets(id, status, priority, unit_id, party_id, unit:units(label), party:parties(label))",
      )
      .eq("customer_id", property.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setAssignments(data || []);
    setLoaded(true);
    loadAssignees((data || []).map((a) => a.id));
  };
  useEffect(() => {
    load();
  }, [property.id]);
  useAssignmentSync(load, "asgn-list");

  // Flip priority on the WHOLE assignment (all its targets). If any
  // target is currently priority, sweep them all off; otherwise sweep
  // them all on. Saves a click compared to opening the detail page.
  const togglePriority = async (assignment) => {
    if (togglingId) return; // already busy with another
    const targetIds = (assignment.targets || []).map((t) => t.id);
    if (targetIds.length === 0) return;
    const newPriority = !assignment.hasPriority;
    setTogglingId(assignment.id);
    // Optimistic update so the chip flips instantly
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignment.id
          ? {
              ...a,
              targets: (a.targets || []).map((t) => ({
                ...t,
                priority: newPriority,
              })),
            }
          : a,
      ),
    );
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: newPriority })
      .in("id", targetIds);
    setTogglingId(null);
    if (error) {
      alert("Could not update priority: " + error.message);
      load(); // re-fetch authoritative state
    }
  };

  // Aggregate status + flags per assignment
  const decorated = (assignments || []).map((a) => {
    const targets = a.targets || [];
    const total = targets.length;
    // Blocked counts toward "done" for the X/N done display — the
    // cleaner can't do those items, so from a workload standpoint
    // they're closed. The Blocked pill still appears below so the
    // owner sees at a glance which need follow-up.
    const done = targets.filter(
      (t) => t.status === "done" || t.status === "blocked",
    ).length;
    const trulyDone = targets.filter((t) => t.status === "done").length;
    const inProgress = targets.filter((t) => t.status === "in_progress").length;
    const blocked = targets.filter((t) => t.status === "blocked").length;
    const allDone = total > 0 && done === total;
    const hasPriority = targets.some((t) => t.priority);
    // Primary unit label: most targets share one unit, take the first non-null
    const firstUnitLabel =
      targets.find((t) => t.unit?.label)?.unit?.label || "";
    return {
      ...a,
      total,
      done,
      trulyDone,
      inProgress,
      blocked,
      allDone,
      hasPriority,
      firstUnitLabel,
    };
  });

  // Search across title, notes, unit label, bedroom label
  const q = search.trim().toLowerCase();
  const matchesSearch = (a) => {
    if (!q) return true;
    if ((a.title || "").toLowerCase().includes(q)) return true;
    if ((a.notes || "").toLowerCase().includes(q)) return true;
    if ((a.firstUnitLabel || "").toLowerCase().includes(q)) return true;
    const bedroom = (a.targets || []).some((t) =>
      (t.party?.label || "").toLowerCase().includes(q),
    );
    if (bedroom) return true;
    return false;
  };

  // Buckets distinguishing what cleaners can see vs what's still
  // waiting on the owner. The "Open" filter mirrors the cleaner-side
  // visibility filter so the counts match (no more "owner sees 100
  // open but cleaner only sees 52"). PM-pending stays surfaced via
  // the awaitingApproval counter so the user knows what's stuck.
  const isCleanerVisible = (a) =>
    !a.allDone && a.active && isPmApprovedAssignment(a);
  const isAwaitingApproval = (a) =>
    a.active && a.source === "pm" && a.pm_status === "pending";
  const awaitingApproval = decorated.filter(isAwaitingApproval);

  const visible = decorated
    .filter((a) => (filter === "open" ? isCleanerVisible(a) : true))
    .filter((a) => !priorityOnly || (a.hasPriority && !a.allDone))
    .filter((a) => filterTypes.size === 0 || filterTypes.has(a.assignment_type))
    .filter(matchesSearch);

  // Available cleaning types for the type filter chips — derived from
  // the current assignments so we don't offer types that don't exist.
  const availableTypes = (() => {
    const set = new Set();
    decorated.forEach((a) => {
      if (a.assignment_type) set.add(a.assignment_type);
    });
    return [...set];
  })();

  const activeFilterCount = (priorityOnly ? 1 : 0) + filterTypes.size;
  const toggleType = (typ) =>
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typ)) next.delete(typ);
      else next.add(typ);
      return next;
    });
  const clearFilters = () => {
    setPriorityOnly(false);
    setFilterTypes(new Set());
  };

  // Group by building. Property-level (no unit) goes into "Whole property".
  // Within each building, sub-group by unit label so when one unit has
  // multiple assignments we can show a collapsible dropdown.
  const buildings = {}; // { buildingKey: { units: { unitLabel: [assignments] } } }
  visible.forEach((a) => {
    const buildingKey = a.firstUnitLabel
      ? buildingFromLabel(a.firstUnitLabel) || a.firstUnitLabel
      : "Whole property";
    const unitKey = a.firstUnitLabel || "Whole property";
    if (!buildings[buildingKey]) buildings[buildingKey] = {};
    if (!buildings[buildingKey][unitKey]) buildings[buildingKey][unitKey] = [];
    buildings[buildingKey][unitKey].push(a);
  });
  const buildingKeys = Object.keys(buildings).sort((a, b) => {
    if (a === "Whole property") return -1;
    if (b === "Whole property") return 1;
    return naturalCompare(a, b);
  });

  const toggleBuilding = (b) =>
    setCollapsedBuildings((prev) => ({ ...prev, [b]: !prev[b] }));
  const toggleApartment = (key) =>
    setOpenApartments((prev) => ({ ...prev, [key]: !prev[key] }));

  // Render a single assignment row (used inside apartment groups). Pulled
  // into a helper so the apartment-dropdown and single-card paths share
  // identical visual treatment.
  // NOTE: we use a div+onClick (not <button>) so the priority toggle
  // can be a nested <button> without HTML-invalid nested-interactive
  // elements. Keyboard a11y maintained via tabIndex + onKeyDown.
  const renderAssignmentRow = (a) => {
    const isToggling = togglingId === a.id;
    const isSelected = selectedIds.has(a.id);
    const handleRowClick = () => {
      // In bulk mode the row tap toggles selection; otherwise it
      // opens the detail view as it did before.
      if (bulkMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(a.id)) next.delete(a.id);
          else next.add(a.id);
          return next;
        });
      } else {
        onOpen(a);
      }
    };
    return (
      <div
        key={a.id}
        onClick={handleRowClick}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRowClick();
          }
        }}
        role="button"
        className={`w-full text-left p-3 rounded-xl border cursor-pointer ${
          bulkMode && isSelected
            ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300"
            : a.allDone
              ? "bg-stone-100 border-stone-200 opacity-70"
              : a.blocked > 0
                ? "bg-red-50/50 border-red-200"
                : "bg-white border-stone-200"
        } hover:border-stone-400 transition-colors`}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Checkbox cell (bulk mode only) */}
          {bulkMode && (
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "border-amber-600 bg-amber-600" : "border-stone-300 bg-white"}`}
            >
              {isSelected && <Check size={12} className="text-white" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {a.file_kind === "pdf" ? (
                <FileText size={14} className="text-stone-500 flex-shrink-0" />
              ) : (
                <ImageIcon size={14} className="text-stone-500 flex-shrink-0" />
              )}
              <span className="font-serif text-base text-stone-900 truncate">
                {a.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {/* Priority TOGGLE — click flips ALL targets of this
                 assignment between priority on/off. stopPropagation
                 so the row click (open detail) doesn't also fire. */}
              {!a.allDone && !bulkMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePriority(a);
                  }}
                  disabled={isToggling}
                  className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                    a.hasPriority
                      ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                      : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                  }`}
                >
                  <AlertCircle size={10} />{" "}
                  {a.hasPriority ? "Priority" : "Mark priority"}
                </button>
              )}
              <AssignmentTypeChip type={a.assignment_type} />
              {a.allDone && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Done
                </span>
              )}
              {a.blocked > 0 && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                  ⚠ Blocked
                </span>
              )}
              {a.source === "pm" && a.pm_status === "pending" && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  ⚠ Awaiting approval
                </span>
              )}
              {a.source === "pm" && a.pm_status === "rejected" && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                  Rejected
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
              {editDateId === a.id ? (
                <DueDateEditor
                  value={a.scheduled_date || ""}
                  onSave={(d) => saveDue(a.id, d)}
                  onCancel={() => setEditDateId(null)}
                />
              ) : canEditDates ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditDateId(a.id);
                  }}
                  className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    a.scheduled_date
                      ? assignmentDueKind(a.scheduled_date) === "overdue"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : assignmentDueKind(a.scheduled_date) === "today"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-stone-100 text-stone-600 border-stone-200"
                      : "bg-white text-stone-500 border-dashed border-stone-300"
                  }`}
                >
                  <Calendar size={9} />{" "}
                  {a.scheduled_date
                    ? assignmentDueKind(a.scheduled_date) === "today"
                      ? "Due today"
                      : assignmentDueKind(a.scheduled_date) === "overdue"
                        ? `Overdue · ${fmtDueDate(a.scheduled_date)}`
                        : `Due ${fmtDueDate(a.scheduled_date)}`
                    : "Set due date"}
                </button>
              ) : a.scheduled_date ? (
                <span className="flex items-center gap-1">
                  <Calendar size={9} /> Due {fmtDueDate(a.scheduled_date)}
                </span>
              ) : (
                <span>{fmtDate(a.created_at)}</span>
              )}
              <span>
                {a.done}/{a.total} done
                {a.inProgress > 0 && `, ${a.inProgress} in progress`}
              </span>
              {(assigneeMap[a.id] || []).map((p) => (
                <span
                  key={p.id}
                  className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${p.requested ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-700"}`}
                >
                  <User size={9} /> {p.name}
                  {p.requested ? " asked" : ""}
                  {p.requested && canAssignHere && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approveAsgRequest(a.id, p.id);
                        }}
                        disabled={reqBusy === `${a.id}:${p.id}`}
                        className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold disabled:opacity-50"
                      >
                        approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          denyAsgRequest(a.id, p.id);
                        }}
                        disabled={reqBusy === `${a.id}:${p.id}`}
                        className="px-1.5 py-0.5 rounded-full bg-white border border-red-300 text-red-700 hover:bg-red-50 text-[9px] font-bold disabled:opacity-50"
                      >
                        deny
                      </button>
                    </>
                  )}
                </span>
              ))}
              {canAssignHere && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignFor(assignFor === a.id ? null : a.id);
                  }}
                  className="px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 inline-flex items-center gap-1"
                >
                  <Plus size={9} /> Assign
                </button>
              )}
            </div>
            {canAssignHere && assignFor === a.id && (
              <div onClick={(e) => e.stopPropagation()}>
                <AssignPicker
                  key={a.id}
                  team={teamList}
                  busy={assignBusy === a.id}
                  currentIds={(assigneeMap[a.id] || []).map((x) => x.id)}
                  onCancel={() => setAssignFor(null)}
                  onSave={(ids) => commitAssign(a.id, ids)}
                />
              </div>
            )}
            {a.notes && (
              <div className="text-xs text-stone-600 mt-1 line-clamp-1">
                {a.notes}
              </div>
            )}
          </div>
          {!bulkMode && (
            <ChevronRight
              size={14}
              className="text-stone-400 flex-shrink-0 mt-1"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={embedded ? "" : "pb-24"}>
      <ScreenId id="OW-ASGN-LIST" />
      {!embedded && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">
              {property.name}
            </div>
            <div className="font-serif text-xl text-stone-900">Assignments</div>
          </div>
          {/* Select-mode toggle — only owners / uploaders see this since
           it gates bulk deletion. Toggling exits and clears selection. */}
          {can(employee, "upload_assignments") && assignments.length > 0 && (
            <button
              onClick={() => {
                setBulkMode((m) => !m);
                setSelectedIds(new Set());
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${bulkMode ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
            >
              {bulkMode ? "Cancel" : "Select"}
            </button>
          )}
        </div>
      )}

      {/* Bulk-action toolbar — sticky-ish row that appears just under
         the header whenever the owner has tapped Select. Shows the
         selected count + Select all + Delete in one row. */}
      {bulkMode &&
        (() => {
          // Show counts based on what's actually visible after search/filter
          // so "select all" feels like it acts on what the user sees.
          const visibleIds = []; // populated below from decorated/filtered list
          try {
            const ids = (typeof decorated !== "undefined" ? decorated : []).map(
              (d) => d.assignment.id,
            );
            visibleIds.push(...ids);
          } catch (e) {
            /* decorated not in scope yet during render — fine */
          }
          const allSelected =
            visibleIds.length > 0 &&
            visibleIds.every((id) => selectedIds.has(id));
          const handleDelete = async () => {
            if (selectedIds.size === 0) return;
            if (
              !confirm(
                `Delete ${selectedIds.size} assignment${selectedIds.size === 1 ? "" : "s"}? They'll be archived (recoverable from the DB if needed).`,
              )
            )
              return;
            const { error } = await supabase
              .from("assignments")
              .update({ active: false })
              .in("id", Array.from(selectedIds));
            if (error) {
              alert("Could not delete: " + error.message);
              return;
            }
            setSelectedIds(new Set());
            setBulkMode(false);
            await load();
          };
          return (
            <div className="sticky top-0 z-20 bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-amber-900 font-bold">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => {
                  if (allSelected) setSelectedIds(new Set());
                  else setSelectedIds(new Set(visibleIds));
                }}
                className="text-[11px] font-mono px-2 py-1 rounded-full bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                {allSelected
                  ? "Clear all"
                  : `Select all visible (${visibleIds.length})`}
              </button>
              <div className="flex-1" />
              <button
                onClick={handleDelete}
                disabled={selectedIds.size === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <X size={12} /> Delete selected
              </button>
            </div>
          );
        })()}

      <div className="px-5 pt-6">
        {can(employee, "upload_assignments") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {onNewQuick && (
              <button
                onClick={onNewQuick}
                className="p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98"
              >
                <Building2 size={18} /> Quick assignment
              </button>
            )}
            {onNewChecklist && (
              <button
                onClick={onNewChecklist}
                className="p-4 rounded-2xl border-2 border-stone-300 bg-white text-stone-700 font-medium flex items-center justify-center gap-2 active:scale-98"
              >
                <FileText size={18} /> New checklist assignment
              </button>
            )}
            <button
              onClick={onNew}
              className="p-4 rounded-2xl border-2 border-stone-300 bg-white text-stone-700 font-medium flex items-center justify-center gap-2 active:scale-98"
            >
              <Plus size={18} /> Upload sheet (legacy)
            </button>
          </div>
        )}

        {/* Search bar — always on for assignments. Filters across
           title, notes, unit, and bedroom in one box. */}
        {assignments.length > 0 && (
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${assignments.length} assignment${assignments.length === 1 ? "" : "s"} (apartment, bedroom, title, notes)…`}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm"
            />
          </div>
        )}

        {/* Filter panel — collapsible. Lets the owner narrow the list
           to priority-only or specific cleaning types. Counts active
           filters on the button so it's clear something's narrowing. */}
        {assignments.length > 0 && (
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
                  Showing {visible.length} of {decorated.length}
                </span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
              />
            </button>
            {filtersOpen && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mt-1 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    Priority
                  </div>
                  <button
                    onClick={() => setPriorityOnly((p) => !p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono inline-flex items-center gap-1.5 transition-colors ${priorityOnly ? "bg-red-100 text-red-800 border border-red-300 font-bold" : "bg-white border border-stone-300 text-stone-600 hover:border-stone-500"}`}
                  >
                    {priorityOnly && <Check size={11} />}
                    <AlertCircle size={11} /> Priority only
                  </button>
                </div>
                {availableTypes.length > 1 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                      Cleaning type
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableTypes.map((typ) => {
                        const active = filterTypes.has(typ);
                        return (
                          <button
                            key={typ}
                            onClick={() => toggleType(typ)}
                            className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 transition-colors ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600 hover:border-stone-500"}`}
                          >
                            {active && <Check size={10} />}
                            {assignmentTypeLabel(typ)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-stone-600 hover:text-stone-900 font-mono underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("open")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${filter === "open" ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
          >
            Open ({decorated.filter(isCleanerVisible).length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${filter === "all" ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-600"}`}
          >
            All ({decorated.length})
          </button>
        </div>

        {/* Awaiting approval callout — PM-portal uploads still in
           pm_status='pending' aren't visible to cleaners. Without this
           the owner saw inflated Open counts and wondered why cleaners
           weren't seeing the work. The Approve all button bulk-updates
           every awaiting assignment in one query — sidesteps the
           one-at-a-time queue entirely. */}
        {awaitingApproval.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider font-mono font-bold text-amber-900 mb-0.5">
                ⚠ {awaitingApproval.length} awaiting your approval
              </div>
              <div className="text-xs text-stone-700">
                These were uploaded by a property manager and need your approval
                before cleaners can see them.
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      `Approve all ${awaitingApproval.length} pending assignments at this property in one go?`,
                    )
                  )
                    return;
                  const ids = awaitingApproval.map((a) => a.id);
                  const { error: ae } = await supabase
                    .from("assignments")
                    .update({
                      pm_status: "approved",
                      approved_by: employee?.id,
                      approved_at: new Date().toISOString(),
                      pm_rejection_reason: null,
                    })
                    .in("id", ids);
                  if (ae) {
                    alert("Bulk approve failed: " + ae.message);
                    return;
                  }
                  // Clear the bell notifications for these now-approved ones.
                  for (const id of ids) await clearPmAssignmentNotification(id);
                  await load();
                  alert(
                    `Approved ${ids.length} assignments. They're now visible to cleaners.`,
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
              >
                Approve all ({awaitingApproval.length})
              </button>
              <button
                onClick={() => setFilter("all")}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium"
              >
                View all
              </button>
            </div>
          </div>
        )}

        {!loaded ? (
          <Splash text="Loading…" />
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            {q ? (
              `No assignments match "${search}".`
            ) : priorityOnly || filterTypes.size > 0 ? (
              <>
                No assignments match the current filters.
                <button
                  onClick={clearFilters}
                  className="block mx-auto mt-2 text-xs text-stone-700 hover:text-stone-900 font-mono underline"
                >
                  Clear all filters
                </button>
              </>
            ) : filter === "open" ? (
              'No open assignments. Tap "Upload new assignment" to add one.'
            ) : (
              "No assignments yet."
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {buildingKeys.map((buildingKey) => {
              const unitsInBuilding = buildings[buildingKey];
              const unitKeys =
                Object.keys(unitsInBuilding).sort(naturalCompare);
              const isCollapsed = !!collapsedBuildings[buildingKey];
              const buildingTotal = unitKeys.reduce(
                (sum, uk) => sum + unitsInBuilding[uk].length,
                0,
              );
              const buildingHasPriority = unitKeys.some((uk) =>
                unitsInBuilding[uk].some((a) => a.hasPriority && !a.allDone),
              );
              return (
                <div
                  key={buildingKey}
                  className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => toggleBuilding(buildingKey)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2
                        size={16}
                        className="text-stone-700 flex-shrink-0"
                      />
                      <span className="font-serif text-base text-stone-900 truncate">
                        {buildingKey}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 flex-shrink-0">
                        {buildingTotal}
                      </span>
                      <PriorityChip on={buildingHasPriority} size="xs" />
                    </div>
                    <ChevronRight
                      size={14}
                      className={`text-stone-500 flex-shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="p-3 space-y-3">
                      {(() => {
                        // Sub-group by floor (first digit of apt number)
                        // so the owner sees Floor 1 → Floor 2 → Floor 3
                        // sections within each building.
                        const byFloor = {};
                        unitKeys.forEach((uk) => {
                          const f = floorFromLabel(uk);
                          const fk = f != null ? String(f) : "—";
                          if (!byFloor[fk]) byFloor[fk] = [];
                          byFloor[fk].push(uk);
                        });
                        const floorKeys = Object.keys(byFloor).sort((a, b) => {
                          if (a === "—") return 1;
                          if (b === "—") return -1;
                          return parseInt(a, 10) - parseInt(b, 10);
                        });
                        const showFloorHeaders = floorKeys.length > 1;
                        const renderUnitKey = (unitKey) => {
                          const assignmentsInUnit = unitsInBuilding[unitKey];
                          // Single assignment in this unit — render plain.
                          if (assignmentsInUnit.length === 1) {
                            return renderAssignmentRow(assignmentsInUnit[0]);
                          }
                          // Multiple — render as a dropdown labeled with apt + count.
                          const apartmentKey = `${buildingKey}::${unitKey}`;
                          const isOpen = !!openApartments[apartmentKey];
                          const unitHasPriority = assignmentsInUnit.some(
                            (a) => a.hasPriority && !a.allDone,
                          );
                          return (
                            <div
                              key={unitKey}
                              className="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden"
                            >
                              <button
                                onClick={() => toggleApartment(apartmentKey)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-amber-50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-sm text-stone-800 truncate">
                                    {unitKey}
                                  </span>
                                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex-shrink-0">
                                    {assignmentsInUnit.length}
                                  </span>
                                  <PriorityChip
                                    on={unitHasPriority}
                                    size="xs"
                                  />
                                </div>
                                <ChevronRight
                                  size={14}
                                  className={`text-amber-700 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                                />
                              </button>
                              {isOpen && (
                                <div className="px-2 pb-2 pt-1 space-y-2 border-t border-amber-100">
                                  {assignmentsInUnit.map((a) =>
                                    renderAssignmentRow(a),
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        };
                        if (!showFloorHeaders) {
                          // Single-floor building — no floor headers, just the apartments
                          return unitKeys.map(renderUnitKey);
                        }
                        return floorKeys.map((fk) => {
                          const floorKey = `${buildingKey}::${fk}`;
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
                                  ({byFloor[fk].length})
                                </span>
                                <div className="flex-1 h-px bg-stone-300" />
                              </button>
                              {floorOpen && (
                                <div className="space-y-2">
                                  {byFloor[fk].map(renderUnitKey)}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
