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
import { AssignmentViewer } from "../cross-cutting/AssignmentViewer.jsx";
import { BedroomHistoryView } from "./BedroomHistoryView.jsx";
import { ChecklistAssignmentView } from "../cross-cutting/ChecklistAssignmentView.jsx";

export function AssignedVsCleanedView({
  employee,
  onBack,
  onOpenBedroomHistory,
  persistedState,
  onStateChange,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoDate = (d) => d.toISOString().split("T")[0];
  // Initialize state from the parent-held persistedState. This is what
  // lets the audit's filters / property / dates survive a round trip to
  // BedroomHistoryView and back. Falls back to today / empty on first
  // mount when persistedState defaults are still in place.
  const [start, setStart] = useState(persistedState?.start || isoDate(today));
  const [end, setEnd] = useState(persistedState?.end || isoDate(today));
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    persistedState?.selectedPropertyId || "",
  );
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(null); // assignment_target for Quick glance
  // Sub-filters — chips that appear AFTER the initial date+property
  // filters have populated rows. Multi-select; empty = "all".
  //   filterBuildings — which building prefixes (B1, B7…) to show
  //   filterStatuses  — 'done' | 'partial' | 'not_started'
  // Collapsed buildings are tracked separately so the user can hide
  // ones they don't care about.
  const [filterBuildings, setFilterBuildings] = useState(
    new Set(persistedState?.filterBuildings || []),
  );
  const [filterStatuses, setFilterStatuses] = useState(
    new Set(persistedState?.filterStatuses || []),
  );
  const [collapsedBuildings, setCollapsedBuildings] = useState(
    new Set(persistedState?.collapsedBuildings || []),
  );
  // Reset all sub-state when the data set changes so the chips don't
  // reference values that no longer exist. Skip the first mount so we
  // don't immediately wipe whatever persistedState we just restored —
  // useEffect always fires once with the initial values, which would
  // otherwise blank the filters as the component remounts after a
  // BedroomHistoryView round trip.
  const isInitialResetMountRef = useRef(true);
  useEffect(() => {
    if (isInitialResetMountRef.current) {
      isInitialResetMountRef.current = false;
      return;
    }
    setFilterBuildings(new Set());
    setFilterStatuses(new Set());
    setCollapsedBuildings(new Set());
  }, [selectedPropertyId, start, end]);

  // Push every state change up to the parent so it persists across
  // unmount/remount cycles. Sets are serialized to plain arrays so
  // React state comparisons stay shallow + cheap.
  useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange((prev) => ({
        ...(prev || {}),
        start,
        end,
        selectedPropertyId,
        filterBuildings: [...filterBuildings],
        filterStatuses: [...filterStatuses],
        collapsedBuildings: [...collapsedBuildings],
      }));
    }
  }, [
    start,
    end,
    selectedPropertyId,
    filterBuildings,
    filterStatuses,
    collapsedBuildings,
  ]);

  // Restore scroll position from the persisted state on first mount,
  // then save current scrollY back to it on unmount so a return trip
  // from BedroomHistoryView lands in the same place.
  useEffect(() => {
    if (persistedState?.scrollY) {
      // Defer to next tick so the rows have rendered before scrolling.
      setTimeout(() => window.scrollTo(0, persistedState.scrollY), 0);
    }
    return () => {
      if (typeof onStateChange === "function") {
        onStateChange((prev) => ({ ...(prev || {}), scrollY: window.scrollY }));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Building prefix extracted from a unit label. "B1-101" → "B1",
  // "B7-326" → "B7". If there's no dash we fall back to the whole
  // label (which is rare).
  const buildingFromLabel = (unitLabel) => {
    if (!unitLabel) return "—";
    const idx = unitLabel.indexOf("-");
    if (idx > 0) return unitLabel.slice(0, idx);
    const m = unitLabel.match(/^([A-Za-z]+)\d/);
    return m ? m[1].toUpperCase() : unitLabel;
  };
  // Status bucket for a row (matches the top summary chips).
  const statusOfRow = (r) => {
    if (r.total === 0) return null;
    if (r.doneAnyTime === 0) return "not_started";
    if (r.doneAnyTime >= r.total) return "done";
    return "partial";
  };

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

  // Build the per-bedroom comparison:
  //   - For each (unit, party) at the chosen property with any active
  //     assignment in the range, count total items and items that
  //     completed within the range.
  //   - Status icon derived from done/total counts.
  const load = async () => {
    if (!selectedPropertyId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    setBusy(true);
    try {
      const startISO = new Date(start + "T00:00:00").toISOString();
      const endISO = new Date(end + "T23:59:59.999").toISOString();
      // Pull every active assignment target at this property along
      // with completion data. We filter visibility in-memory so the
      // range filter only applies to the COMPLETED side.
      const { data } = await supabase
        .from("assignment_targets")
        .select(
          `
          id, status, completed_at, recheck_passed_at, template_section, template_item_key, status_notes,
          unit:units(id, label),
          party:parties(id, label),
          assignment:assignments!inner(id, title, assignment_type, customer_id, active, source, pm_status, deleted_at, file_url, file_kind)
        `,
        )
        .eq("assignment.customer_id", selectedPropertyId);
      const targets = (data || []).filter(
        (t) =>
          t.assignment?.customer_id === selectedPropertyId &&
          t.assignment?.active &&
          !t.assignment?.deleted_at &&
          isPmApprovedAssignment(t.assignment),
      );
      const startMs = new Date(startISO).getTime();
      const endMs = new Date(endISO).getTime();
      // Group by (unit, party). For each: total, doneInRange, doneAnyTime, sampleTarget for quick glance.
      const groups = new Map();
      for (const t of targets) {
        // Date-range filter: items completed BEFORE the start of the
        // chosen range aren't relevant to "what was left to clean as
        // of this range". Skip them so a "today" view doesn't show
        // items completed yesterday as already-done — they were
        // already accounted for in a previous report. Items still
        // pending / paused / in_progress always count (regardless of
        // when they were created) since they're still outstanding.
        if (t.status === "done" && t.completed_at) {
          const completedMs = new Date(t.completed_at).getTime();
          if (completedMs < startMs) continue;
        }
        const uId = t.unit?.id || "_no_unit";
        const pId = t.party?.id || "_no_party";
        const key = `${uId}::${pId}`;
        if (!groups.has(key))
          groups.set(key, {
            key,
            unitId: t.unit?.id,
            unitLabel: t.unit?.label || "Unit",
            partyId: t.party?.id,
            partyLabel: t.party?.label || "Bedroom",
            total: 0,
            doneInRange: 0,
            doneAnyTime: 0,
            blockedCount: 0,
            sampleTarget: t,
            assignmentType: t.assignment?.assignment_type,
            hasFile: !!t.assignment?.file_url,
          });
        const g = groups.get(key);
        g.total += 1;
        if (t.status === "done") {
          g.doneAnyTime += 1;
          if (t.completed_at) {
            const ts = new Date(t.completed_at).getTime();
            if (ts >= startMs && ts <= endMs) g.doneInRange += 1;
          }
        }
        // Blocked items count toward "done" for the audit — the cleaner
        // is finished dealing with them (just waiting on owner review),
        // not still pending. We also track blockedCount separately so
        // the row can surface a visible Blocked badge instead of just
        // a green check pretending nothing's wrong.
        if (t.status === "blocked") {
          g.doneAnyTime += 1;
          g.doneInRange += 1; // blocked is always "in-range" — it's still active
          g.blockedCount += 1;
        }
      }
      // Sort naturally by unit label then bedroom label
      const sorted = Array.from(groups.values()).sort(
        (a, b) =>
          naturalCompare(a.unitLabel, b.unitLabel) ||
          naturalCompare(a.partyLabel, b.partyLabel),
      );
      setRows(sorted);
    } catch (e) {
      console.warn("[AssignedVsCleaned] load failed", e);
      setRows([]);
    }
    setLoaded(true);
    setBusy(false);
  };
  useEffect(() => {
    load();
  }, [selectedPropertyId, start, end]);

  // Permission flags + bedroom-level bulk actions for blocked items.
  // Audit is owner-side, but we still gate Mark done by permission
  // (owner / manager always; cleaners need explicit can() permission).
  // Reopen is more permissive — anyone with an employee identity.
  const isStaff = employee?.role === "owner" || employee?.role === "manager";
  const canMarkDone = isStaff || can(employee, "mark_assignments_done");
  const canReopen = !!employee?.id;

  // Bulk update every relevant item at this bedroom. Used by the
  // inline Reopen / Mark done buttons on each audit row so the owner
  // can resolve a whole bedroom in one tap.
  //
  // For "done": targets any item NOT already done (pending, paused,
  // in_progress, blocked) and flips it to done.
  // For "pending": targets any item NOT already pending (in_progress,
  // paused, blocked, done) and resets it.
  const bulkUpdateAllAtBedroom = async (g, newStatus) => {
    if (!g.unitId || !g.partyId) return;
    // Pre-check what we'd actually change so the confirm prompt and
    // skip-on-empty path are accurate.
    const { data: existing } = await supabase
      .from("assignment_targets")
      .select(
        "id, status, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
      )
      .eq("unit_id", g.unitId)
      .eq("party_id", g.partyId);
    const scoped = (existing || []).filter(
      (t) =>
        t.assignment?.customer_id === selectedPropertyId &&
        t.assignment?.active &&
        !t.assignment?.deleted_at &&
        isPmApprovedAssignment(t.assignment),
    );
    const targets = scoped.filter((t) => t.status !== newStatus);
    if (targets.length === 0) {
      alert(
        `Nothing to change — every item at ${g.unitLabel} · ${g.partyLabel} is already ${newStatus === "done" ? "done" : "pending"}.`,
      );
      return;
    }
    if (
      !confirm(
        newStatus === "done"
          ? `Mark all ${targets.length} item${targets.length === 1 ? "" : "s"} at ${g.unitLabel} · ${g.partyLabel} as done?`
          : `Send all ${targets.length} item${targets.length === 1 ? "" : "s"} at ${g.unitLabel} · ${g.partyLabel} back to pending?`,
      )
    )
      return;
    setBusy(true);
    try {
      const ids = targets.map((t) => t.id);
      const patch = { status: newStatus };
      if (newStatus === "done") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = employee?.id || null;
      } else if (newStatus === "pending") {
        // Clear blocker reason + start stamps so reopened items start
        // truly fresh. Audit trail (photos, history) is preserved
        // elsewhere — we're not destroying anything.
        patch.status_notes = null;
        patch.started_at = null;
        patch.started_by = null;
        patch.completed_at = null;
        patch.completed_by = null;
      }
      await supabase.from("assignment_targets").update(patch).in("id", ids);
    } catch (e) {
      alert("Could not update: " + (e.message || e));
    }
    setBusy(false);
    load();
  };

  // Status helper — returns { icon, color, label }. Blocked items
  // count toward "done" so a bedroom is never marked as red X just
  // because the cleaner had to flag something — they're done dealing
  // with it. A separate amber "Blocked" state surfaces when one or
  // more items at the bedroom are blocked so the owner knows review
  // is needed without losing the "completed" signal.
  const statusFor = (g) => {
    if (g.total === 0)
      return {
        Icon: Square,
        color: "text-stone-300",
        bg: "bg-stone-50",
        label: "No items",
      };
    if (g.doneAnyTime === 0)
      return {
        Icon: X,
        color: "text-red-600",
        bg: "bg-red-50",
        label: "Nothing started",
      };
    if (g.doneAnyTime >= g.total) {
      if (g.blockedCount > 0) {
        return {
          Icon: AlertCircle,
          color: "text-amber-700",
          bg: "bg-amber-50",
          label: "Done with blockers",
        };
      }
      return {
        Icon: Check,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        label: "All done",
      };
    }
    return {
      Icon: Circle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      label: "Partial",
    };
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">
              Audit
            </div>
            <div className="font-serif text-lg text-stone-900">
              Assigned vs cleaned
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 max-w-3xl mx-auto">
        {/* Date range — single day allowed (start = end). Quick
           presets help skip to common windows. */}
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
                onClick={() => {
                  const e = new Date();
                  e.setHours(0, 0, 0, 0);
                  const s = new Date(e);
                  s.setDate(s.getDate() - (p.d - 1));
                  setStart(isoDate(s));
                  setEnd(isoDate(e));
                }}
                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        {/* Property selector — required. Without it we'd be summing
           thousands of bedrooms which isn't useful. */}
        <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">
            Property
          </div>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="">— Pick a property —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Results list */}
        {!selectedPropertyId ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            Pick a property to see the audit.
          </div>
        ) : busy && !loaded ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No active assignments at this property.
          </div>
        ) : (
          (() => {
            // Compute available chips + filtered rows + grouped data here
            // so we can use the results downstream without re-deriving.
            const availableBuildings = (() => {
              const set = new Set();
              rows.forEach((r) => set.add(buildingFromLabel(r.unitLabel)));
              return Array.from(set).sort(naturalCompare);
            })();
            const presentStatuses = (() => {
              const set = new Set();
              rows.forEach((r) => {
                const s = statusOfRow(r);
                if (s) set.add(s);
              });
              return ["done", "partial", "not_started"].filter((s) =>
                set.has(s),
              );
            })();
            const filteredRows = rows.filter((r) => {
              if (
                filterBuildings.size > 0 &&
                !filterBuildings.has(buildingFromLabel(r.unitLabel))
              )
                return false;
              if (filterStatuses.size > 0) {
                const s = statusOfRow(r);
                if (!s || !filterStatuses.has(s)) return false;
              }
              return true;
            });
            const grouped = (() => {
              const m = new Map();
              filteredRows.forEach((r) => {
                const b = buildingFromLabel(r.unitLabel);
                if (!m.has(b)) m.set(b, []);
                m.get(b).push(r);
              });
              return Array.from(m.entries()).sort((a, b) =>
                naturalCompare(a[0], b[0]),
              );
            })();
            const toggleSetVal = (setter) => (val) =>
              setter((prev) => {
                const next = new Set(prev);
                if (next.has(val)) next.delete(val);
                else next.add(val);
                return next;
              });
            const toggleBuilding = toggleSetVal(setFilterBuildings);
            const toggleStatus = toggleSetVal(setFilterStatuses);
            const toggleCollapsed = toggleSetVal(setCollapsedBuildings);
            const statusLabels = {
              done: "Fully done",
              partial: "Partial",
              not_started: "Not started",
            };
            const statusColors = {
              done: "bg-emerald-100 text-emerald-800 border-emerald-300",
              partial: "bg-amber-100 text-amber-800 border-amber-300",
              not_started: "bg-red-100 text-red-800 border-red-300",
            };
            return (
              <>
                {/* Sub-filters — appear only after the initial query has
               populated rows. Buildings + statuses derived from the
               actual data so chips never reference values that don't
               exist. Multi-select; empty = "show all". */}
                {(availableBuildings.length > 1 ||
                  presentStatuses.length > 1) && (
                  <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
                    {availableBuildings.length > 1 && (
                      <div className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">
                          Buildings{" "}
                          {filterBuildings.size === 0 && (
                            <span className="text-stone-400">
                              (showing all)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {availableBuildings.map((b) => {
                            const active = filterBuildings.has(b);
                            return (
                              <button
                                key={b}
                                onClick={() => toggleBuilding(b)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-colors ${active ? "bg-stone-900 border-stone-900 text-stone-50" : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"}`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {presentStatuses.length > 1 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">
                          Status{" "}
                          {filterStatuses.size === 0 && (
                            <span className="text-stone-400">
                              (showing all)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {presentStatuses.map((s) => {
                            const active = filterStatuses.has(s);
                            return (
                              <button
                                key={s}
                                onClick={() => toggleStatus(s)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-colors ${active ? statusColors[s] : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
                              >
                                {statusLabels[s]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Top-level summary — reflects FILTERED rows so the
               numbers match what's actually visible below. */}
                <div className="rounded-2xl bg-white border border-stone-200 p-4 mb-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-2xl font-mono font-light text-emerald-700">
                        {
                          filteredRows.filter(
                            (r) => r.doneAnyTime >= r.total && r.total > 0,
                          ).length
                        }
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-0.5">
                        Fully done
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-mono font-light text-amber-700">
                        {
                          filteredRows.filter(
                            (r) => r.doneAnyTime > 0 && r.doneAnyTime < r.total,
                          ).length
                        }
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-0.5">
                        Partial
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-mono font-light text-red-700">
                        {
                          filteredRows.filter(
                            (r) => r.doneAnyTime === 0 && r.total > 0,
                          ).length
                        }
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-0.5">
                        Not started
                      </div>
                    </div>
                  </div>
                </div>

                {filteredRows.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                    Nothing matches those filters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grouped.map(([buildingName, buildingRows]) => {
                      const isCollapsed = collapsedBuildings.has(buildingName);
                      // Per-building totals so the header doubles as a summary
                      const bDone = buildingRows.filter(
                        (r) => r.doneAnyTime >= r.total && r.total > 0,
                      ).length;
                      const bPartial = buildingRows.filter(
                        (r) => r.doneAnyTime > 0 && r.doneAnyTime < r.total,
                      ).length;
                      const bNotStarted = buildingRows.filter(
                        (r) => r.doneAnyTime === 0 && r.total > 0,
                      ).length;
                      return (
                        <div
                          key={buildingName}
                          className="rounded-2xl bg-white border border-stone-200 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleCollapsed(buildingName)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors"
                          >
                            <div className="text-left flex-1 min-w-0">
                              <div className="font-serif text-base text-stone-900">
                                {buildingName}
                              </div>
                              <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                {buildingRows.length} bedroom
                                {buildingRows.length === 1 ? "" : "s"}
                                {bDone > 0 && (
                                  <span className="text-emerald-700">
                                    {" "}
                                    · {bDone} done
                                  </span>
                                )}
                                {bPartial > 0 && (
                                  <span className="text-amber-700">
                                    {" "}
                                    · {bPartial} partial
                                  </span>
                                )}
                                {bNotStarted > 0 && (
                                  <span className="text-red-700">
                                    {" "}
                                    · {bNotStarted} not started
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight
                              size={16}
                              className={`text-stone-400 flex-shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                            />
                          </button>
                          {!isCollapsed && (
                            <div className="border-t border-stone-100 p-3 space-y-2 bg-stone-50">
                              {buildingRows.map((g) => {
                                const s = statusFor(g);
                                const StatusIcon = s.Icon;
                                const pct =
                                  g.total > 0
                                    ? Math.round(
                                        (g.doneAnyTime / g.total) * 100,
                                      )
                                    : 0;
                                return (
                                  <div
                                    key={g.key}
                                    className="rounded-xl bg-white border border-stone-200 px-3 py-2.5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-8 h-8 rounded-full ${s.bg} ${s.color} flex items-center justify-center flex-shrink-0`}
                                      >
                                        <StatusIcon
                                          size={15}
                                          strokeWidth={2.5}
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm text-stone-900 truncate flex items-center gap-1.5">
                                          <span className="font-medium">
                                            {g.unitLabel}
                                          </span>
                                          <span className="text-stone-400">
                                            ·
                                          </span>
                                          <span className="italic text-amber-700">
                                            {g.partyLabel}
                                          </span>
                                          {g.assignmentType && (
                                            <AssignmentTypeChip
                                              type={g.assignmentType}
                                            />
                                          )}
                                          {/* Blocked badge — clear visible signal that
                                         items at this bedroom need owner review even
                                         though the bedroom counts as "complete". */}
                                          {g.blockedCount > 0 && (
                                            <span className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-0.5">
                                              <AlertCircle size={9} />
                                              Blocked{" "}
                                              {g.blockedCount > 1
                                                ? `· ${g.blockedCount}`
                                                : ""}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="text-[11px] text-stone-600 font-mono whitespace-nowrap">
                                            <span className="text-stone-900 font-bold">
                                              {g.doneAnyTime}
                                            </span>
                                            <span className="text-stone-400">
                                              {" "}
                                              /{" "}
                                            </span>
                                            <span>{g.total}</span>
                                          </div>
                                          <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full transition-all ${pct >= 100 ? (g.blockedCount > 0 ? "bg-amber-500" : "bg-emerald-500") : pct > 0 ? "bg-amber-500" : "bg-red-400"}`}
                                              style={{ width: `${pct}%` }}
                                            />
                                          </div>
                                          <div className="text-[10px] font-mono text-stone-500 whitespace-nowrap">
                                            {pct}%
                                          </div>
                                        </div>
                                      </div>
                                      {/* Inline action buttons. Quick glance + History
                                     are always present. Reopen + Mark done only
                                     appear when this bedroom has blocked items,
                                     so the owner can resolve them in one tap
                                     without opening Quick glance. */}
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={() =>
                                            setOpened(g.sampleTarget)
                                          }
                                          className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-900"
                                          title="Quick glance"
                                        >
                                          <Eye size={14} />
                                        </button>
                                        {onOpenBedroomHistory &&
                                          g.unitId &&
                                          g.partyId && (
                                            <button
                                              onClick={() =>
                                                onOpenBedroomHistory({
                                                  propertyId:
                                                    selectedPropertyId,
                                                  unitId: g.unitId,
                                                  unitLabel: g.unitLabel,
                                                  partyId: g.partyId,
                                                  partyLabel: g.partyLabel,
                                                })
                                              }
                                              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-900"
                                              title="History"
                                            >
                                              <Clock size={14} />
                                            </button>
                                          )}
                                        {canReopen && (
                                          <button
                                            onClick={() =>
                                              bulkUpdateAllAtBedroom(
                                                g,
                                                "pending",
                                              )
                                            }
                                            disabled={busy}
                                            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-900 disabled:opacity-50"
                                            title="Reopen everything at this bedroom"
                                          >
                                            <Play size={14} />
                                          </button>
                                        )}
                                        {canMarkDone && (
                                          <button
                                            onClick={() =>
                                              bulkUpdateAllAtBedroom(g, "done")
                                            }
                                            disabled={busy}
                                            className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-700 disabled:opacity-50"
                                            title="Mark everything at this bedroom done"
                                          >
                                            <Check size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {g.doneInRange > 0 &&
                                      g.doneInRange !== g.doneAnyTime && (
                                        <div className="text-[10px] font-mono text-stone-500 mt-1 pl-11">
                                          {g.doneInRange} done within range ·{" "}
                                          {g.doneAnyTime - g.doneInRange}{" "}
                                          outside
                                        </div>
                                      )}
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
              </>
            );
          })()
        )}
      </div>

      {opened &&
        (opened.assignment?.template_set_id || opened.template_section ? (
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
    </div>
  );
}
