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
} from "../../../../lib/supabase.js";
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
} from "../../../../lib/constants.js";
import {
  can,
  isOwner,
  isManager,
  canSeeMoney,
  visibleProps,
} from "../../../../lib/permissions.js";
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
} from "../../../../lib/format.js";
import {
  naturalCompare,
  buildingFromLabel,
  floorFromLabel,
  buildingKey,
  BUILDING_BLOCK_SIZE,
} from "../../../../lib/compare.js";
import {
  compressImage,
  photoFilename,
  buildZipBlob,
  canShareFiles,
} from "../../../../lib/photos.js";
import { sessionStore } from "../../../../lib/sessionStore.js";
import {
  SUPPORTED_TRANSLATE_LANGUAGES,
  TRANSLATION_ENABLED,
  TEXT_TRANSLATION_ENABLED,
  isTranslateConfigured,
  isTextTranslateConfigured,
  translateText,
  autoTranslateAssignment,
} from "../../../../lib/translation.js";
import { buildTargetTitle, unitSizeLabel, shortenBedroom } from "../../../../lib/labels.js";
import { splitTaskName } from "../../../../lib/tasks.js";
import { useAssignmentSync } from "../../../../hooks/useAssignmentSync.js";
import { useIdleDetector } from "../../../../hooks/useIdleDetector.js";
import { usePagePersistence } from "../../../../hooks/usePagePersistence.js";
import { useItemLabelOverrides } from "../../../../hooks/useItemLabelOverrides.js";
import { useTick } from "../../../../hooks/useTick.js";
import { useUnreadCount } from "../../../../hooks/useUnreadCount.js";
import { useAssignmentsForBedroomOnDate } from "../../../../hooks/useAssignmentsForBedroomOnDate.js";
import { useLocale, TranslationProvider } from "../../../../contexts/LocaleContext.jsx";
import { PreviewContext } from "../../../../contexts/PreviewContext.jsx";
import { AssignmentTypeChip } from "../../../../components/chips/AssignmentTypeChip.jsx";
import { PriorityChip } from "../../../../components/chips/PriorityChip.jsx";
import { Splash } from "../../../../components/Splash.jsx";
import { ScreenId } from "../../../../components/ScreenId.jsx";
import { OwnerOnly } from "../../../../components/OwnerOnly.jsx";
import { DueDateEditor } from "../../../../components/DueDateEditor.jsx";
import { ProgressBar } from "../../../../components/ProgressBar.jsx";
import { CleanerProgressBar } from "../../../../components/CleanerProgressBar.jsx";
import { ConfirmModal } from "../../../../components/ConfirmModal.jsx";
import { AddressLink } from "../../../../components/AddressLink.jsx";
import { TranslatableText } from "../../../../components/TranslatableText.jsx";
import { PhotoModal } from "../../../../components/PhotoModal.jsx";
import { NotificationBell } from "../../../../components/NotificationBell.jsx";
import { Header } from "../../../../components/Header.jsx";
import { TeamClockIcon } from "../../../../components/TeamClockIcon.jsx";
import { TabButton } from "../../../../components/TabButton.jsx";
import { PhotoZoomViewer } from "../../../../components/PhotoZoomViewer.jsx";
import { TranslateButton } from "../../../../components/TranslateButton.jsx";
import { ZoomableImage } from "../../../../components/ZoomableImage.jsx";
import { ItemsDropdown } from "../../cleaner/ItemsDropdown.jsx";
import { BedroomHistoryView } from "../daily/BedroomHistoryView.jsx";

export function CompletedAssignmentsView({ employee, propById }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState(14); // how far back
  const [drill, setDrill] = useState(null); // { propertyId, propertyName, unitId, unitLabel, partyId, partyLabel }

  const load = async () => {
    setLoaded(false);
    const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
    // Paginate to avoid PostgREST's 1000-row cap silently truncating.
    let all = [];
    let from = 0;
    const page = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("assignment_targets")
        .select(
          "id, status, completed_at, unit_id, party_id, unit:units(label), party:parties(label), assignment:assignments!inner(id, title, customer_id, assignment_type, source, deleted_at)",
        )
        .eq("status", "done")
        .not("completed_at", "is", null)
        .gte("completed_at", sinceISO)
        .order("completed_at", { ascending: false })
        .range(from, from + page - 1);
      if (error) {
        console.warn("[completed] load error", error);
        break;
      }
      all = all.concat(data || []);
      if (!data || data.length < page) break;
      from += page;
    }
    // Drop soft-deleted assignments and any preview/test properties.
    const clean = all.filter(
      (t) => !t.assignment?.deleted_at && propById[t.assignment?.customer_id],
    );
    // Collapse to one row per (assignment + unit + party) — a cleaning check
    // has many item-targets that all completed together; we don't want 25
    // rows for one bedroom. Key by assignment+unit+party, keep the latest
    // completed_at and the count of items.
    const byKey = {};
    clean.forEach((t) => {
      const key = `${t.assignment.id}:${t.unit_id}:${t.party_id}`;
      if (!byKey[key]) {
        byKey[key] = {
          key,
          assignmentId: t.assignment.id,
          customerId: t.assignment.customer_id,
          unitId: t.unit_id,
          partyId: t.party_id,
          unitLabel: t.unit?.label || "",
          partyLabel: t.party?.label || "",
          type: t.assignment.assignment_type || "",
          title: t.assignment.title || "",
          completedAt: t.completed_at,
          items: 0,
        };
      }
      byKey[key].items += 1;
      if (t.completed_at > byKey[key].completedAt)
        byKey[key].completedAt = t.completed_at;
    });
    const list = Object.values(byKey).sort((a, b) =>
      (b.completedAt || "").localeCompare(a.completedAt || ""),
    );
    setRows(list);
    setLoaded(true);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [days]);

  if (drill) {
    return (
      <BedroomHistoryView
        propertyId={drill.customerId}
        propertyName={propById[drill.customerId]?.name || "Property"}
        unitId={drill.unitId}
        unitLabel={drill.unitLabel}
        partyId={drill.partyId}
        partyLabel={drill.partyLabel}
        employee={employee}
        onBack={() => setDrill(null)}
      />
    );
  }

  // Group rows by day (local date) for headers like the cleaner's done view.
  const byDay = {};
  rows.forEach((r) => {
    const d = new Date(r.completedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (byDay[key] = byDay[key] || []).push(r);
  });
  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  const fmtDay = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - dt) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return dt.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  const typeLabel = (t) =>
    (QUICK_TYPES.find((q) => q.key === t) || {}).label || t || "Clean";

  return (
    <div>
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5">
        {[
          { v: 7, l: "7 days" },
          { v: 14, l: "14 days" },
          { v: 30, l: "30 days" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setDays(o.v)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${days === o.v ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {!loaded ? (
        <Splash text="Loading…" />
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          Nothing completed in the last {days} days.
        </div>
      ) : (
        <div className="space-y-6">
          {dayKeys.map((dk) => (
            <div key={dk}>
              <div className="text-xs uppercase tracking-wider text-emerald-700 font-mono mb-2 flex items-center gap-1.5">
                <Check size={11} /> {fmtDay(dk)}{" "}
                <span className="text-stone-400">· {byDay[dk].length}</span>
              </div>
              <div className="space-y-2">
                {byDay[dk].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setDrill(r)}
                    className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 active:scale-[0.99] transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-serif text-base text-stone-900 truncate">
                        <span className="font-bold">{r.unitLabel}</span>
                        {r.partyLabel ? (
                          <span className="text-stone-500">
                            {" "}
                            · {r.partyLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-stone-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {propById[r.customerId]?.name || "Property"}
                        </span>
                        <span>·</span>
                        <span>{typeLabel(r.type)}</span>
                        <span>·</span>
                        <span>
                          {r.items} item{r.items === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span>done {fmtTime(r.completedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-stone-400 flex-shrink-0"
                    />
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
