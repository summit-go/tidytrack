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

export function SectionPicker({
  property,
  unit,
  party,
  onStart,
  onJoin,
  onBack,
  busy,
}) {
  // Per-section state at THIS bedroom. countsBySec is built from
  // assignment_targets (how much work in each section). openBySec is
  // the open workblocks keyed by main_section (so we know who's
  // already there). Both load in parallel for speed.
  const [countsBySec, setCountsBySec] = useState({
    bedroom: 0,
    vanity: 0,
    bathroom: 0,
    general: 0,
  });
  const [openBySec, setOpenBySec] = useState({}); // section → { id, employeeName }
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const [targetsRes, blocksRes] = await Promise.all([
        supabase
          .from("assignment_targets")
          .select(
            "template_section, assignment:assignments!inner(customer_id, active, source, pm_status, deleted_at)",
          )
          .eq("unit_id", unit.id)
          .eq("party_id", party.id)
          .not("status", "in", "(done,blocked)"),
        supabase
          .from("work_blocks")
          .select(
            "id, main_section, shift:shifts!inner(customer_id, employee:employees(id, name))",
          )
          .eq("unit_id", unit.id)
          .eq("party_id", party.id)
          .is("end_time", null),
      ]);
      const c = { bedroom: 0, vanity: 0, bathroom: 0, general: 0 };
      (targetsRes.data || []).forEach((t) => {
        const a = t.assignment;
        if (!a || a.active === false) return;
        if (a.customer_id !== property.id) return;
        if (a.source === "pm" && a.pm_status !== "approved") return;
        const sec = (t.template_section || "").toLowerCase();
        if (sec in c) c[sec] += 1;
      });
      const o = {};
      (blocksRes.data || []).forEach((b) => {
        if (b.shift?.customer_id !== property.id) return;
        const sec = b.main_section || "bedroom"; // legacy null = treat as bedroom
        if (!o[sec])
          o[sec] = { id: b.id, employeeName: b.shift?.employee?.name || "?" };
      });
      setCountsBySec(c);
      setOpenBySec(o);
      setLoaded(true);
    })();
  }, [unit.id, party.id, property.id]);

  const SECTIONS = [
    {
      key: "bedroom",
      label: "Bedroom",
      desc: "Beds, dressers, closets, mirrors",
    },
    { key: "vanity", label: "Vanity", desc: "Sinks, counters, fixtures" },
    { key: "bathroom", label: "Bathroom", desc: "Tub, toilet, shower, floor" },
    {
      key: "general",
      label: "General",
      desc: "Living room, kitchen, common areas",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="bg-stone-900 text-stone-50 px-5 py-4">
        <button
          onClick={onBack}
          disabled={busy}
          className="text-xs uppercase tracking-wider font-mono text-stone-400 hover:text-stone-200 disabled:opacity-50 mb-2 flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="text-xs uppercase tracking-wider font-mono text-stone-400">
          {unit.label} · {party.label}
        </div>
        <div className="font-serif text-xl">Which section?</div>
        <div className="text-sm text-stone-400 mt-1">
          Pick what you'll work on. Other cleaners can handle the other sections
          in parallel.
        </div>
      </div>
      <div className="flex-1 px-5 py-4 overflow-y-auto">
        {!loaded ? (
          <Splash text="Loading…" />
        ) : (
          <div className="space-y-2">
            {SECTIONS.map((s) => {
              const n = countsBySec[s.key] || 0;
              const open = openBySec[s.key];
              const isEmpty = n === 0 && !open;
              // Three card states:
              //   open=true  → "X is here" + Join (claimed by another cleaner)
              //   n=0,no open → greyed out "No work here" (informational)
              //   else        → "Start" with item count
              return (
                <div
                  key={s.key}
                  className={`w-full rounded-2xl border-2 p-4 ${isEmpty ? "bg-stone-100 border-stone-200 opacity-60" : "bg-white border-stone-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-serif text-lg text-stone-900">
                          {s.label}
                        </span>
                        {n > 0 && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold">
                            {n} item{n === 1 ? "" : "s"}
                          </span>
                        )}
                        {open && (
                          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                            {open.employeeName} is here
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500">{s.desc}</div>
                    </div>
                    <div className="flex-shrink-0">
                      {open ? (
                        <button
                          onClick={() => onJoin(open.id)}
                          disabled={busy}
                          className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <Plus size={14} /> Join
                        </button>
                      ) : isEmpty ? (
                        <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                          No work here
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            onStart({ section: s.key, workNotes: notes })
                          }
                          disabled={busy}
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold active:scale-95 disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Work notes — applies to the new workblock if the cleaner
               chooses Start. Hidden until they tap to expand to keep the
               screen tight by default. */}
            <details className="mt-3">
              <summary className="text-xs font-mono uppercase tracking-wider text-stone-500 cursor-pointer hover:text-stone-700">
                Add notes (optional)
              </summary>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth noting about this session?"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                rows="2"
              />
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
