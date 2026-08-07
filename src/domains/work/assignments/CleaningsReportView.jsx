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

export function CleaningsReportView({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
  topToggle,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const isoDate = (d) => d.toISOString().split("T")[0];
  const [start, setStart] = useState(isoDate(sevenAgo));
  const [end, setEnd] = useState(isoDate(today));
  // Month displayed in the mini calendar (defaults to current).
  const [calMonth, setCalMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  // Dates (yyyy-mm-dd) that had at least one cleaning completed.
  // Used to highlight cells in the mini calendar so the owner can
  // see at a glance which days actually had activity.
  const [cleaningDates, setCleaningDates] = useState(new Set());
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  // Selected assignment types — empty means "all". Multi-select chip.
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  // View mode: 'bedroom' (existing hierarchy) or 'cleaner' (per-cleaner
  // breakdown — useful for billing or seeing who's productive).
  const [viewMode, setViewMode] = useState("bedroom");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Load active properties for the dropdown
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("active", true)
        .order("name");
      setProperties(data || []);
    })();
  }, []);

  // Load the dates-with-cleanings for the visible calendar month so we
  // can highlight them. We look for completed assignment_targets in
  // the month range — those are the days that actually had work
  // happen. Re-runs when the visible month changes or property filter.
  useEffect(() => {
    (async () => {
      const monthStart = new Date(
        calMonth.getFullYear(),
        calMonth.getMonth(),
        1,
      );
      const monthEnd = new Date(
        calMonth.getFullYear(),
        calMonth.getMonth() + 1,
        1,
      );
      let q = supabase
        .from("assignment_targets")
        .select("completed_at, assignment:assignments!inner(customer_id)")
        .gte("completed_at", monthStart.toISOString())
        .lt("completed_at", monthEnd.toISOString())
        .not("completed_at", "is", null);
      const { data } = await q;
      const set = new Set();
      (data || []).forEach((t) => {
        if (
          selectedPropertyId &&
          t.assignment?.customer_id !== selectedPropertyId
        )
          return;
        const d = new Date(t.completed_at);
        set.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        );
      });
      setCleaningDates(set);
    })();
  }, [calMonth, selectedPropertyId]);

  const toggleType = (val) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  // Build the hierarchical report:
  //   unit → party → section → (general → subgroup) → items[]
  const generate = async () => {
    setError("");
    setBusy(true);
    setReport(null);
    try {
      const startISO = new Date(start + "T00:00:00").toISOString();
      const endDateObj = new Date(end + "T23:59:59.999");
      const endISO = endDateObj.toISOString();
      let q = supabase
        .from("assignment_targets")
        .select(
          `
          id, status, completed_at, completed_by, template_section, template_item_key, status_notes,
          unit:units(id, label),
          party:parties(id, label),
          completed_by_employee:employees!completed_by(id, name),
          assignment:assignments!inner(id, title, assignment_type, customer_id, property:customers(id, name))
        `,
        )
        .gte("completed_at", startISO)
        .lte("completed_at", endISO)
        .not("completed_at", "is", null);
      if (selectedPropertyId)
        q = q.eq("assignment.customer_id", selectedPropertyId);
      if (selectedTypes.size > 0)
        q = q.in("assignment.assignment_type", Array.from(selectedTypes));
      const { data, error: e } = await q;
      if (e) throw e;
      const targets = (data || []).filter(
        (t) =>
          (!selectedPropertyId ||
            t.assignment?.customer_id === selectedPropertyId) &&
          (selectedTypes.size === 0 ||
            selectedTypes.has(t.assignment?.assignment_type)),
      );
      // Natural-sort comparator so "B1-101" sorts before "B1-102"
      // before "B2-101". Plain string sort would put "B10-..." before
      // "B2-..." which isn't what an owner expects.
      const natCmp = (a, b) => {
        const re = /(\d+)|(\D+)/g;
        const pa =
          String(a || "")
            .toLowerCase()
            .match(re) || [];
        const pb =
          String(b || "")
            .toLowerCase()
            .match(re) || [];
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const x = pa[i],
            y = pb[i];
          if (x === undefined) return -1;
          if (y === undefined) return 1;
          const xn = /^\d+$/.test(x),
            yn = /^\d+$/.test(y);
          if (xn && yn) {
            const d = parseInt(x, 10) - parseInt(y, 10);
            if (d !== 0) return d;
          } else if (x !== y) {
            return x < y ? -1 : 1;
          }
        }
        return 0;
      };
      // Group by unit → party → section. For "general", further group by
      // its sub-group label (4 sub-groups A-D). Items are kept in order.
      const generalSubFor = (itemKey) => {
        // template_item_key like "general:living_room"
        const sub = (itemKey || "").split(":")[1];
        if (!sub) return { key: "_general_misc", label: "General" };
        const meta = TASK_CATEGORIES.find(
          (c) => c.id === "general",
        )?.subcategories?.find((s) => s.id === sub);
        if (!meta) return { key: sub, label: sub };
        return { key: meta.group || sub, label: meta.groupLabel || meta.label };
      };
      const labelForItem = (t) => {
        if (
          t.status_notes &&
          (t.template_item_key?.startsWith?.("requested:") ||
            t.template_item_key?.startsWith?.("custom_"))
        )
          return t.status_notes;
        const k = t.template_item_key || "";
        return (
          k
            .replace(/^[a-z_]+:/, "")
            .replace(/_/g, " ")
            .replace(/^./, (c) => c.toUpperCase()) || "Item"
        );
      };
      const units = new Map();
      for (const t of targets) {
        const uId = t.unit?.id || "_no_unit";
        if (!units.has(uId))
          units.set(uId, {
            unitLabel: t.unit?.label || "Unit",
            parties: new Map(),
          });
        const u = units.get(uId);
        const pId = t.party?.id || "_no_party";
        if (!u.parties.has(pId))
          u.parties.set(pId, {
            partyLabel: t.party?.label || "Bedroom",
            assignmentType: t.assignment?.assignment_type,
            assignmentTitle: t.assignment?.title,
            propertyName: t.assignment?.property?.name,
            sections: { bedroom: [], bathroom: [], vanity: [] },
            generalGroups: new Map(),
          });
        const p = u.parties.get(pId);
        const section = (t.template_section || "").toLowerCase();
        if (section === "general") {
          const sub = generalSubFor(t.template_item_key);
          if (!p.generalGroups.has(sub.key))
            p.generalGroups.set(sub.key, { label: sub.label, items: [] });
          p.generalGroups.get(sub.key).items.push(labelForItem(t));
        } else if (
          section === "bedroom" ||
          section === "bathroom" ||
          section === "vanity"
        ) {
          p.sections[section].push(labelForItem(t));
        } else {
          const key = "_misc";
          if (!p.generalGroups.has(key))
            p.generalGroups.set(key, { label: "Other", items: [] });
          p.generalGroups.get(key).items.push(labelForItem(t));
        }
      }
      const out = Array.from(units.values())
        .sort((a, b) => natCmp(a.unitLabel, b.unitLabel))
        .map((u) => ({
          unitLabel: u.unitLabel,
          parties: Array.from(u.parties.values())
            .sort((a, b) => natCmp(a.partyLabel, b.partyLabel))
            .map((p) => ({
              ...p,
              generalGroups: Array.from(p.generalGroups.values()).sort((a, b) =>
                a.label.localeCompare(b.label),
              ),
            })),
        }));
      // Per-cleaner aggregate — used by the "By cleaner" view mode.
      // For each cleaner that completed at least one item in the
      // range we tally items, distinct bedrooms (unit+party), distinct
      // apartments (unit), and the most recent completion timestamp.
      const cleanerMap = new Map();
      for (const t of targets) {
        const cId = t.completed_by;
        if (!cId) continue;
        if (!cleanerMap.has(cId)) {
          cleanerMap.set(cId, {
            id: cId,
            name: t.completed_by_employee?.name || "Unknown",
            items: 0,
            bedrooms: new Set(),
            apartments: new Set(),
            lastCompletedAt: null,
          });
        }
        const c = cleanerMap.get(cId);
        c.items += 1;
        if (t.unit?.id && t.party?.id)
          c.bedrooms.add(`${t.unit.id}::${t.party.id}`);
        if (t.unit?.id) c.apartments.add(t.unit.id);
        const ts = t.completed_at ? new Date(t.completed_at).getTime() : 0;
        if (ts > (c.lastCompletedAt || 0)) c.lastCompletedAt = ts;
      }
      const byCleaner = Array.from(cleanerMap.values())
        .map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items,
          bedrooms: c.bedrooms.size,
          apartments: c.apartments.size,
          avgItemsPerBedroom:
            c.bedrooms.size > 0
              ? Math.round((c.items / c.bedrooms.size) * 10) / 10
              : 0,
          lastCompletedAt: c.lastCompletedAt,
        }))
        .sort((a, b) => b.items - a.items);
      setReport({ byBedroom: out, byCleaner });
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  // Quick-pick presets for the date range
  const setRange = (days) => {
    const e = new Date();
    e.setHours(0, 0, 0, 0);
    const s = new Date(e);
    s.setDate(s.getDate() - (days - 1));
    setStart(isoDate(s));
    setEnd(isoDate(e));
    setCalMonth(new Date(s.getFullYear(), s.getMonth(), 1));
  };

  // Mini calendar grid for the current calMonth — clicking a cell sets
  // it as start (1st click) or end (2nd click). Resets on 3rd click.
  const [calClickStage, setCalClickStage] = useState(0);
  const onCalClick = (d) => {
    const ds = isoDate(d);
    if (calClickStage === 0) {
      setStart(ds);
      setEnd(ds);
      setCalClickStage(1);
    } else if (calClickStage === 1) {
      if (ds < start) {
        setEnd(start);
        setStart(ds);
      } else {
        setEnd(ds);
      }
      setCalClickStage(0);
    }
  };
  // Build the 7-col grid for calMonth
  const calCells = (() => {
    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const last = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  })();
  const monthLabel = calMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const inRange = (d) => {
    if (!d) return false;
    const ds = isoDate(d);
    return ds >= start && ds <= end;
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee?.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      {topToggle}
      <div className="px-5 pt-4 max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-1">
          Reports
        </div>
        <h1 className="text-3xl font-light text-stone-900 tracking-tight mb-5">
          By <span className="font-serif italic text-amber-700">cleaning</span>
        </h1>

        {/* === DATE RANGE === */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">
            Date range
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { d: 1, label: "Today" },
              { d: 7, label: "Last 7d" },
              { d: 14, label: "Last 14d" },
              { d: 30, label: "Last 30d" },
            ].map((p) => (
              <button
                key={p.d}
                onClick={() => setRange(p.d)}
                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <span className="text-stone-400 text-xs">to</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          {/* Mini calendar — dates with cleanings get an amber dot under
             them, dates in the selected range get a stone background.
             Tap to set start, tap again to set end. */}
          <div className="border border-stone-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() =>
                  setCalMonth(
                    new Date(
                      calMonth.getFullYear(),
                      calMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                className="p-1 rounded-full hover:bg-stone-100 text-stone-600"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-xs font-mono text-stone-700">
                {monthLabel}
              </div>
              <button
                onClick={() =>
                  setCalMonth(
                    new Date(
                      calMonth.getFullYear(),
                      calMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                className="p-1 rounded-full hover:bg-stone-100 text-stone-600"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-[9px] font-mono text-stone-400 py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calCells.map((d, i) => {
                if (!d) return <div key={i} />;
                const ds = isoDate(d);
                const hasCleaning = cleaningDates.has(ds);
                const selected = inRange(d);
                const isStartOrEnd = ds === start || ds === end;
                return (
                  <button
                    key={i}
                    onClick={() => onCalClick(d)}
                    className={`relative aspect-square rounded-md text-xs font-mono flex items-center justify-center transition-colors
                      ${
                        isStartOrEnd
                          ? "bg-amber-700 text-white font-bold"
                          : selected
                            ? "bg-amber-100 text-amber-900"
                            : hasCleaning
                              ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                              : "text-stone-600 hover:bg-stone-100"
                      }`}
                  >
                    {d.getDate()}
                    {hasCleaning && !isStartOrEnd && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-stone-500 font-mono">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />{" "}
                day had cleanings
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-700" />{" "}
                selected
              </span>
            </div>
          </div>
        </div>

        {/* === PROPERTY === */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">
            Property
          </div>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* === ASSIGNMENT TYPE === */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">
            Cleaning type{" "}
            {selectedTypes.size === 0 && (
              <span className="text-stone-400">(all types)</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNMENT_TYPES.map((t) => {
              const active = selectedTypes.has(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${active ? t.color : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* === GENERATE === */}
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <button
          onClick={generate}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 mb-6"
        >
          {busy ? "Generating…" : <>Generate report</>}
        </button>

        {/* === OUTPUT === */}
        {report &&
          (report.byBedroom?.length === 0 &&
          (!report.byCleaner || report.byCleaner.length === 0) ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No completed cleanings match those filters.
            </div>
          ) : (
            <div className="space-y-3">
              {/* View-mode toggle — sits above the output so the owner
                 can flip between the by-bedroom hierarchy (good for
                 reviewing what got cleaned where) and the by-cleaner
                 table (good for billing / accountability). */}
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono flex-1">
                  Report ·{" "}
                  {viewMode === "bedroom" ? (
                    <>
                      {report.byBedroom.reduce(
                        (sum, u) => sum + u.parties.length,
                        0,
                      )}{" "}
                      bedroom
                      {report.byBedroom.reduce(
                        (sum, u) => sum + u.parties.length,
                        0,
                      ) === 1
                        ? ""
                        : "s"}{" "}
                      cleaned
                    </>
                  ) : (
                    <>
                      {report.byCleaner.length} cleaner
                      {report.byCleaner.length === 1 ? "" : "s"}
                    </>
                  )}
                </div>
                <div className="inline-flex rounded-full bg-stone-100 p-0.5">
                  <button
                    onClick={() => setViewMode("bedroom")}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${viewMode === "bedroom" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                  >
                    By bedroom
                  </button>
                  <button
                    onClick={() => setViewMode("cleaner")}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${viewMode === "cleaner" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
                  >
                    By cleaner
                  </button>
                </div>
              </div>
              {/* By cleaner — sortable simple table. Default sort is
                 items DESC. Each row is a cleaner with: bedrooms,
                 apartments, items, avg items/bedroom, last completed. */}
              {viewMode === "cleaner" &&
                (report.byCleaner.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                    No cleaners completed items in this range.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
                    <div className="grid grid-cols-12 px-4 py-2 bg-stone-50 border-b border-stone-200 text-[10px] uppercase tracking-wider font-mono text-stone-500">
                      <div className="col-span-4">Cleaner</div>
                      <div className="col-span-2 text-right">Items</div>
                      <div className="col-span-2 text-right">Bedrooms</div>
                      <div className="col-span-2 text-right">Apartments</div>
                      <div className="col-span-2 text-right">Avg / bedroom</div>
                    </div>
                    {report.byCleaner.map((c) => (
                      <div
                        key={c.id}
                        className="grid grid-cols-12 px-4 py-3 border-b border-stone-100 last:border-b-0 items-center"
                      >
                        <div className="col-span-4 min-w-0">
                          <div className="text-sm text-stone-900 truncate">
                            {c.name}
                          </div>
                          {c.lastCompletedAt && (
                            <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                              Last: {fmtDate(c.lastCompletedAt)}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-sm font-mono text-stone-900 font-bold">
                          {c.items}
                        </div>
                        <div className="col-span-2 text-right text-sm font-mono text-stone-700">
                          {c.bedrooms}
                        </div>
                        <div className="col-span-2 text-right text-sm font-mono text-stone-700">
                          {c.apartments}
                        </div>
                        <div className="col-span-2 text-right text-sm font-mono text-stone-500">
                          {c.avgItemsPerBedroom}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              {/* By bedroom — original hierarchical view */}
              {viewMode === "bedroom" &&
                report.byBedroom.map((u, ui) => (
                  <React.Fragment key={ui}>
                    {u.parties.map((p, pi) => (
                      <div
                        key={`${ui}-${pi}`}
                        className="rounded-2xl bg-white border border-stone-200 p-4"
                      >
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <div className="font-serif text-lg text-stone-900">
                            {u.unitLabel} ·{" "}
                            <span className="italic text-amber-700">
                              {p.partyLabel}
                            </span>
                          </div>
                          {p.assignmentType && (
                            <AssignmentTypeChip type={p.assignmentType} />
                          )}
                        </div>
                        {p.propertyName && (
                          <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-2">
                            {p.propertyName}
                            {p.assignmentTitle && ` · ${p.assignmentTitle}`}
                          </div>
                        )}
                        <div className="space-y-2">
                          {["bedroom", "bathroom", "vanity"].map((sec) => {
                            const items = p.sections[sec];
                            if (!items || items.length === 0) return null;
                            return (
                              <div key={sec}>
                                <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-0.5">
                                  {sec.charAt(0).toUpperCase() + sec.slice(1)}{" "}
                                  <span className="text-stone-400">
                                    ({items.length})
                                  </span>
                                </div>
                                <div className="text-sm text-stone-800">
                                  {items.join(", ")}
                                </div>
                              </div>
                            );
                          })}
                          {p.generalGroups.map((g, gi) => (
                            <div key={gi}>
                              <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-0.5">
                                General — {g.label}{" "}
                                <span className="text-stone-400">
                                  ({g.items.length})
                                </span>
                              </div>
                              <div className="text-sm text-stone-800">
                                {g.items.join(", ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
}
