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
} from "../../../../lib/supabase.js";
import {
  ASSIGNMENT_TYPES,
  assignmentTypeLabel,
  assignmentTypeMeta,
  BUILD_TAG,
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom, partyDisplay, unitPartyLabel } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";
import { DateRangePicker } from "../../../../App.jsx";
import { GroupedByPartyView } from "../dashboard/GroupedByPartyView.jsx";
import { LiveCleanersSheet } from "../../cleaner/LiveCleanersSheet.jsx";
import { ShiftDetail } from "../dashboard/ShiftDetail.jsx";
import { ShiftList } from "../dashboard/ShiftList.jsx";
import { ShiftsByCleanerView } from "../dashboard/ShiftsByCleanerView.jsx";
import { StatCard } from "../dashboard/StatCard.jsx";

export function ManagerDashboard({
  employee,
  onSignOut,
  onOpenMessages,
  onLogoClick,
}) {
  const [shifts, setShifts] = useState([]);
  const [view, setView] = useState("shifts");
  const [selectedShift, setSelectedShift] = useState(null);
  const [subView, setSubView] = useState("cleaner"); // 'cleaner' | 'list' | 'today'
  const [selectedCleanerId, setSelectedCleanerId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [liveSheetOpen, setLiveSheetOpen] = useState(false);
  const showMoney = canSeeMoney(employee);

  // Date filter = a custom range OR all time. Empty range = all time,
  // and all time really means all (the query below paginates so nothing
  // gets cut off by the 1000-row cap). Defaults to the last 7 days so a
  // cleaner's recent shifts are all visible — "today only" was hiding
  // yesterday's and cross-day work behind a filter nobody realized was set.
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekAgoKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  })();
  const [dateFrom, setDateFrom] = useState(weekAgoKey); // default: last 7 days
  const [dateTo, setDateTo] = useState(todayKey);
  const [filterCleaners, setFilterCleaners] = useState(new Set());
  const [filterProperties, setFilterProperties] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set()); // open|in_progress|completed
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    // Paginated load so "all time" returns every shift, not just the
    // first 1000. Date bounds applied when set; empty = no bound.
    const PAGE = 1000;
    let rows = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from("shifts")
        .select(
          "*, employee:employees(id,name,pay_rate_hourly), customer:customers(id,name,property_type,bill_rate_hourly,bill_mode), work_blocks(id, end_time, start_time, bill_rate_at_work, assignment_id, unit_id, assignment:assignments(assignment_type), unit:units(label, bedrooms, bathrooms), party:parties(label))",
        )
        .eq("is_preview", false)
        .order("start_time", { ascending: false })
        .range(from, from + PAGE - 1);
      if (dateFrom) {
        const [fy, fm, fd] = dateFrom.split("-").map(Number);
        q = q.gte(
          "start_time",
          new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
        );
      }
      if (dateTo) {
        const [ty, tm, td] = dateTo.split("-").map(Number);
        q = q.lte(
          "start_time",
          new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
        );
      }
      const { data, error } = await q;
      if (error) break;
      rows = rows.concat(data || []);
      if (!data || data.length < PAGE) break;
      if (from > 100000) break;
    }
    setShifts(rows);
    setLoaded(true);
  }, [dateFrom, dateTo]);
  useEffect(() => {
    load();
  }, [load, view]);

  // Keep the drill-down in sync with the cleaner filter. Without this you
  // can be drilled into cleaner A while the filter only allows cleaner B,
  // which shows an empty "Cleaner · 0 days" screen.
  useEffect(() => {
    if (!selectedCleanerId) {
      // Filtering to exactly one cleaner drills straight into them.
      if (filterCleaners.size === 1)
        setSelectedCleanerId(Array.from(filterCleaners)[0]);
      return;
    }
    if (filterCleaners.size && !filterCleaners.has(selectedCleanerId)) {
      setSelectedCleanerId(
        filterCleaners.size === 1 ? Array.from(filterCleaners)[0] : null,
      );
    }
    /* eslint-disable-next-line */
  }, [filterCleaners]);

  if (!loaded) return <Splash text="Loading shifts…" />;
  if (view === "detail" && selectedShift) {
    return (
      <ShiftDetail
        shiftId={selectedShift.id}
        viewerRole={employee.role}
        viewerEmployee={employee}
        onBack={() => {
          setView("shifts");
          setSelectedShift(null);
          load();
        }}
      />
    );
  }

  // Mutually-exclusive shift status.
  const shiftStatus = (s) => {
    if (s.end_time) return "completed";
    return (s.work_blocks || []).some((b) => !b.end_time)
      ? "in_progress"
      : "open";
  };

  // Filter chip sources, derived from the loaded set.
  const cleanerMap = new Map();
  const propertyMap = new Map();
  shifts.forEach((s) => {
    if (s.employee?.id) cleanerMap.set(s.employee.id, s.employee.name || "—");
    if (s.customer?.id) propertyMap.set(s.customer.id, s.customer.name || "—");
  });
  const availableCleaners = Array.from(cleanerMap, ([id, name]) => ({
    id,
    name,
  })).sort((a, b) => naturalCompare(a.name, b.name));
  const availableProperties = Array.from(propertyMap, ([id, name]) => ({
    id,
    name,
  })).sort((a, b) => naturalCompare(a.name, b.name));

  const toggleIn = (setter) => (val) =>
    setter((prev) => {
      const n = new Set(prev);
      n.has(val) ? n.delete(val) : n.add(val);
      return n;
    });
  const toggleCleaner = toggleIn(setFilterCleaners);
  const toggleProperty = toggleIn(setFilterProperties);
  const toggleStatus = toggleIn(setFilterStatuses);

  const filteredShifts = shifts.filter((s) => {
    if (filterCleaners.size && !filterCleaners.has(s.employee?.id))
      return false;
    if (filterProperties.size && !filterProperties.has(s.customer?.id))
      return false;
    if (filterStatuses.size && !filterStatuses.has(shiftStatus(s)))
      return false;
    return true;
  });

  const isAllTime = !dateFrom && !dateTo;
  // The date is the scope (always shown in the header label), so it
  // doesn't inflate the "N active" badge — that counts the extra filters.
  const activeFilterCount =
    filterCleaners.size + filterProperties.size + filterStatuses.size;

  const clearAll = () => {
    setFilterCleaners(new Set());
    setFilterProperties(new Set());
    setFilterStatuses(new Set());
    setDateFrom(todayKey);
    setDateTo(todayKey);
    setSelectedCleanerId(null);
  };

  // Stats — from the filtered set so the numbers track what's shown.
  const activeCount = filteredShifts.filter((s) => !s.end_time).length;
  const totalHours = filteredShifts
    .filter((s) => s.end_time)
    .reduce((sum, s) => sum + shiftBillableMs(s), 0);
  const cleanerCount = new Set(
    filteredShifts.map((s) => s.employee?.id).filter(Boolean),
  ).size;
  let totalBillable = 0;
  if (showMoney) {
    filteredShifts.forEach((s) => {
      if (!s.end_time) return;
      if (s.customer?.property_type === "multi_unit") {
        (s.work_blocks || []).forEach((b) => {
          if (!b.end_time) return;
          const h =
            (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
          totalBillable +=
            h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0);
        });
      } else if (s.bill_rate_at_work) {
        const h = shiftBillableHours(s);
        totalBillable += h * s.bill_rate_at_work;
      }
    });
  }

  const fmtD = (k) =>
    k
      ? new Date(k + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
  const rangeLabel = isAllTime
    ? "all time"
    : dateFrom && dateTo
      ? `${fmtD(dateFrom)} – ${fmtD(dateTo)}`
      : dateFrom
        ? `since ${fmtD(dateFrom)}`
        : `through ${fmtD(dateTo)}`;

  const chip = (on, onClick, content) => (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 ${on ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
    >
      {on && <Check size={11} />}
      {content}
    </button>
  );

  return (
    <div className="pb-24">
      <ScreenId id="OW-SHIFTS" />
      <Header
        name={employee.name}
        onSignOut={onSignOut}
        role={employee.role}
        employee={employee}
        onOpenMessages={onOpenMessages}
        onLogoClick={onLogoClick}
      />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">
          Shifts · {rangeLabel}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard
            label="On the clock"
            value={activeCount}
            unit="now"
            highlight={activeCount > 0}
            onClick={() => setLiveSheetOpen(true)}
          />
          <StatCard label="Hours" value={fmtTimeShort(totalHours)} />
          {showMoney ? (
            <StatCard label="Billable" value={fmtMoney(totalBillable)} accent />
          ) : (
            <StatCard
              label="Shifts"
              value={filteredShifts.length}
              unit="logged"
            />
          )}
          <StatCard label="Cleaners" value={cleanerCount} unit="worked" />
        </div>

        {/* Filters — time, cleaner, property, status all live here now */}
        <div className="mb-2">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${activeFilterCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              Filters
              {activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ""}
            </span>
            <ChevronRight
              size={16}
              className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
            />
          </button>
          {filtersOpen && (
            <div className="mt-2 p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                  Dates
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-mono ${isAllTime ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600"}`}
                  >
                    All time
                  </button>
                  <div className="flex-1 min-w-[180px]">
                    <DateRangePicker
                      start={dateFrom}
                      end={dateTo}
                      onChange={(s2, e2) => {
                        setDateFrom(s2);
                        setDateTo(e2);
                      }}
                    />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-stone-400 mt-1">
                  Tap the range to pick start and end on one calendar, or All
                  time for everything.
                </div>
              </div>

              {availableCleaners.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    Cleaner
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {availableCleaners.map((c) =>
                      chip(
                        filterCleaners.has(c.id),
                        () => toggleCleaner(c.id),
                        c.name,
                      ),
                    )}
                  </div>
                </div>
              )}

              {availableProperties.length > 1 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    Property
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {availableProperties.map((p) =>
                      chip(
                        filterProperties.has(p.id),
                        () => toggleProperty(p.id),
                        p.name,
                      ),
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                  Status
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {chip(
                    filterStatuses.has("open"),
                    () => toggleStatus("open"),
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                      Open
                    </>,
                  )}
                  {chip(
                    filterStatuses.has("in_progress"),
                    () => toggleStatus("in_progress"),
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      In progress
                    </>,
                  )}
                  {chip(
                    filterStatuses.has("completed"),
                    () => toggleStatus("completed"),
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                      Completed
                    </>,
                  )}
                </div>
              </div>

              <div className="pt-1 border-t border-stone-200">
                <button
                  onClick={clearAll}
                  className="text-[11px] uppercase tracking-wider font-mono text-amber-700 hover:text-amber-900 flex items-center gap-1.5"
                >
                  <X size={12} /> Reset all filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-view toggle */}
      <div className="px-5 mb-4 mt-2 flex gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
        <button
          onClick={() => {
            setSubView("cleaner");
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${subView === "cleaner" ? "bg-stone-200 text-stone-900" : "text-stone-500"}`}
        >
          By cleaner
        </button>
        <button
          onClick={() => {
            setSubView("list");
            setSelectedCleanerId(null);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${subView === "list" ? "bg-stone-200 text-stone-900" : "text-stone-500"}`}
        >
          All shifts
        </button>
        <button
          onClick={() => {
            setSubView("today");
            setSelectedCleanerId(null);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${subView === "today" ? "bg-stone-200 text-stone-900" : "text-stone-500"}`}
        >
          By apartment
        </button>
      </div>

      {subView === "cleaner" ? (
        <ShiftsByCleanerView
          shifts={filteredShifts}
          showMoney={showMoney}
          selectedCleanerId={selectedCleanerId}
          onSelectCleaner={setSelectedCleanerId}
          currentEmployee={employee}
          onReload={load}
          onOpenShift={(s) => {
            setSelectedShift(s);
            setView("detail");
          }}
        />
      ) : subView === "today" ? (
        <GroupedByPartyView
          shifts={filteredShifts}
          showMoney={showMoney}
          onOpenShift={(s) => {
            setSelectedShift(s);
            setView("detail");
          }}
        />
      ) : (
        <ShiftList
          shifts={filteredShifts}
          showMoney={showMoney}
          onOpen={(s) => {
            setSelectedShift(s);
            setView("detail");
          }}
        />
      )}

      {liveSheetOpen && (
        <LiveCleanersSheet
          viewer={employee}
          onClose={() => setLiveSheetOpen(false)}
          onOpenShift={(s) => {
            setLiveSheetOpen(false);
            setSelectedShift(s);
            setView("detail");
          }}
        />
      )}
    </div>
  );
}
