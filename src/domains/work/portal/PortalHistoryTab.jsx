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

export function PortalHistoryTab({
  property,
  groups,
  loaded,
  filter,
  setFilter,
  onOpenUnitDay,
}) {
  // Filters — PM-appropriate. Date, building, and apartment. We
  // intentionally don't expose category/cleaner filters here because PMs
  // shouldn't be slicing by who did the work or by task type.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(""); // YYYY-MM-DD or '' for all
  const [filterBuildings, setFilterBuildings] = useState(new Set()); // multi-select of building keys
  const [apartmentSearch, setApartmentSearch] = useState("");

  // Build the set of available buildings and dates from the loaded
  // groups so the filter UI only offers options that actually have
  // cleanings. Empty Set = show all.
  const availableBuildings = (() => {
    const set = new Set();
    groups.forEach((g) =>
      g.units.forEach((u) => {
        const b = buildingFromLabel(u.label);
        if (b) set.add(b);
      }),
    );
    return [...set].sort(naturalCompare);
  })();
  const availableDates = (() => {
    const set = new Set();
    groups.forEach((g) => set.add(g.date));
    return [...set].sort().reverse(); // newest first
  })();

  // Apply filters to the displayed groups. Order: date → building →
  // apartment. We filter inside each group rather than dropping whole
  // dates so the user can see exactly which units match across a date.
  const aq = apartmentSearch.trim().toLowerCase();
  const filteredGroups = groups
    .filter((g) => !filterDate || g.date === filterDate)
    .map((g) => ({
      ...g,
      units: g.units.filter((u) => {
        if (filterBuildings.size > 0) {
          const b = buildingFromLabel(u.label);
          if (!b || !filterBuildings.has(b)) return false;
        }
        if (aq) {
          if (!(u.label || "").toLowerCase().includes(aq)) return false;
        }
        return true;
      }),
    }))
    .filter((g) => g.units.length > 0);

  const activeFilterCount =
    (filterDate ? 1 : 0) + filterBuildings.size + (aq ? 1 : 0);
  const toggleBuilding = (b) =>
    setFilterBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  const clearFilters = () => {
    setFilterDate("");
    setFilterBuildings(new Set());
    setApartmentSearch("");
  };

  // Stats use filtered groups so the numbers reflect what's actually
  // on screen — otherwise the PM sees "12 cleanings" while only 3 rows
  // are visible after filtering.
  const totalPhotos = filteredGroups.reduce(
    (sum, g) => sum + g.units.reduce((s, u) => s + u.photoCount, 0),
    0,
  );
  const damageCount = filteredGroups.reduce(
    (sum, g) => sum + g.units.filter((u) => u.hasDamage).length,
    0,
  );
  const resolvedDamageCount = filteredGroups.reduce(
    (sum, g) => sum + g.units.filter((u) => u.hasResolvedDamage).length,
    0,
  );
  const totalCleanings = filteredGroups.reduce(
    (sum, g) => sum + g.units.length,
    0,
  );
  const cannotCount = filteredGroups.reduce(
    (sum, g) => sum + g.units.filter((u) => u.hasCannot).length,
    0,
  );
  // Build the list of damage entries (date + unit) for the expandable view
  const damageEntries = [];
  const resolvedDamageEntries = [];
  filteredGroups.forEach((g) =>
    g.units.forEach((u) => {
      if (u.hasDamage)
        damageEntries.push({ date: g.date, unitId: u.unitId, label: u.label });
      if (u.hasResolvedDamage)
        resolvedDamageEntries.push({
          date: g.date,
          unitId: u.unitId,
          label: u.label,
        });
    }),
  );
  const [damageExpanded, setDamageExpanded] = useState(false);
  const [damageSubTab, setDamageSubTab] = useState("active"); // 'active' | 'resolved'

  return (
    <div className="px-5 pt-6">
      <ScreenId id="PM-HOME" />
      {/* Sticky damage indicator — pins to the top of the viewport when the
         PM scrolls past the stats row, so they never lose sight of active
         damage while reviewing the cleaning history below. Hidden when no
         active damage. Clicking it expands the same drill-down list. */}
      {damageCount > 0 && (
        <button
          onClick={() => setDamageExpanded((e) => !e)}
          className="sticky top-0 z-30 -mx-5 mb-3 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white flex items-center justify-between gap-3 shadow-md active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {damageCount} {damageCount === 1 ? "unit has" : "units have"}{" "}
              active damage
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono opacity-90 flex-shrink-0 flex items-center gap-0.5">
            {damageExpanded ? "Hide" : "View"}
            <ChevronRight
              size={12}
              className={`transition-transform ${damageExpanded ? "rotate-90" : ""}`}
            />
          </span>
        </button>
      )}

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
            Cleanings
          </div>
          <div className="text-2xl font-serif">{totalCleanings}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
            Photos
          </div>
          <div className="text-2xl font-serif">{totalPhotos}</div>
        </div>
        <button
          onClick={() => {
            if (damageCount === 0 && resolvedDamageCount === 0) return;
            // If there's no active damage but there IS past damage, default sub-tab to resolved
            if (damageCount === 0 && resolvedDamageCount > 0)
              setDamageSubTab("resolved");
            else setDamageSubTab("active");
            setDamageExpanded((e) => !e);
          }}
          disabled={damageCount === 0 && resolvedDamageCount === 0}
          className={`p-4 rounded-2xl border text-left transition-all ${damageCount > 0 ? "bg-red-50 border-red-200 hover:border-red-400 cursor-pointer active:scale-[0.98]" : resolvedDamageCount > 0 ? "bg-white border-stone-200 hover:border-stone-400 cursor-pointer active:scale-[0.98]" : "bg-white border-stone-200 cursor-default"}`}
        >
          <div className={`flex items-center justify-between mb-1`}>
            <div
              className={`text-xs uppercase tracking-wider font-mono ${damageCount > 0 ? "text-red-700" : "text-stone-500"}`}
            >
              Damage
              {resolvedDamageCount > 0 && damageCount === 0 ? " (past)" : ""}
            </div>
            {(damageCount > 0 || resolvedDamageCount > 0) && (
              <ChevronRight
                size={12}
                className={`${damageCount > 0 ? "text-red-700" : "text-stone-500"} transition-transform ${damageExpanded ? "rotate-90" : ""}`}
              />
            )}
          </div>
          <div
            className={`text-2xl font-serif ${damageCount > 0 ? "text-red-800" : ""}`}
          >
            {damageCount}
          </div>
          {resolvedDamageCount > 0 && damageCount > 0 && (
            <div className="text-[10px] font-mono text-stone-500 mt-0.5">
              + {resolvedDamageCount} resolved
            </div>
          )}
        </button>
      </div>

      {/* Damage drill-down: Active and Resolved sub-tabs let PMs scan
         current issues OR browse past resolved damage without diving
         into each unit-day. Open when expanded AND there's something
         to show in either bucket. */}
      {damageExpanded && (damageCount > 0 || resolvedDamageCount > 0) && (
        <div className="mb-4 p-4 rounded-2xl bg-red-50/50 border-2 border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-mono text-red-700 flex items-center gap-1.5">
              <AlertCircle size={12} /> Damage report
            </div>
            <button
              onClick={() => setDamageExpanded(false)}
              className="text-[10px] text-red-700 hover:text-red-900 font-mono uppercase tracking-wider"
            >
              Hide
            </button>
          </div>

          {/* Sub-tab toggle: Active vs Resolved */}
          <div className="flex items-center gap-1 p-1 bg-white/70 rounded-xl mb-3">
            <button
              onClick={() => setDamageSubTab("active")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${damageSubTab === "active" ? "bg-red-600 text-white shadow-sm" : "text-red-700 hover:bg-red-100"}`}
            >
              Active
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${damageSubTab === "active" ? "bg-white/20 text-white" : "bg-red-100 text-red-800"}`}
              >
                {damageCount}
              </span>
            </button>
            <button
              onClick={() => setDamageSubTab("resolved")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${damageSubTab === "resolved" ? "bg-stone-600 text-white shadow-sm" : "text-stone-700 hover:bg-stone-100"}`}
            >
              Past (resolved)
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${damageSubTab === "resolved" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-800"}`}
              >
                {resolvedDamageCount}
              </span>
            </button>
          </div>

          {damageSubTab === "active" ? (
            damageEntries.length === 0 ? (
              <div className="text-center py-4 text-[11px] text-stone-500 italic">
                No active damage in this period. 🎉
              </div>
            ) : (
              <div className="space-y-1.5">
                {damageEntries.map((e, i) => (
                  <button
                    key={`active-${e.date}-${e.unitId || i}`}
                    onClick={() => onOpenUnitDay(e.unitId, e.date)}
                    className="w-full p-3 rounded-xl bg-white border border-red-200 hover:border-red-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-900 text-sm truncate">
                        {e.label}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono">
                        {new Date(e.date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { weekday: "short", month: "short", day: "numeric" },
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-mono text-red-700 flex-shrink-0">
                      Resolve →
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : resolvedDamageEntries.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-stone-500 italic">
              No resolved damage in this period.
            </div>
          ) : (
            <div className="space-y-1.5">
              {resolvedDamageEntries.map((e, i) => (
                <button
                  key={`resolved-${e.date}-${e.unitId || i}`}
                  onClick={() => onOpenUnitDay(e.unitId, e.date)}
                  className="w-full p-3 rounded-xl bg-white border border-stone-200 hover:border-stone-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900 text-sm truncate flex items-center gap-1.5">
                      <Check
                        size={12}
                        className="text-emerald-600 flex-shrink-0"
                      />
                      {e.label}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {new Date(e.date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-mono text-stone-600 flex-shrink-0">
                    View →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex gap-2 mt-3 flex-wrap">
        {[
          { id: "7d", label: "7 days" },
          { id: "30d", label: "30 days" },
          { id: "1y", label: "1 year" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f.id
                ? "bg-stone-900 text-stone-50"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filters panel — PM-appropriate: date / building / apartment.
         The date list only shows dates where cleanings were actually
         done (the "signify which dates have work" affordance), with
         counts so the PM knows how many units to expect. Building and
         apartment filters narrow the list further. */}
      {groups.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${activeFilterCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
          >
            <div className="flex items-center gap-2">
              <Settings size={14} />
              <span className="text-xs uppercase tracking-wider font-mono">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
              <span className="text-[10px] font-mono text-stone-500">
                Showing {filteredGroups.reduce((s, g) => s + g.units.length, 0)}{" "}
                of {groups.reduce((s, g) => s + g.units.length, 0)}
              </span>
            </div>
            <ChevronRight
              size={14}
              className={`transition-transform ${filtersOpen ? "rotate-90" : ""}`}
            />
          </button>
          {filtersOpen && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mt-1 space-y-3">
              {/* Date filter — list of dates with cleanings, count each.
                 Single-select: tap a date to drill down, tap again to clear. */}
              {availableDates.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    Dates with cleanings ({availableDates.length})
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {availableDates.map((date) => {
                      const dateGroup = groups.find((g) => g.date === date);
                      const count = dateGroup?.units.length || 0;
                      const isActive = filterDate === date;
                      return (
                        <button
                          key={date}
                          onClick={() => setFilterDate(isActive ? "" : date)}
                          className={`px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${isActive ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-200 text-stone-700 hover:border-stone-400"}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono truncate">
                              {new Date(date + "T12:00:00").toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  weekday: "short",
                                },
                              )}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? "bg-stone-700 text-stone-100" : "bg-emerald-100 text-emerald-800"}`}
                            >
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Building filter — chips, multi-select. Only shown when
                 there's more than one building in the data. */}
              {availableBuildings.length > 1 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                    Building
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {availableBuildings.map((b) => {
                      const active = filterBuildings.has(b);
                      return (
                        <button
                          key={b}
                          onClick={() => toggleBuilding(b)}
                          className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 transition-colors ${active ? "bg-stone-900 text-stone-50" : "bg-white border border-stone-300 text-stone-600 hover:border-stone-500"}`}
                        >
                          {active && <Check size={10} />}
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Apartment search — fast text filter on unit label. */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1.5">
                  Apartment
                </div>
                <input
                  type="text"
                  value={apartmentSearch}
                  onChange={(e) => setApartmentSearch(e.target.value)}
                  placeholder="e.g. 305"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:border-stone-900"
                />
              </div>

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

      {!loaded ? (
        <Splash text="Loading…" />
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No cleanings in this period.
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No cleanings match the current filters.
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="block mx-auto mt-2 text-xs text-stone-700 hover:text-stone-900 font-mono underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map((g) => (
            <div key={g.date}>
              <div className="text-sm font-mono text-stone-500 mb-2 uppercase tracking-wider">
                {new Date(g.date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="space-y-2">
                {g.units.map((u) => (
                  <button
                    key={`${g.date}-${u.unitId || "simple"}`}
                    onClick={() => onOpenUnitDay(u.unitId, g.date)}
                    className={`w-full text-left p-4 rounded-2xl border transition-colors relative overflow-hidden ${
                      u.hasDamage
                        ? "bg-red-50 border-red-300 hover:border-red-500 border-l-4 border-l-red-600"
                        : u.hasCannot
                          ? "bg-yellow-50 border-yellow-300 hover:border-yellow-500 border-l-4 border-l-yellow-500"
                          : u.hasResolvedDamage || u.hasResolvedCannot
                            ? "bg-white border-stone-200 hover:border-stone-400 border-l-4 border-l-emerald-500"
                            : "bg-white border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {u.hasDamage && (
                            <AlertCircle
                              size={16}
                              className="text-red-600 flex-shrink-0"
                            />
                          )}
                          {!u.hasDamage && u.hasCannot && (
                            <AlertCircle
                              size={16}
                              className="text-yellow-600 flex-shrink-0"
                            />
                          )}
                          {!u.hasDamage &&
                            !u.hasCannot &&
                            (u.hasResolvedDamage || u.hasResolvedCannot) && (
                              <Check
                                size={16}
                                className="text-emerald-600 flex-shrink-0"
                              />
                            )}
                          <span
                            className={`font-serif text-lg ${u.hasDamage ? "text-red-900" : "text-stone-900"}`}
                          >
                            {u.label}
                          </span>
                          {u.hasDamage && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">
                              ⚠ Damage
                            </span>
                          )}
                          {u.hasCannot && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-yellow-500 text-stone-900 font-bold">
                              ⚠ Couldn't clean
                            </span>
                          )}
                          {!u.hasDamage &&
                            !u.hasCannot &&
                            u.hasResolvedCannot && (
                              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Couldn't clean · resolved
                              </span>
                            )}
                          {!u.hasDamage && u.hasResolvedDamage && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Damage resolved
                            </span>
                          )}
                          {u.hasDamage && u.hasResolvedDamage && (
                            <span
                              className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200"
                              title="This cleaning also had past damage that was resolved"
                            >
                              + past
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs font-mono mt-1 ${u.hasDamage ? "text-red-700" : u.hasCannot ? "text-yellow-800" : "text-stone-500"}`}
                        >
                          {u.photoCount}{" "}
                          {u.photoCount === 1 ? "photo" : "photos"}
                          {u.hasDamage || u.hasCannot
                            ? " · tap to resolve"
                            : ""}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`flex-shrink-0 ${u.hasDamage ? "text-red-600" : u.hasCannot ? "text-yellow-600" : "text-stone-400"}`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
