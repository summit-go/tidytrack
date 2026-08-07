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

export function SupplyChecklistGate({ employee, onDone, onSignOut }) {
  const [items, setItems] = useState(null); // null = still loading
  const [checked, setChecked] = useState({});
  const [name, setName] = useState(""); // blank — cleaner types their own name
  const [busy, setBusy] = useState(false);

  // Built-in fallback list. If the supply_checklist_items table is missing,
  // blocked (RLS), or empty, the gate uses THIS so the checklist ALWAYS
  // appears — it no longer depends on any SQL being run. Owner-managed items
  // from the table take over automatically once they exist.
  const DEFAULT_SUPPLY_ITEMS = [
    "all purpose",
    "brush pad",
    "dust pad",
    "floor cleaner",
    "gloves",
    "green scrub pad",
    "keys",
    "Lysol",
    "oven cleaner",
    "paper towel",
    "pumice stone",
    "rags",
    "soft scrub (white liquid)",
    "steel wool (metal scrubbing pad)",
    "Swiffer",
    "vacuum",
    "window cleaner",
    "wood stain",
  ].map((label, i) => ({ id: `default-${i}`, label }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("supply_checklist_items")
        .select("id, label")
        .eq("active", true);
      if (cancelled) return;
      // Table missing / blocked / empty → show the built-in list instead of
      // skipping. The checklist should never silently disappear.
      if (error || !data || data.length === 0) {
        if (error)
          console.warn("[supply] table load failed, using defaults", error);
        setItems(DEFAULT_SUPPLY_ITEMS);
        return;
      }
      const list = data
        .slice()
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
      setItems(list);
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line */
  }, []);

  if (items === null) return <Splash text="Loading…" />;

  const remaining = items.filter((it) => !checked[it.id]).length;
  const allChecked = remaining === 0;
  // Name is a SOFT check now — it must be typed (2+ chars), and we show
  // whether it matches the account name so spelling gets nudged, but a fuzzy
  // string match will NOT hard-block a real worker from starting their job
  // (that kept stranding people). matchWarn just drives a warning, not the gate.
  const norm = (s) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const onFile = norm(employee?.name);
  const typedNorm = norm(name);
  const nameTyped = name.trim().length >= 2;
  const nameMatches =
    !onFile ||
    (typedNorm.length > 0 &&
      (typedNorm === onFile ||
        onFile.split(" ").filter(Boolean).includes(typedNorm) ||
        typedNorm.split(" ").filter(Boolean).includes(onFile) ||
        onFile.includes(typedNorm) ||
        typedNorm.includes(onFile)));
  const canConfirm = allChecked && nameTyped && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    // Local same-day flag first — even if the DB write fails (RLS, offline,
    // missing column), a refresh today won't re-prompt. Keyed per employee.
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`supply_ok_${employee?.id}_${todayKey}`, "1");
    } catch {}
    try {
      const { error } = await supabase
        .from("supply_checklist_confirmations")
        .insert({
          employee_id: employee?.id || null,
          confirmed_name: name.trim(),
          confirmed_at: new Date().toISOString(),
        });
      if (error) console.warn("[supply] confirm save failed", error);
    } catch (e) {
      console.warn("[supply] confirm save failed", e);
    }
    setBusy(false);
    onDone();
  };

  // Show each item starting with a capital letter, whatever case it's stored in.
  const cap = (s) =>
    s && s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      {/* Non-dismissible: no X, backdrop click does nothing. */}
      <div className="bg-stone-50 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-stone-900 text-stone-50 px-5 py-4 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-mono">
            Before you start
          </div>
          <div className="font-serif text-xl mt-0.5">Supply checklist</div>
          <div className="text-xs text-stone-300 mt-0.5">
            Tick each item you have, then type your name to confirm.
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => {
                  const allOn =
                    items.length > 0 && items.every((it) => checked[it.id]);
                  if (allOn) {
                    setChecked({});
                  } else {
                    const next = {};
                    items.forEach((it) => {
                      next[it.id] = true;
                    });
                    setChecked(next);
                  }
                }}
                className="text-xs font-mono px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 active:scale-95 transition"
              >
                {items.length > 0 && items.every((it) => checked[it.id])
                  ? "Clear all"
                  : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((it) => {
                const on = !!checked[it.id];
                return (
                  <button
                    key={it.id}
                    onClick={() =>
                      setChecked((c) => ({ ...c, [it.id]: !c[it.id] }))
                    }
                    className={`w-full flex items-center gap-2.5 p-3 rounded-xl border-2 text-left active:scale-[0.99] transition ${on ? "bg-emerald-50 border-emerald-300" : "bg-white border-stone-200"}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 ${on ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-stone-300"}`}
                    >
                      {on && <Check size={13} />}
                    </span>
                    <span
                      className={`font-serif text-sm leading-tight ${on ? "text-emerald-900 line-through decoration-emerald-400" : "text-stone-900"}`}
                    >
                      {cap(it.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-stone-200 bg-white px-4 py-3 space-y-2.5">
            <div
              className={`text-xs font-mono text-center ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}
            >
              {remaining > 0
                ? `${remaining} item${remaining === 1 ? "" : "s"} left to check`
                : "All items checked ✓"}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name here"
              className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none text-stone-900 placeholder:text-stone-400 ${nameTyped && !nameMatches ? "border-amber-400 focus:border-amber-500" : nameTyped && nameMatches && onFile ? "border-emerald-400 focus:border-emerald-500" : "border-stone-300 focus:border-stone-900"}`}
            />
            {nameTyped && !nameMatches && onFile && (
              <div className="text-[11px] text-amber-700 text-center font-mono -mt-1">
                Heads up — this doesn't match your name on file
                {employee?.name ? ` (${employee.name})` : ""}. You can still
                continue.
              </div>
            )}
            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="w-full py-3.5 rounded-2xl bg-stone-900 text-stone-50 text-base font-bold disabled:opacity-40 active:scale-98 transition-transform"
            >
              {busy ? "Saving…" : "I have everything — continue"}
            </button>
            {!canConfirm && !busy && (
              <div className="text-[11px] text-stone-500 text-center font-mono">
                {!allChecked
                  ? `Check the last ${remaining} item${remaining === 1 ? "" : "s"} to continue`
                  : !nameTyped
                    ? "Type your name above to continue"
                    : ""}
              </div>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-full text-center text-xs text-stone-400 font-mono py-1"
              >
                Not you? Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
