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
import { isVisibleAssignmentTarget } from "../../../lib/assignments.js";
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
import { ItemsDropdown } from "../../../apps/internal/cleaner/ItemsDropdown.jsx";
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function FloorFocusList({ propertyId, workBlocks, onGoToBedroom }) {
  const [state, setState] = useState({
    loading: true,
    anchorLabel: "",
    anchorBuilding: null,
    anchorFloor: null,
    anchorPartyId: null,
    currentBeds: [],
    floorApts: [],
    nextUp: null,
    blocked: [],
  });
  const [showBlocked, setShowBlocked] = useState(false);

  // Re-run whenever a work block opens/closes so the list advances on its
  // own as the cleaner finishes bedrooms.
  const blocksFingerprint = (workBlocks || [])
    .map((b) => `${b.id}:${b.end_time || "open"}`)
    .join("|");

  const unitNumFromLabel = (label) => {
    const m = String(label || "").match(/(\d{3,})/);
    return m ? parseInt(m[1], 10) : 0;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!propertyId) return;
      const [unitsRes, partiesRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, label, active")
          .eq("customer_id", propertyId)
          .eq("active", true),
        supabase
          .from("parties")
          .select("id, label, unit_id, sort_order, active"),
      ]);
      // Paginated target load (1000-row chunks) so we never hit the row cap.
      const PAGE = 1000;
      let rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data: page, error } = await supabase
          .from("assignment_targets")
          .select(
            "status, unit_id, party_id, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
          )
          .eq("assignment.customer_id", propertyId)
          .eq("assignment.active", true)
          .is("assignment.deleted_at", null)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        rows = rows.concat(page || []);
        if (!page || page.length < PAGE) break;
        if (from > 200000) break;
      }
      if (cancelled) return;
      const valid = rows.filter(
        isVisibleAssignmentTarget &&
          t.unit_id &&
          t.party_id,
      );
      const openTargets = valid.filter(
        (t) => t.status !== "done" && t.status !== "blocked",
      );
      const blockedTargets = valid.filter((t) => t.status === "blocked");

      const units = unitsRes.data || [];
      const unitMap = new Map(units.map((u) => [u.id, u]));
      const parties = (partiesRes.data || []).filter((p) => p.active !== false);

      const bedroomsWithWork = new Set();
      openTargets.forEach((t) => bedroomsWithWork.add(t.party_id));

      // Candidate bedrooms = parties with open work, tagged with location.
      const candidates = parties
        .filter((p) => bedroomsWithWork.has(p.id))
        .map((p) => {
          const u = unitMap.get(p.unit_id);
          if (!u) return null;
          return {
            partyId: p.id,
            partyLabel: p.label,
            sort: p.sort_order ?? 0,
            unitId: u.id,
            unitLabel: u.label,
            building: buildingKey(u.label),
            floor: floorFromLabel(u.label),
            unitNum: unitNumFromLabel(u.label),
          };
        })
        .filter(Boolean);

      // Anchor = the apartment the cleaner is currently/most-recently in.
      const myActive = (workBlocks || []).find((b) => !b.end_time);
      const myRecent = (workBlocks || [])
        .slice()
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
      const anchorBlock = myActive || myRecent;
      let anchorUnitId = anchorBlock?.unit_id || null;
      const anchorPartyId = myActive?.party_id || null;
      // No work yet this shift → anchor on the lowest-numbered apartment
      // that still has work, so the list still has a sensible starting point.
      if (!anchorUnitId && candidates.length) {
        anchorUnitId = candidates
          .slice()
          .sort(
            (a, b) =>
              a.unitNum - b.unitNum || naturalCompare(a.unitLabel, b.unitLabel),
          )[0].unitId;
      }
      const anchorUnit = anchorUnitId ? unitMap.get(anchorUnitId) : null;
      const anchorBuilding = anchorUnit ? buildingKey(anchorUnit.label) : null;
      const anchorFloor = anchorUnit ? floorFromLabel(anchorUnit.label) : null;

      // Bucket 1: bedrooms still open in the current apartment.
      const currentBeds = candidates
        .filter((c) => c.unitId === anchorUnitId)
        .sort(
          (a, b) =>
            a.sort - b.sort || naturalCompare(a.partyLabel, b.partyLabel),
        );

      // Bucket 2: other apartments on the SAME building + floor.
      const floorMates = candidates.filter(
        (c) =>
          c.unitId !== anchorUnitId &&
          c.building === anchorBuilding &&
          c.floor === anchorFloor,
      );
      const aptMap = new Map();
      floorMates.forEach((c) => {
        if (!aptMap.has(c.unitId))
          aptMap.set(c.unitId, {
            unitId: c.unitId,
            unitLabel: c.unitLabel,
            unitNum: c.unitNum,
            beds: [],
          });
        aptMap.get(c.unitId).beds.push(c);
      });
      const floorApts = Array.from(aptMap.values())
        .map((a) => ({
          ...a,
          beds: a.beds.sort(
            (x, y) =>
              x.sort - y.sort || naturalCompare(x.partyLabel, y.partyLabel),
          ),
        }))
        .sort(
          (a, b) =>
            a.unitNum - b.unitNum || naturalCompare(a.unitLabel, b.unitLabel),
        );

      // Bucket 3: nearest remaining bedroom once this floor is clear —
      // same building (nearest floor) first, then the next building.
      let nextUp = null;
      if (currentBeds.length === 0 && floorApts.length === 0) {
        const elsewhere = candidates.filter(
          (c) => !(c.building === anchorBuilding && c.floor === anchorFloor),
        );
        elsewhere.sort((a, b) => {
          const sameB = (x) => (x.building === anchorBuilding ? 0 : 1);
          if (sameB(a) !== sameB(b)) return sameB(a) - sameB(b);
          const fd =
            Math.abs((a.floor ?? 99) - (anchorFloor ?? 0)) -
            Math.abs((b.floor ?? 99) - (anchorFloor ?? 0));
          if (fd !== 0) return fd;
          return (
            a.unitNum - b.unitNum || naturalCompare(a.unitLabel, b.unitLabel)
          );
        });
        nextUp = elsewhere[0] || null;
      }

      // Blocked bedrooms — unique unit+party pairs sitting in blocked.
      const blockedMap = new Map();
      blockedTargets.forEach((t) => {
        const key = `${t.unit_id}::${t.party_id}`;
        if (blockedMap.has(key)) return;
        const u = unitMap.get(t.unit_id);
        const p = parties.find((pp) => pp.id === t.party_id);
        blockedMap.set(key, {
          unitLabel: u?.label || "Apartment",
          partyLabel: p?.label || "Bedroom",
        });
      });

      setState({
        loading: false,
        anchorLabel: anchorUnit?.label || "",
        anchorBuilding,
        anchorFloor,
        anchorPartyId,
        currentBeds,
        floorApts,
        nextUp,
        blocked: Array.from(blockedMap.values()),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, blocksFingerprint]);

  const go = (c) =>
    onGoToBedroom &&
    onGoToBedroom({
      unit_id: c.unitId,
      party_id: c.partyId,
      unit: { label: c.unitLabel },
      party: { label: c.partyLabel },
    });

  if (state.loading) return null;
  const {
    currentBeds,
    floorApts,
    nextUp,
    blocked,
    anchorLabel,
    anchorBuilding,
    anchorFloor,
    anchorPartyId,
  } = state;
  const nothingHere =
    currentBeds.length === 0 && floorApts.length === 0 && !nextUp;
  if (nothingHere && blocked.length === 0) return null;

  const floorLabel = [
    anchorBuilding,
    anchorFloor != null ? `Floor ${anchorFloor}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const BedRow = ({ c }) => {
    const isNow = c.partyId === anchorPartyId;
    return (
      <button
        onClick={() => go(c)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-200 hover:border-stone-900 active:scale-98 transition-all text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="italic text-stone-800 truncate">
            {shortenBedroom(c.partyLabel)}
          </span>
          {isNow && (
            <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex-shrink-0">
              Now
            </span>
          )}
        </span>
        <ChevronRight size={15} className="text-stone-400 flex-shrink-0" />
      </button>
    );
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
          Where to clean
        </div>
        {blocked.length > 0 && (
          <button
            onClick={() => setShowBlocked((v) => !v)}
            className="text-[10px] uppercase tracking-wider font-mono font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 active:scale-95"
          >
            <AlertCircle size={11} /> {blocked.length} blocked
          </button>
        )}
      </div>

      {showBlocked && blocked.length > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-red-50/60 border border-red-200">
          <div className="text-[10px] uppercase tracking-wider font-mono text-red-700 mb-1.5">
            Blocked — waiting on your manager
          </div>
          <div className="space-y-1">
            {blocked.map((b, i) => (
              <div key={i} className="text-xs text-stone-700 font-mono">
                <span className="font-bold">{b.unitLabel}</span> ·{" "}
                {shortenBedroom(b.partyLabel)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current apartment */}
      {currentBeds.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-1.5 px-1">
            Current apartment · {anchorLabel}
          </div>
          <div className="space-y-1.5">
            {currentBeds.map((c) => (
              <BedRow key={c.partyId} c={c} />
            ))}
          </div>
        </div>
      )}

      {/* Rest of this floor */}
      {floorApts.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400 mb-1.5 px-1">
            Rest of this floor{floorLabel ? ` · ${floorLabel}` : ""}
          </div>
          <div className="space-y-3">
            {floorApts.map((a) => (
              <div key={a.unitId}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <Building2 size={13} className="text-stone-400" />
                  <span className="text-sm font-bold text-stone-800">
                    {a.unitLabel}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    · {a.beds.length} left
                  </span>
                </div>
                <div className="space-y-1.5">
                  {a.beds.map((c) => (
                    <BedRow key={c.partyId} c={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floor done → next up */}
      {nextUp && currentBeds.length === 0 && floorApts.length === 0 && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <Check size={15} className="text-emerald-600" />
            <span className="text-sm font-medium text-emerald-900">
              This floor is done — nice work.
            </span>
          </div>
          <button
            onClick={() => go(nextUp)}
            className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl bg-white border border-emerald-300 hover:border-emerald-500 active:scale-98 transition-all text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-700 font-bold">
                Next up
              </span>
              <span className="font-bold text-stone-900">
                {nextUp.unitLabel}
              </span>
              <span className="text-stone-400">·</span>
              <span className="italic text-stone-700 truncate">
                {shortenBedroom(nextUp.partyLabel)}
              </span>
            </span>
            <ChevronRight size={15} className="text-stone-400 flex-shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
