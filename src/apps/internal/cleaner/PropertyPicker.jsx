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
import { sessionStore } from "../../../domains/auth/sessionStore.js";
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
import { ItemsDropdown } from "./ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "../../../domains/work/cleaner/LeaveWorkblockModal.jsx";

export function PropertyPicker({
  onPick,
  onCancel,
  busy,
  title,
  subtitle,
  viewOnly = false,
  employee,
}) {
  const [properties, setProperties] = useState([]);
  const [assignmentCounts, setAssignmentCounts] = useState({}); // { customer_id: number }
  const [dateCounts, setDateCounts] = useState({}); // { dateKey|'__none__': { customer_id: count } }
  const [loaded, setLoaded] = useState(false);
  const [showAllOthers, setShowAllOthers] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      // Load active properties AND open assignment counts in parallel.
      // The count is **unique bedrooms** with open work, not the raw
      // assignment_target row count. One bedroom can have 20 items but
      // it's still ONE bedroom that needs cleaning — that's the number
      // the cleaner cares about ("which apartments have work?"), not
      // the item-level total.
      const [propsRes, targetsRes] = await Promise.all([
        supabase.from("customers").select("*").eq("active", true).order("name"),
        supabase
          .from("assignment_targets")
          .select(
            "unit_id, party_id, status, assignment:assignments!inner(customer_id, active, scheduled_date, deleted_at)",
          )
          .not("status", "in", "(done,blocked)"),
      ]);
      const counts = {};
      const seenBedrooms = new Set();
      const dateBedrooms = {}; // dateKey -> propId -> Set(bedroomKey)
      (targetsRes.data || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.active === false || a.deleted_at) return;
        const cid = a.customer_id;
        if (!cid) return;
        const bKey = `${t.unit_id || ""}::${t.party_id || ""}`;
        const key = `${cid}::${bKey}`;
        if (!seenBedrooms.has(key)) {
          seenBedrooms.add(key);
          counts[cid] = (counts[cid] || 0) + 1;
        }
        // Per-date bucket (undated work groups under '__none__').
        const dk = a.scheduled_date || "__none__";
        dateBedrooms[dk] = dateBedrooms[dk] || {};
        dateBedrooms[dk][cid] = dateBedrooms[dk][cid] || new Set();
        dateBedrooms[dk][cid].add(bKey);
      });
      const dc = {};
      Object.entries(dateBedrooms).forEach(([dk, byProp]) => {
        dc[dk] = {};
        Object.entries(byProp).forEach(([cid, set]) => {
          dc[dk][cid] = set.size;
        });
      });
      setProperties(visibleProps(propsRes.data || [], employee));
      setAssignmentCounts(counts);
      setDateCounts(dc);
      setLoaded(true);
    })();
  }, []);

  // Split into two buckets: properties with open assignments (top) and
  // everything else (collapsed dropdown). Both lists are alphabetical
  // by name.
  const q = search.trim().toLowerCase();
  const matchesSearch = (p) =>
    !q ||
    (p.name || "").toLowerCase().includes(q) ||
    (p.address || "").toLowerCase().includes(q);
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  // Group properties under the dates their open work is scheduled for.
  // Dated groups sort ascending (soonest/overdue first); undated work
  // drops into its own group at the bottom, then properties with no
  // open assignments.
  const rowsForBucket = (bucket) =>
    Object.keys(bucket || {})
      .map((cid) => propById[cid])
      .filter((p) => p && matchesSearch(p))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map((p) => ({ p, count: bucket[p.id] }));

  const dateSections = Object.keys(dateCounts)
    .filter((k) => k !== "__none__")
    .sort()
    .map((dk) => ({ dateKey: dk, rows: rowsForBucket(dateCounts[dk]) }))
    .filter((s) => s.rows.length > 0);
  const noDateRows = rowsForBucket(dateCounts["__none__"]);
  const others = properties
    .filter((p) => (assignmentCounts[p.id] || 0) === 0 && matchesSearch(p))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const fmtSchedDate = (key) => {
    const today = localTodayKey();
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tmr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    if (key === today) return "Today";
    if (key === tmr) return "Tomorrow";
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Reusable row renderer — count is the number due in this context.
  const PropertyRow = ({ p, count }) => {
    const c = count != null ? count : assignmentCounts[p.id] || 0;
    return (
      <button
        key={p.id}
        onClick={() => onPick(p)}
        disabled={busy}
        className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-serif text-lg text-stone-900">
                {p.name}
              </span>
              {p.property_type === "multi_unit" && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Multi-unit
                </span>
              )}
              {c > 0 && (
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white flex items-center gap-1 font-bold">
                  <FileText size={10} /> {c} bedroom{c === 1 ? "" : "s"} to
                  clean
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
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            {subtitle || "Clock in"}
          </div>
          <div className="font-serif text-xl text-stone-900">
            {title || "Pick a property"}
          </div>
        </div>
      </div>
      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {!loaded ? (
          <Splash text="Loading…" />
        ) : (
          <>
            {properties.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                No properties yet.
              </div>
            ) : (
              <>
                {/* Search box for quick filtering when there are many properties */}
                {properties.length > 3 && (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        if (e.target.value && others.length > 0)
                          setShowAllOthers(true);
                      }}
                      placeholder={`Search ${properties.length} properties…`}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
                    />
                  </div>
                )}
                {/* Scheduled work, grouped by the date it's due. Tapping a
                   property still clocks the cleaner in there as normal. */}
                {dateSections.map((section) => (
                  <div key={section.dateKey} className="mb-6">
                    <div className="text-xs uppercase tracking-wider text-amber-700 font-mono mb-2 flex items-center gap-1.5">
                      <Calendar size={11} /> {fmtSchedDate(section.dateKey)}
                    </div>
                    <div className="space-y-2">
                      {section.rows.map(({ p, count }) => (
                        <PropertyRow key={p.id} p={p} count={count} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Open work with no scheduled date — kept at the bottom. */}
                {noDateRows.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 flex items-center gap-1.5">
                      <FileText size={11} /> No date set
                    </div>
                    <div className="space-y-2">
                      {noDateRows.map(({ p, count }) => (
                        <PropertyRow key={p.id} p={p} count={count} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Below: everything else, alphabetical, hidden behind
                   a toggle to keep the screen short when there are
                   lots of properties. */}
                {others.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowAllOthers((s) => !s)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 size={14} />
                        <span className="text-sm font-medium">
                          {dateSections.length > 0 || noDateRows.length > 0
                            ? "Other properties"
                            : "All properties"}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          ({others.length})
                        </span>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`text-stone-500 transition-transform ${showAllOthers ? "rotate-90" : ""}`}
                      />
                    </button>
                    {showAllOthers && (
                      <div className="space-y-2 mt-2">
                        {others.map((p) => (
                          <PropertyRow key={p.id} p={p} count={0} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {!viewOnly && (
              <button
                onClick={() => onPick(null)}
                disabled={busy}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-stone-300 text-stone-600 text-sm hover:border-stone-500 disabled:opacity-50"
              >
                Skip — clock in without a property
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
