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

export function DailyDayDetail({ date, employee, showMoney, onBack, onOpenUnit }) {
  const [data, setData] = useState(null);
  // Open assignment per unit, so the same inline controls (done / size /
  // assign / due date) work straight from a Daily card.
  const [unitAsg, setUnitAsg] = useState({}); // unitId -> {id, scheduledDate, tookLonger, open, assignees[]} — NO size here, see unitSize
  const [dTeam, setDTeam] = useState([]);
  const [dBusy, setDBusy] = useState(null);
  const [dAssignFor, setDAssignFor] = useState(null);
  const [dDueFor, setDDueFor] = useState(null);
  const [dSizeFor, setDSizeFor] = useState(null);
  const [dBr, setDBr] = useState("");
  const [dBa, setDBa] = useState("");
  const dToday = localTodayKey();
  const canDailyAssign = can(employee, "assign_cleaners");
  const canDailyDates = can(employee, "edit_due_dates");
  const canDailyDone = can(employee, "mark_assignments_done");

  const [unitSize, setUnitSize] = useState({}); // unitId -> {bedrooms, bathrooms} (always available)
  const loadUnitAsg = async (unitIds) => {
    // Scope to the units on this day. A global query hits PostgREST's
    // 1000-row cap once there are thousands of done items, which silently
    // drops assignments (units then look like they have none).
    const ids = (unitIds || []).filter(Boolean);
    if (!ids.length) {
      setUnitAsg({});
      setUnitSize({});
      return;
    }
    const { data: rows } = await supabase
      .from("assignment_targets")
      .select(
        "unit_id, status, completed_at, unit:units(id, bedrooms, bathrooms), assignment:assignments!inner(id, active, deleted_at, scheduled_date, took_longer)",
      )
      .in("unit_id", ids)
      .not("status", "eq", "blocked");
    // Sizes come straight from units so they're always right, even for
    // units with no assignment at all.
    const { data: unitRows } = await supabase
      .from("units")
      .select("id, bedrooms, bathrooms")
      .in("id", ids);
    const m = {};
    const sizes = {};
    (unitRows || []).forEach((u) => {
      sizes[u.id] = { bedrooms: u.bedrooms, bathrooms: u.bathrooms };
    });
    (rows || []).forEach((t) => {
      const a = t.assignment;
      if (!a || a.active === false || a.deleted_at || !t.unit_id) return;
      const open = t.status !== "done";
      const prev = m[t.unit_id];
      // Prefer an OPEN assignment; otherwise keep the most recent done one.
      if (!prev || (open && !prev.open)) {
        m[t.unit_id] = {
          id: a.id,
          scheduledDate: a.scheduled_date || null,
          tookLonger: !!a.took_longer,
          open,
          assignees: [],
        };
      }
    });
    setUnitSize(sizes);
    // Roster first, so assignee names resolve without a PostgREST embed.
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .order("name");
    const nameById = Object.fromEntries(
      (emps || []).map((e) => [e.id, e.name]),
    );
    const asgIds = Object.values(m).map((v) => v.id);
    if (asgIds.length) {
      const { data: asg, error: asgErr } = await supabase
        .from("assignment_assignees")
        .select("assignment_id, employee_id, status")
        .in("assignment_id", asgIds);
      if (asgErr)
        alert("Could not load who\u2019s assigned: " + asgErr.message);
      (asg || []).forEach((r) => {
        Object.values(m).forEach((v) => {
          if (v.id === r.assignment_id)
            v.assignees.push({
              id: r.employee_id,
              name: nameById[r.employee_id] || "",
              requested: r.status === "requested",
            });
        });
      });
    }
    setUnitAsg(m);
    setDTeam((emps || []).filter((e) => e.role !== "owner"));
  };
  // Unit ids present on this day (from the loaded work blocks).
  const dayUnitIds = React.useMemo(() => {
    const set = new Set();
    Object.values(data?.groups || {}).forEach((pg) => {
      Object.values(pg.units || {}).forEach((u) => {
        if (u.unitId) set.add(u.unitId);
      });
    });
    return Array.from(set);
  }, [data]);
  const refreshUnitAsg = () => loadUnitAsg(dayUnitIds);
  useEffect(() => {
    if (dayUnitIds.length)
      loadUnitAsg(dayUnitIds); /* eslint-disable-next-line */
  }, [dayUnitIds.join(",")]);

  const dSaveDue = async (asgId, val) => {
    setDDueFor(null);
    setDBusy(asgId);
    await supabase
      .from("assignments")
      .update({ scheduled_date: val || null })
      .eq("id", asgId);
    setDBusy(null);
    refreshUnitAsg();
  };
  const dCommitAssignees = async (ua, ids) => {
    setDBusy(ua.id);
    const error = await saveAssignees(
      ua.id,
      ua.assignees.map((a) => a.id),
      ids,
      employee.id,
    );
    setDBusy(null);
    if (error) {
      alert("Could not update who\u2019s assigned: " + error.message);
      return;
    }
    setDAssignFor(null);
    refreshUnitAsg();
  };
  const dSaveSize = async (unitId, br, ba) => {
    setDBusy(unitId);
    const payload = {
      // parseFloat on baths: 2.5 is a real size and parseInt would silently
      // save it as 2.
      bedrooms: br === "" ? null : parseInt(br, 10),
      bathrooms: ba === "" ? null : parseFloat(ba),
    };
    // .select() so we can tell a silent 0-row update (RLS) from a real save.
    const { data: updated, error } = await supabase
      .from("units")
      .update(payload)
      .eq("id", unitId)
      .select("id, bedrooms, bathrooms");
    setDBusy(null);
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
    // Optimistic: reflect the saved values right away.
    setUnitSize((prev) => ({
      ...prev,
      [unitId]: {
        bedrooms: updated[0].bedrooms,
        bathrooms: updated[0].bathrooms,
      },
    }));
    setDSizeFor(null);
    refreshUnitAsg();
  };
  const dToggleExtra = async (asgId, current) => {
    setDBusy(asgId);
    const { data, error } = await supabase
      .from("assignments")
      .update({ took_longer: !current })
      .eq("id", asgId)
      .select("id, took_longer");
    setDBusy(null);
    if (error) {
      alert("Could not update the Extra flag: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert(
        "Extra did not save — the database rejected the update for this job.",
      );
      return;
    }
    refreshUnitAsg();
  };
  const dMarkDone = async (asgId, label) => {
    if (!confirm(`Mark ${label} completed?`)) return;
    setDBusy(asgId);
    await supabase
      .from("assignment_targets")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: employee.id,
      })
      .eq("assignment_id", asgId)
      .neq("status", "done");
    setDBusy(null);
    refreshUnitAsg();
  };
  // Filters — multi-select for cleaners + properties so the owner can
  // zoom into a specific person or building's day. Empty Set = "no filter".
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCleaners, setFilterCleaners] = useState(new Set());
  const [filterProperties, setFilterProperties] = useState(new Set());
  const [filterCategories, setFilterCategories] = useState(new Set());

  useEffect(() => {
    (async () => {
      const [dyY, dyM, dyD] = String(date).split("-").map(Number);
      const dayStart = new Date(dyY, dyM - 1, dyD, 0, 0, 0, 0).toISOString();
      const dayEnd = new Date(dyY, dyM - 1, dyD, 23, 59, 59, 999).toISOString();

      // Get all shifts that started this day. Include idle_seconds so the
      // per-cleaner breakdown can show clocked-in time + idle adjustments.
      // Exclude preview-mode shifts (owner using "Preview as cleaner").
      const { data: shifts } = await supabase
        .from("shifts")
        .select(
          "id, start_time, end_time, customer_id, idle_seconds, employee:employees(id,name), customer:customers(id,name,property_type,bill_rate_hourly), work_blocks(id, start_time, end_time, bill_rate_at_work, unit:units(id, label), party:parties(id, label, full_name), tasks(*, photos(*, taken_by_employee:employees!taken_by(name))))",
        )
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .eq("is_preview", false)
        .order("start_time");

      // Group by property → unit
      // For multi_unit shifts we use work_blocks. For simple shifts, group by property only.
      const groups = {}; // { propertyId: { property, units: { unitId: { unitLabel, employees: Set, totalMs, hasDamage, photoCount } } } }

      // Per-cleaner aggregate: { employeeId: { name, totalActiveMs, totalShiftMs, idleSeconds, hasOpenShift, units: Set, categories: Set } }
      // - totalActiveMs = sum of work_block durations (the time they were billing for)
      // - totalShiftMs = sum of shift durations (total clocked-in time)
      // - idleSeconds = sum of idle_seconds across shifts (DB-detected inactivity)
      // - hasOpenShift = at least one shift still active (no end_time)
      const byCleaner = {};

      (shifts || []).forEach((s) => {
        if (!s.customer_id) return;
        const propId = s.customer_id;
        if (!groups[propId]) {
          groups[propId] = {
            property: s.customer,
            units: {},
            simpleShifts: [],
          };
        }
        const propGroup = groups[propId];

        // Per-cleaner aggregation
        const eId = s.employee?.id || "unknown";
        if (!byCleaner[eId]) {
          byCleaner[eId] = {
            employeeId: eId,
            name: s.employee?.name || "—",
            totalActiveMs: 0,
            totalShiftMs: 0,
            idleSeconds: 0,
            hasOpenShift: false,
            units: new Set(),
            categories: new Set(),
            properties: new Set(),
          };
        }
        const c = byCleaner[eId];
        const shiftMs =
          (s.end_time ? new Date(s.end_time) : new Date()) -
          new Date(s.start_time);
        c.totalShiftMs += shiftMs;
        c.idleSeconds += s.idle_seconds || 0;
        if (!s.end_time) c.hasOpenShift = true;
        c.properties.add(s.customer?.name || "—");

        if (s.customer.property_type === "multi_unit") {
          (s.work_blocks || []).forEach((b) => {
            if (!b.unit) return;
            const uId = b.unit.id;
            if (!propGroup.units[uId]) {
              propGroup.units[uId] = {
                unitId: uId,
                unitLabel: b.unit.label,
                employees: new Set(),
                totalMs: 0,
                hasDamage: false,
                hasCannot: false,
                photoCount: 0,
                blocks: [],
              };
            }
            const ug = propGroup.units[uId];
            ug.employees.add(s.employee?.name || "?");
            ug.blocks.push({
              block: b,
              employee: s.employee,
              rate: s.customer.bill_rate_hourly,
            });
            const blockMs = b.end_time
              ? new Date(b.end_time) - new Date(b.start_time)
              : new Date() - new Date(b.start_time);
            ug.totalMs += blockMs;
            c.totalActiveMs += blockMs;
            c.units.add(b.unit.label);
            (b.tasks || []).forEach((t) => {
              if (t.category) c.categories.add(t.category);
              (t.photos || []).forEach((p) => {
                ug.photoCount++;
                if (p.kind === "damage") ug.hasDamage = true;
                if (p.kind === KIND_CANNOT) ug.hasCannot = true;
              });
            });
          });
        } else {
          propGroup.simpleShifts.push(s);
          // For simple-property shifts there's no work_block breakdown,
          // so active time equals shift time
          c.totalActiveMs += shiftMs;
        }
      });

      setData({ groups, shifts: shifts || [], byCleaner });
    })();
  }, [date]);

  if (!data) return <Splash text="Loading…" />;

  const dateObj = new Date(date + "T12:00:00");
  const propIds = Object.keys(data.groups);
  const totalShifts = data.shifts.length;
  const totalProperties = propIds.length;

  return (
    <div className="pb-24">
      <ScreenId id="OW-DAY" />
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 text-sm mb-4 hover:text-stone-50"
        >
          <ArrowLeft size={16} /> Back to calendar
        </button>
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {dateObj.toLocaleDateString("en-US", { weekday: "long" })}
        </div>
        <h1 className="font-serif text-3xl mb-1">
          {dateObj.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h1>
        <div className="text-sm text-stone-300 mt-2">
          {totalShifts} {totalShifts === 1 ? "shift" : "shifts"} across{" "}
          {totalProperties} {totalProperties === 1 ? "property" : "properties"}
        </div>
      </div>

      <div className="px-5 pt-6">
        {/* Filters + per-cleaner breakdown live above the property
           grouping so the owner can quickly see "who worked how long"
           before drilling into specific properties/units. */}
        {data.shifts.length > 0 &&
          (() => {
            // Compute filter options from the unfiltered data
            const allCleaners = Object.values(data.byCleaner)
              .map((c) => ({ id: c.employeeId, name: c.name }))
              .sort((a, b) => a.name.localeCompare(b.name));
            const allProperties = Object.values(data.groups)
              .map((g) => g.property?.name)
              .filter(Boolean);
            const uniqueProps = [...new Set(allProperties)].sort();
            const allCategories = new Set();
            Object.values(data.byCleaner).forEach((c) =>
              c.categories.forEach((cat) => allCategories.add(cat)),
            );
            const availableCategories = TASK_CATEGORIES.filter((c) =>
              allCategories.has(c.id),
            );

            // Apply filters to per-cleaner list
            const cleanersFiltered = Object.values(data.byCleaner)
              .filter((c) => {
                if (
                  filterCleaners.size > 0 &&
                  !filterCleaners.has(c.employeeId)
                )
                  return false;
                if (filterProperties.size > 0) {
                  const hit = [...c.properties].some((p) =>
                    filterProperties.has(p),
                  );
                  if (!hit) return false;
                }
                if (filterCategories.size > 0) {
                  const hit = [...c.categories].some((cat) =>
                    filterCategories.has(cat),
                  );
                  if (!hit) return false;
                }
                return true;
              })
              .sort((a, b) => b.totalActiveMs - a.totalActiveMs);

            const activeFilterCount =
              filterCleaners.size +
              filterProperties.size +
              filterCategories.size;
            const toggleSet = (setter) => (value) =>
              setter((prev) => {
                const next = new Set(prev);
                if (next.has(value)) next.delete(value);
                else next.add(value);
                return next;
              });
            return (
              <>
                {(allCleaners.length > 0 ||
                  uniqueProps.length > 1 ||
                  availableCategories.length > 0) && (
                  <div className="mb-4">
                    <button
                      onClick={() => setFiltersOpen((o) => !o)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border ${activeFilterCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-200 text-stone-600"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Settings size={14} />
                        <span className="text-xs uppercase tracking-wider font-mono">
                          Filters
                          {activeFilterCount > 0
                            ? ` (${activeFilterCount})`
                            : ""}
                        </span>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                    {filtersOpen && (
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mt-1 space-y-3">
                        {allCleaners.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                              Cleaner
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {allCleaners.map((c) => {
                                const active = filterCleaners.has(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    onClick={() =>
                                      toggleSet(setFilterCleaners)(c.id)
                                    }
                                    className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                                  >
                                    {active && <Check size={10} />} {c.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {uniqueProps.length > 1 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                              Property
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {uniqueProps.map((name) => {
                                const active = filterProperties.has(name);
                                return (
                                  <button
                                    key={name}
                                    onClick={() =>
                                      toggleSet(setFilterProperties)(name)
                                    }
                                    className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                                  >
                                    {active && <Check size={10} />} {name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {availableCategories.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">
                              Task category
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {availableCategories.map((c) => {
                                const active = filterCategories.has(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    onClick={() =>
                                      toggleSet(setFilterCategories)(c.id)
                                    }
                                    className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                                  >
                                    {active && <Check size={10} />} {c.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {activeFilterCount > 0 && (
                          <button
                            onClick={() => {
                              setFilterCleaners(new Set());
                              setFilterProperties(new Set());
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

                {/* Per-cleaner breakdown card */}
                {cleanersFiltered.length > 0 && (
                  <div className="mb-6 p-4 rounded-2xl bg-stone-900 text-stone-50">
                    <div className="text-xs uppercase tracking-wider text-stone-400 font-mono mb-3 flex items-center gap-2">
                      <Users size={12} /> By cleaner
                    </div>
                    <div className="space-y-2">
                      {cleanersFiltered.map((c) => {
                        // Idle handling: subtract idle from clocked-in to get an
                        // "adjusted" billable estimate. Flag excessive idle (over
                        // 15% of shift time, or more than 30 min) so the owner
                        // can review.
                        const idleMs = (c.idleSeconds || 0) * 1000;
                        const adjustedMs = Math.max(0, c.totalShiftMs - idleMs);
                        const idlePct =
                          c.totalShiftMs > 0 ? idleMs / c.totalShiftMs : 0;
                        const idleHighlight =
                          idleMs > 30 * 60 * 1000 || idlePct > 0.15;
                        return (
                          <div
                            key={c.employeeId}
                            className="flex items-start justify-between gap-3 py-1.5 border-b border-stone-800 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-serif text-base truncate flex items-center gap-2">
                                {c.name}
                                {c.hasOpenShift && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-stone-400 mt-0.5">
                                {[...c.units].slice(0, 4).join(", ")}
                                {c.units.size > 4 &&
                                  ` +${c.units.size - 4} more`}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {/* Active work time first, then total clocked-in in parens. */}
                              <div className="font-mono text-sm">
                                {fmtTimeShort(c.totalActiveMs)}
                                <span className="text-stone-400 ml-1">
                                  ({fmtTimeShort(c.totalShiftMs)})
                                </span>
                              </div>
                              {idleHighlight && (
                                <div className="text-[10px] font-mono text-amber-300 mt-0.5 flex items-center justify-end gap-1">
                                  <AlertCircle size={10} />
                                  {fmtTimeShort(idleMs)} idle · adj{" "}
                                  {fmtTimeShort(adjustedMs)}
                                </div>
                              )}
                              {!idleHighlight && idleMs > 0 && (
                                <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                  {fmtTimeShort(idleMs)} idle
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 text-[10px] text-stone-500 font-mono">
                      Active = sum of work blocks. (Clocked-in) = total shift
                      time. Adj = adjusted for idle.
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        {propIds.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No cleanings on this date.
          </div>
        ) : (
          <div className="space-y-6">
            {propIds.map((propId) => {
              const pg = data.groups[propId];
              const unitIds = Object.keys(pg.units);
              const sortedUnits = unitIds
                .map((id) => pg.units[id])
                .sort((a, b) => naturalCompare(a.unitLabel, b.unitLabel));

              return (
                <div key={propId}>
                  <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                    <h3 className="font-serif text-xl text-stone-900 flex items-center gap-2">
                      <Building2 size={16} /> {pg.property.name}
                    </h3>
                    <span className="text-xs font-mono text-stone-500">
                      {sortedUnits.length || pg.simpleShifts.length}{" "}
                      {(sortedUnits.length || pg.simpleShifts.length) === 1
                        ? "cleaning"
                        : "cleanings"}
                    </span>
                  </div>

                  {/* Multi-unit: list of units */}
                  {sortedUnits.length > 0 && (
                    <div className="space-y-2">
                      {sortedUnits.map((u) => {
                        const ua = unitAsg[u.unitId];
                        // Size lives on the unit, NOT on the assignment. Read it
                        // from unitSize so the pill is right even when this unit
                        // has no open assignment (ua would be undefined).
                        const us = unitSize[u.unitId];
                        return (
                          <div
                            key={u.unitId}
                            className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                              u.hasDamage
                                ? "bg-red-50/50 border-red-200"
                                : u.hasCannot
                                  ? "bg-yellow-50/60 border-yellow-300"
                                  : "bg-white border-stone-200"
                            }`}
                          >
                            <button
                              onClick={() =>
                                onOpenUnit(
                                  propId,
                                  u.unitId,
                                  u.unitLabel,
                                  pg.property.name,
                                )
                              }
                              className="w-full text-left"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-serif text-lg text-stone-900">
                                      {u.unitLabel}
                                    </span>
                                    {u.hasDamage && (
                                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                        ⚠ Damage
                                      </span>
                                    )}
                                    {u.hasCannot && (
                                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900 font-bold">
                                        ⚠ Couldn't clean
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-stone-500 font-mono">
                                    {fmtTimeShort(u.totalMs)} total ·{" "}
                                    {u.employees.size}{" "}
                                    {u.employees.size === 1
                                      ? "cleaner"
                                      : "cleaners"}{" "}
                                    · {u.photoCount}{" "}
                                    {u.photoCount === 1 ? "photo" : "photos"}
                                  </div>
                                  <div className="text-xs text-stone-600 mt-1">
                                    {[...u.employees].join(", ")}
                                  </div>
                                </div>
                                <ChevronRight
                                  size={16}
                                  className="text-stone-400 flex-shrink-0 ml-2"
                                />
                              </div>
                            </button>

                            {/* Inline controls for this unit's open assignment */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              {dSizeFor === u.unitId ? (
                                <span className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    autoFocus
                                    value={dBr}
                                    onChange={(e) => setDBr(e.target.value)}
                                    className="w-10 px-1 py-0.5 rounded border border-stone-300 text-[10px] font-mono"
                                    placeholder="BR"
                                  />
                                  <span className="text-[9px] text-stone-400">
                                    BR
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={dBa}
                                    onChange={(e) => setDBa(e.target.value)}
                                    className="w-12 px-1 py-0.5 rounded border border-stone-300 text-[10px] font-mono"
                                    placeholder="BA"
                                  />
                                  <span className="text-[9px] text-stone-400">
                                    BA
                                  </span>
                                  <button
                                    onClick={() =>
                                      dSaveSize(u.unitId, dBr, dBa)
                                    }
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-stone-900 text-white"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setDSizeFor(null)}
                                    className="text-[10px] px-1 text-stone-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setDSizeFor(u.unitId);
                                    setDBr(us?.bedrooms ?? "");
                                    setDBa(us?.bathrooms ?? "");
                                  }}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700"
                                >
                                  {us?.bedrooms || us?.bathrooms
                                    ? `${us.bedrooms || 0}BR / ${us.bathrooms || 0}BA`
                                    : "Set size"}
                                </button>
                              )}

                              {ua ? (
                                <>
                                  {dDueFor === ua.id ? (
                                    <DueDateEditor
                                      compact
                                      value={ua.scheduledDate || ""}
                                      onSave={(d) => dSaveDue(ua.id, d)}
                                      onCancel={() => setDDueFor(null)}
                                    />
                                  ) : canDailyDates ? (
                                    <button
                                      onClick={() => setDDueFor(ua.id)}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                        ua.scheduledDate
                                          ? ua.scheduledDate < dToday
                                            ? "bg-red-100 text-red-700 border-red-200"
                                            : ua.scheduledDate === dToday
                                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                              : "bg-stone-100 text-stone-600 border-stone-200"
                                          : "bg-white text-stone-500 border-dashed border-stone-300"
                                      }`}
                                    >
                                      <Calendar size={9} />{" "}
                                      {ua.scheduledDate
                                        ? fmtDueDate(ua.scheduledDate)
                                        : "Set due date"}
                                    </button>
                                  ) : null}

                                  {ua.assignees.map((a) => (
                                    <span
                                      key={a.id}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${a.requested ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-700"}`}
                                    >
                                      <User size={9} /> {a.name}
                                      {a.requested ? " asked" : ""}
                                    </span>
                                  ))}
                                  {canDailyAssign && (
                                    <button
                                      onClick={() =>
                                        setDAssignFor(
                                          dAssignFor === ua.id ? null : ua.id,
                                        )
                                      }
                                      className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 inline-flex items-center gap-1"
                                    >
                                      <Plus size={9} /> Assign
                                    </button>
                                  )}

                                  {/* Took longer → charge extra on the invoice */}
                                  <button
                                    onClick={() =>
                                      dToggleExtra(ua.id, ua.tookLonger)
                                    }
                                    disabled={dBusy === ua.id}
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 disabled:opacity-50 ${ua.tookLonger ? "bg-amber-500 text-white" : "bg-white border border-dashed border-stone-300 text-stone-500"}`}
                                  >
                                    <Clock size={9} />{" "}
                                    {ua.tookLonger ? "Extra" : "Mark extra"}
                                  </button>

                                  {canDailyDone &&
                                    (ua.open ? (
                                      <button
                                        onClick={() =>
                                          dMarkDone(ua.id, u.unitLabel)
                                        }
                                        disabled={dBusy === ua.id}
                                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white inline-flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <Check size={9} /> Mark done
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                        <Check size={9} /> Done
                                      </span>
                                    ))}
                                </>
                              ) : (
                                <span className="text-[10px] font-mono text-stone-400">
                                  No open assignment
                                </span>
                              )}
                            </div>

                            {ua && canDailyAssign && dAssignFor === ua.id && (
                              <AssignPicker
                                key={ua.id}
                                team={dTeam}
                                busy={dBusy === ua.id}
                                currentIds={ua.assignees.map((a) => a.id)}
                                onCancel={() => setDAssignFor(null)}
                                onSave={(ids) => dCommitAssignees(ua, ids)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Simple-property shifts: just list them as-is */}
                  {pg.simpleShifts.length > 0 && (
                    <div className="space-y-2">
                      {pg.simpleShifts.map((s) => {
                        const dur =
                          (s.end_time ? new Date(s.end_time) : new Date()) -
                          new Date(s.start_time);
                        return (
                          <div
                            key={s.id}
                            className="p-4 rounded-2xl bg-white border border-stone-200"
                          >
                            <div className="font-serif text-base text-stone-900">
                              {s.employee?.name}
                            </div>
                            <div className="text-xs text-stone-500 font-mono mt-1">
                              {fmtClock(s.start_time)}
                              {s.end_time &&
                                ` — ${fmtClock(s.end_time)}`} ·{" "}
                              {fmtTimeShort(dur)}
                            </div>
                          </div>
                        );
                      })}
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

  // Helper hoisted so we can call it inside the JSX above
  // (onOpenUnit comes in as a prop from the parent — see DailyView)
}
