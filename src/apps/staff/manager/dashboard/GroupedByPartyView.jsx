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
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
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

export function GroupedByPartyView({ shifts, showMoney, onOpenShift }) {
  // Multi-select property filter — narrows the list to just the
  // properties the user wants to see. Defaults to "all" (empty filter
  // means "show everything").
  const [selectedProperties, setSelectedProperties] = useState(new Set());
  const [selectedCleaners, setSelectedCleaners] = useState(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [cleanerFilterOpen, setCleanerFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const cleanerFilterRef = useRef(null);

  // Click-outside to close the filter dropdowns
  useEffect(() => {
    if (!filterOpen && !cleanerFilterOpen) return;
    const onClick = (e) => {
      if (
        filterOpen &&
        filterRef.current &&
        !filterRef.current.contains(e.target)
      )
        setFilterOpen(false);
      if (
        cleanerFilterOpen &&
        cleanerFilterRef.current &&
        !cleanerFilterRef.current.contains(e.target)
      )
        setCleanerFilterOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filterOpen, cleanerFilterOpen]);

  // Flatten every work_block from every shift into a list, plus simple-property shifts as standalone rows
  const allRows = [];
  shifts.forEach((s) => {
    if (s.customer?.property_type === "multi_unit" && s.work_blocks?.length) {
      s.work_blocks.forEach((b) => {
        allRows.push({
          kind: "block",
          shift: s,
          block: b,
          property: s.customer?.name || "Unknown",
          unit: b.unit?.label || "—",
          party: b.party?.label || "—",
          employee: s.employee?.name || "—",
          start: b.start_time,
          end: b.end_time,
          rate: b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0,
        });
      });
    } else {
      allRows.push({
        kind: "shift",
        shift: s,
        property: s.customer?.name || "No property",
        unit: "—",
        party: "—",
        employee: s.employee?.name || "—",
        start: s.start_time,
        end: s.end_time,
        rate: s.bill_rate_at_work || 0,
      });
    }
  });

  // All property + cleaner names for the filter dropdowns
  const allPropertyNames = [...new Set(allRows.map((r) => r.property))].sort();
  const allCleanerNames = [
    ...new Set(allRows.map((r) => r.employee).filter((n) => n && n !== "—")),
  ].sort();
  // Apply filters — empty set means "show everything"
  const rows = allRows.filter((r) => {
    if (selectedProperties.size > 0 && !selectedProperties.has(r.property))
      return false;
    if (selectedCleaners.size > 0 && !selectedCleaners.has(r.employee))
      return false;
    return true;
  });

  const toggleProperty = (name) => {
    setSelectedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const toggleCleaner = (name) => {
    setSelectedCleaners((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const clearFilter = () => setSelectedProperties(new Set());
  const selectAll = () => setSelectedProperties(new Set(allPropertyNames));

  // Group by property + unit + party
  const groups = {};
  rows.forEach((r) => {
    const key = `${r.property}::${r.unit}::${r.party}`;
    if (!groups[key])
      groups[key] = {
        property: r.property,
        unit: r.unit,
        party: r.party,
        entries: [],
      };
    groups[key].entries.push(r);
  });

  // Group those further by property for display
  const byProperty = {};
  Object.values(groups).forEach((g) => {
    if (!byProperty[g.property]) byProperty[g.property] = [];
    byProperty[g.property].push(g);
  });

  // Sort each property's entries naturally by unit then party
  Object.values(byProperty).forEach((arr) => {
    arr.sort(
      (a, b) =>
        naturalCompare(a.unit, b.unit) || naturalCompare(a.party, b.party),
    );
  });

  const propertyNames = Object.keys(byProperty).sort();
  const isFiltered = selectedProperties.size > 0;
  const filterLabel = !isFiltered
    ? `All ${allPropertyNames.length} ${allPropertyNames.length === 1 ? "property" : "properties"}`
    : selectedProperties.size === 1
      ? Array.from(selectedProperties)[0]
      : `${selectedProperties.size} of ${allPropertyNames.length} properties`;

  // Filter dropdown (reused in both empty + populated states)
  const filterDropdown = (
    <div className="relative flex-1 min-w-0" ref={filterRef}>
      <button
        onClick={() => setFilterOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isFiltered ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-300 text-stone-700"} hover:border-stone-500 transition-colors`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="flex-shrink-0" />
          <span className="text-sm font-medium truncate">{filterLabel}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearFilter();
              }}
              className="text-[10px] uppercase tracking-wider font-mono text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              Clear
            </span>
          )}
          <ChevronRight
            size={14}
            className={`text-stone-400 transition-transform ${filterOpen ? "rotate-90" : ""}`}
          />
        </div>
      </button>
      {filterOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-stone-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-white border-b border-stone-100 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
              Pick properties to show
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={selectAll}
                className="text-[10px] uppercase tracking-wider font-mono text-stone-600 hover:text-stone-900"
              >
                All
              </button>
              <span className="text-stone-300">·</span>
              <button
                onClick={clearFilter}
                className="text-[10px] uppercase tracking-wider font-mono text-stone-600 hover:text-stone-900"
              >
                None
              </button>
            </div>
          </div>
          {allPropertyNames.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-stone-400 italic">
              No properties to filter.
            </div>
          ) : (
            allPropertyNames.map((name) => {
              const checked = selectedProperties.has(name);
              return (
                <label
                  key={name}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-stone-50 ${checked ? "bg-amber-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProperty(name)}
                    className="w-4 h-4 flex-shrink-0 accent-amber-700"
                  />
                  <span className="text-sm text-stone-900 truncate">
                    {name}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  // Cleaner filter dropdown — same pattern but for the "who worked where" view
  const isCleanerFiltered = selectedCleaners.size > 0;
  const cleanerFilterLabel = !isCleanerFiltered
    ? `All ${allCleanerNames.length} ${allCleanerNames.length === 1 ? "cleaner" : "cleaners"}`
    : selectedCleaners.size === 1
      ? Array.from(selectedCleaners)[0]
      : `${selectedCleaners.size} of ${allCleanerNames.length} cleaners`;
  const clearCleanerFilter = () => setSelectedCleaners(new Set());
  const selectAllCleaners = () => setSelectedCleaners(new Set(allCleanerNames));

  const cleanerFilterDropdown = (
    <div className="relative flex-1 min-w-0" ref={cleanerFilterRef}>
      <button
        onClick={() => setCleanerFilterOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isCleanerFiltered ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-300 text-stone-700"} hover:border-stone-500 transition-colors`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users size={14} className="flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {cleanerFilterLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCleanerFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearCleanerFilter();
              }}
              className="text-[10px] uppercase tracking-wider font-mono text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              Clear
            </span>
          )}
          <ChevronRight
            size={14}
            className={`text-stone-400 transition-transform ${cleanerFilterOpen ? "rotate-90" : ""}`}
          />
        </div>
      </button>
      {cleanerFilterOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-stone-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-white border-b border-stone-100 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
              Pick cleaners to show
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={selectAllCleaners}
                className="text-[10px] uppercase tracking-wider font-mono text-stone-600 hover:text-stone-900"
              >
                All
              </button>
              <span className="text-stone-300">·</span>
              <button
                onClick={clearCleanerFilter}
                className="text-[10px] uppercase tracking-wider font-mono text-stone-600 hover:text-stone-900"
              >
                None
              </button>
            </div>
          </div>
          {allCleanerNames.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-stone-400 italic">
              No cleaners to filter.
            </div>
          ) : (
            allCleanerNames.map((name) => {
              const checked = selectedCleaners.has(name);
              return (
                <label
                  key={name}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-stone-50 ${checked ? "bg-amber-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCleaner(name)}
                    className="w-4 h-4 flex-shrink-0 accent-amber-700"
                  />
                  <span className="text-sm text-stone-900 truncate">
                    {name}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  if (propertyNames.length === 0) {
    // Could be "no work at all" OR "filter excludes everything in scope"
    return (
      <div className="px-5 space-y-4">
        {allPropertyNames.length > 0 && (
          <div className="flex gap-2">
            {filterDropdown}
            {allCleanerNames.length > 0 && cleanerFilterDropdown}
          </div>
        )}
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          {isFiltered || isCleanerFiltered ? (
            <>
              No work in this period matches your filters.
              <br />
              <button
                onClick={() => {
                  clearFilter();
                  clearCleanerFilter();
                }}
                className="text-amber-700 hover:text-amber-900 underline mt-2 inline-block"
              >
                Clear filters to see all
              </button>
            </>
          ) : (
            "No work in this period."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-6">
      {/* Filters row — property + cleaner dropdowns side by side */}
      {(allPropertyNames.length > 1 || allCleanerNames.length > 1) && (
        <div className="-mt-2 flex gap-2 flex-wrap">
          {allPropertyNames.length > 1 && filterDropdown}
          {allCleanerNames.length > 1 && cleanerFilterDropdown}
        </div>
      )}
      {/* When filters are active, show a banner with exact counts so the
         user can confirm filtering is taking effect. If anything looks
         off (e.g. they expected 3 Jessica blocks but see 5), this makes
         the discrepancy visible. */}
      {(isFiltered || isCleanerFiltered) && (
        <div className="-mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-mono text-amber-900 flex items-center gap-2 flex-wrap">
          <Settings size={11} />
          <span>Filtered:</span>
          {isCleanerFiltered && (
            <span>
              {selectedCleaners.size} cleaner
              {selectedCleaners.size === 1 ? "" : "s"} (
              {Array.from(selectedCleaners).slice(0, 3).join(", ")}
              {selectedCleaners.size > 3
                ? ` +${selectedCleaners.size - 3}`
                : ""}
              )
            </span>
          )}
          {isFiltered && (
            <span>
              · {selectedProperties.size} propert
              {selectedProperties.size === 1 ? "y" : "ies"}
            </span>
          )}
          <span className="text-amber-700">
            → Showing {rows.length} of {allRows.length} work blocks
          </span>
        </div>
      )}
      {propertyNames.map((propName) => {
        const propGroups = byProperty[propName];
        const propTotalMs = propGroups.reduce(
          (sum, g) =>
            sum +
            g.entries.reduce(
              (s, e) =>
                s +
                ((e.end ? new Date(e.end) : new Date()) - new Date(e.start)),
              0,
            ),
          0,
        );
        const propTotalBillable = !showMoney
          ? 0
          : propGroups.reduce(
              (sum, g) =>
                sum +
                g.entries.reduce((s, e) => {
                  if (!e.end) return s;
                  const h = (new Date(e.end) - new Date(e.start)) / 1000 / 3600;
                  return s + h * (e.rate || 0);
                }, 0),
              0,
            );

        return (
          <div key={propName}>
            <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-stone-200">
              <h3 className="font-serif text-xl text-stone-900 flex items-center gap-2">
                <Building2 size={16} /> {propName}
              </h3>
              <div className="font-mono text-xs text-stone-500">
                {fmtTimeShort(propTotalMs)}
                {showMoney && propTotalBillable > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-emerald-700">
                      {fmtMoney(propTotalBillable)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {propGroups.map((g) => {
                const totalMs = g.entries.reduce(
                  (s, e) =>
                    s +
                    ((e.end ? new Date(e.end) : new Date()) -
                      new Date(e.start)),
                  0,
                );
                const totalBillable = !showMoney
                  ? 0
                  : g.entries.reduce((s, e) => {
                      if (!e.end) return s;
                      const h =
                        (new Date(e.end) - new Date(e.start)) / 1000 / 3600;
                      return s + h * (e.rate || 0);
                    }, 0);
                const hasLive = g.entries.some((e) => !e.end);

                return (
                  <div
                    key={`${g.unit}::${g.party}`}
                    className="bg-white border border-stone-200 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-serif text-base text-stone-900 flex items-center gap-2 flex-wrap">
                          {g.unit !== "—" && <span>{g.unit}</span>}
                          {g.party !== "—" && (
                            <span className="italic text-amber-700">
                              · {g.party}
                            </span>
                          )}
                          {hasLive && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              live
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 font-mono mt-0.5">
                          Total: {fmtTimeShort(totalMs)}
                          {showMoney && totalBillable > 0 && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="text-emerald-700 font-medium">
                                {fmtMoney(totalBillable)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Per-employee rows */}
                    <div className="mt-3 space-y-1.5">
                      {g.entries.map((e, i) => {
                        // Defense-in-depth: if a filter is active and this
                        // entry doesn't match, skip rendering. The group-
                        // building step should have already filtered, but
                        // this guards against any future regressions.
                        if (
                          isCleanerFiltered &&
                          !selectedCleaners.has(e.employee)
                        )
                          return null;
                        if (isFiltered && !selectedProperties.has(e.property))
                          return null;
                        const dur =
                          (e.end ? new Date(e.end) : new Date()) -
                          new Date(e.start);
                        const billable =
                          showMoney && e.end
                            ? (dur / 1000 / 3600) * (e.rate || 0)
                            : 0;
                        return (
                          <button
                            key={i}
                            onClick={() => onOpenShift(e.shift)}
                            className="w-full text-left flex items-center justify-between p-2 -m-2 rounded-lg hover:bg-stone-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <User
                                size={12}
                                className="text-stone-400 flex-shrink-0"
                              />
                              <span className="text-sm text-stone-900 truncate">
                                {e.employee}
                              </span>
                              <span className="text-xs text-stone-500 font-mono flex-shrink-0">
                                {fmtClock(e.start)}
                                {e.end ? `–${fmtClock(e.end)}` : " →"}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-stone-700 flex items-center gap-2 flex-shrink-0">
                              {fmtTimeShort(dur)}
                              {showMoney && billable > 0 && (
                                <span className="text-emerald-700">
                                  {fmtMoney(billable)}
                                </span>
                              )}
                              <ChevronRight
                                size={12}
                                className="text-stone-400"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
