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
  unitNumberFromLabel,
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

export function NextUpModal({ from, employeeId, onPick, onClose, onSeeAssignments }) {
  const [data, setData] = useState({
    loading: true,
    sameApt: [],
    sameFloor: [],
    sameBuilding: [],
    otherBuilding: [],
    otherCleaners: [],
  });

  // Pull a parsing helper for building/floor out of a label like B3-205
  // (B<building>-<floor><unit>). We use the existing floorFromLabel
  // for floor, and a tiny inline regex for building.
  const buildingFromLabel = (label) => {
    if (!label) return null;
    const s = String(label);
    const dash = s.match(/^B(\d+)-/i);
    if (dash) return dash[1];
    const letter = s.match(/^([A-Za-z]+)\d/);
    if (letter) return letter[1].toUpperCase();
    return null;
  };
  const fromBuilding = buildingFromLabel(from.unitLabel);
  const fromFloor = floorFromLabel(from.unitLabel);
  const fromUnitNum = unitNumberFromLabel(from.unitLabel);

  useEffect(() => {
    if (!from?.propertyId) return;
    (async () => {
      // 1. Load every unit + party for the property so we can compute
      //    which bedrooms still have open targets and where they live.
      const [unitsRes, partiesRes, targetsRes, blocksRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, label, active")
          .eq("customer_id", from.propertyId)
          .eq("active", true),
        supabase
          .from("parties")
          .select("id, label, unit_id, sort_order, active"),
        supabase
          .from("assignment_targets")
          .select(
            "unit_id, party_id, status, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at, scheduled_date)",
          )
          .not("status", "in", "(done,blocked)"),
        // Open work blocks at this property so we can show "who's here"
        supabase
          .from("work_blocks")
          .select(
            "unit_id, party_id, shift:shifts!inner(customer_id, employee:employees(id, name))",
          )
          .is("end_time", null),
      ]);
      const units = unitsRes.data || [];
      const parties = (partiesRes.data || []).filter((p) => p.active !== false);
      // Filter targets to active + this property
      const openTargets = (targetsRes.data || []).filter((t) => {
        const a = t.assignment;
        if (!a || a.customer_id !== from.propertyId) return false;
        if (a.active === false) return false;
        if (a.source === "pm" && a.pm_status !== "approved") return false;
        return true;
      });
      // Bedrooms with open work (party_id set) + their soonest due date.
      const bedroomsWithWork = new Set();
      const dueByParty = {};
      openTargets.forEach((t) => {
        if (t.party_id) {
          bedroomsWithWork.add(t.party_id);
          const d = t.assignment?.scheduled_date;
          if (d && (!dueByParty[t.party_id] || d < dueByParty[t.party_id]))
            dueByParty[t.party_id] = d;
        }
      });
      // Map unit → unit label
      const unitMap = new Map(units.map((u) => [u.id, u]));
      // Build candidate list: parties in apartments at this property
      // that have open work, EXCLUDING the bedroom we just finished.
      const candidates = parties
        .filter((p) => p.id !== from.partyId)
        .filter((p) => bedroomsWithWork.has(p.id))
        .map((p) => {
          const unit = unitMap.get(p.unit_id);
          if (!unit) return null;
          return {
            partyId: p.id,
            partyLabel: p.label,
            dueDate: dueByParty[p.id] || null,
            unitId: unit.id,
            unitLabel: unit.label,
            building: buildingFromLabel(unit.label),
            floor: floorFromLabel(unit.label),
            unitNum: unitNumberFromLabel(unit.label),
          };
        })
        .filter(Boolean);

      // Bucket
      const sameApt = candidates.filter((c) => c.unitId === from.unitId);
      const sameFloor = candidates.filter(
        (c) =>
          c.unitId !== from.unitId &&
          c.building === fromBuilding &&
          c.floor === fromFloor,
      );
      const sameBuilding = candidates.filter(
        (c) => c.building === fromBuilding && c.floor !== fromFloor,
      );
      const otherBuilding = candidates.filter(
        (c) => c.building !== fromBuilding,
      );

      // Same-floor: sort by closest unit number
      sameFloor.sort((a, b) => {
        const da = Math.abs((a.unitNum || 0) - (fromUnitNum || 0));
        const db = Math.abs((b.unitNum || 0) - (fromUnitNum || 0));
        return da - db;
      });
      // Same-building (different floor): nearest floor first, then unit
      sameBuilding.sort((a, b) => {
        const fa = Math.abs((a.floor ?? 99) - (fromFloor ?? 0));
        const fb = Math.abs((b.floor ?? 99) - (fromFloor ?? 0));
        if (fa !== fb) return fa - fb;
        return (a.unitNum || 0) - (b.unitNum || 0);
      });
      // Other-building: per user's request — start on 3rd floor, then
      // descend (3 → 2 → 1 → 4+). Sort by abs distance from floor 3.
      const distanceFromThree = (f) => {
        if (f == null) return 99;
        // Penalty for going above 3 so we prefer 3,2,1 order then 4,5,…
        if (f === 3) return 0;
        if (f < 3) return 3 - f; // 2 → 1, 1 → 2
        return f - 3 + 3; // 4 → 4, 5 → 5 (after 3,2,1)
      };
      otherBuilding.sort((a, b) => {
        if (a.building !== b.building)
          return (a.building || "").localeCompare(b.building || "");
        const da = distanceFromThree(a.floor);
        const db = distanceFromThree(b.floor);
        if (da !== db) return da - db;
        return (a.unitNum || 0) - (b.unitNum || 0);
      });

      // Who else is here — cleaners with open blocks in the same apt
      const otherCleaners = (blocksRes.data || [])
        .filter((b) => b.shift?.customer_id === from.propertyId)
        .filter((b) => b.unit_id === from.unitId)
        .filter(
          (b) => b.shift?.employee?.id && b.shift.employee.id !== employeeId,
        )
        .map((b) => ({
          name: b.shift.employee.name,
          partyId: b.party_id,
          partyLabel: parties.find((p) => p.id === b.party_id)?.label || "",
        }));

      setData({
        loading: false,
        sameApt,
        sameFloor,
        sameBuilding,
        otherBuilding,
        otherCleaners,
      });
    })();
  }, [from?.propertyId, from?.unitId, from?.partyId, employeeId]);

  const Bucket = ({ title, items, limit = 5 }) => {
    if (!items || items.length === 0) return null;
    const shown = items.slice(0, limit);
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1 px-1">
          {title} <span className="text-stone-400">· {items.length}</span>
        </div>
        <div className="space-y-1.5">
          {shown.map((c) => (
            <button
              key={c.partyId}
              onClick={() => onPick(c)}
              className="w-full p-3 rounded-xl bg-white border border-stone-200 hover:border-stone-900 text-left active:scale-98 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-serif text-sm text-stone-900 font-bold">
                    {c.unitLabel}
                  </span>
                  {partyDisplay(c.partyLabel) && (
                    <>
                      <span className="text-stone-400">·</span>
                      <span className="italic text-stone-700">
                        {partyDisplay(c.partyLabel)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[11px] font-mono ${c.dueDate ? "text-stone-500" : "text-stone-300"}`}
                  >
                    {c.dueDate ? fmtDueDate(c.dueDate) : "No date"}
                  </span>
                  <ChevronRight size={14} className="text-stone-400" />
                </div>
              </div>
            </button>
          ))}
          {items.length > limit && (
            <div className="text-[10px] font-mono text-stone-500 italic px-1">
              + {items.length - limit} more
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-stone-200">
          <div className="font-serif text-xl text-stone-900 mb-1">
            Nice work in {from.partyLabel}
          </div>
          <div className="text-sm text-stone-600">
            What's next? Closer suggestions are at the top.
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {data.loading ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              Finding next bedrooms…
            </div>
          ) : (
            <>
              {/* Who else is at this apartment — comes first per user's request */}
              {data.otherCleaners.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-amber-900 font-bold mb-1">
                    Who's at {from.unitLabel}
                  </div>
                  <div className="space-y-0.5">
                    {data.otherCleaners.map((c, i) => (
                      <div key={i} className="text-sm text-stone-800">
                        <span className="font-bold">{c.name}</span>
                        {partyDisplay(c.partyLabel) && (
                          <span className="text-stone-600">
                            {" "}
                            · {partyDisplay(c.partyLabel)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-amber-800 mt-1.5 italic">
                    You could walk over and ask if they need help.
                  </div>
                </div>
              )}
              <Bucket
                title={`Same apartment (${from.unitLabel})`}
                items={data.sameApt}
              />
              <Bucket title={`Same floor`} items={data.sameFloor} />
              <Bucket title={`Same building`} items={data.sameBuilding} />
              <Bucket
                title={`Other buildings — starting on floor 3`}
                items={data.otherBuilding}
              />
              {data.sameApt.length +
                data.sameFloor.length +
                data.sameBuilding.length +
                data.otherBuilding.length ===
                0 && (
                <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  Looks like all the bedrooms are taken care of. Nice job!
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-5 border-t border-stone-200">
          <button
            onClick={onSeeAssignments || onClose}
            className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Layers size={16} /> See all my assignments
          </button>
        </div>
      </div>
    </div>
  );
}
