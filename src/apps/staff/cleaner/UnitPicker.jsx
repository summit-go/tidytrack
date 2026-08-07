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
import { sessionStore } from "../../../lib/sessionStore.js";
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
import { LeaveWorkblockModal } from "./LeaveWorkblockModal.jsx";

export function UnitPicker({ property, onPick, onBack, busy, title = "Pick a unit" }) {
  const [units, setUnits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  // Per-unit bedroom counts: how many bedrooms (party_ids) within
  // this apartment still have open assignment items. Lets the
  // cleaner spot at a glance which apartments need work and how
  // much, without drilling in.
  const [bedroomCounts, setBedroomCounts] = useState({}); // { unit_id: number }
  useEffect(() => {
    (async () => {
      const [unitsRes, targetsRes] = await Promise.all([
        supabase
          .from("units")
          .select("*")
          .eq("customer_id", property.id)
          .eq("active", true)
          .order("sort_order")
          .order("label"),
        supabase
          .from("assignment_targets")
          .select(
            "unit_id, party_id, status, assignment:assignments!inner(customer_id, active)",
          )
          .not("status", "in", "(done,blocked)"),
      ]);
      // Apply natural sort client-side so '10-101' comes after '9-101'
      const sorted = (unitsRes.data || [])
        .slice()
        .sort((a, b) => naturalCompare(a.label, b.label));
      // Count unique (party_id) bedrooms per unit — scoped to THIS
      // property and to active assignments. unit_id can be null when
      // an assignment is property-wide; those don't apply to any one
      // unit so we skip them here.
      const counts = {};
      const seen = new Set();
      (targetsRes.data || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.active === false) return;
        if (a.customer_id !== property.id) return;
        if (!t.unit_id) return;
        const key = `${t.unit_id}::${t.party_id || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        counts[t.unit_id] = (counts[t.unit_id] || 0) + 1;
      });
      setUnits(sorted);
      setBedroomCounts(counts);
      setLoaded(true);
    })();
  }, [property.id]);

  const q = search.trim().toLowerCase();
  const filtered = (
    q
      ? units.filter(
          (u) =>
            u.label.toLowerCase().includes(q) ||
            (u.notes || "").toLowerCase().includes(q),
        )
      : units
  )
    .slice()
    .sort((a, b) => {
      // Apartments with open work jump to the top so the cleaner sees
      // them first. Within each bucket keep the natural sort by label.
      const aHas = (bedroomCounts[a.id] || 0) > 0 ? 1 : 0;
      const bHas = (bedroomCounts[b.id] || 0) > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return naturalCompare(a.label, b.label);
    });

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100"
        >
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
            {property.name}
          </div>
          <div className="font-serif text-xl text-stone-900">{title}</div>
        </div>
      </div>

      {/* Search bar — always show so the user can quickly find by typing
         instead of scrolling. Helpful even with 4-5 units. */}
      {units.length > 1 && (
        <div className="px-5 pt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${units.length} ${units.length === 1 ? "unit" : "units"}…`}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
      )}

      <div className="flex-1 px-5 py-4 overflow-y-auto">
        {!loaded ? (
          <Splash text="Loading…" />
        ) : units.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units configured for this property yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units match "{search}".
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const n = bedroomCounts[u.id] || 0;
              return (
                <button
                  key={u.id}
                  onClick={() => onPick(u)}
                  disabled={busy}
                  className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif text-lg text-stone-900">
                          {u.label}
                        </span>
                        {n > 0 && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex items-center gap-1">
                            <FileText size={10} /> {n} bedroom
                            {n === 1 ? "" : "s"} to clean
                          </span>
                        )}
                      </div>
                      {u.notes && (
                        <div className="text-xs text-stone-500 mt-1">
                          {u.notes}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-stone-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
