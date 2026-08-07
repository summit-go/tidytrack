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
} from "../../lib/supabase.js";
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
} from "../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../lib/permissions.js";
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
} from "../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../lib/photos.js";
import { sessionStore } from "../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../lib/translation.js";
import {
  buildTargetTitle,
  unitSizeLabel,
  shortenBedroom,
  partyDisplay,
  unitPartyLabel,
  bathroomNumberForBedroom,
} from "../../lib/labels.js";
import { splitTaskName } from "../../lib/tasks.js";
import { useAssignmentSync } from "../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../hooks/useTick.js";
import { useUnreadCount } from "../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../components/chips/PriorityChip.jsx";
import { Splash } from "../../components/Splash.jsx";
import { ScreenId } from "../../components/ScreenId.jsx";
import { OwnerOnly } from "../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../components/ConfirmModal.jsx";
import { AddressLink } from "../../components/AddressLink.jsx";
import { TranslatableText } from "../../components/TranslatableText.jsx";
import { PhotoModal } from "../../components/PhotoModal.jsx";
import { NotificationBell } from "../../components/NotificationBell.jsx";
import { Header } from "../../components/Header.jsx";
import { TeamClockIcon } from "../../components/TeamClockIcon.jsx";
import { TabButton } from "../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../components/ZoomableImage.jsx";
import { AssignmentViewer } from "./AssignmentViewer.jsx";
import { BlockedNoteModal } from "./BlockedNoteModal.jsx";
import { ChecklistAssignmentView } from "./ChecklistAssignmentView.jsx";
import { ReassignModal } from "./ReassignModal.jsx";

export function SuggestedTabContent({
  propertyId,
  employee,
  onGoToBedroom,
  onOpenBedroomHistory,
  onJoinBlock,
}) {
  const [loaded, setLoaded] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [groups, setGroups] = useState({
    sameApt: [],
    sameFloor: [],
    sameBuilding: [],
    otherBuilding: [],
  });
  const [busy, setBusy] = useState(false);
  // Action modals — one bedroom card at a time may want to open a Blocked-note
  // modal or a Reassign modal. We hold them here at the tab level since the
  // cards themselves are just renderers.
  const [opened, setOpened] = useState(null); // representative target for View Doc
  const [statusModal, setStatusModal] = useState(null); // { target, bulkRows }
  const [reassignTarget, setReassignTarget] = useState(null);
  // Per-section collapse. Same apartment + Same floor open by default,
  // Same building + Other buildings collapsed.
  const [collapsed, setCollapsed] = useState({
    sameApt: false,
    sameFloor: false,
    sameBuilding: true,
    otherBuilding: true,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [editDueId, setEditDueId] = useState(null);
  const canEditDatesS = can(employee, "edit_due_dates");
  const todayKeyS = localTodayKey();
  const saveDueS = async (id, date) => {
    setEditDueId(null);
    if (id) {
      await supabase
        .from("assignments")
        .update({ scheduled_date: date || null })
        .eq("id", id);
      reload();
    }
  };
  // Realtime: pick up workblocks opening/closing and target status
  // changes from other cleaners so the "X is here" chip + status pill
  // appear within seconds rather than after a manual refresh.
  useAssignmentSync(reload, "suggested-tab");

  // Label parsers — same as NextUpModal
  const buildingFromLabel = (label) => {
    if (!label) return null;
    const s = String(label);
    const dash = s.match(/^B(\d+)-/i);
    if (dash) return dash[1];
    const letter = s.match(/^([A-Za-z]+)\d/);
    if (letter) return letter[1].toUpperCase();
    return null;
  };
  const unitNumberFromLabel = (label) => {
    if (!label) return null;
    const m = label.match(/-(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };

  useEffect(() => {
    if (!propertyId || !employee?.id) return;
    (async () => {
      setLoaded(false);
      // 1. Anchor — cleaner's most recent block at this property
      const { data: myBlocks } = await supabase
        .from("work_blocks")
        .select(
          "id, unit_id, party_id, end_time, start_time, unit:units(label), party:parties(label), shift:shifts!inner(customer_id, employee_id)",
        )
        .order("start_time", { ascending: false })
        .limit(20);
      const mine = (myBlocks || []).filter(
        (b) =>
          b.shift?.customer_id === propertyId &&
          b.shift?.employee_id === employee.id,
      );
      const recent = mine[0];
      const anchorObj = recent
        ? {
            unitId: recent.unit_id,
            partyId: recent.party_id,
            unitLabel: recent.unit?.label || "",
            partyLabel: recent.party?.label || "",
            building: buildingFromLabel(recent.unit?.label),
            floor: floorFromLabel(recent.unit?.label),
            unitNum: unitNumberFromLabel(recent.unit?.label),
            wasOpen: !recent.end_time,
          }
        : null;

      // 2. Units + parties + full target detail + open work blocks
      const [unitsRes, partiesRes, targetsRes, blocksRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, label, active")
          .eq("customer_id", propertyId)
          .eq("active", true),
        supabase
          .from("parties")
          .select("id, label, unit_id, sort_order, active"),
        supabase
          .from("assignment_targets")
          .select(
            "*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status, deleted_at, assignment_type, template_set_id, sheet_type, general_variant, bathroom_variant, scheduled_date, created_at), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name), assignedTo:employees!assigned_to(id, name)",
          )
          .not("status", "in", "(done,blocked)"),
        // Open work blocks property-wide for the "who's here" chips.
        // main_section is pulled so each chip can label which section
        // the cleaner is working — relevant once cleaners split a
        // bedroom across sections.
        // Scoped to this property server-side — an app-wide open-block
        // query silently truncates at the 1000-row cap and the "is here"
        // chips go missing on arbitrary cards.
        supabase
          .from("work_blocks")
          .select(
            "id, unit_id, party_id, main_section, shift:shifts!inner(customer_id, employee:employees(id, name))",
          )
          .is("end_time", null)
          .eq("shift.customer_id", propertyId),
      ]);
      const units = unitsRes.data || [];
      const parties = (partiesRes.data || []).filter((p) => p.active !== false);
      const openTargets = (targetsRes.data || []).filter((t) => {
        const a = t.assignment;
        if (!a || a.customer_id !== propertyId) return false;
        if (a.active === false) return false;
        if (a.source === "pm" && a.pm_status !== "approved") return false;
        return true;
      });
      const openBlocks = (blocksRes.data || []).filter(
        (b) =>
          b.shift?.customer_id === propertyId &&
          b.shift?.employee?.id &&
          b.shift.employee.id !== employee.id,
      );

      // Group open targets by bedroom (party_id)
      const targetsByParty = new Map();
      openTargets.forEach((t) => {
        if (!t.party_id) return;
        if (!targetsByParty.has(t.party_id)) targetsByParty.set(t.party_id, []);
        targetsByParty.get(t.party_id).push(t);
      });
      // Build "who's here" map — keyed by party_id, contains [{ name, partyLabel(if relevant) }]
      // For the chip we just need the cleaner's name; the bedroom IS the card.
      const whosHereByParty = new Map();
      openBlocks.forEach((b) => {
        if (!b.party_id) return;
        if (!whosHereByParty.has(b.party_id))
          whosHereByParty.set(b.party_id, []);
        whosHereByParty.get(b.party_id).push({
          name: b.shift.employee.name,
          workBlockId: b.id,
          mainSection: b.main_section, // null for legacy blocks; UI hides badge in that case
        });
      });

      const unitMap = new Map(units.map((u) => [u.id, u]));
      const candidates = parties
        .filter((p) => targetsByParty.has(p.id))
        .filter((p) => !anchorObj || p.id !== anchorObj.partyId)
        .map((p) => {
          const unit = unitMap.get(p.unit_id);
          if (!unit) return null;
          const items = targetsByParty.get(p.id) || [];
          const hasPriority = items.some((i) => i.priority);
          return {
            partyId: p.id,
            partyLabel: p.label,
            unitId: unit.id,
            unitLabel: unit.label,
            building: buildingFromLabel(unit.label),
            floor: floorFromLabel(unit.label),
            unitNum: unitNumberFromLabel(unit.label),
            items,
            hasPriority,
            whosHere: whosHereByParty.get(p.id) || [],
          };
        })
        .filter(Boolean);

      // Bucket
      const sameApt = anchorObj
        ? candidates.filter((c) => c.unitId === anchorObj.unitId)
        : [];
      const sameFloor = anchorObj
        ? candidates.filter(
            (c) =>
              c.unitId !== anchorObj.unitId &&
              c.building === anchorObj.building &&
              c.floor === anchorObj.floor,
          )
        : [];
      const sameBuilding = anchorObj
        ? candidates.filter(
            (c) =>
              c.building === anchorObj.building && c.floor !== anchorObj.floor,
          )
        : [];
      const otherBuilding = anchorObj
        ? candidates.filter((c) => c.building !== anchorObj.building)
        : [...candidates];

      // Sorts (same as before)
      sameFloor.sort((a, b) => {
        if (a.hasPriority !== b.hasPriority) return a.hasPriority ? -1 : 1;
        const da = Math.abs((a.unitNum || 0) - (anchorObj?.unitNum || 0));
        const db = Math.abs((b.unitNum || 0) - (anchorObj?.unitNum || 0));
        return da - db;
      });
      sameBuilding.sort((a, b) => {
        if (a.hasPriority !== b.hasPriority) return a.hasPriority ? -1 : 1;
        const fa = Math.abs((a.floor ?? 99) - (anchorObj?.floor ?? 0));
        const fb = Math.abs((b.floor ?? 99) - (anchorObj?.floor ?? 0));
        if (fa !== fb) return fa - fb;
        return (a.unitNum || 0) - (b.unitNum || 0);
      });
      const distFromThree = (f) => {
        if (f == null) return 99;
        if (f === 3) return 0;
        if (f < 3) return 3 - f;
        return f - 3 + 3;
      };
      otherBuilding.sort((a, b) => {
        if (a.hasPriority !== b.hasPriority) return a.hasPriority ? -1 : 1;
        if (a.building !== b.building)
          return (a.building || "").localeCompare(b.building || "");
        const da = distFromThree(a.floor);
        const db = distFromThree(b.floor);
        if (da !== db) return da - db;
        return (a.unitNum || 0) - (b.unitNum || 0);
      });

      setAnchor(anchorObj);
      setGroups({ sameApt, sameFloor, sameBuilding, otherBuilding });
      setLoaded(true);
    })();
  }, [propertyId, employee?.id, reloadKey]);

  // Bulk handlers — operate on a single bedroom's items. Mirror of the
  // helpers in AssignmentBanner/AssignmentTabContent. Optimistic + single
  // DB write, then trigger a reload so counts settle.
  const bulkUpdateStatus = async (rows, newStatus, statusNotes) => {
    if (!rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === "in_progress") {
      patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (newStatus === "pending") {
      patch.started_at = null;
      patch.started_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch)
      .in("id", ids);
    setBusy(false);
    if (error) {
      alert("Could not update: " + error.message);
      reload();
      return;
    }
    reload();
  };
  const bulkTogglePriority = async (rows) => {
    if (!rows || rows.length === 0) return;
    const anyOn = rows.some((r) => r.priority);
    const next = !anyOn;
    const ids = rows.map((r) => r.id);
    const { error } = await supabase
      .from("assignment_targets")
      .update({ priority: next })
      .in("id", ids);
    if (error) {
      alert("Could not update priority: " + error.message);
    }
    reload();
  };

  // Bedroom card — matches renderChecklistGroupCard from AssignmentBanner.
  // Shows the full bulk-card chrome plus the "{name} is here" chip when
  // another cleaner has an open block at this bedroom.
  const renderBedroomCard = (c) => {
    const items = c.items;
    const rep = items[0];
    if (!rep) return null;
    const counts = {
      pending: items.filter((i) => i.status === "pending").length,
      in_progress: items.filter((i) => i.status === "in_progress").length,
      paused: items.filter((i) => i.status === "paused").length,
      blocked: items.filter((i) => i.status === "blocked").length,
      done: 0,
    };
    const total = items.length;
    const sectionCounts = {
      bedroom: items.filter(
        (i) => (i.template_section || "").toLowerCase() === "bedroom",
      ).length,
      vanity: items.filter(
        (i) => (i.template_section || "").toLowerCase() === "vanity",
      ).length,
      bathroom: items.filter(
        (i) => (i.template_section || "").toLowerCase() === "bathroom",
      ).length,
      general: items.filter(
        (i) => (i.template_section || "").toLowerCase() === "general",
      ).length,
    };
    const knownSectioned =
      sectionCounts.bedroom +
      sectionCounts.vanity +
      sectionCounts.bathroom +
      sectionCounts.general;
    const otherCount = total - knownSectioned;
    const sectionBits = [];
    if (sectionCounts.bedroom)
      sectionBits.push(`Bedroom (${sectionCounts.bedroom})`);
    if (sectionCounts.vanity)
      sectionBits.push(`Vanity (${sectionCounts.vanity})`);
    if (sectionCounts.bathroom)
      sectionBits.push(`Bathroom (${sectionCounts.bathroom})`);
    if (sectionCounts.general)
      sectionBits.push(`General (${sectionCounts.general})`);
    if (otherCount > 0) sectionBits.push(`Other (${otherCount})`);
    const statusOrder = ["pending", "in_progress", "paused", "blocked"];
    const dominantStatus =
      statusOrder.find((s) => items.some((i) => i.status === s)) || "pending";
    const statusPill =
      ASSIGNMENT_STATUSES[dominantStatus] || ASSIGNMENT_STATUSES.pending;
    // Done items don't get an overdue pill — overdue means unfinished
    // past its due date, and these are finished.
    const allDone = items.length > 0 && items.every((i) => i.status === "done");
    const goTo = () => {
      if (!onGoToBedroom) return;
      // Carry this card's assignment so the block is tagged with the exact
      // job. A grouped card can hold items from one assignment; if it somehow
      // spans more than one, we don't guess — leave it null so it behaves as
      // legacy rather than mis-tagging.
      const asgIds = [
        ...new Set(items.map((i) => i.assignment_id).filter(Boolean)),
      ];
      onGoToBedroom({
        unit_id: c.unitId,
        party_id: c.partyId,
        assignment_id: asgIds.length === 1 ? asgIds[0] : null,
        unit: { id: c.unitId, label: c.unitLabel },
        party: { id: c.partyId, label: c.partyLabel },
      });
    };
    return (
      <div
        key={c.partyId}
        className="p-3 sm:p-4 rounded-xl bg-white border border-stone-200"
      >
        {/* === HEADER === */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={goTo}
              disabled={busy}
              className="block text-left w-full font-serif text-lg text-stone-900 leading-tight break-words hover:underline disabled:opacity-50"
            >
              <span className="font-bold">{c.unitLabel}</span>
              {partyDisplay(c.partyLabel) && (
                <>
                  <span className="text-stone-400 mx-1.5">·</span>
                  <span className="italic">{partyDisplay(c.partyLabel)}</span>
                </>
              )}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-shrink-0 sm:max-w-[60%]">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bulkTogglePriority(items);
                }}
                disabled={busy}
                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                  c.hasPriority
                    ? "bg-red-100 text-red-800 border-red-300 font-bold hover:bg-red-200"
                    : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                }`}
              >
                <AlertCircle size={10} />{" "}
                {c.hasPriority ? "Priority" : "Mark priority"}
              </button>
              <span
                className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${statusPill.color}`}
              >
                {statusPill.label}
              </span>
              {allDone ? (
                (() => {
                  const last = items
                    .map((i) => i.completed_at)
                    .filter(Boolean)
                    .sort()
                    .slice(-1)[0];
                  return (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-900 text-white inline-flex items-center gap-1">
                      <Check size={9} />{" "}
                      {last
                        ? `Done ${fmtDueDate(String(last).slice(0, 10))}`
                        : "Done"}
                    </span>
                  );
                })()
              ) : editDueId === rep.assignment?.id ? (
                <DueDateEditor
                  compact
                  value={rep.assignment?.scheduled_date || ""}
                  onSave={(d) => saveDueS(rep.assignment?.id, d)}
                  onCancel={() => setEditDueId(null)}
                />
              ) : canEditDatesS ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditDueId(rep.assignment?.id);
                  }}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    rep.assignment?.scheduled_date
                      ? rep.assignment.scheduled_date < todayKeyS
                        ? "bg-red-100 text-red-700 border-red-200"
                        : rep.assignment.scheduled_date === todayKeyS
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-stone-100 text-stone-600 border-stone-200"
                      : "bg-white text-stone-500 border-dashed border-stone-300"
                  }`}
                >
                  <Calendar size={9} />{" "}
                  {rep.assignment?.scheduled_date
                    ? rep.assignment.scheduled_date < todayKeyS
                      ? `Overdue · ${fmtDueDate(rep.assignment.scheduled_date)}`
                      : rep.assignment.scheduled_date === todayKeyS
                        ? "Today"
                        : fmtDueDate(rep.assignment.scheduled_date)
                    : "Set due date"}
                </button>
              ) : rep.assignment?.scheduled_date ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200 inline-flex items-center gap-1">
                  <Calendar size={9} />{" "}
                  {rep.assignment.scheduled_date === todayKeyS
                    ? "Today"
                    : fmtDueDate(rep.assignment.scheduled_date)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => setOpened(rep)}
                className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1"
              >
                <Eye size={10} /> Quick glance
              </button>
              {onOpenBedroomHistory && (
                <button
                  onClick={() =>
                    onOpenBedroomHistory({
                      unitId: c.unitId,
                      unitLabel: c.unitLabel,
                      partyId: c.partyId,
                      partyLabel: c.partyLabel,
                    })
                  }
                  disabled={busy}
                  className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <Clock size={10} /> History
                </button>
              )}
            </div>
          </div>
        </div>

        {/* "Who's here" chip — shown when another cleaner has an open block
           at this bedroom. Compact pill row above the title/breakdown.
           Each name gets a Join button so the helper can jump straight
           into that workblock as a participant. */}
        {c.whosHere &&
          c.whosHere.length > 0 &&
          (() => {
            // One consolidated chip + ONE Join button, not a chip+button per
            // name. Everyone here is at the same bedroom, so joining any of
            // their open blocks lands the helper in this bedroom — we use the
            // first block that has an id.
            const names = c.whosHere.map((w) => w.name).filter(Boolean);
            const sections = Array.from(
              new Set(c.whosHere.map((w) => w.mainSection).filter(Boolean)),
            );
            const joinTarget = c.whosHere.find((w) => w.workBlockId);
            const label =
              names.join(", ") +
              " here" +
              (sections.length ? ` · ${sections.join(", ")}` : "");
            return (
              <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold">
                  ●
                </span>
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                  {label}
                </span>
                {onJoinBlock && joinTarget && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinBlock({ id: joinTarget.workBlockId });
                    }}
                    className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold inline-flex items-center gap-1 active:scale-95"
                  >
                    <Plus size={9} /> Join
                  </button>
                )}
              </div>
            );
          })()}

        {/* === TITLE + TYPE + SECTION BREAKDOWN === */}
        <div className="mb-2">
          <div className="font-serif text-sm text-stone-700">
            {rep.assignment?.title || "Checklist assignment"}
          </div>
          {rep.assignment?.assignment_type && (
            <div className="mt-1">
              <AssignmentTypeChip type={rep.assignment.assignment_type} />
            </div>
          )}
          <div className="text-[11px] font-mono text-stone-500 mt-1">
            {total} {total === 1 ? "item" : "items"}
            {sectionBits.length > 0 && <> · {sectionBits.join(" · ")}</>}
          </div>
        </div>

        {/* === Status chips row === */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {counts.in_progress > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {counts.in_progress} in progress
            </span>
          )}
          {counts.pending > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {counts.pending} pending
            </span>
          )}
          {counts.paused > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {counts.paused} paused
            </span>
          )}
          {counts.blocked > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {counts.blocked} blocked
            </span>
          )}
        </div>

        {/* === Action buttons === */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Go to bedroom — small now, not a big bar. */}
          <button
            onClick={goTo}
            className="h-9 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center gap-1"
          >
            Go to bedroom <ChevronRight size={13} />
          </button>
          {allDone ? (
            /* Done job — the useful action is to REOPEN it (mistake / redo),
               not to "go look at it again". */
            can(employee, "mark_assignments_done") && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Reopen ${c.unitLabel}${c.partyLabel ? " · " + c.partyLabel : ""}? It goes back to Pending so it can be worked again.`,
                    )
                  )
                    bulkUpdateStatus(items, "pending");
                }}
                disabled={busy}
                className="h-9 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw size={12} /> Reopen
              </button>
            )
          ) : (
            <>
              {can(employee, "mark_assignments_done") && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Mark all ${items.length} item${items.length === 1 ? "" : "s"} at ${c.unitLabel}${c.partyLabel ? " · " + c.partyLabel : ""} complete?`,
                      )
                    )
                      bulkUpdateStatus(items, "done");
                  }}
                  disabled={busy}
                  className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <Check size={12} /> Mark complete
                </button>
              )}
              <OwnerOnly employee={employee}>
                <button
                  onClick={() =>
                    setStatusModal({ target: rep, bulkRows: items })
                  }
                  disabled={busy}
                  title="Owners only"
                  className="h-9 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <AlertCircle size={12} /> Block
                </button>
              </OwnerOnly>
              <button
                onClick={() => setReassignTarget(rep)}
                disabled={busy}
                className="h-9 px-3 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <User size={12} /> Reassign
              </button>
            </>
          )}
          {/* Owner-only delete for an assignment uploaded by mistake. */}
          {can(employee, "upload_assignments") && rep.assignment?.id && (
            <button
              onClick={async () => {
                if (
                  !confirm(
                    "Delete this assignment? Use this only if it was uploaded by mistake — it removes it for everyone.",
                  )
                )
                  return;
                const { error } = await supabase
                  .from("assignments")
                  .update({
                    deleted_at: new Date().toISOString(),
                    deleted_by: employee?.id || null,
                  })
                  .eq("id", rep.assignment.id);
                if (error) {
                  alert("Could not delete: " + error.message);
                  return;
                }
                reload();
              }}
              disabled={busy}
              title="Delete this assignment (uploaded by mistake)"
              className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center border border-stone-300 bg-white hover:bg-red-50 text-red-600 disabled:opacity-50"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Collapsible section
  const Section = ({ id, title, items, limit = 5 }) => {
    if (!items || items.length === 0) return null;
    const isOpen = !collapsed[id];
    const shown = items.slice(0, limit);
    return (
      <div>
        <button
          onClick={() => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))}
          className="w-full flex items-center gap-2 mb-2 px-1 py-1.5 hover:bg-stone-50 rounded transition-colors text-left"
        >
          <ChevronRight
            size={14}
            className={`text-stone-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="text-sm font-bold text-stone-800 tracking-wide">
            {title}
          </span>
          <span className="text-xs font-mono text-stone-500">
            ({items.length})
          </span>
          <div className="flex-1 h-px bg-stone-300" />
        </button>
        {isOpen && (
          <div className="space-y-2">
            {shown.map(renderBedroomCard)}
            {items.length > limit && (
              <div className="text-[11px] font-mono text-stone-500 italic px-1 py-1">
                + {items.length - limit} more bedroom
                {items.length - limit === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!loaded)
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        Finding the closest work…
      </div>
    );

  const total =
    groups.sameApt.length +
    groups.sameFloor.length +
    groups.sameBuilding.length +
    groups.otherBuilding.length;
  if (total === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
        Nothing else to clean at this property. Nice work!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Anchor banner */}
      {anchor ? (
        <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
          <div className="text-[10px] uppercase tracking-wider font-mono text-stone-600 mb-0.5">
            Suggesting from
          </div>
          <div className="text-sm text-stone-900">
            <span className="font-bold">{anchor.unitLabel}</span>
            {anchor.partyLabel && (
              <>
                {" "}
                · <span className="italic">{anchor.partyLabel}</span>
              </>
            )}
            <span className="text-stone-500 text-xs ml-2">
              {anchor.wasOpen
                ? "(your current bedroom)"
                : "(your most recent bedroom)"}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
          <div className="text-xs text-stone-700">
            You haven't started yet today. We're suggesting the 3rd floor of
            each building first, then working down.
          </div>
        </div>
      )}
      <Section
        id="sameApt"
        title={anchor ? `Same apartment (${anchor.unitLabel})` : "Start here"}
        items={groups.sameApt}
      />
      <Section id="sameFloor" title="Same floor" items={groups.sameFloor} />
      <Section
        id="sameBuilding"
        title="Same building"
        items={groups.sameBuilding}
      />
      <Section
        id="otherBuilding"
        title={
          anchor
            ? "Other buildings — starting on floor 3"
            : "All buildings — starting on floor 3"
        }
        items={groups.otherBuilding}
      />

      {/* Modals */}
      {opened &&
        (opened.assignment?.template_set_id ? (
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
      {statusModal && (
        <BlockedNoteModal
          target={statusModal.target}
          onSave={(notes) => {
            if (statusModal.bulkRows && statusModal.bulkRows.length > 0) {
              bulkUpdateStatus(statusModal.bulkRows, "blocked", notes);
            } else {
              bulkUpdateStatus([statusModal.target], "blocked", notes);
            }
            setStatusModal(null);
          }}
          onClose={() => setStatusModal(null)}
          busy={busy}
        />
      )}
      {reassignTarget && (
        <ReassignModal
          target={reassignTarget}
          propertyId={propertyId}
          onSaved={() => {
            setReassignTarget(null);
            reload();
          }}
          onClose={() => setReassignTarget(null)}
        />
      )}
    </div>
  );
}
