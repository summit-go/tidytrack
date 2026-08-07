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

export function PartyPicker({ property, unit, onPick, onBack, busy }) {
  const [parties, setParties] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  // Per-bedroom subsection counts so the cleaner sees at a glance
  // which bedrooms have how much work, broken down by main section.
  // Shape: { party_id: { total: N, bedroom: N, vanity: N, bathroom: N, general: N } }
  const [counts, setCounts] = useState({});
  useEffect(() => {
    (async () => {
      const [partiesRes, targetsRes] = await Promise.all([
        supabase
          .from("parties")
          .select("*")
          .eq("unit_id", unit.id)
          .eq("active", true)
          .order("sort_order")
          .order("label"),
        supabase
          .from("assignment_targets")
          .select(
            "party_id, template_section, template_item_key, status, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
          )
          .eq("unit_id", unit.id)
          .not("status", "in", "(done,blocked)"),
      ]);
      // Build the section-by-section counts per party. Only count
      // open targets on active, customer-matched assignments (so
      // legacy archived rows don't inflate the totals).
      const c = {};
      (targetsRes.data || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.active === false) return;
        if (a.customer_id !== property.id) return;
        if (a.source === "pm" && a.pm_status !== "approved") return;
        if (!t.party_id) return;
        if (!c[t.party_id])
          c[t.party_id] = {
            total: 0,
            bedroom: 0,
            vanity: 0,
            bathroom: 0,
            general: 0,
            bathTub: false,
            bathToilet: false,
            genHot: false,
            genFridge: false,
            genFreezer: false,
          };
        c[t.party_id].total += 1;
        const sec = (t.template_section || "").toLowerCase();
        if (sec in c[t.party_id]) c[t.party_id][sec] += 1;
        // Subsection flags for chip coloring, based ONLY on which items are
        // actually part of this bedroom's open assignment (not the variant).
        // A 'tub' bathroom assignment that doesn't include the tub item won't
        // light up red — it's about what's chosen, not the variant.
        //   Bathroom: tub item → red, toilet item → blue
        //   General:  stove/oven item → red; fridge AND freezer both → orange
        const key = (t.template_item_key || "").toLowerCase();
        if (sec === "bathroom") {
          if (key.includes("tub")) c[t.party_id].bathTub = true;
          if (key.includes("toilet")) c[t.party_id].bathToilet = true;
        }
        if (sec === "general") {
          if (key.includes("stove") || key.includes("oven"))
            c[t.party_id].genHot = true;
          if (key.includes("refrigerator") || key.includes("fridge"))
            c[t.party_id].genFridge = true;
          if (key.includes("freezer")) c[t.party_id].genFreezer = true;
        }
      });
      setParties(partiesRes.data || []);
      setCounts(c);
      setLoaded(true);
    })();
  }, [unit.id, property.id]);

  const q = search.trim().toLowerCase();
  const filteredParties = q
    ? parties.filter(
        (p) =>
          (p.label || "").toLowerCase().includes(q) ||
          (p.full_name || "").toLowerCase().includes(q),
      )
    : parties;

  if (picked) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
          <button
            onClick={() => setPicked(null)}
            className="p-2 -ml-2 rounded-full hover:bg-stone-100"
          >
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">
              {property.name} · {unit.label}
            </div>
            <div className="font-serif text-xl text-stone-900">
              {picked.label}
            </div>
          </div>
        </div>
        <div className="flex-1 px-5 py-6">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            What was assigned this week?
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Kitchen, master bath, vacuum living room"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none"
          />
          <p className="text-xs text-stone-500 mt-2 mb-6">
            Optional. Appears on the invoice.
          </p>
          <button
            onClick={() => onPick(picked, notes)}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform disabled:opacity-50"
          >
            Start cleaning {picked.label}
          </button>
        </div>
      </div>
    );
  }

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
            {property.name} · {unit.label}
          </div>
          <div className="font-serif text-xl text-stone-900">
            Whose portion?
          </div>
        </div>
      </div>
      {/* Search box when there are more than 2 parties — saves scrolling */}
      {parties.length > 2 && (
        <div className="px-5 pt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${parties.length} ${parties.length === 1 ? "bedroom" : "bedrooms"}…`}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
          />
        </div>
      )}
      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {!loaded ? (
          <Splash text="Loading…" />
        ) : parties.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No parties configured for this unit yet.
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No bedrooms match "{search}".
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sort bedrooms-with-open-work to the top so the cleaner
               sees what needs cleaning first. Within each bucket keep
               the original (label/sort_order) order. */}
            {filteredParties
              .slice()
              .sort((a, b) => {
                const aHas = (counts[a.id]?.total || 0) > 0 ? 1 : 0;
                const bHas = (counts[b.id]?.total || 0) > 0 ? 1 : 0;
                return bHas - aHas;
              })
              .map((p) => {
                const c = counts[p.id];
                const total = c?.total || 0;
                // Section chips with subsection-based colors:
                //   BR / Vanity        → neutral stone
                //   Bathroom           → red (tub) / blue (toilet) / neutral
                //   General            → red (stove or oven) / orange (fridge) / neutral
                const sectionChips = [];
                if (c) {
                  if (c.bedroom)
                    sectionChips.push({
                      label: `BR (${c.bedroom})`,
                      cls: "bg-stone-100 text-stone-600 border-stone-200",
                    });
                  if (c.vanity)
                    sectionChips.push({
                      label: `Vanity (${c.vanity})`,
                      cls: "bg-stone-100 text-stone-600 border-stone-200",
                    });
                  if (c.bathroom) {
                    const cls = c.bathTub
                      ? "bg-red-100 text-red-700 border-red-300"
                      : c.bathToilet
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-stone-100 text-stone-600 border-stone-200";
                    sectionChips.push({
                      label: `Bathroom (${c.bathroom})`,
                      cls,
                    });
                  }
                  if (c.general) {
                    const cls = c.genHot
                      ? "bg-red-100 text-red-700 border-red-300"
                      : c.genFridge || c.genFreezer
                        ? "bg-orange-100 text-orange-700 border-orange-300"
                        : "bg-stone-100 text-stone-600 border-stone-200";
                    sectionChips.push({ label: `General (${c.general})`, cls });
                  }
                }
                return (
                  <button
                    key={p.id}
                    onClick={() => setPicked(p)}
                    disabled={busy}
                    className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-serif text-lg text-stone-900">
                            {p.label}
                          </span>
                          {total > 0 && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold flex items-center gap-1">
                              <FileText size={10} /> {total} to clean
                            </span>
                          )}
                        </div>
                        {p.full_name && (
                          <div className="text-sm text-stone-600">
                            {p.full_name}
                          </div>
                        )}
                        {sectionChips.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sectionChips.map((chip, i) => (
                              <span
                                key={i}
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${chip.cls}`}
                              >
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.notes && (
                          <div className="text-xs text-stone-500 mt-1 italic line-clamp-1">
                            {p.notes}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-stone-400 flex-shrink-0 mt-1"
                      />
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
